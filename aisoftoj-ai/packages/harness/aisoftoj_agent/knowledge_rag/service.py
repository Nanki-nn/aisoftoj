from __future__ import annotations

import asyncio
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from config import Settings

from ..persistence.repositories.knowledge_documents import KnowledgeDocumentRepository
from ..textbook_rag.embeddings import EmbeddingClient, EmbeddingError
from ..textbook_rag.qdrant import QdrantClient, QdrantError
from .bm25 import Bm25Encoder, Bm25Error
from .models import KnowledgeChunk, RetrievedKnowledgeChunk


class KnowledgeSearchService:
    def __init__(
        self,
        *,
        settings: Settings,
        session_factory: async_sessionmaker[AsyncSession],
        embedding_client: EmbeddingClient | None,
        bm25_encoder: Bm25Encoder | None,
        qdrant_client: QdrantClient | None,
    ) -> None:
        self.settings = settings
        self.session_factory = session_factory
        self.embedding_client = embedding_client
        self.bm25_encoder = bm25_encoder
        self.qdrant_client = qdrant_client

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
        try:
            dense, sparse = await asyncio.gather(
                self.embedding_client.embed([value]), self.bm25_encoder.encode([value])
            )
            records = await self.qdrant_client.hybrid_search(
                dense_vector=dense[0],
                sparse_vector=sparse[0],
                limit=self.settings.knowledge_retrieval_candidates * 3,
            )
        except (EmbeddingError, Bm25Error, QdrantError, IndexError):
            return _unavailable("retrieval_unavailable")
        candidates = [
            candidate
            for candidate in (_to_retrieved(item) for item in records)
            if candidate is not None
            and (candidate.chunk.document_id, candidate.chunk.index_version) in active_versions
            and candidate.score >= self.settings.knowledge_retrieval_min_score
        ][: self.settings.knowledge_retrieval_candidates]
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


def _evidence(text: str, limit: int = 500) -> str:
    value = " ".join(text.split())
    return value if len(value) <= limit else f"{value[:limit].rstrip()}..."


def _unavailable(reason: str) -> dict[str, object]:
    return {"status": "unavailable", "reason": reason, "sources": []}
