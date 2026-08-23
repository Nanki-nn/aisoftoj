from __future__ import annotations

import asyncio
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from types import SimpleNamespace
from typing import Any, cast

import httpx
import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.auth.dependencies import get_trusted_user
from app.lifespan import AppState
from app.main import create_app
from config import PROJECT_ROOT
from packages.harness.aisoftoj_agent.integrations.aisoftoj.client import PlatformClient
from packages.harness.aisoftoj_agent.integrations.aisoftoj.context import TrustedUser
from packages.harness.aisoftoj_agent.persistence.models import Base
from packages.harness.aisoftoj_agent.persistence.repositories.runs import RunRepository
from packages.harness.aisoftoj_agent.runtime.run_manager import RunManager
from packages.harness.aisoftoj_agent.runtime.stream_bridge import StreamBridge
from packages.harness.aisoftoj_agent.runtime.worker import Worker
from packages.harness.aisoftoj_agent.skills import CURRENT_INPUT_KEY, SkillRegistry


class IdleWorker:
    async def execute(self, run_id: str, context: object) -> None:
        await asyncio.sleep(0)


@pytest.fixture
async def api_client() -> AsyncGenerator[tuple[httpx.AsyncClient, PlatformClient, Any], None]:
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    platform = PlatformClient(
        base_url="http://127.0.0.1:8080",
        service_key="test",
        transport=httpx.MockTransport(lambda _: httpx.Response(500)),
    )
    app = create_app()
    app.router.lifespan_context = _empty_lifespan
    app.state.container = AppState(
        settings=cast(Any, SimpleNamespace(llm_default_model="test-model")),
        ready=True,
        engine=engine,
        session_factory=session_factory,
        platform_client=platform,
        agent=cast(Any, SimpleNamespace()),
        stream_bridge=StreamBridge(),
        run_manager=RunManager(max_runs=4, max_user_runs=2),
        worker=cast(Any, IdleWorker()),
    )
    app.state.platform_client = platform
    app.dependency_overrides[get_trusted_user] = lambda: TrustedUser(
        user_id=7,
        username="reader",
        nickname=None,
        role="USER",
        bearer_token="jwt",
    )
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://test"
    ) as client:
        yield client, platform, app
    await app.state.container.run_manager.shutdown(0)
    await platform.close()
    await engine.dispose()


@asynccontextmanager
async def _empty_lifespan(_app: object) -> AsyncGenerator[None, None]:
    yield


async def test_thread_and_message_endpoints_are_owner_scoped(
    api_client: tuple[httpx.AsyncClient, PlatformClient, object],
) -> None:
    client, _platform, _app = api_client
    created = await client.post("/api/ai/threads", json={"title": "错题复习"})
    assert created.status_code == 201
    thread_id = created.json()["id"]

    listed = await client.get("/api/ai/threads")
    assert listed.status_code == 200
    assert listed.json()["items"][0]["id"] == thread_id

    messages = await client.get(f"/api/ai/threads/{thread_id}/messages")
    assert messages.status_code == 200
    assert messages.json()["items"] == []


async def test_skill_endpoint_returns_authenticated_metadata_only(
    api_client: tuple[httpx.AsyncClient, PlatformClient, Any],
) -> None:
    client, _platform, app = api_client
    app.state.container.skill_registry = SkillRegistry.from_directory(
        PROJECT_ROOT / "skills" / "public",
        max_file_bytes=256 * 1024,
        max_count=100,
        max_index_chars=12_000,
    )

    identity_override = app.dependency_overrides.pop(get_trusted_user)
    try:
        unauthorized = await client.get("/api/ai/skills")
    finally:
        app.dependency_overrides[get_trusted_user] = identity_override
    assert unauthorized.status_code == 401

    response = await client.get("/api/ai/skills")

    assert response.status_code == 200
    assert response.json()["total"] == 1
    assert response.json()["items"] == [
        {
            "name": "question-explanation",
            "description": (
                "基于平台可信题目数据讲解软考题干、考点、选项依据和易错点；"
                "用于用户要求解析当前题、复盘错题或比较选项时。"
            ),
            "category": "public",
            "enabled": True,
            "license": "internal",
        }
    ]
    encoded = response.text.lower()
    assert "skill.md" not in encoded
    assert "content" not in encoded


async def test_run_creation_is_idempotent(
    api_client: tuple[httpx.AsyncClient, PlatformClient, object],
) -> None:
    client, _platform, _app = api_client
    thread_id = (await client.post("/api/ai/threads", json={})).json()["id"]
    headers = {"Idempotency-Key": "same-request"}
    first = await client.post(
        f"/api/ai/threads/{thread_id}/runs", json={"message": "查看我的错题"}, headers=headers
    )
    second = await client.post(
        f"/api/ai/threads/{thread_id}/runs", json={"message": "查看我的错题"}, headers=headers
    )
    assert first.status_code == 202
    assert second.status_code == 200
    assert first.json()["id"] == second.json()["id"]


async def test_run_persists_first_question_context_across_idempotent_replay(
    api_client: tuple[httpx.AsyncClient, PlatformClient, Any],
) -> None:
    client, _platform, app = api_client
    thread_id = (await client.post("/api/ai/threads", json={})).json()["id"]
    headers = {"Idempotency-Key": "question-snapshot"}
    first = await client.post(
        f"/api/ai/threads/{thread_id}/runs",
        json={"message": "讲讲这题", "context": {"question_id": 123}},
        headers=headers,
    )
    second = await client.post(
        f"/api/ai/threads/{thread_id}/runs",
        json={"message": "讲讲这题", "context": {"question_id": 456}},
        headers=headers,
    )

    assert first.status_code == 202
    assert second.status_code == 200
    async with app.state.container.session_factory() as session:
        run = await RunRepository(session).get(first.json()["id"])
        assert run is not None
        assert run.question_id == 123
    worker = Worker(
        app.state.container.session_factory,
        cast(Any, SimpleNamespace()),
        app.state.container.stream_bridge,
        max_run_seconds=30,
    )
    assert await worker._load_question_id(first.json()["id"]) == 123
    messages = await worker._load_messages(
        thread_id, current_input_id=run.input_message_id
    )
    current = [
        message
        for message in messages
        if message.additional_kwargs.get(CURRENT_INPUT_KEY) is True
    ]
    assert len(current) == 1
    assert str(current[0].id) == run.input_message_id


@pytest.mark.parametrize(
    "context",
    [
        {"question_id": "123"},
        {"question_id": True},
        {"question_id": 1.5},
        {"question_id": 0},
        {"question_id": -1},
        {"question_id": 2_147_483_648},
        {"question_id": 1, "unknown": "value"},
    ],
)
async def test_run_rejects_invalid_question_context_without_creating_message(
    api_client: tuple[httpx.AsyncClient, PlatformClient, Any],
    context: object,
) -> None:
    client, _platform, app = api_client
    thread_id = (await client.post("/api/ai/threads", json={})).json()["id"]
    response = await client.post(
        f"/api/ai/threads/{thread_id}/runs",
        json={"message": "讲讲这题", "context": context},
        headers={"Idempotency-Key": "invalid-context"},
    )

    assert response.status_code == 422
    messages = await client.get(f"/api/ai/threads/{thread_id}/messages")
    assert messages.json()["items"] == []
    async with app.state.container.session_factory() as session:
        runs, total = await RunRepository(session).list_for_thread(thread_id, 1, 20)
        assert runs == []
        assert total == 0


@pytest.mark.parametrize("context", [None, {}])
async def test_run_accepts_empty_question_context(
    api_client: tuple[httpx.AsyncClient, PlatformClient, Any],
    context: object,
) -> None:
    client, _platform, app = api_client
    thread_id = (await client.post("/api/ai/threads", json={})).json()["id"]
    response = await client.post(
        f"/api/ai/threads/{thread_id}/runs",
        json={"message": "继续", "context": context},
        headers={"Idempotency-Key": f"empty-context-{context!s}"},
    )

    assert response.status_code == 202
    async with app.state.container.session_factory() as session:
        run = await RunRepository(session).get(response.json()["id"])
        assert run is not None
        assert run.question_id is None


async def test_run_events_are_owner_scoped_and_paginated(
    api_client: tuple[httpx.AsyncClient, PlatformClient, Any],
) -> None:
    client, _platform, app = api_client
    thread_id = (await client.post("/api/ai/threads", json={})).json()["id"]
    created = await client.post(
        f"/api/ai/threads/{thread_id}/runs",
        json={"message": "查看我的错题"},
        headers={"Idempotency-Key": "event-page"},
    )
    run_id = created.json()["id"]
    async with app.state.container.session_factory.begin() as session:
        repository = RunRepository(session)
        await repository.append_event(run_id, "message.delta", {"delta": "一"})
        await repository.append_event(run_id, "message.delta", {"delta": "二"})

    first = await client.get(
        f"/api/ai/threads/{thread_id}/runs/{run_id}/events?limit=1"
    )
    assert first.status_code == 200
    assert first.json()["has_more"] is True
    cursor = first.json()["next_after_sequence"]
    second = await client.get(
        f"/api/ai/threads/{thread_id}/runs/{run_id}/events"
        f"?after_sequence={cursor}&limit=10"
    )
    assert second.status_code == 200
    assert all(item["sequence"] > cursor for item in second.json()["items"])
    assert second.json()["has_more"] is False


async def test_live_deltas_are_not_persisted_and_terminal_sequence_stays_newer(
    api_client: tuple[httpx.AsyncClient, PlatformClient, Any],
) -> None:
    client, _platform, app = api_client
    thread_id = (await client.post("/api/ai/threads", json={})).json()["id"]
    created = await client.post(
        f"/api/ai/threads/{thread_id}/runs",
        json={"message": "解释这道题"},
        headers={"Idempotency-Key": "ephemeral-delta"},
    )
    run_id = created.json()["id"]
    worker = Worker(
        app.state.container.session_factory,
        cast(Any, SimpleNamespace()),
        app.state.container.stream_bridge,
        max_run_seconds=30,
    )
    subscription = await app.state.container.stream_bridge.subscribe(run_id)

    await worker._initialize_event_sequence(run_id)
    await worker._publish_delta(run_id, "第一段")
    await worker._publish_delta(run_id, "第二段")
    await worker._complete(run_id, thread_id, "第一段第二段")

    live_events = [await subscription.receive() for _ in range(4)]
    assert [event.type for event in live_events if event is not None] == [
        "message.delta",
        "message.delta",
        "message.completed",
        "run.completed",
    ]
    live_sequences = [event.sequence for event in live_events if event is not None]
    assert live_sequences == sorted(set(live_sequences))
    assert live_sequences[-1] > live_sequences[-2]

    async with app.state.container.session_factory() as session:
        stored = await RunRepository(session).list_events_after(run_id, 0)
    assert [event.event_type for event in stored] == [
        "run.created",
        "message.completed",
        "run.completed",
    ]
    assert [event.sequence for event in stored] == [1, 4, 5]


async def test_stream_finishes_when_run_completes_during_subscription(
    api_client: tuple[httpx.AsyncClient, PlatformClient, Any],
) -> None:
    client, _platform, app = api_client
    thread_id = (await client.post("/api/ai/threads", json={})).json()["id"]
    created = await client.post(
        f"/api/ai/threads/{thread_id}/runs",
        json={"message": "查看练习历史"},
        headers={"Idempotency-Key": "subscription-race"},
    )
    run_id = created.json()["id"]

    class CompletingBridge(StreamBridge):
        async def subscribe(self, subscribed_run_id: str):  # type: ignore[no-untyped-def]
            subscription = await super().subscribe(subscribed_run_id)
            async with app.state.container.session_factory.begin() as session:
                repository = RunRepository(session)
                run = await repository.get(subscribed_run_id)
                assert run is not None
                await repository.transition(run, "completed")
                await repository.append_event(
                    subscribed_run_id,
                    "run.completed",
                    {"status": "completed", "error_code": None},
                )
            await self.close(subscribed_run_id)
            return subscription

    app.state.container.stream_bridge = CompletingBridge()
    response = await client.get(f"/api/ai/threads/{thread_id}/runs/{run_id}/stream")

    assert response.status_code == 200
    assert "event: run.completed" in response.text
    assert "event: stream.end" in response.text
