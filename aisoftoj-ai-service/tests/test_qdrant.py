from aisoftoj_ai.clients.qdrant import QdrantStore
from aisoftoj_ai.rag.models import Chunk


class FakeQdrantClient:
    def __init__(self):
        self.batches = []

    async def upsert(self, collection_name, points, wait):
        self.batches.append(list(points))


async def test_upsert_splits_large_requests_into_batches():
    store = QdrantStore(
        "http://qdrant",
        "",
        "knowledge",
        embedding_dimension=2,
        upsert_max_bytes=3_000,
        upsert_max_points=2,
    )
    store.client = FakeQdrantClient()
    chunks = [
        Chunk(
            id=f"chunk-{index}",
            knowledge_base_id="kb-1",
            document_id="doc-1",
            content="production knowledge " * 10,
            content_type="text",
        )
        for index in range(5)
    ]

    await store.upsert(chunks, [[0.1, 0.2] for _ in chunks])

    assert [len(batch) for batch in store.client.batches] == [2, 2, 1]
