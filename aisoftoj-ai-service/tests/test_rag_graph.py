from aisoftoj_ai.rag.agent.graph import build_rag_graph
from aisoftoj_ai.rag.agent.nodes import _fuse_results, _parse_rewritten_queries
from aisoftoj_ai.rag.models import SearchResult


class FakeChat:
    def __init__(self, verdict: str):
        self.verdict = verdict

    async def complete(self, messages, temperature=0.1):
        if "只输出“足够”或“不足”" in messages[0]["content"]:
            return self.verdict
        return '["CAP 定理的含义", "分布式系统 CAP 三要素", "CAP 取舍与应用场景"]'

    async def stream_with_reasoning(
        self,
        messages,
        temperature=0.2,
        thinking_enabled=False,
    ):
        if thinking_enabled:
            yield "reasoning", "先核对资料。"
        for token in ["这是", "回答"]:
            yield "token", token


class FakeSearch:
    def __init__(self):
        self.queries = []

    async def search(self, query, knowledge_base_ids, limit=None):
        self.queries.append(query)
        return [
            SearchResult(
                id="shared",
                content="CAP 包含一致性、可用性和分区容错性。",
                title="CAP 定理",
                score=0.9,
            ),
            SearchResult(
                id=f"result-{len(self.queries)}",
                content=f"{query} 的补充资料",
                title="补充资料",
                score=0.5,
            ),
        ]


class FakeWeb:
    def __init__(self):
        self.called = False

    async def search(self, query, limit=5):
        self.called = True
        return [
            SearchResult(
                id="web-1",
                content="公开资料",
                source="web",
                title="网页",
                url="https://example.com",
            )
        ]


async def collect_custom_events(graph, web_enabled=False, thinking_enabled=False):
    events = []
    async for part in graph.astream(
        {
            "question": "什么是 CAP？",
            "knowledge_base_ids": ["kb-1"],
            "history": [],
            "web_enabled": web_enabled,
            "thinking_enabled": thinking_enabled,
            "rewrite_count": 3,
        },
        stream_mode="custom",
        version="v2",
    ):
        events.append(part["data"])
    return events


async def test_graph_runs_multiple_rewrites_and_streams_reasoning():
    web = FakeWeb()
    search = FakeSearch()
    graph = build_rag_graph(FakeChat("足够"), search, web)

    events = await collect_custom_events(graph, thinking_enabled=True)

    assert search.queries == [
        "CAP 定理的含义",
        "分布式系统 CAP 三要素",
        "CAP 取舍与应用场景",
    ]
    assert web.called is False
    assert "".join(item["content"] for item in events if item["type"] == "token") == "这是回答"
    reasoning = "".join(item["content"] for item in events if item["type"] == "reasoning")
    assert reasoning == "先核对资料。"
    assert any(item["type"] == "rewrite" for item in events)
    assert any(item["type"] == "citation" for item in events)


async def test_graph_uses_web_when_evidence_is_not_enough():
    web = FakeWeb()
    graph = build_rag_graph(FakeChat("不足"), FakeSearch(), web)

    await collect_custom_events(graph, web_enabled=True)

    assert web.called is True


def test_parse_rewritten_queries_falls_back_to_requested_count():
    queries = _parse_rewritten_queries("单个查询", "原始问题", 3)

    assert len(queries) == 3
    assert queries[:2] == ["单个查询", "原始问题"]


def test_fuse_results_rewards_results_found_by_multiple_queries():
    shared = SearchResult(id="shared", content="shared", score=0.2)
    first = SearchResult(id="first", content="first", score=0.9)
    second = SearchResult(id="second", content="second", score=0.8)

    fused = _fuse_results([[first, shared], [second, shared]], limit=3)

    assert fused[0].id == "shared"
    assert {item.id for item in fused} == {"shared", "first", "second"}
