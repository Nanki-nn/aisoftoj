from __future__ import annotations

import pytest
from langchain_core.messages import AIMessage

from packages.harness.aisoftoj_agent.knowledge_rag.service import (
    LlmQueryRewriter,
    QueryRewriteError,
    _fuse_candidates,
)


def _record(chunk_id: str, *, document_id: str = "doc-1", score: float = 0.8) -> dict:
    return {
        "id": chunk_id,
        "score": score,
        "payload": {
            "documentId": document_id,
            "indexVersion": "v1",
            "title": "网络安全",
            "headingPath": ["认证"],
            "ordinal": 1,
            "text": f"内容 {chunk_id}",
            "pageStart": 1,
            "pageEnd": 1,
        },
    }


class FakeRewriteModel:
    async def ainvoke(self, _messages: object) -> AIMessage:
        return AIMessage(content='["零信任架构的定义", "零信任架构的核心原则"]')


@pytest.mark.asyncio
async def test_llm_rewriter_keeps_original_and_bounds_variants() -> None:
    variants = await LlmQueryRewriter(FakeRewriteModel()).rewrite(
        "请问什么是零信任架构？", limit=3
    )  # type: ignore[arg-type]

    assert variants == [
        "请问什么是零信任架构？",
        "零信任架构的定义",
        "零信任架构的核心原则",
    ]


class InvalidRewriteModel:
    async def ainvoke(self, _messages: object) -> AIMessage:
        return AIMessage(content="not json")


@pytest.mark.asyncio
async def test_llm_rewriter_reports_invalid_output() -> None:
    with pytest.raises(QueryRewriteError):
        await LlmQueryRewriter(InvalidRewriteModel()).rewrite("认证", limit=3)  # type: ignore[arg-type]


def test_fusion_deduplicates_chunks_and_rewards_cross_query_hits() -> None:
    records = [
        [_record("both"), _record("original-only")],
        [_record("both"), _record("rewritten-only")],
    ]

    results = _fuse_candidates(
        records,
        active_versions={("doc-1", "v1"): object()},
        minimum_score=0,
        fusion_k=1,
        limit=3,
    )

    assert [item.chunk.chunk_id for item in results] == [
        "both",
        "original-only",
        "rewritten-only",
    ]
    assert len({item.chunk.chunk_id for item in results}) == 3
