from __future__ import annotations

import asyncio
from typing import Any


class Bm25Error(RuntimeError):
    pass


class Bm25Encoder:
    """Local BM25 sparse-vector encoder provided by FastEmbed/Qdrant."""

    def __init__(self, model_name: str) -> None:
        from fastembed import SparseTextEmbedding

        self._model = SparseTextEmbedding(model_name=model_name)

    async def encode(self, texts: list[str]) -> list[dict[str, list[int] | list[float]]]:
        try:
            return await asyncio.to_thread(self._encode, texts)
        except (TypeError, ValueError, RuntimeError) as exc:
            raise Bm25Error("BM25_UNAVAILABLE") from exc

    def _encode(self, texts: list[str]) -> list[dict[str, list[int] | list[float]]]:
        encoded: list[dict[str, list[int] | list[float]]] = []
        for item in self._model.embed(texts):
            indices: Any = getattr(item, "indices", None)
            values: Any = getattr(item, "values", None)
            if indices is None or values is None:
                raise ValueError("invalid sparse embedding")
            encoded.append(
                {
                    "indices": [int(value) for value in indices],
                    "values": [float(value) for value in values],
                }
            )
        if len(encoded) != len(texts):
            raise ValueError("sparse embedding count mismatch")
        return encoded
