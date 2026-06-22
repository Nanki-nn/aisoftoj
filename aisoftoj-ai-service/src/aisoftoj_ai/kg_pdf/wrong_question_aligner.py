import json
import logging
from typing import Any

logger = logging.getLogger("aisoftoj.kg_pdf.wrong_question_aligner")

ALIGNMENT_SYSTEM_PROMPT = """
你是软考刷题平台的知识点归因专家。
你的任务是：在已经从 PDF 结构化知识图谱中抽取出的候选知识点里，为每道错题选择最相关的知识点。

只返回严格 JSON，不要 Markdown：
{
  "alignments": [
    {
      "question_id": "123",
      "knowledge_point_id": "entity:...",
      "confidence": 0.0,
      "reason": "为什么这道题考查该知识点",
      "evidence_text": "题干/解析/候选知识点中的关键证据",
      "context_dependency": "question_text|analysis|heading_path|chunk_context"
    }
  ]
}

规则：
1. knowledge_point_id 必须来自候选知识点，不能编造。
2. 如果没有把握，不要输出该题的映射。
3. 只有当题干、选项、解析或候选知识点上下文能支撑判断时才输出。
4. 同名知识点出现在不同 heading_path 时，要根据题目语义和标题路径判断，不要只按名字匹配。
5. confidence 低于 0.55 的映射不要输出。
"""


async def align_wrong_questions_to_kg(
    chat,
    wrong_questions: list[dict[str, Any]],
    entity_nodes: list[dict[str, Any]],
    kg_extraction_chunks: list[dict[str, Any]],
    max_alignments: int = 120,
) -> dict[str, Any]:
    """Use LLM judgement to map wrong questions to extracted KG entities."""
    candidates = _build_candidates(entity_nodes, kg_extraction_chunks)
    questions = _build_questions(wrong_questions)
    if not chat or not candidates or not questions:
        return {"alignments": []}

    prompt = _build_prompt(questions, candidates, max_alignments)
    raw = await chat.complete(
        [
            {"role": "system", "content": ALIGNMENT_SYSTEM_PROMPT.strip()},
            {"role": "user", "content": prompt},
        ],
        temperature=0.02,
    )
    parsed = _extract_json(raw)
    return _sanitize_alignments(parsed, questions, candidates, max_alignments)


def _build_candidates(
    entity_nodes: list[dict[str, Any]],
    kg_extraction_chunks: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    chunks_by_id = {
        _text(chunk.get("kg_chunk_id")): chunk
        for chunk in kg_extraction_chunks
        if _text(chunk.get("kg_chunk_id"))
    }
    candidates: list[dict[str, Any]] = []
    seen: set[str] = set()
    for entity in entity_nodes:
        entity_id = _text(entity.get("entity_id"))
        name = _text(entity.get("canonical_name")) or _text(entity.get("name"))
        if not entity_id or not name or entity_id in seen:
            continue
        seen.add(entity_id)
        source_chunks = []
        for chunk_id in _string_list(entity.get("source_kg_chunk_ids"))[:3]:
            chunk = chunks_by_id.get(chunk_id)
            if not chunk:
                continue
            source_chunks.append(
                {
                    "kg_chunk_id": chunk_id,
                    "source_page_range": _text(chunk.get("source_page_range")),
                    "heading_path": _string_list(chunk.get("heading_path")),
                    "text": _truncate(_text(chunk.get("text")), 420),
                }
            )
        candidates.append(
            {
                "knowledge_point_id": entity_id,
                "name": name,
                "aliases": _string_list(entity.get("aliases")),
                "heading_path": _string_list(entity.get("heading_path")),
                "disambiguation_key": _text(entity.get("disambiguation_key")),
                "source_chunks": source_chunks,
            }
        )
    return candidates[:120]


def _build_questions(wrong_questions: list[dict[str, Any]]) -> list[dict[str, Any]]:
    questions: list[dict[str, Any]] = []
    seen: set[str] = set()
    for raw in wrong_questions:
        question_id = _text(raw.get("questionId") or raw.get("question_id"))
        if not question_id or question_id in seen:
            continue
        seen.add(question_id)
        questions.append(
            {
                "question_id": question_id,
                "question_name": _text(raw.get("questionName") or raw.get("question_name")),
                "known_legacy_point": _text(
                    raw.get("knowledgePointName") or raw.get("knowledge_point_name")
                ),
                "subject": _text(raw.get("subjectName") or raw.get("subject_name")),
                "paper": _text(raw.get("paperName") or raw.get("paper_name")),
                "question_type": _text(raw.get("questionType") or raw.get("question_type")),
                "question_intro": _truncate(
                    _text(raw.get("questionIntro") or raw.get("question_intro")),
                    900,
                ),
                "options": _truncate(_text(raw.get("options")), 600),
                "analysis": _truncate(_text(raw.get("analysis")), 900),
                "difficulty": raw.get("difficulty"),
                "error_count": raw.get("errorCount") or raw.get("error_count"),
            }
        )
    return questions[:60]


def _build_prompt(
    questions: list[dict[str, Any]],
    candidates: list[dict[str, Any]],
    max_alignments: int,
) -> str:
    payload = {
        "wrong_questions": questions,
        "candidate_knowledge_points": candidates,
        "limits": {"max_alignments": max_alignments},
    }
    return (
        "请逐题在 candidate_knowledge_points 中搜索和判断最匹配的知识点。\n"
        "输出时只保留有充分证据、confidence >= 0.55 的映射。\n"
        "不要因为旧知识点名称相同就直接匹配，必须结合题干、解析、标题路径和 chunk 上下文。\n\n"
        + json.dumps(payload, ensure_ascii=False, default=str)
    )


def _sanitize_alignments(
    parsed: dict[str, Any],
    questions: list[dict[str, Any]],
    candidates: list[dict[str, Any]],
    max_alignments: int,
) -> dict[str, Any]:
    question_ids = {_text(item.get("question_id")) for item in questions}
    candidate_ids = {_text(item.get("knowledge_point_id")) for item in candidates}
    alignments: list[dict[str, Any]] = []
    seen: set[tuple[str, str]] = set()
    for raw in parsed.get("alignments", []):
        question_id = _text(raw.get("question_id") or raw.get("questionId"))
        knowledge_point_id = _text(
            raw.get("knowledge_point_id")
            or raw.get("knowledgePointId")
            or raw.get("entity_id")
            or raw.get("entityId")
        )
        confidence = _clamp_float(raw.get("confidence"), 0.0, 1.0, 0.0)
        key = (question_id, knowledge_point_id)
        if (
            question_id not in question_ids
            or knowledge_point_id not in candidate_ids
            or confidence < 0.55
            or key in seen
        ):
            continue
        seen.add(key)
        alignments.append(
            {
                "question_id": question_id,
                "knowledge_point_id": knowledge_point_id,
                "confidence": confidence,
                "reason": _truncate(_text(raw.get("reason")), 220),
                "evidence_text": _truncate(
                    _text(raw.get("evidence_text") or raw.get("evidence")),
                    220,
                ),
                "context_dependency": _text(raw.get("context_dependency")) or "chunk_context",
                "mapping_method": "llm_semantic_alignment",
            }
        )
        if len(alignments) >= max_alignments:
            break
    return {"alignments": alignments}


def _extract_json(raw: str) -> dict[str, Any]:
    text = raw.strip()
    if text.startswith("```"):
        text = text.strip("`")
        if text.lower().startswith("json"):
            text = text[4:].strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        start = text.find("{")
        end = text.rfind("}")
        if start >= 0 and end > start:
            return json.loads(text[start : end + 1])
        raise


def _string_list(value: Any) -> list[str]:
    if isinstance(value, list):
        return [_text(item) for item in value if _text(item)]
    text = _text(value)
    return [text] if text else []


def _text(value: Any) -> str:
    return "" if value is None else str(value).strip()


def _truncate(value: str, limit: int) -> str:
    if len(value) <= limit:
        return value
    return value[:limit]


def _clamp_float(value: Any, minimum: float, maximum: float, default: float) -> float:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return default
    return max(minimum, min(maximum, number))
