from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from dataclasses import dataclass

from fastapi import FastAPI
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker

from config import Settings, load_settings
from packages.harness.aisoftoj_agent.agents.factory import AgentGraph, build_agent_graph
from packages.harness.aisoftoj_agent.integrations.aisoftoj.client import PlatformClient
from packages.harness.aisoftoj_agent.persistence.engine import create_engine, create_session_factory
from packages.harness.aisoftoj_agent.persistence.repositories.runs import RunRepository
from packages.harness.aisoftoj_agent.runtime.run_manager import RunManager
from packages.harness.aisoftoj_agent.runtime.stream_bridge import StreamBridge
from packages.harness.aisoftoj_agent.runtime.worker import Worker


@dataclass(slots=True)
class AppState:
    settings: Settings
    ready: bool
    engine: AsyncEngine
    session_factory: async_sessionmaker[AsyncSession]
    platform_client: PlatformClient
    agent: AgentGraph
    stream_bridge: StreamBridge
    run_manager: RunManager
    worker: Worker


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    settings = load_settings()
    engine = create_engine(settings.database_url.get_secret_value())
    session_factory = create_session_factory(engine)
    platform_client = PlatformClient(
        base_url=str(settings.platform_base_url).rstrip("/"),
        service_key=settings.platform_service_key.get_secret_value(),
        connect_timeout=settings.platform_connect_timeout_seconds,
        read_timeout=settings.platform_read_timeout_seconds,
        max_response_bytes=settings.platform_max_response_bytes,
    )
    agent = build_agent_graph(settings, platform_client)
    stream_bridge = StreamBridge()
    run_manager = RunManager(
        max_runs=settings.agent_max_concurrent_runs,
        max_user_runs=settings.agent_max_user_concurrent_runs,
    )
    worker = Worker(
        session_factory,
        agent,
        stream_bridge,
        max_run_seconds=settings.agent_max_run_seconds,
    )
    async with session_factory.begin() as session:
        await RunRepository(session).interrupt_unfinished()
    container = AppState(
        settings=settings,
        ready=True,
        engine=engine,
        session_factory=session_factory,
        platform_client=platform_client,
        agent=agent,
        stream_bridge=stream_bridge,
        run_manager=run_manager,
        worker=worker,
    )
    app.state.container = container
    app.state.platform_client = platform_client
    try:
        yield
    finally:
        container.ready = False
        await run_manager.shutdown(settings.shutdown_drain_seconds)
        await platform_client.close()
        await engine.dispose()
