from __future__ import annotations

from config import Settings
from packages.harness.aisoftoj_agent.knowledge_rag.indexing import KnowledgeIndexer


class FakeEmbeddings:
    async def embed(self, texts: list[str]) -> list[list[float]]:
        return [[0.1, 0.2, 0.3] for _ in texts]


class FakeBm25:
    async def encode(self, texts: list[str]) -> list[dict[str, list[int] | list[float]]]:
        return [{"indices": [1], "values": [1.0]} for _ in texts]


class FakeQdrant:
    def __init__(self) -> None:
        self.dimensions: int | None = None
        self.points: list[dict[str, object]] = []

    async def ensure_hybrid_collection(self, dimensions: int) -> None:
        self.dimensions = dimensions

    async def upsert_hybrid(self, points: list[dict[str, object]], *, batch_size: int = 64) -> None:
        del batch_size
        self.points = points

    async def delete_hybrid_index(self, _document_id: str, _index_version: str) -> None:
        return None


def settings() -> Settings:
    return Settings.model_validate(
        {
            "database_url": "mysql+asyncmy://user:secret@127.0.0.1/aisoftoj_test",
            "platform_service_key": "service-secret",
            "llm_base_url": "https://gateway.example/v1",
            "llm_api_key": "llm-secret",
            "llm_default_model": "model-name",
            "knowledge_rag_enabled": True,
            "mineru_api_key": "mineru-secret",
            "knowledge_embedding_dimensions": 3,
            "knowledge_chunk_target_chars": 200,
            "knowledge_chunk_overlap_chars": 20,
        }
    )


async def test_indexing_writes_dense_and_bm25_named_vectors() -> None:
    qdrant = FakeQdrant()
    indexer = KnowledgeIndexer(
        settings=settings(),
        embedding_client=FakeEmbeddings(),  # type: ignore[arg-type]
        bm25_encoder=FakeBm25(),  # type: ignore[arg-type]
        qdrant_client=qdrant,  # type: ignore[arg-type]
    )

    count = await indexer.index(
        document_id="document-1",
        index_version="v1",
        title="安全设计",
        markdown="# 认证\n\n认证用于确认身份。",
    )

    assert count == 1
    assert qdrant.dimensions == 3
    assert qdrant.points[0]["vector"] == {
        "dense": [0.1, 0.2, 0.3],
        "bm25": {"indices": [1], "values": [1.0]},
    }
