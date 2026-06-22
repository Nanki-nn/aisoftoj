import asyncio
import hashlib
import json
import logging
import re
import unicodedata
from typing import Any

from aisoftoj_ai.kg_pdf.kg_structure_builder import flatten_heading_nodes, heading_lookup
from aisoftoj_ai.kg_pdf.models import (
    KgDocumentStructure,
    KgEntityNode,
    KgEvidenceRelation,
    KgExtractionChunk,
)

KG_RELATION_EXTRACTION_SYSTEM_PROMPT = """
你是结构感知的 PDF 知识图谱实体关系抽取器。
只能依据输入正文和结构上下文抽取，返回严格 JSON，不要输出 Markdown。

输出 schema:
{
  "entities": [
    {
      "name": "实体规范候选名",
      "aliases": ["别名"],
      "evidence_text": "当前正文中的短证据",
      "context_dependency": "explicit|heading_context|cross_chunk_context",
      "confidence": 0.0
    }
  ],
  "relations": [
    {
      "subject": "实体名",
      "predicate": "关系",
      "object": "实体名",
      "evidence_text": "当前正文中的短证据",
      "context_dependency": "explicit|heading_context|cross_chunk_context",
      "confidence": 0.0
    }
  ]
}

要求:
1. 区分显式正文关系、依赖标题上下文关系、跨 chunk 上下文关系。
2. 不要把标题当作正文证据，但可以作为 heading_context 依赖。
3. 每条业务关系必须有当前 chunk 证据；不确定就降低 confidence。
4. 优先抽取软考/软件工程/项目管理等领域概念。
"""

logger = logging.getLogger("aisoftoj.kg_pdf.relation_extractor")
DEFAULT_EXTRACTION_CONCURRENCY = 8
DEFAULT_CHUNK_TIMEOUT_SECONDS = 45.0


def build_kg_relation_prompt(document_title: str, chunk: KgExtractionChunk) -> str:
    return (
        f"文档标题：{document_title}\n"
        f"标题路径：{' > '.join(chunk.heading_path)}\n"
        f"所属结构节点：{chunk.parent_heading_id}\n"
        f"页码范围：{chunk.source_page_range}\n"
        f"上一个抽取单元摘要：{chunk.previous_context_summary}\n"
        f"当前抽取单元正文：\n{chunk.text}\n"
        f"下一个抽取单元摘要：{chunk.next_context_summary}\n"
    )


async def extract_kg_relations(
    chat,
    structure: KgDocumentStructure,
    chunks: list[KgExtractionChunk],
    max_chunks: int = 72,
    concurrency: int = DEFAULT_EXTRACTION_CONCURRENCY,
    chunk_timeout_seconds: float = DEFAULT_CHUNK_TIMEOUT_SECONDS,
) -> tuple[list[KgEntityNode], list[KgEvidenceRelation]]:
    structure_relations = build_structure_relations(structure, chunks)
    selected_chunks = chunks[: max(1, max_chunks)]

    if chat is None:
        extracted = [(chunk, _heuristic_extract(chunk)) for chunk in selected_chunks]
    else:
        semaphore = asyncio.Semaphore(max(1, concurrency))

        async def extract_one(
            index: int,
            chunk: KgExtractionChunk,
        ) -> tuple[int, KgExtractionChunk, dict[str, Any]]:
            async with semaphore:
                try:
                    raw = await asyncio.wait_for(
                        chat.complete(
                            [
                                {
                                    "role": "system",
                                    "content": KG_RELATION_EXTRACTION_SYSTEM_PROMPT.strip(),
                                },
                                {
                                    "role": "user",
                                    "content": build_kg_relation_prompt(structure.title, chunk),
                                },
                            ],
                            temperature=0.05,
                        ),
                        timeout=max(0.01, chunk_timeout_seconds),
                    )
                    parsed = _extract_json(raw)
                except Exception as exc:
                    logger.warning(
                        "KG LLM extraction failed for chunk %s; using heuristic fallback: %s",
                        chunk.kg_chunk_id,
                        exc,
                    )
                    parsed = _heuristic_extract(chunk)
                return index, chunk, parsed

        completed = await asyncio.gather(
            *(extract_one(index, chunk) for index, chunk in enumerate(selected_chunks))
        )
        completed.sort(key=lambda item: item[0])
        extracted = [(chunk, parsed) for _, chunk, parsed in completed]

    entities, business_relations = _normalize_extraction(extracted)
    entity_relations = _entity_context_relations(entities, chunks)
    return entities, [*structure_relations, *entity_relations, *business_relations]


def build_structure_relations(
    structure: KgDocumentStructure,
    chunks: list[KgExtractionChunk],
) -> list[KgEvidenceRelation]:
    nodes = flatten_heading_nodes(structure.nodes)
    relations: list[KgEvidenceRelation] = []
    document_node_id = f"document:{structure.document_id}"

    for node in nodes:
        if node.parent_id:
            parent = next(
                (candidate for candidate in nodes if candidate.node_id == node.parent_id),
                None,
            )
            predicate = _child_predicate(parent.type if parent else "document", node.type)
            subject = node.parent_id
        else:
            predicate = "has_chapter" if node.type == "chapter" else "has_section"
            subject = document_node_id
        relations.append(
            KgEvidenceRelation(
                subject=subject,
                predicate=predicate,
                object=node.node_id,
                evidence_text=node.title,
                source_page_range=_node_page_range(node.page_start, node.page_end),
                heading_path=[node.title],
                context_dependency="structural",
                confidence=1.0,
                relation_category="structure",
            )
        )

    node_map = heading_lookup(structure)
    for chunk in chunks:
        heading = node_map.get(chunk.parent_heading_id)
        if heading:
            relations.append(
                KgEvidenceRelation(
                    subject=heading.node_id,
                    predicate="has_chunk",
                    object=chunk.kg_chunk_id,
                    evidence_text=_truncate(chunk.text, 160),
                    source_kg_chunk_id=chunk.kg_chunk_id,
                    source_page_range=chunk.source_page_range,
                    heading_path=chunk.heading_path,
                    context_dependency="structural",
                    confidence=1.0,
                    relation_category="structure",
                )
            )
        relations.append(
            KgEvidenceRelation(
                subject=chunk.kg_chunk_id,
                predicate="under_heading",
                object=chunk.parent_heading_id,
                evidence_text="chunk heading binding",
                source_kg_chunk_id=chunk.kg_chunk_id,
                source_page_range=chunk.source_page_range,
                heading_path=chunk.heading_path,
                context_dependency="structural",
                confidence=1.0,
                relation_category="structure",
            )
        )
        for page in _pages(chunk.page_start, chunk.page_end):
            relations.append(
                KgEvidenceRelation(
                    subject=chunk.kg_chunk_id,
                    predicate="on_page",
                    object=f"page:{page}",
                    evidence_text=f"page {page}",
                    source_kg_chunk_id=chunk.kg_chunk_id,
                    source_page_range=chunk.source_page_range,
                    heading_path=chunk.heading_path,
                    context_dependency="structural",
                    confidence=1.0,
                    relation_category="structure",
                )
            )
    return relations


def _normalize_extraction(
    extracted: list[tuple[KgExtractionChunk, dict[str, Any]]],
) -> tuple[list[KgEntityNode], list[KgEvidenceRelation]]:
    entities_by_key: dict[str, KgEntityNode] = {}
    name_index: dict[tuple[str, str], str] = {}
    relations: list[KgEvidenceRelation] = []

    def ensure_entity(
        name: str,
        chunk: KgExtractionChunk,
        aliases: list[str] | None = None,
    ) -> KgEntityNode:
        canonical = _clean_name(name)
        scope = " > ".join(chunk.heading_path)
        key = f"{_normalize_key(canonical)}|{_normalize_key(scope)}"
        if key not in entities_by_key:
            scope_hash = hashlib.sha1(scope.encode()).hexdigest()[:8]
            entity_id = f"entity:{_normalize_key(canonical) or 'unknown'}:{scope_hash}"
            entities_by_key[key] = KgEntityNode(
                entity_id=entity_id,
                name=canonical,
                canonical_name=canonical,
                aliases=[],
                heading_path=list(chunk.heading_path),
                disambiguation_key=key,
                source_kg_chunk_ids=[],
            )
            name_index[(_normalize_key(canonical), scope)] = entity_id
        entity = entities_by_key[key]
        if chunk.kg_chunk_id not in entity.source_kg_chunk_ids:
            entity.source_kg_chunk_ids.append(chunk.kg_chunk_id)
        for alias in aliases or []:
            clean_alias = _clean_name(alias)
            if (
                clean_alias
                and clean_alias != entity.canonical_name
                and clean_alias not in entity.aliases
            ):
                entity.aliases.append(clean_alias)
        return entity

    for chunk, parsed in extracted:
        for item in parsed.get("entities", []):
            name = _clean_name(item.get("name"))
            if name:
                ensure_entity(name, chunk, _list(item.get("aliases")))

        for item in parsed.get("relations", []):
            subject_name = _clean_name(item.get("subject"))
            object_name = _clean_name(item.get("object"))
            predicate = _clean_predicate(item.get("predicate"))
            if not subject_name or not object_name or not predicate:
                continue
            subject = ensure_entity(subject_name, chunk)
            obj = ensure_entity(object_name, chunk)
            dependency = _dependency(item.get("context_dependency"))
            relation_id = _relation_id(
                subject.entity_id,
                predicate,
                obj.entity_id,
                chunk.kg_chunk_id,
            )
            evidence = _truncate(str(item.get("evidence_text") or ""), 240)
            confidence = _confidence(item.get("confidence"), 0.65)
            relations.append(
                KgEvidenceRelation(
                    subject=subject.entity_id,
                    predicate=predicate,
                    object=obj.entity_id,
                    evidence_text=evidence,
                    source_kg_chunk_id=chunk.kg_chunk_id,
                    source_page_range=chunk.source_page_range,
                    heading_path=chunk.heading_path,
                    context_dependency=dependency,
                    confidence=confidence,
                    relation_category="business",
                )
            )
            relations.append(
                KgEvidenceRelation(
                    subject=relation_id,
                    predicate="supported_by",
                    object=chunk.kg_chunk_id,
                    evidence_text=evidence,
                    source_kg_chunk_id=chunk.kg_chunk_id,
                    source_page_range=chunk.source_page_range,
                    heading_path=chunk.heading_path,
                    context_dependency=dependency,
                    confidence=confidence,
                    relation_category="business",
                )
            )

    alias_relations: list[KgEvidenceRelation] = []
    chunk_by_id = {chunk.kg_chunk_id: chunk for chunk, _ in extracted}
    for entity in entities_by_key.values():
        source_chunk = (
            chunk_by_id.get(entity.source_kg_chunk_ids[0])
            if entity.source_kg_chunk_ids
            else None
        )
        for alias in entity.aliases:
            alias_relations.append(
                KgEvidenceRelation(
                    subject=f"alias:{_normalize_key(alias)}",
                    predicate="alias_of",
                    object=entity.entity_id,
                    evidence_text=alias,
                    source_kg_chunk_id=source_chunk.kg_chunk_id if source_chunk else "",
                    source_page_range=source_chunk.source_page_range if source_chunk else "",
                    heading_path=entity.heading_path,
                    context_dependency="explicit",
                    confidence=0.9,
                    relation_category="entity_resolution",
                )
            )
    return list(entities_by_key.values()), [*relations, *alias_relations]


def _entity_context_relations(
    entities: list[KgEntityNode],
    chunks: list[KgExtractionChunk],
) -> list[KgEvidenceRelation]:
    chunk_by_id = {chunk.kg_chunk_id: chunk for chunk in chunks}
    relations: list[KgEvidenceRelation] = []
    seen: set[tuple[str, str, str]] = set()
    for entity in entities:
        for chunk_id in entity.source_kg_chunk_ids:
            chunk = chunk_by_id.get(chunk_id)
            if not chunk:
                continue
            for predicate, obj in [
                ("mentioned_in", chunk.kg_chunk_id),
                ("under_heading", chunk.parent_heading_id),
            ]:
                needs_heading_context = (
                    predicate == "under_heading" or entity.canonical_name not in chunk.text
                )
                key = (entity.entity_id, predicate, obj)
                if key in seen:
                    continue
                seen.add(key)
                relations.append(
                    KgEvidenceRelation(
                        subject=entity.entity_id,
                        predicate=predicate,
                        object=obj,
                        evidence_text=entity.canonical_name,
                        source_kg_chunk_id=chunk.kg_chunk_id,
                        source_page_range=chunk.source_page_range,
                        heading_path=chunk.heading_path,
                        context_dependency="heading_context"
                        if needs_heading_context
                        else "explicit",
                        confidence=1.0,
                        relation_category="business",
                    )
                )
    return relations


def _heuristic_extract(chunk: KgExtractionChunk) -> dict[str, Any]:
    """Small deterministic fallback used by tests and offline examples."""
    candidates = []
    for term in ["风险识别", "风险分析", "风险应对", "风险监控", "风险管理"]:
        if term in chunk.text or term in " ".join(chunk.heading_path):
            candidates.append(term)
    entities = [
        {
            "name": name,
            "aliases": [],
            "evidence_text": name if name in chunk.text else "标题路径",
            "context_dependency": "explicit" if name in chunk.text else "heading_context",
            "confidence": 0.86,
        }
        for name in candidates
    ]
    relations = []
    if "风险识别" in candidates and "风险应对" in candidates:
        relations.append(
            {
                "subject": "风险识别",
                "predicate": "支持",
                "object": "风险应对",
                "evidence_text": _truncate(chunk.text, 160),
                "context_dependency": "explicit",
                "confidence": 0.8,
            }
        )
    heading = chunk.heading_path[-1] if chunk.heading_path else ""
    for name in candidates:
        if heading and heading != name:
            relations.append(
                {
                    "subject": name,
                    "predicate": "属于主题",
                    "object": heading,
                    "evidence_text": heading,
                    "context_dependency": "heading_context",
                    "confidence": 0.82,
                }
            )
    return {"entities": entities, "relations": relations}


def _child_predicate(parent_type: str, child_type: str) -> str:
    if parent_type == "document" and child_type == "chapter":
        return "has_chapter"
    if child_type == "section":
        return "has_section"
    if child_type == "subsection":
        return "has_subsection"
    return "has_section"


def _pages(start: int | None, end: int | None) -> list[int]:
    if start is None and end is None:
        return []
    if start is None:
        return [end] if end is not None else []
    if end is None:
        return [start]
    return list(range(start, end + 1))


def _node_page_range(start: int | None, end: int | None) -> str:
    if start is None and end is None:
        return ""
    if start == end or end is None:
        return str(start)
    if start is None:
        return str(end)
    return f"{start}-{end}"


def _relation_id(subject: str, predicate: str, obj: str, chunk_id: str) -> str:
    digest = hashlib.sha1(f"{subject}|{predicate}|{obj}|{chunk_id}".encode()).hexdigest()[:16]
    return f"relation:{digest}"


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


def _clean_name(value: Any) -> str:
    text = unicodedata.normalize("NFKC", str(value or "")).strip()
    text = re.sub(r"\s+", "", text)
    return text.strip(" ,.;:，。；：、()（）[]【】")


def _clean_predicate(value: Any) -> str:
    text = str(value or "").strip()
    text = re.sub(r"\s+", "_", text)
    return text[:40]


def _normalize_key(value: Any) -> str:
    text = _clean_name(value).lower()
    text = re.sub(r"[^\u4e00-\u9fffa-z0-9]+", "_", text)
    return text.strip("_")


def _dependency(value: Any) -> str:
    text = str(value or "").strip()
    if text in {"explicit", "heading_context", "cross_chunk_context"}:
        return text
    return "explicit"


def _confidence(value: Any, fallback: float) -> float:
    try:
        return max(0.0, min(1.0, float(value)))
    except (TypeError, ValueError):
        return fallback


def _list(value: Any) -> list[str]:
    if isinstance(value, list):
        return [str(item) for item in value if item]
    if value:
        return [str(value)]
    return []


def _truncate(value: str, limit: int) -> str:
    if len(value) <= limit:
        return value
    return value[:limit].rstrip() + "..."
