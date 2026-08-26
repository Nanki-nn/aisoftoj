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
                    "filter": {
                        "must": [
                            {"key": "textbookId", "match": {"value": textbook_id}},
                            {"key": "indexVersion", "match": {"value": index_version}},
                        ]
                    },
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


def _collection_vector_size(payload: Any) -> int | None:
    try:
        vectors = payload["result"]["config"]["params"]["vectors"]
    except (KeyError, TypeError):
        return None
    if isinstance(vectors, dict) and isinstance(vectors.get("size"), int):
        return int(vectors["size"])
    return None
