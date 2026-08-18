from __future__ import annotations

import json
from types import SimpleNamespace

import pytest
from langchain_core.messages import AIMessage, HumanMessage, ToolMessage

from packages.harness.aisoftoj_agent.agents.middlewares.loop_detection import (
    AgentLoopDetected,
    LoopDetectionMiddleware,
)
from packages.harness.aisoftoj_agent.agents.middlewares.token_budget import (
    TokenBudgetExceeded,
    TokenBudgetMiddleware,
)
from packages.harness.aisoftoj_agent.agents.middlewares.tool_events import (
    ToolEventMiddleware,
    safe_tool_input,
    safe_tool_name,
    safe_tool_summary,
)


async def test_token_budget_fails_before_an_unbounded_model_call() -> None:
    middleware = TokenBudgetMiddleware(max_tokens=2)

    with pytest.raises(TokenBudgetExceeded):
        await middleware.abefore_model({"messages": [HumanMessage(content="123456789012")]}, None)


async def test_repeated_identical_tool_calls_are_stopped() -> None:
    middleware = LoopDetectionMiddleware(hard_repetitions=3)
    messages = [
        AIMessage(
            content="",
            tool_calls=[{"name": "get_question", "args": {"question_id": 1}, "id": str(i)}],
        )
        for i in range(3)
    ]

    with pytest.raises(AgentLoopDetected):
        await middleware.abefore_model({"messages": messages}, None)


class CapturingSink:
    def __init__(self) -> None:
        self.events: list[tuple[str, dict[str, object]]] = []

    async def emit(self, event_type: str, payload: dict[str, object]) -> None:
        self.events.append((event_type, payload))


def tool_request(sink: CapturingSink, name: str, args: dict[str, object]) -> object:
    return SimpleNamespace(
        tool_call={"id": "call-1", "name": name, "args": args},
        runtime=SimpleNamespace(context=SimpleNamespace(event_sink=sink)),
    )


async def test_tool_events_pair_started_and_completed_with_safe_summary() -> None:
    sink = CapturingSink()
    request = tool_request(sink, "list_papers", {"secret": "must-not-pass"})

    async def handler(_request: object) -> ToolMessage:
        return ToolMessage(
            content=json.dumps({"total": 12, "records": [{"answer": "secret"}]}),
            tool_call_id="call-1",
        )

    await ToolEventMiddleware().awrap_tool_call(request, handler)  # type: ignore[arg-type]

    assert [event[0] for event in sink.events] == ["tool.started", "tool.completed"]
    assert sink.events[0][1]["call_id"] == sink.events[1][1]["call_id"] == "call-1"
    assert sink.events[0][1]["input"] == {}
    assert sink.events[1][1]["summary"] == {"total": 12}
    assert "secret" not in json.dumps(sink.events)


async def test_error_tool_message_is_a_failed_event() -> None:
    sink = CapturingSink()
    request = tool_request(sink, "get_question", {"question_id": 7})

    async def handler(_request: object) -> ToolMessage:
        return ToolMessage(
            content="arbitrary exception with token=secret",
            tool_call_id="call-1",
            status="error",
        )

    await ToolEventMiddleware().awrap_tool_call(request, handler)  # type: ignore[arg-type]

    assert sink.events[-1][0] == "tool.failed"
    assert sink.events[-1][1]["message"] == "tool_unavailable"
    assert "secret" not in json.dumps(sink.events)


def test_tool_event_sanitizers_are_strict_and_bounded() -> None:
    assert safe_tool_name("../../token\n") == "unknown_tool"
    assert safe_tool_input(
        "list_practice_history",
        {"page": 2, "page_size": 999, "jwt": "secret"},
    ) == {"page": 2, "page_size": 20}
    summary = safe_tool_summary(
        "review_wrong_question",
        {
            "question_type": "single_choice",
            "difficulty": "hard",
            "error_count": 3,
            "importance": "x" * 100,
            "correct_answer": "A",
            "analysis": "must-not-pass",
            "nested": {"service_key": "secret"},
        },
    )
    assert summary == {
        "question_type": "single_choice",
        "difficulty": "hard",
        "error_count": 3,
        "importance": "x" * 32,
    }
    assert "must-not-pass" not in json.dumps(summary)
    assert "secret" not in json.dumps(summary)
