from aisoftoj_ai.rag.chunking import split_blocks
from aisoftoj_ai.rag.models import DocumentBlock


def test_chunker_keeps_heading_path_and_metadata():
    blocks = [
        DocumentBlock(
            content="# 第一章\n## CAP 定理\n一致性、可用性和分区容错性。",
            page=2,
            bbox=[1, 2, 3, 4],
        )
    ]

    chunks = split_blocks(blocks, "kb-1", "doc-1", 1, chunk_size=50, overlap=10)

    assert len(chunks) == 1
    assert chunks[0].heading_path == ["第一章", "CAP 定理"]
    assert chunks[0].page == 2
    assert chunks[0].bbox == [1, 2, 3, 4]


def test_chunker_does_not_merge_different_sections():
    blocks = [
        DocumentBlock(content="# 第一章\n内容一\n# 第二章\n内容二"),
    ]

    chunks = split_blocks(blocks, "kb-1", "doc-1", 1, chunk_size=50, overlap=10)

    assert [chunk.heading_path for chunk in chunks] == [["第一章"], ["第二章"]]


def test_chunker_prefers_chinese_sentence_boundaries():
    blocks = [
        DocumentBlock(
            content="第一句话说明背景。第二句话解释原理。第三句话给出结论。",
            heading_path=["章节"],
        )
    ]

    chunks = split_blocks(blocks, "kb-1", "doc-1", 1, chunk_size=16, overlap=0)

    assert chunks[0].content.endswith("。")
    assert all(chunk.heading_path == ["章节"] for chunk in chunks)
