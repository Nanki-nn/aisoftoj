from __future__ import annotations

from typing import Any

import httpx


class EmbeddingError(RuntimeError):
    pass


class EmbeddingClient:
    def __init__(
        self,
        *,
        base_url: str,
        api_key: str,
        model: str,
        batch_size: int,
        timeout_seconds: float,
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> None:
        self.model = model
        self.batch_size = batch_size
        self._client = httpx.AsyncClient(
            base_url=f"{base_url.rstrip('/')}/",
            timeout=timeout_seconds,
            transport=transport,
            trust_env=False,
            headers={"Authorization": f"Bearer {api_key}", "Accept": "application/json"},
        )

    async def close(self) -> None:
        await self._client.aclose()

    async def embed(self, texts: list[str]) -> list[list[float]]:
        vectors: list[list[float]] = []
        for offset in range(0, len(texts), self.batch_size):
            batch = texts[offset : offset + self.batch_size]
            try:
                response = await self._client.post(
                    "embeddings", json={"model": self.model, "input": batch}
                )
                response.raise_for_status()
                payload: Any = response.json()
                data = payload.get("data") if isinstance(payload, dict) else None
                if not isinstance(data, list) or len(data) != len(batch):
                    raise ValueError("embedding count mismatch")
                if not all(isinstance(item, dict) for item in data):
                    raise ValueError("invalid embedding record")
                ordered = sorted(data, key=lambda item: item.get("index", 0))
                for item in ordered:
                    vector = item.get("embedding") if isinstance(item, dict) else None
                    if not isinstance(vector, list) or not vector:
                        raise ValueError("invalid embedding vector")
                    vectors.append([float(value) for value in vector])
            except (httpx.HTTPError, TypeError, ValueError) as exc:
                raise EmbeddingError("EMBEDDING_UNAVAILABLE") from exc
        return vectors
