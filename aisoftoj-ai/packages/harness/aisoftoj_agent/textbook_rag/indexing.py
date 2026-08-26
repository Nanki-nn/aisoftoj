from __future__ import annotations

import asyncio
from datetime import UTC, datetime
from pathlib import Path
from typing import Any
from uuid import uuid4

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from config import Settings

from ..integrations.aisoftoj.client import PlatformClient
from ..integrations.aisoftoj.models import TextbookCatalog
from ..persistence.models import AiTextbookIndex
from ..persistence.repositories.textbook_indexes import TextbookIndexRepository
from .chunking import build_chunks
from .downloader import SecureTextbookDownloader, TextbookDownloadError
from .embeddings import EmbeddingClient, EmbeddingError
from .extractor import PyMuPDFTextbookExtractor
from .hashing import catalog_content_hash
from .models import PageText, TextbookChunk
from .qdrant import QdrantClient, QdrantError


class TextbookIndexingError(RuntimeError):
    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


class TextbookIndexer:
    def __init__(
        self,
        *,
        settings: Settings,
        session_factory: async_sessionmaker[AsyncSession],
        platform_client: PlatformClient,
        downloader: SecureTextbookDownloader,
        extractor: PyMuPDFTextbookExtractor,
        embedding_client: EmbeddingClient,
        qdrant_client: QdrantClient,
    ) -> None:
        self.settings = settings
        self.session_factory = session_factory
        self.platform_client = platform_client
        self.downloader = downloader
        self.extractor = extractor
        self.embedding_client = embedding_client
        self.qdrant_client = qdrant_client

    async def index(self, bearer_token: str, textbook_id: int) -> dict[str, Any]:
        profile = await self.platform_client.get_profile(bearer_token)
        if profile.role != "ADMIN":
            raise TextbookIndexingError("ADMIN_REQUIRED")
        catalog = await self.platform_client.get_textbook_catalog(bearer_token, textbook_id)
        if not catalog.sections:
            raise TextbookIndexingError("TEXTBOOK_SECTIONS_MISSING")

        downloaded = None
        index_item: AiTextbookIndex | None = None
        try:
            downloaded = await self.downloader.download(str(catalog.official_url))
            catalog_hash = catalog_content_hash(catalog)
            async with self.session_factory.begin() as session:
                repository = TextbookIndexRepository(session)
                reusable = await repository.get_reusable(
                    textbook_id,
                    downloaded.sha256,
                    catalog_hash,
                    self.settings.textbook_embedding_model,
                    self.settings.textbook_retrieval_profile_version,
                )
                if reusable is not None:
                    if reusable.status != "ACTIVE":
                        await repository.activate(reusable, reusable.chunk_count)
                    return _index_response(reusable, reused=True)
                version = _index_version(downloaded.sha256)
                index_item = await repository.create_building(
                    textbook_id=textbook_id,
                    index_version=version,
                    source_hash=downloaded.sha256,
                    catalog_hash=catalog_hash,
                    retrieval_profile_version=(
                        self.settings.textbook_retrieval_profile_version
                    ),
                    parser_name=self.extractor.name,
                    parser_version=self.extractor.version,
                    embedding_model=self.settings.textbook_embedding_model,
                    reranker_model="dense-lexical-v1",
                    collection_name=self.settings.qdrant_collection,
                )

            pages = await asyncio.to_thread(self.extractor.extract, downloaded.path)
            chunks = build_chunks(
                catalog,
                pages,
                index_version=index_item.index_version,
                target_chars=self.settings.textbook_chunk_target_chars,
                overlap_chars=self.settings.textbook_chunk_overlap_chars,
            )
            if not chunks:
                raise TextbookIndexingError("TEXTBOOK_NO_INDEXABLE_TEXT")
            _validate_extraction(catalog, pages, chunks)
            vectors = await self.embedding_client.embed([chunk.text for chunk in chunks])
            if any(
                len(vector) != self.settings.textbook_embedding_dimensions
                for vector in vectors
            ):
                raise TextbookIndexingError("EMBEDDING_DIMENSION_MISMATCH")
            await self.qdrant_client.ensure_collection(
                self.settings.textbook_embedding_dimensions
            )
            await self.qdrant_client.upsert(chunks, vectors)
            async with self.session_factory.begin() as session:
                stored = await session.get(AiTextbookIndex, index_item.id)
                if stored is None:
                    raise TextbookIndexingError("INDEX_STATE_MISSING")
                await TextbookIndexRepository(session).activate(stored, len(chunks))
                index_item = stored
            return _index_response(index_item, reused=False)
        except (TextbookDownloadError, EmbeddingError, QdrantError) as exc:
            code = str(exc) or "INDEX_BUILD_FAILED"
            await self._mark_failed(index_item, code)
            raise TextbookIndexingError(code) from exc
        except TextbookIndexingError as exc:
            await self._mark_failed(index_item, exc.code)
            raise
        except asyncio.CancelledError:
            await asyncio.shield(self._mark_failed(index_item, "INDEX_CANCELLED"))
            raise
        except Exception as exc:
            await self._mark_failed(index_item, "INDEX_BUILD_FAILED")
            raise TextbookIndexingError("INDEX_BUILD_FAILED") from exc
        finally:
            if downloaded is not None:
                _remove_temp(downloaded.path)

    async def _mark_failed(self, item: AiTextbookIndex | None, error_code: str) -> None:
        if item is None:
            return
        async with self.session_factory.begin() as session:
            stored = await session.get(AiTextbookIndex, item.id)
            if stored is not None and stored.status == "BUILDING":
                await TextbookIndexRepository(session).fail(stored, error_code)


class TextbookIndexTaskManager:
    def __init__(self, indexer: TextbookIndexer) -> None:
        self.indexer = indexer
        self._tasks: dict[str, asyncio.Task[None]] = {}
        self._states: dict[str, dict[str, Any]] = {}
        self._active_by_textbook: dict[int, str] = {}
        self._lock = asyncio.Lock()

    async def start(self, bearer_token: str, textbook_id: int) -> dict[str, Any]:
        async with self._lock:
            existing_id = self._active_by_textbook.get(textbook_id)
            if existing_id is not None:
                return dict(self._states[existing_id])
            task_id = str(uuid4())
            state = {
                "taskId": task_id,
                "textbookId": textbook_id,
                "status": "queued",
                "result": None,
                "errorCode": None,
            }
            self._states[task_id] = state
            self._active_by_textbook[textbook_id] = task_id
            self._tasks[task_id] = asyncio.create_task(
                self._run(task_id, bearer_token, textbook_id),
                name=f"textbook-index-{task_id}",
            )
            return dict(state)

    async def get(self, task_id: str) -> dict[str, Any] | None:
        async with self._lock:
            state = self._states.get(task_id)
            return dict(state) if state is not None else None

    async def shutdown(self) -> None:
        async with self._lock:
            tasks = list(self._tasks.values())
        for task in tasks:
            task.cancel()
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)

    async def _run(self, task_id: str, bearer_token: str, textbook_id: int) -> None:
        await self._update(task_id, status="running")
        try:
            result = await self.indexer.index(bearer_token, textbook_id)
            await self._update(task_id, status="completed", result=result)
        except asyncio.CancelledError:
            await self._update(task_id, status="cancelled", error_code="SERVICE_STOPPED")
            raise
        except TextbookIndexingError as exc:
            await self._update(task_id, status="failed", error_code=exc.code)
        except Exception:
            await self._update(task_id, status="failed", error_code="INDEX_BUILD_FAILED")
        finally:
            async with self._lock:
                self._tasks.pop(task_id, None)
                if self._active_by_textbook.get(textbook_id) == task_id:
                    self._active_by_textbook.pop(textbook_id, None)

    async def _update(
        self,
        task_id: str,
        *,
        status: str,
        result: dict[str, Any] | None = None,
        error_code: str | None = None,
    ) -> None:
        async with self._lock:
            state = self._states[task_id]
            state["status"] = status
            state["result"] = result
            state["errorCode"] = error_code


def _index_version(source_hash: str) -> str:
    stamp = datetime.now(UTC).strftime("v%Y%m%d%H%M%S")
    return f"{stamp}-{source_hash[:8]}-{uuid4().hex[:6]}"


def _validate_extraction(
    catalog: TextbookCatalog, pages: list[PageText], chunks: list[TextbookChunk]
) -> None:
    catalog_pages = [
        page
        for page in pages
        if any(
            section.pdf_page_start <= page.pdf_page <= section.pdf_page_end
            for section in catalog.sections
        )
    ]
    if not catalog_pages:
        raise TextbookIndexingError("TEXTBOOK_PAGE_MAPPING_INVALID")
    readable_ratio = sum(bool(page.text.strip()) for page in catalog_pages) / len(catalog_pages)
    if readable_ratio < 0.5:
        raise TextbookIndexingError("TEXTBOOK_TEXT_COVERAGE_LOW")
    parent_ids = {
        section.parent_id for section in catalog.sections if section.parent_id is not None
    }
    leaf_ids = {section.id for section in catalog.sections if section.id not in parent_ids}
    chunk_section_ids = {chunk.section_id for chunk in chunks}
    if leaf_ids and len(leaf_ids & chunk_section_ids) / len(leaf_ids) < 0.5:
        raise TextbookIndexingError("TEXTBOOK_SECTION_COVERAGE_LOW")


def _index_response(item: AiTextbookIndex, *, reused: bool) -> dict[str, Any]:
    return {
        "indexId": item.id,
        "textbookId": item.textbook_id,
        "indexVersion": item.index_version,
        "status": item.status,
        "chunkCount": item.chunk_count,
        "reused": reused,
    }


def _remove_temp(path: Path) -> None:
    try:
        path.unlink(missing_ok=True)
    except OSError:
        return
