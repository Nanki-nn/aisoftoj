from __future__ import annotations

from typing import Any

import httpx

from .models import RetrievedChunk, TextbookChunk


class QdrantError(RuntimeError):
    pass


class QdrantClient:
    def __init__(
        self,
        *,
        base_url: str,
        collection: str,
        api_key: str | None = None,
        timeout_seconds: float = 15,
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> None:
        headers = {"Accept": "application/json"}
        if api_key:
            headers["api-key"] = api_key
        self.collection = collection
        self._client = httpx.AsyncClient(
            base_url=base_url.rstrip("/"),
            timeout=timeout_seconds,
            transport=transport,
            trust_env=False,
            headers=headers,
        )

    async def close(self) -> None:
        await self._client.aclose()

    async def ensure_collection(self, dimensions: int) -> None:
        try:
            response = await self._client.get(f"/collections/{self.collection}")
            if response.status_code == 404:
                response = await self._client.put(
                    f"/collections/{self.collection}",
                    json={"vectors": {"size": dimensions, "distance": "Cosine"}},
                )
                if response.status_code == 409:
                    response = await self._client.get(f"/collections/{self.collection}")
            response.raise_for_status()
            payload = response.json()
            if payload.get("status") not in {"ok", "green", None}:
                raise ValueError("unexpected collection status")
            configured_size = _collection_vector_size(payload)
            if configured_size is not None and configured_size != dimensions:
                raise ValueError("collection vector size mismatch")
        except (httpx.HTTPError, TypeError, ValueError) as exc:
            raise QdrantError("VECTOR_STORE_UNAVAILABLE") from exc

    async def ensure_hybrid_collection(self, dimensions: int) -> None:
        """Create the named dense+sparse schema used by the MinerU knowledge base."""
        try:
            response = await self._client.get(f"/collections/{self.collection}")
            if response.status_code == 404:
                response = await self._client.put(
                    f"/collections/{self.collection}",
                    json={
                        "vectors": {"dense": {"size": dimensions, "distance": "Cosine"}},
                        "sparse_vectors": {"bm25": {}},
                    },
                )
                if response.status_code == 409:
                    response = await self._client.get(f"/collections/{self.collection}")
                else:
                    response.raise_for_status()
                    response = await self._client.get(f"/collections/{self.collection}")
            response.raise_for_status()
            payload = response.json()
            configured_size = _named_collection_vector_size(payload, "dense")
            if configured_size is not None and configured_size != dimensions:
                raise ValueError("collection vector size mismatch")
            if not _has_sparse_vector(payload, "bm25"):
                raise ValueError("collection does not support sparse vectors")
            await self._ensure_payload_indexes({"documentId": "keyword", "indexVersion": "keyword"})
        except (httpx.HTTPError, TypeError, ValueError) as exc:
            raise QdrantError("VECTOR_STORE_UNAVAILABLE") from exc

    async def upsert_hybrid(
        self,
        points: list[dict[str, Any]],
        *,
        batch_size: int = 64,
    ) -> None:
        for offset in range(0, len(points), batch_size):
            try:
                response = await self._client.put(
                    f"/collections/{self.collection}/points",
                    params={"wait": "true"},
                    json={"points": points[offset : offset + batch_size]},
                )
                response.raise_for_status()
            except httpx.HTTPError as exc:
                raise QdrantError("VECTOR_STORE_UNAVAILABLE") from exc

    async def hybrid_search(
        self,
        *,
        dense_vector: list[float],
        sparse_vector: dict[str, list[int] | list[float]],
        limit: int,
    ) -> list[dict[str, Any]]:
        try:
            response = await self._client.post(
                f"/collections/{self.collection}/points/query",
                json={
                    "prefetch": [
                        {"query": dense_vector, "using": "dense", "limit": limit},
                        {"query": sparse_vector, "using": "bm25", "limit": limit},
                    ],
                    "query": {"fusion": "rrf"},
                    "limit": limit,
                    "with_payload": True,
                },
            )
            response.raise_for_status()
            body: Any = response.json()
            records = body.get("result", {}).get("points") if isinstance(body, dict) else None
            if not isinstance(records, list):
                raise ValueError("invalid hybrid search result")
            return records
        except (httpx.HTTPError, TypeError, ValueError) as exc:
            raise QdrantError("VECTOR_STORE_UNAVAILABLE") from exc

    async def delete_hybrid_index(self, document_id: str, index_version: str) -> None:
        try:
            response = await self._client.post(
                f"/collections/{self.collection}/points/delete",
                params={"wait": "true"},
                json={
                    "filter": {
                        "must": [
                            {"key": "documentId", "match": {"value": document_id}},
                            {"key": "indexVersion", "match": {"value": index_version}},
                        ]
                    }
                },
            )
            if response.status_code == 404:
                return
            response.raise_for_status()
        except httpx.HTTPError as exc:
            raise QdrantError("VECTOR_STORE_UNAVAILABLE") from exc

    async def _ensure_payload_indexes(self, fields: dict[str, str]) -> None:
        for field_name, field_schema in fields.items():
            response = await self._client.put(
                f"/collections/{self.collection}/index",
                params={"wait": "true"},
                json={"field_name": field_name, "field_schema": field_schema},
            )
            response.raise_for_status()

    async def upsert(
        self, chunks: list[TextbookChunk], vectors: list[list[float]], batch_size: int = 64
    ) -> None:
        if len(chunks) != len(vectors):
            raise ValueError("chunk and vector counts differ")
        for offset in range(0, len(chunks), batch_size):
            points = [
                {"id": chunk.chunk_id, "vector": vector, "payload": chunk.payload()}
                for chunk, vector in zip(
                    chunks[offset : offset + batch_size],
                    vectors[offset : offset + batch_size],
                    strict=True,
                )
            ]
            try:
                response = await self._client.put(
                    f"/collections/{self.collection}/points",
                    params={"wait": "true"},
                    json={"points": points},
                )
                response.raise_for_status()
            except httpx.HTTPError as exc:
                raise QdrantError("VECTOR_STORE_UNAVAILABLE") from exc

    async def search(
        self,
        *,
        vector: list[float],
        textbook_id: int,
        index_version: str,
        limit: int,
    ) -> list[RetrievedChunk]:
        try:
            response = await self._client.post(
                f"/collections/{self.collection}/points/search",
                json={
                    "vector": vector,
                    "limit": limit,
                    "with_payload": True,
                    "filter": _index_filter(textbook_id, index_version),
                },
            )
            response.raise_for_status()
            body: Any = response.json()
            records = body.get("result") if isinstance(body, dict) else None
            if not isinstance(records, list):
                raise ValueError("invalid search result")
            return [self._to_retrieved(item) for item in records]
        except (httpx.HTTPError, TypeError, ValueError, KeyError) as exc:
            raise QdrantError("VECTOR_STORE_UNAVAILABLE") from exc

    async def count_index_points(self, textbook_id: int, index_version: str) -> int:
        try:
            response = await self._client.post(
                f"/collections/{self.collection}/points/count",
                json={
                    "filter": _index_filter(textbook_id, index_version),
                    "exact": True,
                },
            )
            if response.status_code == 404:
                return 0
            response.raise_for_status()
            body: Any = response.json()
            value = body.get("result", {}).get("count") if isinstance(body, dict) else None
            if not isinstance(value, int) or value < 0:
                raise ValueError("invalid point count")
            return value
        except (httpx.HTTPError, TypeError, ValueError) as exc:
            raise QdrantError("VECTOR_STORE_UNAVAILABLE") from exc

    async def delete_index_points(self, textbook_id: int, index_version: str) -> None:
        try:
            response = await self._client.post(
                f"/collections/{self.collection}/points/delete",
                params={"wait": "true"},
                json={"filter": _index_filter(textbook_id, index_version)},
            )
            response.raise_for_status()
        except httpx.HTTPError as exc:
            raise QdrantError("VECTOR_STORE_UNAVAILABLE") from exc

    def _to_retrieved(self, item: Any) -> RetrievedChunk:
        if not isinstance(item, dict) or not isinstance(item.get("payload"), dict):
            raise ValueError("invalid Qdrant point")
        payload = item["payload"]
        chapter_path = payload.get("chapterPath")
        if not isinstance(chapter_path, list) or not all(
            isinstance(value, str) for value in chapter_path
        ):
            raise ValueError("invalid chapter path")
        chunk = TextbookChunk(
            chunk_id=str(item["id"]),
            textbook_id=int(payload["textbookId"]),
            index_version=str(payload["indexVersion"]),
            section_id=int(payload["sectionId"]),
            chapter_path=chapter_path,
            pdf_page_start=int(payload["pdfPageStart"]),
            pdf_page_end=int(payload["pdfPageEnd"]),
            printed_page_start=int(payload["printedPageStart"]),
            printed_page_end=int(payload["printedPageEnd"]),
            chunk_hash=str(payload["chunkHash"]),
            text=str(payload["text"]),
        )
        return RetrievedChunk(chunk=chunk, dense_score=float(item.get("score", 0.0)))


def _index_filter(textbook_id: int, index_version: str) -> dict[str, object]:
    return {
        "must": [
            {"key": "textbookId", "match": {"value": textbook_id}},
            {"key": "indexVersion", "match": {"value": index_version}},
        ]
    }


def _collection_vector_size(payload: Any) -> int | None:
    try:
        vectors = payload["result"]["config"]["params"]["vectors"]
    except (KeyError, TypeError):
        return None
    if isinstance(vectors, dict) and isinstance(vectors.get("size"), int):
        return int(vectors["size"])
    return None


def _named_collection_vector_size(payload: Any, name: str) -> int | None:
    try:
        vectors = payload["result"]["config"]["params"]["vectors"]
    except (KeyError, TypeError):
        return None
    if not isinstance(vectors, dict):
        return None
    value = vectors.get(name)
    if not isinstance(value, dict) or not isinstance(value.get("size"), int):
        return None
    return int(value["size"])


def _has_sparse_vector(payload: Any, name: str) -> bool:
    try:
        sparse = payload["result"]["config"]["params"]["sparse_vectors"]
    except (KeyError, TypeError):
        return False
    return isinstance(sparse, dict) and name in sparse
