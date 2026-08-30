from __future__ import annotations

from packages.harness.aisoftoj_agent.knowledge_rag.markdown import (
    build_markdown_chunks,
    offset_page_markers,
)


def test_markdown_chunks_keep_heading_path_and_stable_document_metadata() -> None:
    chunks = build_markdown_chunks(
        "# 第一章\n\n这是章节正文。\n\n## 认证\n\n认证用于确认身份。",
        document_id="document-1",
        index_version="v1",
        title="安全设计",
        target_chars=200,
        overlap_chars=20,
    )

    assert [item.heading_path for item in chunks] == [["第一章"], ["第一章", "认证"]]
    assert all(item.document_id == "document-1" for item in chunks)
    assert all(item.index_version == "v1" for item in chunks)


def test_mineru_page_markers_are_converted_to_one_based_ranges() -> None:
    chunks = build_markdown_chunks(
        "<!-- page_idx: 0 -->\n# 第一章\n\n第一页内容。\n\n<!-- page_idx: 1 -->\n第二页内容。",
        document_id="document-1",
        index_version="v1",
        title="安全设计",
        target_chars=200,
        overlap_chars=20,
    )

    assert len(chunks) == 1
    assert chunks[0].page_start == 1
    assert chunks[0].page_end == 2


def test_split_markdown_page_markers_receive_continuous_offset() -> None:
    markdown = "<!-- page_idx: 0 -->\n第二卷第一页\n<!-- page_idx: 1 -->\n第二卷第二页"

    assert offset_page_markers(markdown, 200) == (
        "<!-- page_idx: 200 -->\n第二卷第一页\n<!-- page_idx: 201 -->\n第二卷第二页"
    )
