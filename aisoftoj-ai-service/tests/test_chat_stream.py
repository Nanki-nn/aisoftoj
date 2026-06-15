import json

from aisoftoj_ai.api.routes import _stream_conversation
from aisoftoj_ai.api.schemas import ChatMessage, ChatRequest
from aisoftoj_ai.rag.models import SearchResult


class FakeChat:
    def __init__(self):
        self.messages = []

    async def stream_with_reasoning(
        self,
        messages,
        temperature=0.2,
        thinking_enabled=False,
    ):
        self.messages = messages
        if thinking_enabled:
            yield "reasoning", "思考过程"
        for token in ("回答", "完成"):
            yield "token", token


class FakeWeb:
    def __init__(self, fail=False):
        self.called = False
        self.fail = fail

    async def search(self, query, limit=5):
        self.called = True
        if self.fail:
            raise RuntimeError("offline")
        return [
            SearchResult(
                id="web-1",
                content="公开资料内容",
                source="web",
                title="公开资料",
                url="https://example.com",
            )
        ]


class FakeServices:
    def __init__(self, fail_web=False):
        self.chat = FakeChat()
        self.searxng = FakeWeb(fail_web)


def parse_event(raw):
    lines = raw.strip().splitlines()
    return lines[0][7:], json.loads(lines[1][6:])


async def collect(body, services):
    return [
        parse_event(raw)
        async for raw in _stream_conversation(body, services, "trace-1")
    ]


async def test_plain_chat_never_calls_web_and_keeps_history():
    services = FakeServices()
    body = ChatRequest(
        question="继续解释",
        history=[ChatMessage(role="user", content="什么是架构")],
    )

    events = await collect(body, services)

    assert services.searxng.called is False
    assert [event for event, _ in events] == ["status", "token", "token", "citation"]
    assert services.chat.messages[-2]["content"] == "什么是架构"
    assert services.chat.messages[-1]["content"] == "继续解释"


async def test_web_chat_returns_citation():
    services = FakeServices()

    events = await collect(
        ChatRequest(question="查询资料", web_enabled=True),
        services,
    )

    assert services.searxng.called is True
    citation = next(data for event, data in events if event == "citation")
    assert citation["citations"][0]["url"] == "https://example.com"


async def test_web_failure_warns_and_falls_back_to_plain_chat():
    services = FakeServices(fail_web=True)

    events = await collect(
        ChatRequest(question="查询资料", web_enabled=True),
        services,
    )

    assert [event for event, _ in events] == [
        "status",
        "warning",
        "status",
        "token",
        "token",
        "citation",
    ]


async def test_thinking_mode_streams_reasoning_before_answer():
    services = FakeServices()

    events = await collect(
        ChatRequest(question="分析问题", thinking_enabled=True),
        services,
    )

    event_names = [event for event, _ in events]
    assert event_names.index("reasoning") < event_names.index("token")
