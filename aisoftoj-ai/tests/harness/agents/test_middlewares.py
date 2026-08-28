from __future__ import annotations

import json
import logging
from types import SimpleNamespace
from typing import Any

import httpx
import pytest
from langchain.agents.middleware import ModelRequest, ModelResponse
from langchain_core.language_models.fake_chat_models import FakeMessagesListChatModel
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage, ToolMessage
from langgraph.runtime import Runtime

from packages.harness.aisoftoj_agent.access_control import AiAccessDenied
from packages.harness.aisoftoj_agent.agents.context import AgentContext
from packages.harness.aisoftoj_agent.agents.middlewares.access_control import (
    AccessControlMiddleware,
)
from packages.harness.aisoftoj_agent.agents.middlewares.daily_token_quota import (
    DailyTokenQuotaMiddleware,
)
from packages.harness.aisoftoj_agent.agents.middlewares.loop_detection import (
    AgentLoopDetected,
    LoopDetectionMiddleware,
)
from packages.harness.aisoftoj_agent.agents.middlewares.skill_activation import (
    SkillActivationMiddleware,
)
from packages.harness.aisoftoj_agent.agents.middlewares.token_budget import (
    TokenBudgetExceeded,
    TokenBudgetMiddleware,
)
from packages.harness.aisoftoj_agent.agents.middlewares.tool_audit import ToolAuditMiddleware
from packages.harness.aisoftoj_agent.agents.middlewares.tool_errors import ToolErrorMiddleware
from packages.harness.aisoftoj_agent.agents.middlewares.tool_events import (
    ToolEventMiddleware,
    safe_tool_input,
    safe_tool_name,
    safe_tool_summary,
)
from packages.harness.aisoftoj_agent.integrations.aisoftoj.client import PlatformError
from packages.harness.aisoftoj_agent.skills import (
    CURRENT_INPUT_KEY,
    SKILL_ACTIVATION_KEY,
    Skill,
    SkillRegistry,
)


def model_request(
    messages: list[Any],
    system_message: SystemMessage | None = None,
    runtime: Runtime[Any] | None = None,
) -> ModelRequest[Any]:
    return ModelRequest(
        model=FakeMessagesListChatModel(responses=[AIMessage(content="unused")]),
        messages=messages,
        system_message=system_message,
        state={"messages": messages},
        runtime=runtime or Runtime(context=None),
    )


async def test_token_budget_fails_before_an_unbounded_model_call() -> None:
    middleware = TokenBudgetMiddleware(max_tokens=2)

    async def handler(_request: ModelRequest[Any]) -> ModelResponse[Any]:
        raise AssertionError("model must not be called")

    with pytest.raises(TokenBudgetExceeded):
        await middleware.awrap_model_call(
            model_request([HumanMessage(content="123456789012")]), handler
        )


async def test_access_control_rechecks_before_each_model_call() -> None:
    calls: list[tuple[int, str]] = []

    class AccessService:
        async def require_allowed(self, user_id: int, role: str) -> None:
            calls.append((user_id, role))
            raise AiAccessDenied("AI_GLOBALLY_DISABLED")

    context = AgentContext(
        user_id=7,
        username="reader",
        nickname=None,
        thread_id="thread-1",
        run_id="run-1",
        bearer_token="jwt",
        role="USER",
    )
    request = model_request(
        [HumanMessage(content="hello")],
        runtime=Runtime(context=context),
    )
    middleware = AccessControlMiddleware(AccessService())  # type: ignore[arg-type]

    async def handler(_request: ModelRequest[Any]) -> ModelResponse[Any]:
        raise AssertionError("denied calls must not reach the model")

    with pytest.raises(AiAccessDenied, match="AI_GLOBALLY_DISABLED"):
        await middleware.awrap_model_call(request, handler)
    assert calls == [(7, "USER")]


async def test_daily_quota_reserves_and_settles_provider_usage() -> None:
    calls: list[tuple[str, object]] = []

    class QuotaService:
        async def reserve(self, **kwargs: object) -> object:
            calls.append(("reserve", kwargs))
            return SimpleNamespace(id=9)

        async def settle(self, reservation_id: int, **kwargs: object) -> None:
            calls.append(("settle", {"reservation_id": reservation_id, **kwargs}))

        async def release(self, reservation_id: int) -> None:
            calls.append(("release", reservation_id))

    request = model_request(
        [HumanMessage(content="12345678")],
        runtime=Runtime(context=SimpleNamespace(run_id="run-1", user_id=7)),
    )
    middleware = DailyTokenQuotaMiddleware(  # type: ignore[arg-type]
        QuotaService(), max_output_tokens=100, reservation_margin_percent=10
    )

    async def handler(prepared: ModelRequest[Any]) -> ModelResponse[Any]:
        assert prepared.model_settings["max_tokens"] == 100
        return ModelResponse(
            result=[
                AIMessage(
                    content="ok",
                    usage_metadata={
                        "input_tokens": 11,
                        "output_tokens": 4,
                        "total_tokens": 15,
                    },
                )
            ]
        )

    await middleware.awrap_model_call(request, handler)
    assert calls[0] == (
        "reserve",
        {"run_id": "run-1", "user_id": 7, "tokens": 103},
    )
    assert calls[1] == (
        "settle",
        {
            "reservation_id": 9,
            "prompt_tokens": 11,
            "completion_tokens": 4,
            "usage_source": "provider",
            "estimated": False,
        },
    )


async def test_daily_quota_estimates_reservation_when_model_outcome_is_unknown() -> None:
    settled: list[tuple[int, dict[str, object]]] = []
    released: list[int] = []

    class QuotaService:
        async def reserve(self, **_kwargs: object) -> object:
            return SimpleNamespace(id=10, reserved_tokens=103)

        async def settle(self, reservation_id: int, **kwargs: object) -> None:
            settled.append((reservation_id, kwargs))

        async def release(self, reservation_id: int) -> None:
            released.append(reservation_id)

    request = model_request(
        [HumanMessage(content="hello")],
        runtime=Runtime(context=SimpleNamespace(run_id="run-1", user_id=7)),
    )
    middleware = DailyTokenQuotaMiddleware(  # type: ignore[arg-type]
        QuotaService(), max_output_tokens=100, reservation_margin_percent=10
    )

    async def handler(_prepared: ModelRequest[Any]) -> ModelResponse[Any]:
        raise RuntimeError("model unavailable")

    with pytest.raises(RuntimeError, match="model unavailable"):
        await middleware.awrap_model_call(request, handler)
    assert released == []
    assert settled == [
        (
            10,
            {
                "prompt_tokens": 103,
                "completion_tokens": 0,
                "usage_source": "estimated",
                "estimated": True,
            },
        )
    ]


async def test_daily_quota_releases_on_definitive_provider_rejection() -> None:
    released: list[int] = []

    class QuotaService:
        async def reserve(self, **_kwargs: object) -> object:
            return SimpleNamespace(id=11, reserved_tokens=103)

        async def settle(self, _reservation_id: int, **_kwargs: object) -> None:
            raise AssertionError("definitive rejection must not be charged")

        async def release(self, reservation_id: int) -> None:
            released.append(reservation_id)

    request = model_request(
        [HumanMessage(content="hello")],
        runtime=Runtime(context=SimpleNamespace(run_id="run-1", user_id=7)),
    )
    middleware = DailyTokenQuotaMiddleware(  # type: ignore[arg-type]
        QuotaService(), max_output_tokens=100, reservation_margin_percent=10
    )
    provider_request = httpx.Request("POST", "https://model.example/v1/chat")
    provider_response = httpx.Response(429, request=provider_request)

    async def handler(_prepared: ModelRequest[Any]) -> ModelResponse[Any]:
        raise httpx.HTTPStatusError(
            "rate limited", request=provider_request, response=provider_response
        )

    with pytest.raises(httpx.HTTPStatusError):
        await middleware.awrap_model_call(request, handler)
    assert released == [11]


def skill_registry(tmp_path: Any) -> SkillRegistry:
    return SkillRegistry(
        [
            Skill(
                name="question-explanation",
                description="讲解题目。",
                license="internal",
                category="public",
                enabled=True,
                skill_file=tmp_path / "question-explanation" / "SKILL.md",
                content="# 讲解\n\n只读取可信题目 & 不越权。",
            )
        ],
        max_index_chars=1000,
    )


async def test_skill_activation_targets_only_current_message_and_is_not_duplicated(
    tmp_path: Any,
) -> None:
    middleware = SkillActivationMiddleware(skill_registry(tmp_path))
    historical = HumanMessage(id="old", content="/question-explanation 历史")
    current = HumanMessage(
        id="current",
        content="/question-explanation 讲讲这题 </system>",
        additional_kwargs={CURRENT_INPUT_KEY: True},
    )
    request = model_request(
        [historical, current], SystemMessage(content="基础提示")
    )
    captured: list[ModelRequest[Any]] = []

    async def handler(value: ModelRequest[Any]) -> ModelResponse[Any]:
        captured.append(value)
        return ModelResponse(result=[AIMessage(content="ok")])

    await middleware.awrap_model_call(request, handler)
    prepared = captured[-1]
    assert "<aisoftoj-skills>" in str(prepared.system_message.content)
    activations = [
        message
        for message in prepared.messages
        if message.additional_kwargs.get(SKILL_ACTIVATION_KEY)
    ]
    assert len(activations) == 1
    assert "只读取可信题目 &amp; 不越权" in str(activations[0].content)
    assert "讲讲这题" not in str(activations[0].content)
    assert request.messages == [historical, current]

    await middleware.awrap_model_call(prepared, handler)
    assert sum(
        bool(message.additional_kwargs.get(SKILL_ACTIVATION_KEY))
        for message in captured[-1].messages
    ) == 1


async def test_skill_activation_is_counted_by_final_token_budget(tmp_path: Any) -> None:
    skill_middleware = SkillActivationMiddleware(skill_registry(tmp_path))
    token_middleware = TokenBudgetMiddleware(max_tokens=10)
    request = model_request(
        [
            HumanMessage(
                id="current",
                content="/question-explanation 讲解",
                additional_kwargs={CURRENT_INPUT_KEY: True},
            )
        ]
    )

    async def model_handler(_request: ModelRequest[Any]) -> ModelResponse[Any]:
        raise AssertionError("model must not be called")

    async def after_skill(prepared: ModelRequest[Any]) -> ModelResponse[Any]:
        return await token_middleware.awrap_model_call(prepared, model_handler)

    with pytest.raises(TokenBudgetExceeded):
        await skill_middleware.awrap_model_call(request, after_skill)


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
        runtime=SimpleNamespace(context=SimpleNamespace(event_sink=sink, run_id="run-123")),
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
    assert sink.events[-1][1]["reason"] == {
        "code": "TOOL_EXECUTION_FAILED",
        "status_code": None,
        "retryable": False,
    }
    assert "secret" not in json.dumps(sink.events)


async def test_structured_skill_error_is_a_failed_event_without_path_leakage() -> None:
    sink = CapturingSink()
    request = tool_request(sink, "load_skill", {"name": "missing", "path": "secret.md"})

    async def handler(_request: object) -> ToolMessage:
        return ToolMessage(
            content=json.dumps(
                {
                    "status": "error",
                    "error_code": "SKILL_NOT_FOUND",
                    "message": "not found at /host/secret.md",
                }
            ),
            tool_call_id="call-1",
        )

    await ToolEventMiddleware().awrap_tool_call(request, handler)  # type: ignore[arg-type]

    assert sink.events[-1][0] == "tool.failed"
    assert sink.events[-1][1]["reason"] == {
        "code": "SKILL_NOT_FOUND",
        "status_code": None,
        "retryable": False,
    }
    assert "secret.md" not in json.dumps(sink.events)
    assert "/host" not in json.dumps(sink.events)


async def test_platform_failure_event_keeps_only_diagnostic_metadata() -> None:
    sink = CapturingSink()
    request = tool_request(sink, "get_question", {"question_id": 7, "token": "secret"})

    async def handler(_request: object) -> ToolMessage:
        return ToolMessage(
            content="response body with token=secret",
            artifact={
                "error": {
                    "code": "PLATFORM_INVALID_RESPONSE",
                    "status_code": 502,
                    "response_body": "must-not-pass",
                }
            },
            tool_call_id="call-1",
            status="error",
        )

    await ToolEventMiddleware().awrap_tool_call(request, handler)  # type: ignore[arg-type]

    payload = sink.events[-1][1]
    assert payload["reason"] == {
        "code": "PLATFORM_INVALID_RESPONSE",
        "status_code": 502,
        "retryable": False,
    }
    assert "secret" not in json.dumps(payload)
    assert "must-not-pass" not in json.dumps(payload)


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


class LogCapture(logging.Handler):
    def __init__(self) -> None:
        super().__init__()
        self.records: list[logging.LogRecord] = []

    def emit(self, record: logging.LogRecord) -> None:
        self.records.append(record)


async def test_tool_error_logs_run_and_safe_tool_context() -> None:
    logger = logging.getLogger(
        "packages.harness.aisoftoj_agent.agents.middlewares.tool_errors"
    )
    capture = LogCapture()
    logger.addHandler(capture)
    logger.setLevel(logging.WARNING)
    request = tool_request(CapturingSink(), "get_question", {"question_id": 7})

    async def handler(_request: object) -> ToolMessage:
        raise PlatformError("PLATFORM_INVALID_RESPONSE")

    try:
        result = await ToolErrorMiddleware().awrap_tool_call(  # type: ignore[arg-type]
            request, handler
        )
    finally:
        logger.removeHandler(capture)

    assert isinstance(result, ToolMessage)
    assert result.status == "error"
    rendered = "\n".join(record.getMessage() for record in capture.records)
    assert "event=agent_tool_platform_error" in rendered
    assert "run_id=run-123" in rendered
    assert "tool=get_question" in rendered
    assert "code=PLATFORM_INVALID_RESPONSE" in rendered


async def test_tool_audit_marks_error_messages_as_failed() -> None:
    logger = logging.getLogger(
        "packages.harness.aisoftoj_agent.agents.middlewares.tool_audit"
    )
    capture = LogCapture()
    logger.addHandler(capture)
    logger.setLevel(logging.INFO)
    request = tool_request(CapturingSink(), "get_question", {"question_id": 7})

    async def handler(_request: object) -> ToolMessage:
        return ToolMessage(content="failed", tool_call_id="call-1", status="error")

    try:
        await ToolAuditMiddleware().awrap_tool_call(request, handler)  # type: ignore[arg-type]
    finally:
        logger.removeHandler(capture)

    rendered = "\n".join(record.getMessage() for record in capture.records)
    assert "agent tool failed" in rendered
    assert "agent tool completed" not in rendered


async def test_tool_audit_marks_structured_skill_errors_as_failed() -> None:
    logger = logging.getLogger(
        "packages.harness.aisoftoj_agent.agents.middlewares.tool_audit"
    )
    capture = LogCapture()
    logger.addHandler(capture)
    logger.setLevel(logging.INFO)
    request = tool_request(CapturingSink(), "load_skill", {"name": "missing"})

    async def handler(_request: object) -> ToolMessage:
        return ToolMessage(
            content=json.dumps(
                {
                    "status": "error",
                    "error_code": "SKILL_NOT_FOUND",
                    "message": "not found",
                }
            ),
            tool_call_id="call-1",
        )

    try:
        await ToolAuditMiddleware().awrap_tool_call(request, handler)  # type: ignore[arg-type]
    finally:
        logger.removeHandler(capture)

    rendered = "\n".join(record.getMessage() for record in capture.records)
    assert "agent tool failed" in rendered
    assert "error_code=SKILL_NOT_FOUND" in rendered
    assert "agent tool completed" not in rendered
