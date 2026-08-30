from __future__ import annotations

import asyncio

from config import Settings

from ..textbook_rag.embeddings import EmbeddingClient, EmbeddingError
from ..textbook_rag.qdrant import QdrantClient, QdrantError
from .bm25 import Bm25Encoder, Bm25Error
from .markdown import build_markdown_chunks
from .models import KnowledgeChunk


class KnowledgeIndexingError(RuntimeError):
    def __init__(self, code: str) -> None:
        self.code = code
        super().__init__(code)


class KnowledgeIndexer:
    def __init__(
        self,
        *,
        settings: Settings,
        embedding_client: EmbeddingClient,
        bm25_encoder: Bm25Encoder,
        qdrant_client: QdrantClient,
    ) -> None:
        self.settings = settings
        self.embedding_client = embedding_client
        self.bm25_encoder = bm25_encoder
        self.qdrant_client = qdrant_client

    async def index(
        self, *, document_id: str, index_version: str, title: str, markdown: str
    ) -> int:
        chunks = build_markdown_chunks(
            markdown,
            document_id=document_id,
            index_version=index_version,
            title=title,
            target_chars=self.settings.knowledge_chunk_target_chars,
            overlap_chars=self.settings.knowledge_chunk_overlap_chars,
        )
        if not chunks:
            raise KnowledgeIndexingError("KNOWLEDGE_NO_INDEXABLE_TEXT")
        try:
            dense_vectors, sparse_vectors = await asyncio.gather(
                self.embedding_client.embed([chunk.text for chunk in chunks]),
                self.bm25_encoder.encode([chunk.text for chunk in chunks]),
            )
            if len(dense_vectors) != len(chunks) or len(sparse_vectors) != len(chunks):
                raise KnowledgeIndexingError("KNOWLEDGE_VECTOR_COUNT_MISMATCH")
            if any(
                len(vector) != self.settings.knowledge_embedding_dimensions
                for vector in dense_vectors
            ):
                raise KnowledgeIndexingError("KNOWLEDGE_EMBEDDING_DIMENSION_MISMATCH")
            await self.qdrant_client.ensure_hybrid_collection(
                self.settings.knowledge_embedding_dimensions
            )
            await self.qdrant_client.upsert_hybrid(
                _hybrid_points(chunks, dense_vectors, sparse_vectors)
            )
            return len(chunks)
        except (EmbeddingError, Bm25Error, QdrantError) as exc:
            await self._cleanup(document_id, index_version)
            raise KnowledgeIndexingError(str(exc) or "KNOWLEDGE_INDEX_UNAVAILABLE") from exc
        except KnowledgeIndexingError:
            await self._cleanup(document_id, index_version)
            raise

    async def _cleanup(self, document_id: str, index_version: str) -> None:
        try:
            await self.qdrant_client.delete_hybrid_index(document_id, index_version)
        except QdrantError:
            pass

    async def delete(self, document_id: str, index_version: str) -> None:
        try:
            await self.qdrant_client.delete_hybrid_index(document_id, index_version)
        except QdrantError as exc:
            raise KnowledgeIndexingError(str(exc) or "KNOWLEDGE_INDEX_UNAVAILABLE") from exc


def _hybrid_points(
    chunks: list[KnowledgeChunk],
    dense_vectors: list[list[float]],
    sparse_vectors: list[dict[str, list[int] | list[float]]],
) -> list[dict[str, object]]:
    return [
        {
            "id": chunk.chunk_id,
            "vector": {"dense": dense, "bm25": sparse},
            "payload": chunk.payload(),
        }
        for chunk, dense, sparse in zip(chunks, dense_vectors, sparse_vectors, strict=True)
    ]
