from __future__ import annotations

from pathlib import Path
from typing import Any

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from config import Settings
from packages.harness.aisoftoj_agent.integrations.aisoftoj.models import Profile
from packages.harness.aisoftoj_agent.persistence.models import AiTextbookIndex, Base
from packages.harness.aisoftoj_agent.textbook_rag.downloader import DownloadedTextbook
from packages.harness.aisoftoj_agent.textbook_rag.hashing import catalog_content_hash
from packages.harness.aisoftoj_agent.textbook_rag.indexing import TextbookIndexer
from packages.harness.aisoftoj_agent.textbook_rag.models import PageText, TextbookChunk
from tests.harness.textbook_rag.test_retrieval import catalog


class FakePlatform:
    async def get_profile(self, _token: str) -> Profile:
        return Profile(
            user_id=1,
            username="admin",
            nickname=None,
            role="ADMIN",
            join_date=None,
            last_login_date=None,
            practice_session_count=0,
            wrong_question_count=0,
        )

    async def get_textbook_catalog(self, _token: str, _textbook_id: int) -> Any:
        return catalog()


class FakeDownloader:
    def __init__(self, path: Path, source_hash: str) -> None:
        self.path = path
        self.source_hash = source_hash

    async def download(self, _url: str) -> DownloadedTextbook:
        self.path.write_bytes(b"%PDF-1.7\nfixture")
        return DownloadedTextbook(path=self.path, sha256=self.source_hash)


class FakeExtractor:
    name = "fake"
    version = "1"

    def __init__(self) -> None:
        self.calls = 0

    def extract(self, _path: Path) -> list[PageText]:
        self.calls += 1
        return [
            PageText(
                pdf_page=92,
                text="管道过滤器架构由过滤器和连接过滤器的管道组成。",
            )
        ]


class FakeEmbeddings:
    async def embed(self, texts: list[str]) -> list[list[float]]:
        return [[0.1, 0.2, 0.3] for _text in texts]


class FakeQdrant:
    def __init__(self, point_count: int) -> None:
        self.point_count = point_count
        self.upserted: list[TextbookChunk] = []
        self.deleted: list[tuple[int, str]] = []

    async def count_index_points(self, _textbook_id: int, _index_version: str) -> int:
        return self.point_count

    async def ensure_collection(self, _dimensions: int) -> None:
        return None

    async def upsert(
        self, chunks: list[TextbookChunk], _vectors: list[list[float]], batch_size: int = 64
    ) -> None:
        del batch_size
        self.upserted.extend(chunks)

    async def delete_index_points(self, textbook_id: int, index_version: str) -> None:
        self.deleted.append((textbook_id, index_version))


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
            "textbook_embedding_dimensions": 3,
            "textbook_chunk_target_chars": 200,
            "textbook_chunk_overlap_chars": 20,
        }
    )


async def database_with_reusable_index(source_hash: str) -> tuple[
    AsyncEngine, async_sessionmaker[AsyncSession]
]:
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    async with session_factory.begin() as session:
        session.add(
            AiTextbookIndex(
                id="c185c2ad-d5ea-488b-bc87-d64c9dd77818",
                textbook_id=1,
                index_version="v-old",
                source_hash=source_hash,
                catalog_hash=catalog_content_hash(catalog()),
                retrieval_profile_version="textbook-rag-v1",
                parser_name="fake",
                parser_version="1",
                embedding_model="text-embedding-3-small",
                reranker_model="dense-lexical-v1",
                collection_name="aisoftoj_textbook_chunks",
                chunk_count=1,
                status="ACTIVE",
            )
        )
    return engine, session_factory


async def test_reuses_index_only_when_qdrant_points_still_exist(tmp_path: Path) -> None:
    source_hash = "a" * 64
    engine, session_factory = await database_with_reusable_index(source_hash)
    extractor = FakeExtractor()
    qdrant = FakeQdrant(point_count=1)
    indexer = TextbookIndexer(
        settings=settings(),
        session_factory=session_factory,
        platform_client=FakePlatform(),  # type: ignore[arg-type]
        downloader=FakeDownloader(tmp_path / "book.pdf", source_hash),  # type: ignore[arg-type]
        extractor=extractor,  # type: ignore[arg-type]
        embedding_client=FakeEmbeddings(),  # type: ignore[arg-type]
        qdrant_client=qdrant,  # type: ignore[arg-type]
    )

    result = await indexer.index("jwt", 1)
    await engine.dispose()

    assert result["reused"] is True
    assert result["indexVersion"] == "v-old"
    assert extractor.calls == 0
    assert qdrant.upserted == []


async def test_rebuilds_missing_reusable_vectors_and_cleans_retired_version(
    tmp_path: Path,
) -> None:
    source_hash = "b" * 64
    engine, session_factory = await database_with_reusable_index(source_hash)
    extractor = FakeExtractor()
    qdrant = FakeQdrant(point_count=0)
    indexer = TextbookIndexer(
        settings=settings(),
        session_factory=session_factory,
        platform_client=FakePlatform(),  # type: ignore[arg-type]
        downloader=FakeDownloader(tmp_path / "book.pdf", source_hash),  # type: ignore[arg-type]
        extractor=extractor,  # type: ignore[arg-type]
        embedding_client=FakeEmbeddings(),  # type: ignore[arg-type]
        qdrant_client=qdrant,  # type: ignore[arg-type]
    )

    result = await indexer.index("jwt", 1)
    await engine.dispose()

    assert result["reused"] is False
    assert extractor.calls == 1
    assert len(qdrant.upserted) == 1
    assert qdrant.deleted == [(1, "v-old")]
