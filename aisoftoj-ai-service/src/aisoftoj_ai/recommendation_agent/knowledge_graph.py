import json
import logging
from typing import Any

logger = logging.getLogger("aisoftoj.recommendation.graph")

RELATION_TYPES = {"PREREQUISITE_OF", "RELATED_TO", "CONTAINS", "CONFUSED_WITH"}

GRAPH_SYSTEM_PROMPT = """
You are the knowledge-graph builder for a Chinese software-qualification exam practice platform.
Use wrong-question evidence and retrieved knowledge-base context to produce a compact graph.

Return strict JSON only, no markdown:
{
  "nodes": [
    {
      "id": "kp:<subject>:<name>",
      "name": "<knowledge name>",
      "type": "knowledge|related",
      "subject": "<subject>",
      "category": "<category>",
      "confidence": 0.0,
      "source": "wrong_question|knowledge_base|agent"
    }
  ],
  "edges": [
    {
      "source": "kp:<subject>:<name>",
      "target": "kp:<subject>:<name>",
      "type": "PREREQUISITE_OF|RELATED_TO|CONTAINS|CONFUSED_WITH",
      "label": "前置|关联|包含|易混淆",
      "weight": 0.0,
      "evidence": "<short reason grounded in the evidence/context>"
    }
  ]
}

Rules:
1. Keep the graph useful for study planning, not encyclopedic.
2. Prefer relations supported by the retrieved knowledge-base snippets.
3. If context is weak, use only conservative exam-domain relations and give lower confidence.
4. Do not create question nodes. The Java service already creates question evidence nodes.
5. Do not output isolated related nodes unless at least one edge connects them.
"""


async def build_knowledge_graph_relations(
    chat,
    search,
    recommendations: list[dict[str, Any]],
    evidences: list[dict[str, Any]],
    knowledge_base_ids: list[str],
    max_nodes: int = 48,
    max_edges: int = 80,
) -> dict[str, Any]:
    weak_points = _collect_weak_points(recommendations, evidences)[:12]
    contexts = await _retrieve_contexts(search, weak_points, knowledge_base_ids)
    prompt = _build_prompt(weak_points, evidences, contexts, max_nodes, max_edges)
    raw = await chat.complete(
        [
            {"role": "system", "content": GRAPH_SYSTEM_PROMPT.strip()},
            {"role": "user", "content": prompt},
        ],
        temperature=0.05,
    )
    parsed = _extract_json(raw)
    return _sanitize_graph(parsed, weak_points, max_nodes, max_edges)


async def _retrieve_contexts(search, weak_points: list[dict[str, Any]], knowledge_base_ids: list[str]) -> list[dict[str, Any]]:
    if not knowledge_base_ids:
        return []

    contexts: list[dict[str, Any]] = []
    seen: set[str] = set()
    for point in weak_points[:8]:
        name = str(point.get("name") or "").strip()
        subject = str(point.get("subject") or "").strip()
        if not name:
            continue
        query = f"{subject} {name} 前置知识 关联知识 易混淆 考点 学习路径".strip()
        try:
            results = await search.search(query, knowledge_base_ids, limit=3)
        except Exception:
            logger.exception("Knowledge graph retrieval failed for query: %s", query)
            continue
        for result in results:
            if result.id in seen:
                continue
            seen.add(result.id)
            contexts.append(
                {
                    "id": result.id,
                    "title": result.title,
                    "heading_path": result.heading_path,
                    "content": _truncate(result.content, 700),
                    "score": result.score,
                    "document_id": result.document_id,
                    "page": result.page,
                }
            )
    return contexts[:18]


def _build_prompt(
    weak_points: list[dict[str, Any]],
    evidences: list[dict[str, Any]],
    contexts: list[dict[str, Any]],
    max_nodes: int,
    max_edges: int,
) -> str:
    payload = {
        "weak_points": weak_points,
        "wrong_question_evidence": evidences[:40],
        "retrieved_knowledge_context": contexts,
        "limits": {"max_nodes": max_nodes, "max_edges": max_edges},
    }
    return (
        "请根据下面 JSON 构建错题知识图谱的知识点关系。\n"
        "重点回答：薄弱知识点需要哪些前置知识、和哪些考点关联、哪些概念容易混淆。\n"
        "只输出严格 JSON，不要解释。\n\n"
        + json.dumps(payload, ensure_ascii=False, default=str)
    )


def _collect_weak_points(
    recommendations: list[dict[str, Any]],
    evidences: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    points: dict[str, dict[str, Any]] = {}
    for item in recommendations:
        name = _text(item.get("name"))
        subject = _text(item.get("subject")) or "通用"
        if not name:
            continue
        point_id = _text(item.get("id")) or _node_id(subject, name)
        points[point_id] = {
            "id": point_id,
            "name": name,
            "subject": subject,
            "category": _text(item.get("category")) or name,
            "score": item.get("score"),
            "error_count": item.get("errorCount"),
            "wrong_question_count": item.get("wrongQuestionCount"),
        }
    for evidence in evidences:
        name = _text(evidence.get("knowledgePointName")) or _text(evidence.get("questionName"))
        subject = _text(evidence.get("subjectName")) or "通用"
        if not name:
            continue
        point_id = _node_id(subject, name)
        points.setdefault(
            point_id,
            {
                "id": point_id,
                "name": name,
                "subject": subject,
                "category": name,
                "score": None,
                "error_count": evidence.get("errorCount"),
                "wrong_question_count": 1,
            },
        )
    return list(points.values())


def _sanitize_graph(
    graph: dict[str, Any],
    weak_points: list[dict[str, Any]],
    max_nodes: int,
    max_edges: int,
) -> dict[str, Any]:
    nodes: dict[str, dict[str, Any]] = {}
    for point in weak_points:
        node_id = _text(point.get("id"))
        name = _text(point.get("name"))
        subject = _text(point.get("subject")) or "通用"
        if not node_id or not name:
            continue
        nodes[node_id] = {
            "id": node_id,
            "name": name,
            "type": "knowledge",
            "subject": subject,
            "category": _text(point.get("category")) or name,
            "confidence": 1.0,
            "source": "wrong_question",
        }

    for item in graph.get("nodes", []):
        if len(nodes) >= max_nodes:
            break
        name = _text(item.get("name") or item.get("label"))
        subject = _text(item.get("subject")) or "通用"
        node_id = _text(item.get("id")) or _node_id(subject, name)
        if not name or not node_id:
            continue
        nodes[node_id] = {
            "id": node_id,
            "name": name,
            "type": "knowledge" if node_id in nodes else "related",
            "subject": subject,
            "category": _text(item.get("category")) or name,
            "confidence": _clamp_float(item.get("confidence"), 0.0, 1.0, 0.6),
            "source": _text(item.get("source")) or "agent",
        }

    edges: list[dict[str, Any]] = []
    edge_keys: set[tuple[str, str, str]] = set()
    for item in graph.get("edges", []):
        if len(edges) >= max_edges:
            break
        source = _text(item.get("source"))
        target = _text(item.get("target"))
        rel_type = _text(item.get("type")).upper()
        if not source or not target or source == target or rel_type not in RELATION_TYPES:
            continue
        if source not in nodes or target not in nodes:
            continue
        key = (source, target, rel_type)
        if key in edge_keys:
            continue
        edge_keys.add(key)
        edges.append(
            {
                "source": source,
                "target": target,
                "type": rel_type,
                "label": _relation_label(rel_type, item.get("label")),
                "weight": _clamp_float(item.get("weight"), 0.05, 1.0, 0.55),
                "evidence": _truncate(_text(item.get("evidence")), 180),
            }
        )

    connected_ids = {edge["source"] for edge in edges} | {edge["target"] for edge in edges}
    kept_nodes = [
        node
        for node in nodes.values()
        if node["type"] == "knowledge" or node["id"] in connected_ids
    ]
    return {"nodes": kept_nodes[:max_nodes], "edges": edges}


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


def _relation_label(rel_type: str, candidate: Any) -> str:
    label = _text(candidate)
    if label:
        return label
    if rel_type == "PREREQUISITE_OF":
        return "前置"
    if rel_type == "CONTAINS":
        return "包含"
    if rel_type == "CONFUSED_WITH":
        return "易混淆"
    return "关联"


def _node_id(subject: str, name: str) -> str:
    return f"kp:{subject.strip() or '通用'}:{name.strip()}"


def _text(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip()


def _truncate(value: str, limit: int) -> str:
    if len(value) <= limit:
        return value
    return value[:limit].rstrip() + "..."


def _clamp_float(value: Any, minimum: float, maximum: float, fallback: float) -> float:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return fallback
    return max(minimum, min(maximum, number))
