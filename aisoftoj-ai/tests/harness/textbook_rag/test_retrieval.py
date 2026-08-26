from __future__ import annotations

from packages.harness.aisoftoj_agent.integrations.aisoftoj.models import (
    KnowledgePoint,
    KnowledgePointSource,
    TextbookCatalog,
    TextbookSection,
)
from packages.harness.aisoftoj_agent.textbook_rag.chunking import build_chunks
from packages.harness.aisoftoj_agent.textbook_rag.models import PageText, RetrievedChunk
from packages.harness.aisoftoj_agent.textbook_rag.reranker import rerank
from packages.harness.aisoftoj_agent.textbook_rag.service import (
    _build_trace_result,
    _hydrate_result,
    _validated_candidates,
)


def catalog() -> TextbookCatalog:
    return TextbookCatalog(
        textbook_id=1,
        subject_name="系统架构设计师",
        name="系统架构设计师教程",
        edition="第1版",
        isbn=None,
        official_url="https://books.example.com/authorized.pdf",
        viewer_page_template="https://books.example.com/authorized.pdf#page={pdfPage}",
        sections=[
            TextbookSection(
                id=10,
                parent_id=None,
                level=1,
                section_code="第3章",
                title="软件架构",
                printed_page_start=80,
                printed_page_end=100,
                pdf_page_start=86,
                pdf_page_end=106,
                sort_order=1,
            ),
            TextbookSection(
                id=11,
                parent_id=10,
                level=2,
                section_code="3.2",
                title="架构风格",
                printed_page_start=86,
                printed_page_end=89,
                pdf_page_start=92,
                pdf_page_end=95,
                sort_order=2,
            ),
        ],
        knowledge_points=[
            KnowledgePoint(
                id=101,
                parent_id=None,
                level=1,
                code="ARCH-PIPE-FILTER",
                name="管道过滤器架构",
                description="一种数据流架构风格",
                sources=[
                    KnowledgePointSource(
                        id=1001,
                        section_id=11,
                        printed_page_start=86,
                        printed_page_end=89,
                        pdf_page_start=92,
                        pdf_page_end=95,
                        primary=True,
                    )
                ],
            )
        ],
    )


def test_chunking_uses_deepest_section_and_keeps_both_page_systems() -> None:
    chunks = build_chunks(
        catalog(),
        [PageText(pdf_page=92, text="管道过滤器由一组过滤器和管道组成。数据依次流经各过滤器。")],
        index_version="v1",
        target_chars=200,
        overlap_chars=20,
    )

    assert len(chunks) == 1
    assert chunks[0].section_id == 11
    assert chunks[0].chapter_path == ["第3章 软件架构", "3.2 架构风格"]
    assert chunks[0].pdf_page_start == 92
    assert chunks[0].printed_page_start == 86


def test_found_result_only_uses_validated_chunk_metadata_and_known_point() -> None:
    item = build_chunks(
        catalog(),
        [PageText(pdf_page=92, text="管道过滤器架构把处理步骤组织为过滤器，由管道传输数据。")],
        index_version="v1",
        target_chars=200,
        overlap_chars=20,
    )[0]
    candidates = [RetrievedChunk(chunk=item, dense_score=0.91)]
    valid = _validated_candidates(candidates, catalog(), "v1")
    ranked = rerank("管道过滤器架构", valid)
    result = _build_trace_result(
        ranked,
        catalog(),
        "v1",
        query="管道过滤器架构",
        minimum_score=0.5,
        source_limit=3,
    )
    hydrated = _hydrate_result(result, catalog(), question_id=7, cache_status="miss")

    assert hydrated["status"] == "found"
    assert hydrated["primaryKnowledgePoint"]["id"] == 101
    assert hydrated["sources"][0]["printedPageStart"] == 86
    assert hydrated["sources"][0]["viewerUrl"].endswith("#page=92")
    assert "officialUrl" not in result["sources"][0]


def test_unmapped_or_low_score_chunk_cannot_create_a_page_citation() -> None:
    result = _build_trace_result(
        [],
        catalog(),
        "v1",
        query="完全无关的题目",
        minimum_score=0.5,
        source_limit=3,
    )

    assert result["status"] == "insufficient_evidence"
    assert result["sources"] == []
    assert result["primaryKnowledgePoint"] is None
