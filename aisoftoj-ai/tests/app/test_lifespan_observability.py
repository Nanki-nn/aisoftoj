from __future__ import annotations

from contextlib import asynccontextmanager
from types import SimpleNamespace
from typing import Any

from fastapi import FastAPI

import app.lifespan as lifespan_module
from config import Settings
from packages.harness.aisoftoj_agent.skills import SkillRegistry


def valid_settings() -> Settings:
    return Settings.model_validate({
        "database_url": "mysql+asyncmy://user:secret@127.0.0.1/aisoftoj",
        "platform_base_url": "http://127.0.0.1:8080",
        "platform_service_key": "platform-service-secret",
        "llm_base_url": "https://gateway.example/v1",
        "llm_api_key": "llm-api-secret-value",
        "llm_default_model": "test-model",
    })


class FakeEngine:
    def __init__(self, calls: list[str]) -> None:
        self.calls = calls

    async def dispose(self) -> None:
        self.calls.append("engine.dispose")


class FakeSessionFactory:
    @asynccontextmanager
    async def begin(self):
        yield object()


class FakePlatformClient:
    def __init__(self, calls: list[str], **_kwargs: object) -> None:
        self.calls = calls

    async def close(self) -> None:
        self.calls.append("platform.close")


class FakeRunManager:
    def __init__(self, calls: list[str], **_kwargs: object) -> None:
        self.calls = calls

    async def shutdown(self, _drain_seconds: int) -> None:
        self.calls.append("runs.shutdown")


class FakeTracing:
    enabled = True

    def __init__(self, calls: list[str]) -> None:
        self.calls = calls

    async def aclose(self) -> None:
        self.calls.append("tracing.close")


class FakeRepository:
    def __init__(self, _session: object) -> None:
        pass

    async def interrupt_unfinished(self) -> None:
        pass


async def test_lifespan_injects_and_closes_langsmith_tracing(
    monkeypatch: Any,
) -> None:
    calls: list[str] = []
    settings = valid_settings()
    tracing = FakeTracing(calls)
    engine = FakeEngine(calls)
    session_factory = FakeSessionFactory()
    platform = FakePlatformClient(calls)
    run_manager = FakeRunManager(calls)
    worker_args: dict[str, object] = {}

    monkeypatch.setattr(lifespan_module, "load_settings", lambda: settings)
    monkeypatch.setattr(
        lifespan_module, "configure_application_logging", lambda _level: None
    )
    monkeypatch.setattr(
        lifespan_module.SkillRegistry,
        "from_directory",
        lambda *_args, **_kwargs: SkillRegistry.empty(),
    )
    monkeypatch.setattr(lifespan_module, "build_skill_tools", lambda *_args, **_kwargs: [])
    monkeypatch.setattr(lifespan_module, "create_engine", lambda _url: engine)
    monkeypatch.setattr(
        lifespan_module,
        "create_session_factory",
        lambda _engine: session_factory,
    )
    monkeypatch.setattr(
        lifespan_module,
        "PlatformClient",
        lambda **_kwargs: platform,
    )
    monkeypatch.setattr(
        lifespan_module,
        "build_agent_graph",
        lambda *_args, **_kwargs: SimpleNamespace(),
    )
    monkeypatch.setattr(lifespan_module, "StreamBridge", lambda: SimpleNamespace())
    monkeypatch.setattr(
        lifespan_module,
        "RunManager",
        lambda **_kwargs: run_manager,
    )

    def build_worker(*args: object, **kwargs: object) -> SimpleNamespace:
        worker_args["args"] = args
        worker_args["kwargs"] = kwargs
        return SimpleNamespace()

    monkeypatch.setattr(lifespan_module, "Worker", build_worker)
    monkeypatch.setattr(lifespan_module, "RunRepository", FakeRepository)
    monkeypatch.setattr(
        lifespan_module,
        "build_langsmith_tracing",
        lambda _settings: tracing,
        raising=False,
    )

    app = FastAPI()
    async with lifespan_module.lifespan(app):
        assert app.state.container.langsmith_tracing is tracing
        assert worker_args["kwargs"] == {
            "max_run_seconds": settings.agent_max_run_seconds,
            "tracing": tracing,
            "model_name": "test-model",
        }

    assert calls == [
        "runs.shutdown",
        "tracing.close",
        "platform.close",
        "engine.dispose",
    ]
