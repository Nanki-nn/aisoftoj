from __future__ import annotations

from typing import Any

from pydantic import HttpUrl
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from config import Settings
from packages.harness.aisoftoj_agent.integrations.aisoftoj.models import (
    QuestionOption,
    TextbookTraceQuestion,
)
from packages.harness.aisoftoj_agent.persistence.models import AiTextbookIndex, Base
from packages.harness.aisoftoj_agent.textbook_rag.hashing import catalog_content_hash
from packages.harness.aisoftoj_agent.textbook_rag.models import RetrievedChunk, TextbookChunk
from packages.harness.aisoftoj_agent.textbook_rag.service import TextbookTraceService
from tests.harness.textbook_rag.test_retrieval import catalog


class FakePlatform:
    def __init__(self) -> None:
        self.question_calls = 0
        self.catalog = catalog()

    async def get_textbook_trace_question(
        self, _bearer_token: str, question_id: int
    ) -> TextbookTraceQuestion:
        self.question_calls += 1
        return TextbookTraceQuestion(
            question_id=question_id,
            name="架构风格",
            content="哪种架构由过滤器和管道组成？",
            options=[QuestionOption(key="A", content="管道过滤器")],
            analysis="考查管道过滤器架构",
            question_type="single_choice",
            difficulty="medium",
            subject_name="系统架构设计师",
        )

    async def get_active_textbook_catalog(self, _token: str, _subject: str) -> Any:
        return self.catalog


class FakeEmbeddings:
    def __init__(self) -> None:
        self.calls = 0

    async def embed(self, _texts: list[str]) -> list[list[float]]:
        self.calls += 1
        return [[0.1, 0.2, 0.3]]


class FakeQdrant:
    async def search(self, **_kwargs: object) -> list[RetrievedChunk]:
        chunk = TextbookChunk(
            chunk_id="7aeaf8ed-a19f-4c5b-b0c5-b2c984f45d75",
            textbook_id=1,
            index_version="v1",
            section_id=11,
            chapter_path=["第3章 软件架构", "3.2 架构风格"],
            pdf_page_start=92,
            pdf_page_end=92,
            printed_page_start=86,
            printed_page_end=86,
            chunk_hash="a" * 64,
            text="管道过滤器架构由过滤器和连接过滤器的管道组成。",
        )
        return [RetrievedChunk(chunk=chunk, dense_score=0.92)]


def settings() -> Settings:
    return Settings.model_validate(
        {
            "database_url": "mysql+asyncmy://user:secret@127.0.0.1/aisoftoj_test",
            "platform_service_key": "service-secret",
            "llm_base_url": "https://gateway.example/v1",
            "llm_api_key": "llm-secret",
            "llm_default_model": "model-name",
            "textbook_rag_enabled": True,
            "textbook_allowed_hosts": ["books.example.com"],
            "textbook_retrieval_min_score": 0.5,
        }
    )


async def test_first_read_retrieves_and_second_read_uses_versioned_fact_cache() -> None:
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    async with session_factory.begin() as session:
        session.add(
            AiTextbookIndex(
                id="c185c2ad-d5ea-488b-bc87-d64c9dd77818",
                textbook_id=1,
                index_version="v1",
                source_hash="b" * 64,
                catalog_hash=catalog_content_hash(catalog()),
                retrieval_profile_version="textbook-rag-v1",
                parser_name="pymupdf",
                parser_version="1",
                embedding_model="text-embedding-3-small",
                reranker_model="dense-lexical-v1",
                collection_name="aisoftoj_textbook_chunks",
                chunk_count=1,
                status="ACTIVE",
            )
        )
    platform = FakePlatform()
    embeddings = FakeEmbeddings()
    service = TextbookTraceService(
        settings=settings(),
        session_factory=session_factory,
        platform_client=platform,  # type: ignore[arg-type]
        embedding_client=embeddings,  # type: ignore[arg-type]
        qdrant_client=FakeQdrant(),  # type: ignore[arg-type]
    )

    first = await service.trace("jwt", 7)
    platform.catalog = platform.catalog.model_copy(
        update={"official_url": HttpUrl("https://books.example.com/current.pdf")}
    )
    second = await service.trace("jwt", 7)
    await engine.dispose()

    assert first["status"] == "found"
    assert first["cacheStatus"] == "miss"
    assert second["cacheStatus"] == "hit"
    assert second["sources"][0]["officialUrl"] == "https://books.example.com/current.pdf"
    assert embeddings.calls == 1
    assert platform.question_calls == 2
