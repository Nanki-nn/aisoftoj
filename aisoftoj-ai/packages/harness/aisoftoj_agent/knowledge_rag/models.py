from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True, slots=True)
class KnowledgeChunk:
    chunk_id: str
    document_id: str
    index_version: str
    title: str
    heading_path: list[str]
    ordinal: int
    text: str
    page_start: int | None = None
    page_end: int | None = None

    def payload(self) -> dict[str, Any]:
        return {
            "documentId": self.document_id,
            "indexVersion": self.index_version,
            "title": self.title,
            "headingPath": self.heading_path,
            "ordinal": self.ordinal,
            "text": self.text,
            "pageStart": self.page_start,
            "pageEnd": self.page_end,
        }


@dataclass(frozen=True, slots=True)
class RetrievedKnowledgeChunk:
    chunk: KnowledgeChunk
    score: float
