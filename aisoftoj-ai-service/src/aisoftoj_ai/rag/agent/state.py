from typing import TypedDict

from aisoftoj_ai.rag.models import Citation, SearchResult


class RagState(TypedDict, total=False):
    """LangGraph 中流转的 RAG 状态。"""
    question: str
    knowledge_base_ids: list[str]
    history: list[dict[str, str]]
    web_enabled: bool
    thinking_enabled: bool
    rewrite_count: int
    rewritten_query: str
    rewritten_queries: list[str]
    knowledge_results: list[SearchResult]
    web_results: list[SearchResult]
    evidence_enough: bool
    answer: str
    citations: list[Citation]
