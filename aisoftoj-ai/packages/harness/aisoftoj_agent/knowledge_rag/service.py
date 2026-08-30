from __future__ import annotations

import asyncio
import json
import logging
import re
from typing import Any, Protocol

from langchain_core.language_models import BaseChatModel
from langchain_core.messages import HumanMessage, SystemMessage
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from config import Settings

from ..persistence.repositories.knowledge_documents import KnowledgeDocumentRepository
from ..textbook_rag.embeddings import EmbeddingClient, EmbeddingError
from ..textbook_rag.qdrant import QdrantClient, QdrantError
from .bm25 import Bm25Encoder, Bm25Error
from .models import KnowledgeChunk, RetrievedKnowledgeChunk

logger = logging.getLogger(__name__)


class KnowledgeSearchService:
    def __init__(
        self,
        *,
        settings: Settings,
        session_factory: async_sessionmaker[AsyncSession],
        embedding_client: EmbeddingClient | None,
        bm25_encoder: Bm25Encoder | None,
        qdrant_client: QdrantClient | None,
        query_rewriter: QueryRewriter | None,
    ) -> None:
        self.settings = settings
        self.session_factory = session_factory
        self.embedding_client = embedding_client
        self.bm25_encoder = bm25_encoder
        self.qdrant_client = qdrant_client
        self.query_rewriter = query_rewriter

    async def search(self, query: str) -> dict[str, Any]:
        value = query.strip()
        if not self.settings.knowledge_rag_enabled:
            return _unavailable("feature_disabled")
        if (
            not value
            or self.embedding_client is None
            or self.bm25_encoder is None
            or self.qdrant_client is None
        ):
            return _unavailable("service_unavailable")
        async with self.session_factory() as session:
            active = await KnowledgeDocumentRepository(session).list_active()
        if not active:
            return {"status": "not_found", "sources": []}
        active_versions = {(item.id, item.index_version): item for item in active}
        queries = [value]
        if self.query_rewriter is not None:
            try:
                queries = await self.query_rewriter.rewrite(
                    value, limit=self.settings.knowledge_retrieval_query_variants
                )
            except QueryRewriteError:
                queries = [value]
        try:
            dense_vectors, sparse_vectors = await asyncio.gather(
                self.embedding_client.embed(queries), self.bm25_encoder.encode(queries)
            )
            if len(dense_vectors) != len(queries) or len(sparse_vectors) != len(queries):
                return _unavailable("retrieval_unavailable")
            records_by_query = await asyncio.gather(
                *(
                    self.qdrant_client.hybrid_search(
                        dense_vector=dense,
                        sparse_vector=sparse,
                        limit=self.settings.knowledge_retrieval_candidates * 3,
                    )
                    for dense, sparse in zip(dense_vectors, sparse_vectors, strict=True)
                )
            )
        except (EmbeddingError, Bm25Error, QdrantError, IndexError, ValueError):
            return _unavailable("retrieval_unavailable")
        candidates = _fuse_candidates(
            records_by_query,
            active_versions=active_versions,
            minimum_score=self.settings.knowledge_retrieval_min_score,
            fusion_k=self.settings.knowledge_retrieval_fusion_k,
            limit=self.settings.knowledge_retrieval_candidates,
        )
        if not candidates:
            return {"status": "not_found", "sources": []}
        return {
            "status": "found",
            "sources": [
                {
                    "documentId": item.chunk.document_id,
                    "title": active_versions[
                        (item.chunk.document_id, item.chunk.index_version)
                    ].title,
                    "headingPath": item.chunk.heading_path,
                    "ordinal": item.chunk.ordinal,
                    "pageStart": item.chunk.page_start,
                    "pageEnd": item.chunk.page_end,
                    "evidence": _evidence(item.chunk.text),
                    "score": round(item.score, 6),
                }
                for item in candidates
            ],
        }


def _to_retrieved(record: object) -> RetrievedKnowledgeChunk | None:
    if not isinstance(record, dict) or not isinstance(record.get("payload"), dict):
        return None
    payload = record["payload"]
    heading_path = payload.get("headingPath")
    if not isinstance(heading_path, list) or not all(
        isinstance(value, str) for value in heading_path
    ):
        return None
    try:
        chunk = KnowledgeChunk(
            chunk_id=str(record["id"]),
            document_id=str(payload["documentId"]),
            index_version=str(payload["indexVersion"]),
            title=str(payload["title"]),
            heading_path=heading_path,
            ordinal=int(payload["ordinal"]),
            text=str(payload["text"]),
            page_start=(
                int(payload["pageStart"]) if payload.get("pageStart") is not None else None
            ),
            page_end=(int(payload["pageEnd"]) if payload.get("pageEnd") is not None else None),
        )
        return RetrievedKnowledgeChunk(chunk=chunk, score=float(record["score"]))
    except (KeyError, TypeError, ValueError):
        return None


class QueryRewriteError(RuntimeError):
    pass


class QueryRewriter(Protocol):
    async def rewrite(self, query: str, *, limit: int) -> list[str]: ...


class LlmQueryRewriter:
    def __init__(self, model: BaseChatModel) -> None:
        self.model = model

    async def rewrite(self, query: str, *, limit: int) -> list[str]:
        if not query.strip() or limit < 1:
            return [query.strip()] if query.strip() else []
        try:
            response = await self.model.ainvoke(
                [
                    SystemMessage(
                        content=(
                            "你是知识库检索查询改写器。保持用户原意，只输出 JSON 字符串数组，"
                            "不要回答问题、不要解释。数组中给出最多指定数量的互补检索查询："
                            "保留关键术语、实体和限制条件，改写为适合教材语义检索的短句。"
                        )
                    ),
                    HumanMessage(
                        content=f"最多输出 {max(0, limit - 1)} 个改写查询。用户问题：{query}"
                    ),
                ]
            )
            content = _message_content(response.content)
            decoded = _decode_query_rewrites(content)
        except Exception as exc:
            logger.warning("event=knowledge_query_rewrite_failed")
            raise QueryRewriteError("QUERY_REWRITE_UNAVAILABLE") from exc
        variants = [query.strip()]
        for item in decoded:
            normalized = re.sub(r"\s+", " ", item).strip()
            if normalized and normalized not in variants:
                variants.append(normalized)
            if len(variants) >= limit:
                break
        return variants


def _message_content(content: object) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = [
            str(item.get("text"))
            for item in content
            if isinstance(item, dict) and isinstance(item.get("text"), str)
        ]
        return "".join(parts)
    raise TypeError("invalid rewrite response")


def _decode_query_rewrites(content: str) -> list[str]:
    match = re.search(r"\[[\s\S]*\]", content)
    if match is None:
        raise QueryRewriteError("invalid rewrite response")
    payload = json.loads(match.group(0))
    if not isinstance(payload, list) or not all(isinstance(item, str) for item in payload):
        raise QueryRewriteError("invalid rewrite response")
    return payload


def _fuse_candidates(
    records_by_query: list[list[dict[str, Any]]],
    *,
    active_versions: dict[tuple[str, str], Any],
    minimum_score: float,
    fusion_k: int,
    limit: int,
) -> list[RetrievedKnowledgeChunk]:
    fused: dict[str, tuple[RetrievedKnowledgeChunk, float]] = {}
    for query_index, records in enumerate(records_by_query):
        # The first query is the user's exact wording; derived queries are slightly
        # less trusted so an accidental expansion cannot dominate the result.
        weight = 1.0 if query_index == 0 else 0.85
        rank = 0
        for record in records:
            candidate = _to_retrieved(record)
            if candidate is None:
                continue
            if (
                candidate.chunk.document_id,
                candidate.chunk.index_version,
            ) not in active_versions or candidate.score < minimum_score:
                continue
            rank += 1
            contribution = weight / (fusion_k + rank)
            previous = fused.get(candidate.chunk.chunk_id)
            if previous is None:
                fused[candidate.chunk.chunk_id] = (candidate, contribution)
            else:
                fused[candidate.chunk.chunk_id] = (previous[0], previous[1] + contribution)
    ranked = sorted(fused.values(), key=lambda item: item[1], reverse=True)
    return [
        RetrievedKnowledgeChunk(chunk=candidate.chunk, score=score)
        for candidate, score in ranked[:limit]
    ]


def _evidence(text: str, limit: int = 500) -> str:
    value = " ".join(text.split())
    return value if len(value) <= limit else f"{value[:limit].rstrip()}..."


def _unavailable(reason: str) -> dict[str, object]:
    return {"status": "unavailable", "reason": reason, "sources": []}
