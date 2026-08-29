from __future__ import annotations

import logging
from collections import defaultdict
from datetime import UTC, datetime, timedelta
from typing import Any
from urllib.parse import urlsplit

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from config import Settings

from ..integrations.aisoftoj.client import PlatformClient, PlatformError
from ..integrations.aisoftoj.models import (
    KnowledgePoint,
    TextbookCatalog,
    TextbookSection,
)
from ..persistence.repositories.question_trace_cache import QuestionTraceCacheRepository
from ..persistence.repositories.textbook_indexes import TextbookIndexRepository
from .embeddings import EmbeddingClient, EmbeddingError
from .hashing import catalog_content_hash, question_content_hash, question_retrieval_text
from .models import RetrievedChunk
from .qdrant import QdrantClient, QdrantError
from .reranker import lexical_overlap, rerank

logger = logging.getLogger(__name__)


class TextbookTraceService:
    def __init__(
        self,
        *,
        settings: Settings,
        session_factory: async_sessionmaker[AsyncSession],
        platform_client: PlatformClient,
        embedding_client: EmbeddingClient | None,
        qdrant_client: QdrantClient | None,
    ) -> None:
        self.settings = settings
        self.session_factory = session_factory
        self.platform_client = platform_client
        self.embedding_client = embedding_client
        self.qdrant_client = qdrant_client

    async def trace(self, bearer_token: str, question_id: int) -> dict[str, Any]:
        if (
            not self.settings.textbook_rag_enabled
            or self.embedding_client is None
            or self.qdrant_client is None
        ):
            return _unavailable(question_id, "feature_disabled")
        question = await self.platform_client.get_textbook_trace_question(
            bearer_token, question_id
        )
        try:
            catalog = await self.platform_client.get_active_textbook_catalog(
                bearer_token, question.subject_name
            )
        except PlatformError as exc:
            if exc.code == "PLATFORM_NOT_FOUND":
                return _unavailable(question_id, "no_active_textbook")
            raise

        async with self.session_factory() as session:
            active_index = await TextbookIndexRepository(session).get_active(
                catalog.textbook_id
            )
        if active_index is None:
            return _unavailable(question_id, "index_not_ready")
        if (
            active_index.catalog_hash != catalog_content_hash(catalog)
            or active_index.retrieval_profile_version
            != self.settings.textbook_retrieval_profile_version
        ):
            return _unavailable(question_id, "reindex_required")

        content_hash = question_content_hash(question)
        async with self.session_factory() as session:
            cached = await QuestionTraceCacheRepository(session).get(
                question_id=question_id,
                question_content_hash=content_hash,
                textbook_id=catalog.textbook_id,
                index_version=active_index.index_version,
                retrieval_profile_version=self.settings.textbook_retrieval_profile_version,
            )
        if cached is not None:
            return _hydrate_result(
                cached.result_json, catalog, question_id=question_id, cache_status="hit"
            )

        query = question_retrieval_text(question)
        try:
            query_vector = (await self.embedding_client.embed([query]))[0]
            candidates = await self.qdrant_client.search(
                vector=query_vector,
                textbook_id=catalog.textbook_id,
                index_version=active_index.index_version,
                limit=self.settings.textbook_retrieval_candidates,
            )
        except (EmbeddingError, QdrantError, IndexError):
            return _unavailable(question_id, "retrieval_unavailable")

        valid_candidates = _validated_candidates(candidates, catalog, active_index.index_version)
        ranked = rerank(query, valid_candidates)
        result = _build_trace_result(
            ranked,
            catalog,
            active_index.index_version,
            query=query,
            minimum_score=self.settings.textbook_retrieval_min_score,
            source_limit=self.settings.textbook_retrieval_sources,
        )
        await self._cache_result(
            question_id=question_id,
            question_content_hash=content_hash,
            textbook_id=catalog.textbook_id,
            index_version=active_index.index_version,
            result=result,
        )
        return _hydrate_result(result, catalog, question_id=question_id, cache_status="miss")

    async def _cache_result(
        self,
        *,
        question_id: int,
        question_content_hash: str,
        textbook_id: int,
        index_version: str,
        result: dict[str, Any],
    ) -> None:
        primary = result.get("primaryKnowledgePoint")
        secondary = result.get("secondaryKnowledgePoints", [])
        sources = result.get("sources", [])
        expires_at = None
        if result.get("status") == "insufficient_evidence":
            expires_at = datetime.now(UTC).replace(tzinfo=None) + timedelta(
                seconds=self.settings.textbook_negative_cache_ttl_seconds
            )
        try:
            async with self.session_factory.begin() as session:
                await QuestionTraceCacheRepository(session).put(
                    question_id=question_id,
                    question_content_hash=question_content_hash,
                    textbook_id=textbook_id,
                    index_version=index_version,
                    retrieval_profile_version=self.settings.textbook_retrieval_profile_version,
                    status=str(result["status"]).upper(),
                    primary_knowledge_point_id=(
                        int(primary["id"]) if isinstance(primary, dict) else None
                    ),
                    secondary_knowledge_point_ids=[
                        int(item["id"]) for item in secondary if isinstance(item, dict)
                    ],
                    source_chunk_ids=[
                        str(item["chunkId"]) for item in sources if isinstance(item, dict)
                    ],
                    confidence=float(result.get("confidence", 0.0)),
                    result=result,
                    expires_at=expires_at,
                )
        except Exception as exc:
            # The cache is an optimization; a transient write failure must not discard
            # a retrieval result that already passed deterministic citation validation.
            logger.warning(
                "event=textbook_trace_cache_write_failed error_type=%s",
                type(exc).__name__,
            )


def _validated_candidates(
    candidates: list[RetrievedChunk], catalog: TextbookCatalog, index_version: str
) -> list[RetrievedChunk]:
    sections = {section.id: section for section in catalog.sections}
    paths = {section.id: _chapter_path(section, sections) for section in catalog.sections}
    result: list[RetrievedChunk] = []
    for candidate in candidates:
        chunk = candidate.chunk
        section = sections.get(chunk.section_id)
        if (
            section is None
            or chunk.textbook_id != catalog.textbook_id
            or chunk.index_version != index_version
            or chunk.chapter_path != paths[section.id]
            or not section.pdf_page_start <= chunk.pdf_page_start <= chunk.pdf_page_end
            or not chunk.pdf_page_start <= chunk.pdf_page_end <= section.pdf_page_end
            or not section.printed_page_start
            <= chunk.printed_page_start
            <= chunk.printed_page_end
            or not chunk.printed_page_start
            <= chunk.printed_page_end
            <= section.printed_page_end
            or not chunk.text.strip()
        ):
            continue
        result.append(candidate)
    return result


def _build_trace_result(
    ranked: list[RetrievedChunk],
    catalog: TextbookCatalog,
    index_version: str,
    *,
    query: str,
    minimum_score: float,
    source_limit: int,
) -> dict[str, Any]:
    eligible = [item for item in ranked if item.relevance_score >= minimum_score]
    point_scores: dict[int, float] = defaultdict(float)
    points_by_id = {point.id: point for point in catalog.knowledge_points}
    chunks_by_point: dict[int, set[str]] = defaultdict(set)
    for candidate in eligible:
        for point in catalog.knowledge_points:
            matched_sources = [
                source
                for source in point.sources
                if source.section_id == candidate.chunk.section_id
                and source.pdf_page_start <= candidate.chunk.pdf_page_end
                and candidate.chunk.pdf_page_start <= source.pdf_page_end
            ]
            if not matched_sources:
                continue
            primary_bonus = 0.03 if any(source.primary for source in matched_sources) else 0.0
            point_text = f"{point.name} {point.description or ''}"
            semantic_bonus = lexical_overlap(query, point_text) * 0.08
            point_scores[point.id] = max(
                point_scores[point.id],
                min(1.0, candidate.relevance_score + primary_bonus + semantic_bonus),
            )
            chunks_by_point[point.id].add(candidate.chunk.chunk_id)

    if not eligible or not point_scores:
        return {
            "status": "insufficient_evidence",
            "confidence": 0.0,
            "primaryKnowledgePoint": None,
            "secondaryKnowledgePoints": [],
            "sources": [],
            "indexVersion": index_version,
        }

    ordered_points = sorted(point_scores, key=lambda point_id: (-point_scores[point_id], point_id))
    primary_id = ordered_points[0]
    primary_score = point_scores[primary_id]
    secondary_ids = [
        point_id
        for point_id in ordered_points[1:]
        if point_scores[point_id] >= max(minimum_score, primary_score - 0.12)
    ][:3]
    selected_chunk_ids = set().union(
        *(chunks_by_point[point_id] for point_id in [primary_id, *secondary_ids])
    )
    selected_sources = [
        _source_payload(candidate, catalog)
        for candidate in eligible
        if candidate.chunk.chunk_id in selected_chunk_ids
    ][:source_limit]
    if not selected_sources:
        return {
            "status": "insufficient_evidence",
            "confidence": 0.0,
            "primaryKnowledgePoint": None,
            "secondaryKnowledgePoints": [],
            "sources": [],
            "indexVersion": index_version,
        }
    return {
        "status": "found",
        "confidence": round(primary_score, 6),
        "primaryKnowledgePoint": _point_payload(points_by_id[primary_id]),
        "secondaryKnowledgePoints": [
            _point_payload(points_by_id[point_id]) for point_id in secondary_ids
        ],
        "sources": selected_sources,
        "indexVersion": index_version,
    }


def _point_payload(point: KnowledgePoint) -> dict[str, Any]:
    return {"id": point.id, "code": point.code, "name": point.name}


def _source_payload(candidate: RetrievedChunk, catalog: TextbookCatalog) -> dict[str, Any]:
    chunk = candidate.chunk
    return {
        "chunkId": chunk.chunk_id,
        "textbookId": catalog.textbook_id,
        "textbookName": catalog.name,
        "edition": catalog.edition,
        "sectionId": chunk.section_id,
        "chapterPath": chunk.chapter_path,
        "printedPageStart": chunk.printed_page_start,
        "printedPageEnd": chunk.printed_page_end,
        "pdfPageStart": chunk.pdf_page_start,
        "pdfPageEnd": chunk.pdf_page_end,
        "evidence": _evidence(chunk.text),
        "relevanceScore": candidate.relevance_score,
    }


def _hydrate_result(
    cached_result: dict[str, Any],
    catalog: TextbookCatalog,
    *,
    question_id: int,
    cache_status: str,
) -> dict[str, Any]:
    official_url = str(catalog.official_url)
    sources = []
    for raw in cached_result.get("sources", []):
        if not isinstance(raw, dict):
            continue
        pdf_page = raw.get("pdfPageStart")
        sources.append(
            {
                **raw,
                "textbookName": catalog.name,
                "edition": catalog.edition,
                "officialUrl": official_url,
                "viewerUrl": _viewer_url(catalog.viewer_page_template, pdf_page),
            }
        )
    return {
        **cached_result,
        "questionId": question_id,
        "cacheStatus": cache_status,
        "sources": sources,
    }


def _viewer_url(template: str | None, pdf_page: object) -> str | None:
    if not template or "{pdfPage}" not in template or not isinstance(pdf_page, int):
        return None
    value = template.replace("{pdfPage}", str(pdf_page))
    parsed = urlsplit(value)
    return value if parsed.scheme == "https" and parsed.hostname else None


def _chapter_path(
    section: TextbookSection, sections: dict[int, TextbookSection]
) -> list[str]:
    result: list[str] = []
    current: TextbookSection | None = section
    visited: set[int] = set()
    while current is not None:
        if current.id in visited:
            return []
        visited.add(current.id)
        result.append(f"{current.section_code} {current.title}".strip())
        current = sections.get(current.parent_id) if current.parent_id is not None else None
    return list(reversed(result))


def _evidence(text: str, limit: int = 320) -> str:
    compact = " ".join(text.split())
    if len(compact) <= limit:
        return compact
    return f"{compact[:limit].rstrip()}…"


def _unavailable(question_id: int, reason: str) -> dict[str, Any]:
    return {
        "status": "unavailable",
        "reason": reason,
        "questionId": question_id,
        "cacheStatus": "bypass",
        "primaryKnowledgePoint": None,
        "secondaryKnowledgePoints": [],
        "sources": [],
    }
