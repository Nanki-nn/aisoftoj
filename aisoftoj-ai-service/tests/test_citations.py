from aisoftoj_ai.rag.citations import build_citations
from aisoftoj_ai.rag.models import SearchResult


def test_build_citations_keeps_location():
    citations = build_citations(
        [
            SearchResult(
                id="1",
                content="内容",
                title="CAP 定理",
                document_id="doc-1",
                heading_path=["分布式系统", "CAP 定理"],
                page=3,
                asset_url="https://example.com/cap.png",
            )
        ]
    )

    assert citations[0].source == "知识库"
    assert citations[0].heading_path == ["分布式系统", "CAP 定理"]
    assert citations[0].page == 3
    assert citations[0].result_id == "1"
    assert citations[0].document_id == "doc-1"
    assert citations[0].content
