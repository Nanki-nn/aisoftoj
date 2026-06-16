import asyncio
import json
import re

from langgraph.config import get_stream_writer

from aisoftoj_ai.rag.agent.prompts import (
    ANSWER_SYSTEM,
    EVIDENCE_JUDGE_SYSTEM,
    QUERY_REWRITE_SYSTEM,
)
from aisoftoj_ai.rag.agent.state import RagState
from aisoftoj_ai.rag.citations import build_citations
from aisoftoj_ai.rag.models import SearchResult


def build_nodes(chat, search_tool, web_tool, storage=None):
    """Build the nodes used by the RAG workflow."""

    async def rewrite_query(state: RagState) -> dict:
        """Generate complementary standalone retrieval queries."""
        writer = get_stream_writer()
        rewrite_count = min(max(state.get("rewrite_count", 3), 1), 5)
        writer({"type": "status", "message": f"正在生成 {rewrite_count} 个检索查询"})
        history = "\n".join(
            f"{item['role']}：{item['content']}" for item in state.get("history", [])[-6:]
        )
        raw = await chat.complete(
            [
                {
                    "role": "system",
                    "content": QUERY_REWRITE_SYSTEM.format(count=rewrite_count),
                },
                {
                    "role": "user",
                    "content": (
                        f"最近对话：\n{history or '无'}\n\n"
                        f"当前问题：{state['question']}"
                    ),
                },
            ]
        )
        queries = _parse_rewritten_queries(raw, state["question"], rewrite_count)
        writer({"type": "rewrite", "queries": queries})
        return {
            "rewritten_query": queries[0],
            "rewritten_queries": queries,
        }

    async def retrieve(state: RagState) -> dict:
        """Run rewritten queries concurrently, then fuse and deduplicate results."""
        writer = get_stream_writer()
        queries = state.get("rewritten_queries") or [state["rewritten_query"]]
        writer({"type": "status", "message": f"正在并行检索 {len(queries)} 个查询"})
        responses = await asyncio.gather(
            *(
                search_tool.ainvoke(
                    {
                        "query": query,
                        "knowledge_base_ids": state["knowledge_base_ids"],
                    }
                )
                for query in queries
            ),
            return_exceptions=True,
        )
        result_sets = [
            [_as_result(item) for item in response]
            for response in responses
            if not isinstance(response, BaseException)
        ]
        if not result_sets:
            errors = [response for response in responses if isinstance(response, BaseException)]
            raise RuntimeError("all rewritten queries failed") from errors[0]

        results = _fuse_results(result_sets, limit=12)
        writer({"type": "status", "message": f"已融合 {len(results)} 条知识库资料"})
        return {"knowledge_results": results}

    async def judge_evidence(state: RagState) -> dict:
        """Judge whether the retrieved evidence can answer the question."""
        results = state.get("knowledge_results", [])
        if not results:
            return {"evidence_enough": False}
        context = _format_context(results)
        verdict = await chat.complete(
            [
                {"role": "system", "content": EVIDENCE_JUDGE_SYSTEM},
                {
                    "role": "user",
                    "content": f"问题：{state['question']}\n\n资料：\n{context}",
                },
            ],
            temperature=0,
        )
        return {"evidence_enough": verdict.startswith("足够")}

    async def search_web(state: RagState) -> dict:
        """Search public web sources when knowledge-base evidence is insufficient."""
        writer = get_stream_writer()
        writer({"type": "status", "message": "正在联网检索公开资料"})
        try:
            raw = await web_tool.ainvoke({"query": state["rewritten_query"]})
        except Exception as exc:
            writer(
                {
                    "type": "warning",
                    "message": f"联网检索暂时不可用，继续使用已有信息回答：{exc}",
                }
            )
            return {"web_results": []}
        results = [_as_result(item) for item in raw]
        writer({"type": "status", "message": f"已获取 {len(results)} 条网页资料"})
        return {"web_results": results}

    async def answer(state: RagState) -> dict:
        """Generate a streamed answer and citations from the collected evidence."""
        writer = get_stream_writer()
        results = [*state.get("knowledge_results", []), *state.get("web_results", [])]
        citations = build_citations(results)
        context = _format_context(results)
        user_content = [
            {
                "type": "text",
                "text": (
                    f"问题：{state['question']}\n\n"
                    f"可用资料：\n{context or '没有可用资料'}"
                ),
            }
        ]
        image_results = [
            item
            for item in results
            if item.content_type == "image" and item.asset_url
        ][:3]
        for item in image_results:
            image_url = (
                await storage.as_data_url(item.asset_url)
                if storage is not None
                else item.asset_url
            )
            user_content.append(
                {"type": "image_url", "image_url": {"url": image_url}}
            )
        messages = [
            {"role": "system", "content": ANSWER_SYSTEM},
            *state.get("history", [])[-6:],
            {"role": "user", "content": user_content},
        ]
        writer({"type": "status", "message": "正在组织回答"})
        answer_text = ""
        async for event_type, token in chat.stream_with_reasoning(
            messages,
            thinking_enabled=state.get("thinking_enabled", False),
        ):
            if event_type == "token":
                answer_text += token
            writer({"type": event_type, "content": token})
        writer(
            {
                "type": "citation",
                "citations": [citation.model_dump() for citation in citations],
            }
        )
        return {"answer": answer_text, "citations": citations}

    return rewrite_query, retrieve, judge_evidence, search_web, answer


def _format_context(results: list[SearchResult]) -> str:
    """Format retrieval results as numbered model context."""
    sections = []
    for index, item in enumerate(results, start=1):
        location = " / ".join(item.heading_path)
        page = f"，第 {item.page + 1} 页" if item.page is not None else ""
        sections.append(
            f"[{index}] {item.title or '资料'}{page}"
            f"{f'，章节：{location}' if location else ''}\n{item.content}"
        )
    return "\n\n".join(sections)


def _as_result(item) -> SearchResult:
    """Normalize a dictionary or Pydantic object to SearchResult."""
    if isinstance(item, SearchResult):
        return item
    return SearchResult.model_validate(item)


def _parse_rewritten_queries(raw: str, fallback: str, count: int) -> list[str]:
    """Parse model output defensively and return unique non-empty queries."""
    text = raw.strip()
    fenced = re.fullmatch(r"```(?:json)?\s*(.*?)\s*```", text, flags=re.DOTALL)
    if fenced:
        text = fenced.group(1)

    parsed = None
    try:
        parsed = json.loads(text)
    except json.JSONDecodeError:
        match = re.search(r"\[[\s\S]*\]", text)
        if match:
            try:
                parsed = json.loads(match.group(0))
            except json.JSONDecodeError:
                parsed = None

    candidates = parsed if isinstance(parsed, list) else [text]
    queries = []
    for candidate in candidates:
        if not isinstance(candidate, str):
            continue
        query = " ".join(candidate.split()).strip(" \"'")
        if query and query not in queries:
            queries.append(query)
        if len(queries) == count:
            break

    fallback = fallback.strip()
    if not queries:
        queries.append(fallback)
    if len(queries) < count and fallback not in queries:
        queries.append(fallback)
    fallback_variants = [
        f"{fallback} 相关概念 专业术语",
        f"{fallback} 原理 条件 应用",
        f"{fallback} 常见问题 解决方法",
        f"{fallback} 对比 区别",
    ]
    for variant in fallback_variants:
        if len(queries) == count:
            break
        if variant not in queries:
            queries.append(variant)
    return queries[:count]


def _fuse_results(
    result_sets: list[list[SearchResult]],
    limit: int,
    rrf_k: int = 60,
) -> list[SearchResult]:
    """Fuse independently reranked lists with reciprocal rank fusion."""
    scores: dict[str, float] = {}
    items: dict[str, SearchResult] = {}
    for results in result_sets:
        seen = set()
        for rank, result in enumerate(results, start=1):
            if result.id in seen:
                continue
            seen.add(result.id)
            scores[result.id] = scores.get(result.id, 0.0) + 1 / (rrf_k + rank)
            current = items.get(result.id)
            if current is None or result.score > current.score:
                items[result.id] = result

    ranked_ids = sorted(scores, key=scores.get, reverse=True)[:limit]
    return [items[item_id].model_copy(update={"score": scores[item_id]}) for item_id in ranked_ids]
