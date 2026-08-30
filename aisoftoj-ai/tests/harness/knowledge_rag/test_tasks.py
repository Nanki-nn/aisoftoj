from __future__ import annotations

import fitz

from packages.harness.aisoftoj_agent.knowledge_rag import tasks


def test_pdf_over_page_limit_is_split_into_ordered_parts(tmp_path) -> None:
    source = tmp_path / "source.pdf"
    document = fitz.open()
    for _ in range(201):
        document.new_page()
    document.save(source)
    document.close()

    original_parts_root = tasks.PARTS_ROOT
    tasks.PARTS_ROOT = tmp_path / "parts"
    try:
        parts = tasks._split_pdf_if_needed("document-1", source)
        assert [(part.path.name, part.page_offset) for part in parts] == [
            ("document-1.part-001.pdf", 0),
            ("document-1.part-002.pdf", 200),
        ]
        assert [fitz.open(part.path).page_count for part in parts] == [200, 1]
    finally:
        tasks.PARTS_ROOT = original_parts_root
