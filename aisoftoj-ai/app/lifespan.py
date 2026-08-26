from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from dataclasses import dataclass, field

from fastapi import FastAPI
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker

from app.logging_config import configure_application_logging
from config import Settings, load_settings
from packages.harness.aisoftoj_agent.access_control import AiAccessControlService
from packages.harness.aisoftoj_agent.agents.factory import AgentGraph, build_agent_graph
from packages.harness.aisoftoj_agent.integrations.aisoftoj.client import PlatformClient
from packages.harness.aisoftoj_agent.observability import (
    LangSmithTracing,
    build_langsmith_tracing,
)
from packages.harness.aisoftoj_agent.persistence.engine import create_engine, create_session_factory
from packages.harness.aisoftoj_agent.persistence.repositories.runs import RunRepository
from packages.harness.aisoftoj_agent.persistence.repositories.textbook_indexes import (
    TextbookIndexRepository,
)
from packages.harness.aisoftoj_agent.quota import DailyTokenQuotaService
from packages.harness.aisoftoj_agent.runtime.run_manager import RunManager
from packages.harness.aisoftoj_agent.runtime.stream_bridge import StreamBridge
from packages.harness.aisoftoj_agent.runtime.worker import Worker
from packages.harness.aisoftoj_agent.skills import SkillRegistry, build_skill_tools
from packages.harness.aisoftoj_agent.textbook_rag import (
    TextbookIndexer,
    TextbookIndexTaskManager,
    TextbookTraceService,
)
from packages.harness.aisoftoj_agent.textbook_rag.downloader import SecureTextbookDownloader
from packages.harness.aisoftoj_agent.textbook_rag.embeddings import EmbeddingClient
from packages.harness.aisoftoj_agent.textbook_rag.extractor import PyMuPDFTextbookExtractor
from packages.harness.aisoftoj_agent.textbook_rag.qdrant import QdrantClient


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
    quota_service: DailyTokenQuotaService | None = None
    access_control_service: AiAccessControlService | None = None
    textbook_trace_service: TextbookTraceService | None = None
    textbook_indexer: TextbookIndexer | None = None
    textbook_index_tasks: TextbookIndexTaskManager | None = None
    skill_registry: SkillRegistry = field(default_factory=SkillRegistry.empty)
    langsmith_tracing: LangSmithTracing = field(
        default_factory=LangSmithTracing.disabled
    )


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    settings = load_settings()
    configure_application_logging(settings.log_level)
    skill_registry = SkillRegistry.from_directory(
        settings.resolved_skills_root,
        max_file_bytes=settings.skills_max_file_bytes,
        max_count=settings.skills_max_count,
        max_index_chars=settings.skills_max_index_chars,
        max_resources_per_skill=settings.skills_max_resources_per_skill,
        max_total_resource_bytes=settings.skills_max_total_resource_bytes,
    )
    skill_tools = build_skill_tools(skill_registry, read_max_chars=settings.skills_read_max_chars)
    engine = create_engine(settings.database_url.get_secret_value())
    session_factory = create_session_factory(engine)
    platform_client = PlatformClient(
        base_url=str(settings.platform_base_url).rstrip("/"),
        service_key=settings.platform_service_key.get_secret_value(),
        connect_timeout=settings.platform_connect_timeout_seconds,
        read_timeout=settings.platform_read_timeout_seconds,
        max_response_bytes=settings.platform_max_response_bytes,
    )
    quota_service = DailyTokenQuotaService(session_factory)
    access_control_service = AiAccessControlService(session_factory)
    embedding_client: EmbeddingClient | None = None
    qdrant_client: QdrantClient | None = None
    downloader: SecureTextbookDownloader | None = None
    textbook_indexer: TextbookIndexer | None = None
    textbook_index_tasks: TextbookIndexTaskManager | None = None
    if settings.textbook_rag_enabled:
        embedding_client = EmbeddingClient(
            base_url=settings.resolved_textbook_embedding_base_url,
            api_key=settings.resolved_textbook_embedding_api_key,
            model=settings.textbook_embedding_model,
            batch_size=settings.textbook_embedding_batch_size,
            timeout_seconds=settings.llm_request_timeout_seconds,
        )
        qdrant_client = QdrantClient(
            base_url=str(settings.qdrant_url).rstrip("/"),
            collection=settings.qdrant_collection,
            api_key=(
                settings.qdrant_api_key.get_secret_value()
                if settings.qdrant_api_key is not None
                else None
            ),
        )
        downloader = SecureTextbookDownloader(
            allowed_hosts=settings.textbook_allowed_hosts,
            timeout_seconds=settings.textbook_download_timeout_seconds,
            max_bytes=settings.textbook_download_max_bytes,
            max_redirects=settings.textbook_download_max_redirects,
        )
        textbook_indexer = TextbookIndexer(
            settings=settings,
            session_factory=session_factory,
            platform_client=platform_client,
            downloader=downloader,
            extractor=PyMuPDFTextbookExtractor(),
            embedding_client=embedding_client,
            qdrant_client=qdrant_client,
        )
        textbook_index_tasks = TextbookIndexTaskManager(textbook_indexer)
    textbook_trace_service = TextbookTraceService(
        settings=settings,
        session_factory=session_factory,
        platform_client=platform_client,
        embedding_client=embedding_client,
        qdrant_client=qdrant_client,
    )
    agent = build_agent_graph(
        settings,
        platform_client,
        skill_registry=skill_registry,
        skill_tools=skill_tools,
        quota_service=quota_service,
        access_control_service=access_control_service,
        textbook_trace_service=textbook_trace_service,
    )
    langsmith_tracing = build_langsmith_tracing(settings)
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
        tracing=langsmith_tracing,
        model_name=settings.llm_default_model,
    )
    worker.platform_client = platform_client
    async with session_factory.begin() as session:
        await RunRepository(session).interrupt_unfinished()
        await TextbookIndexRepository(session).fail_unfinished()
    await quota_service.recover_unsettled()
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
        quota_service=quota_service,
        access_control_service=access_control_service,
        textbook_trace_service=textbook_trace_service,
        textbook_indexer=textbook_indexer,
        textbook_index_tasks=textbook_index_tasks,
        skill_registry=skill_registry,
        langsmith_tracing=langsmith_tracing,
    )
    app.state.container = container
    app.state.platform_client = platform_client
    try:
        yield
    finally:
        container.ready = False
        await run_manager.shutdown(settings.shutdown_drain_seconds)
        if textbook_index_tasks is not None:
            await textbook_index_tasks.shutdown()
        await langsmith_tracing.aclose()
        if downloader is not None:
            await downloader.close()
        if qdrant_client is not None:
            await qdrant_client.close()
        if embedding_client is not None:
            await embedding_client.close()
        await platform_client.close()
        await engine.dispose()
