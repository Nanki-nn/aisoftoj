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
from packages.harness.aisoftoj_agent.integrations.aisoftoj.client import PlatformClient
from packages.harness.aisoftoj_agent.integrations.aisoftoj.context import TrustedUser
from packages.harness.aisoftoj_agent.persistence.models import Base
from packages.harness.aisoftoj_agent.runtime.run_manager import RunManager
from packages.harness.aisoftoj_agent.runtime.stream_bridge import StreamBridge


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
