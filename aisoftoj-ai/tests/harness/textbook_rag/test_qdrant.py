from __future__ import annotations

import json

import httpx

from packages.harness.aisoftoj_agent.textbook_rag.qdrant import QdrantClient


async def test_count_and_delete_are_scoped_to_one_index_version() -> None:
    requests: list[httpx.Request] = []

    async def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        body = json.loads(request.content)
        assert body["filter"] == {
            "must": [
                {"key": "textbookId", "match": {"value": 7}},
                {"key": "indexVersion", "match": {"value": "v2"}},
            ]
        }
        if request.url.path.endswith("/points/count"):
            assert body["exact"] is True
            return httpx.Response(200, json={"result": {"count": 4}, "status": "ok"})
        assert request.url.path.endswith("/points/delete")
        assert request.url.params["wait"] == "true"
        return httpx.Response(200, json={"result": {"status": "completed"}, "status": "ok"})

    client = QdrantClient(
        base_url="http://127.0.0.1:6333",
        collection="textbook",
        transport=httpx.MockTransport(handler),
    )
    count = await client.count_index_points(7, "v2")
    await client.delete_index_points(7, "v2")
    await client.close()

    assert count == 4
    assert len(requests) == 2


async def test_missing_collection_has_zero_reusable_points() -> None:
    client = QdrantClient(
        base_url="http://127.0.0.1:6333",
        collection="textbook",
        transport=httpx.MockTransport(lambda _request: httpx.Response(404)),
    )

    count = await client.count_index_points(7, "missing")
    await client.close()

    assert count == 0


async def test_hybrid_search_uses_qdrant_rrf_fusion() -> None:
    requests: list[httpx.Request] = []

    async def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        assert request.url.path.endswith("/points/query")
        payload = json.loads(request.content)
        assert payload["prefetch"][0] == {"query": [0.1, 0.2], "using": "dense", "limit": 4}
        assert payload["prefetch"][1]["using"] == "bm25"
        assert payload["query"] == {"fusion": "rrf"}
        return httpx.Response(
            200,
            json={"result": {"points": [{"id": "chunk", "score": 0.03, "payload": {}}]}},
        )

    client = QdrantClient(
        base_url="http://127.0.0.1:6333",
        collection="aisoftoj_knowledge",
        transport=httpx.MockTransport(handler),
    )
    result = await client.hybrid_search(
        dense_vector=[0.1, 0.2],
        sparse_vector={"indices": [3], "values": [1.0]},
        limit=4,
    )
    await client.close()

    assert result[0]["id"] == "chunk"
    assert len(requests) == 1
