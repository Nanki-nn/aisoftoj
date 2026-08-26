from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True, slots=True)
class PageText:
    pdf_page: int
    text: str


@dataclass(frozen=True, slots=True)
class TextbookChunk:
    chunk_id: str
    textbook_id: int
    index_version: str
    section_id: int
    chapter_path: list[str]
    pdf_page_start: int
    pdf_page_end: int
    printed_page_start: int
    printed_page_end: int
    chunk_hash: str
    text: str

    def payload(self) -> dict[str, Any]:
        return {
            "textbookId": self.textbook_id,
            "indexVersion": self.index_version,
            "sectionId": self.section_id,
            "chapterPath": self.chapter_path,
            "pdfPageStart": self.pdf_page_start,
            "pdfPageEnd": self.pdf_page_end,
            "printedPageStart": self.printed_page_start,
            "printedPageEnd": self.printed_page_end,
            "chunkHash": self.chunk_hash,
            "text": self.text,
        }


@dataclass(frozen=True, slots=True)
class RetrievedChunk:
    chunk: TextbookChunk
    dense_score: float
    relevance_score: float = 0.0
