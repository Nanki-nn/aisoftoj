from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager
from typing import Any, cast
from unittest.mock import Mock

import pytest
from langsmith import Client

from config import Settings
from packages.harness.aisoftoj_agent.observability.config import LangSmithConfig
from packages.harness.aisoftoj_agent.observability.langsmith import (
    LangSmithTracing,
    _trace_error,
    build_langsmith_tracing,
)


class FakeClient:
    def __init__(self) -> None:
        self.close_calls: list[float | None] = []
        self.close_error: Exception | None = None

    def close(self, timeout: float | None = None) -> None:
        self.close_calls.append(timeout)
        if self.close_error is not None:
            raise self.close_error


def valid_settings() -> Settings:
    return Settings.model_validate({
        "database_url": "mysql+asyncmy://user:secret@127.0.0.1/aisoftoj",
        "platform_base_url": "http://127.0.0.1:8080",
        "platform_service_key": "platform-service-secret",
        "llm_base_url": "https://gateway.example/v1",
        "llm_api_key": "llm-api-secret-value",
        "llm_default_model": "test-model",
    })


def enabled_env(**overrides: str) -> dict[str, str]:
    result = {
        "LANGSMITH_TRACING": "true",
        "LANGSMITH_API_KEY": "langsmith-api-secret",
    }
    result.update(overrides)
    return result


def test_disabled_provider_does_not_construct_client() -> None:
    factory = Mock()

    provider = build_langsmith_tracing(
        valid_settings(), environ={}, client_factory=factory
    )

    assert provider.enabled is False
    factory.assert_not_called()


def test_enabled_provider_builds_batched_secret_safe_client() -> None:
    fake_client = cast(Client, FakeClient())
    factory = Mock(return_value=fake_client)

    provider = build_langsmith_tracing(
        valid_settings(), environ=enabled_env(), client_factory=factory
    )

    kwargs = factory.call_args.kwargs
    assert kwargs["api_url"] == "https://api.smith.langchain.com"
    assert kwargs["api_key"] == "langsmith-api-secret"
    assert kwargs["auto_batch_tracing"] is True
    assert kwargs["tracing_sampling_rate"] == 1.0
    assert callable(kwargs["anonymizer"])
    assert callable(kwargs["tracing_error_callback"])
    redacted = kwargs["anonymizer"]({
        "text": (
            "llm-api-secret-value platform-service-secret "
            "langsmith-api-secret"
        )
    })
    assert "secret" not in redacted["text"]
    assert redacted["text"] == {"redacted": True, "chars": 65}
    assert provider.enabled is True


def test_trace_run_yields_root_runnable_config(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    contexts: list[dict[str, Any]] = []

    @contextmanager
    def recording_context(**kwargs: Any) -> Iterator[None]:
        contexts.append(kwargs)
        yield

    monkeypatch.setattr(
        "packages.harness.aisoftoj_agent.observability.langsmith.tracing_context",
        recording_context,
    )
    config = LangSmithConfig.from_env(enabled_env())
    provider = LangSmithTracing(config, cast(Client, FakeClient()))

    with provider.trace_run(
        run_id="run-1",
        thread_id="thread-1",
        user_id=7,
        question_id=None,
        model="gpt-test",
    ) as runnable:
        assert runnable["run_name"] == "aisoftoj-agent-run"
        assert runnable["metadata"]["question_id"] is None
        assert "user_id" not in runnable["metadata"]
        assert len(runnable["metadata"]["user_id_hash"]) == 16
        assert "environment:development" in runnable["tags"]

    assert contexts[0]["project_name"] == "aisoftoj-agent-dev"
    assert contexts[0]["parent"] is False
    assert contexts[0]["enabled"] is True


def test_disabled_trace_context_overrides_ambient_tracing(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    contexts: list[dict[str, Any]] = []

    @contextmanager
    def recording_context(**kwargs: Any) -> Iterator[None]:
        contexts.append(kwargs)
        yield

    monkeypatch.setattr(
        "packages.harness.aisoftoj_agent.observability.langsmith.tracing_context",
        recording_context,
    )

    with LangSmithTracing.disabled().trace_run(
        run_id="run-1",
        thread_id="thread-1",
        user_id=7,
        question_id=3,
        model="gpt-test",
    ):
        pass

    assert contexts[0]["enabled"] is False
    assert contexts[0]["client"] is None
    assert contexts[0]["parent"] is False


def test_trace_error_log_does_not_include_exception_message(
    caplog: pytest.LogCaptureFixture,
) -> None:
    _trace_error(RuntimeError("langsmith-api-secret"))

    rendered = caplog.text
    assert "event=langsmith_trace_export_failed" in rendered
    assert "RuntimeError" in rendered
    assert "langsmith-api-secret" not in rendered


async def test_close_passes_one_whole_sequence_timeout() -> None:
    fake_client = FakeClient()
    provider = LangSmithTracing(
        LangSmithConfig.from_env(
            enabled_env(LANGSMITH_FLUSH_TIMEOUT_SECONDS="2.5")
        ),
        cast(Client, fake_client),
    )

    await provider.aclose()

    assert fake_client.close_calls == [2.5]


async def test_close_error_is_logged_without_raising(
    caplog: pytest.LogCaptureFixture,
) -> None:
    fake_client = FakeClient()
    fake_client.close_error = RuntimeError("close-secret")
    provider = LangSmithTracing(
        LangSmithConfig.from_env(enabled_env()), cast(Client, fake_client)
    )

    await provider.aclose()

    assert "event=langsmith_trace_close_failed" in caplog.text
    assert "RuntimeError" in caplog.text
    assert "close-secret" not in caplog.text
