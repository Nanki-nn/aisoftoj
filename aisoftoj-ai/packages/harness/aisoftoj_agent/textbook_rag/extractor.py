from __future__ import annotations

from pathlib import Path

from .models import PageText


class PyMuPDFTextbookExtractor:
    name = "pymupdf"
    version = "1"

    def extract(self, path: Path) -> list[PageText]:
        import fitz  # type: ignore[import-untyped]

        pages: list[PageText] = []
        with fitz.open(path) as document:
            if not document.is_pdf or document.page_count < 1:
                raise ValueError("source is not a readable PDF")
            for index, page in enumerate(document):
                pages.append(PageText(pdf_page=index + 1, text=page.get_text("text")))
        return pages
