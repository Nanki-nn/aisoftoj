from __future__ import annotations

import asyncio
import hashlib
import io
import logging
from collections.abc import AsyncIterator
from dataclasses import dataclass
from pathlib import Path
from zipfile import ZipFile

import anyio
import fitz  # type: ignore[import-untyped]
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from config import Settings

from ..integrations.mineru import (
    MineruClient,
    MineruError,
    MineruFileSpec,
    MineruParseOptions,
)
from ..persistence.models import AiKnowledgeDocument
from ..persistence.repositories.knowledge_documents import KnowledgeDocumentRepository
from .indexing import KnowledgeIndexer, KnowledgeIndexingError
from .markdown import offset_page_markers

logger = logging.getLogger(__name__)
PARSED_MARKDOWN_DIR = anyio.Path("storage/knowledge/parsed")
PARTS_DIR = anyio.Path("storage/knowledge/.parts")
PARTS_ROOT = Path("storage/knowledge/.parts")
MAX_PAGES_PER_PART = 200
MAX_PARTS_PER_BATCH = 50


@dataclass(frozen=True, slots=True)
class _PdfPart:
    path: Path
    page_offset: int


class MineruKnowledgeTaskManager:
    def __init__(
        self,
        *,
        settings: Settings,
        session_factory: async_sessionmaker[AsyncSession],
        mineru_client: MineruClient,
        indexer: KnowledgeIndexer,
    ) -> None:
        self.settings = settings
        self.session_factory = session_factory
        self.mineru_client = mineru_client
        self.indexer = indexer
        self._tasks: dict[str, asyncio.Task[None]] = {}
        self._lock = asyncio.Lock()

    async def start(self, document_id: str) -> None:
        async with self._lock:
            if document_id in self._tasks:
                return
            self._tasks[document_id] = asyncio.create_task(
                self._run(document_id), name=f"mineru-knowledge-{document_id}"
            )

    async def resume_pending(self) -> None:
        async with self.session_factory() as session:
            documents = await KnowledgeDocumentRepository(session).list_resumable()
        for document in documents:
            await self.start(document.id)

    async def shutdown(self) -> None:
        async with self._lock:
            tasks = list(self._tasks.values())
        for task in tasks:
            task.cancel()
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)

    async def cancel(self, document_id: str) -> None:
        async with self._lock:
            task = self._tasks.pop(document_id, None)
        if task is not None:
            task.cancel()
            await asyncio.gather(task, return_exceptions=True)

    async def delete_index(self, document_id: str, index_version: str) -> None:
        await self.indexer.delete(document_id, index_version)

    async def cleanup_parts(self, document_id: str) -> None:
        await self._cleanup_pdf_parts(document_id)

    async def read_markdown(self, document_id: str) -> str | None:
        document = await self._get_document(document_id)
        if document is None:
            return None
        markdown = await self._load_or_download_markdown(document)
        return markdown.decode("utf-8")

    async def _run(self, document_id: str) -> None:
        try:
            document = await self._get_document(document_id)
            if document is None or document.status in {"ACTIVE", "FAILED"}:
                return
            task_id = document.mineru_task_id
            batch_id = document.mineru_batch_id
            if document.local_path is not None and batch_id is None:
                parts = await self._prepare_pdf_parts(document.id, document.local_path)
                upload = await self.mineru_client.request_upload_urls(
                    [MineruFileSpec(name=part.path.name) for part in parts],
                    options=MineruParseOptions(is_ocr=document.is_ocr),
                )
                if len(upload.file_urls) != len(parts):
                    raise MineruError(
                        "UPLOAD_URL_COUNT_MISMATCH", "MinerU upload URL count mismatch"
                    )
                for upload_url, part in zip(upload.file_urls, parts, strict=True):
                    await self.mineru_client.upload_file(
                        str(upload_url), self._read_file(str(part.path))
                    )
                batch_id = upload.batch_id
                await self._mark_batch_parsing(document_id, batch_id)
            elif task_id is None and batch_id is None:
                task = await self.mineru_client.submit_url(
                    document.source_url,
                    options=MineruParseOptions(is_ocr=document.is_ocr),
                )
                task_id = task.task_id
                await self._mark_parsing(document_id, task_id)
                document = await self._get_document(document_id)
                if document is None:
                    return
            markdown_url = document.markdown_url
            if markdown_url is None:
                if batch_id is not None:
                    markdown = await self._download_batch_markdown(batch_id, document)
                else:
                    if task_id is None:
                        raise MineruError("TASK_MISSING", "MinerU task is missing")
                    markdown_url = await self._wait_for_result(task_id)
                    markdown = await self._download_markdown(markdown_url)
                source_hash = hashlib.sha256(markdown).hexdigest()
                parsed_path = await self._save_markdown(document_id, markdown)
                await self._mark_indexing(
                    document_id,
                    markdown_url if batch_id is None else None,
                    source_hash,
                    parsed_path,
                )
                await self._cleanup_pdf_parts(document_id)
            else:
                markdown = await self._load_or_download_markdown(document)
            current = await self._get_document(document_id)
            if current is None:
                return
            chunk_count = await self.indexer.index(
                document_id=current.id,
                index_version=current.index_version,
                title=current.title,
                markdown=markdown.decode("utf-8"),
            )
            await self._activate(document_id, chunk_count)
        except asyncio.CancelledError:
            raise
        except KnowledgeIndexingError as exc:
            await self._fail(document_id, str(exc.code))
        except MineruError as exc:
            logger.warning(
                "event=mineru_knowledge_task_failed document_id=%s code=%s message=%s",
                document_id,
                exc.code,
                str(exc),
            )
            await self._fail(document_id, str(exc.code))
        except UnicodeDecodeError:
            await self._fail(document_id, "MINERU_MARKDOWN_INVALID")
        except Exception:
            logger.exception("event=mineru_knowledge_task_failed document_id=%s", document_id)
            await self._fail(document_id, "KNOWLEDGE_INDEX_FAILED")
        finally:
            async with self._lock:
                self._tasks.pop(document_id, None)

    async def _wait_for_result(self, task_id: str) -> str:
        deadline = (
            asyncio.get_running_loop().time()
            + self.settings.knowledge_mineru_max_wait_seconds
        )
        while True:
            result = await self.mineru_client.get_task(task_id)
            if result.state == "done":
                result_url = result.markdown_url or result.full_zip_url
                if result_url is not None:
                    return str(result_url)
            if result.state == "failed":
                raise MineruError("TASK_FAILED", result.err_msg or "MinerU parsing failed")
            if asyncio.get_running_loop().time() >= deadline:
                raise MineruError("TASK_TIMEOUT", "MinerU parsing timed out")
            await asyncio.sleep(self.settings.knowledge_mineru_poll_seconds)

    async def _wait_for_batch_results(self, batch_id: str) -> list[tuple[str, str]]:
        deadline = (
            asyncio.get_running_loop().time() + self.settings.knowledge_mineru_max_wait_seconds
        )
        while True:
            result = await self.mineru_client.get_batch(batch_id)
            if any(item.state == "failed" for item in result.extract_result):
                item = next(item for item in result.extract_result if item.state == "failed")
                raise MineruError("TASK_FAILED", item.err_msg or "MinerU parsing failed")
            completed = [
                (item.file_name, str(item.markdown_url or item.full_zip_url))
                for item in result.extract_result
                if item.state == "done" and (item.markdown_url or item.full_zip_url) is not None
            ]
            if completed and len(completed) == len(result.extract_result):
                return completed
            if asyncio.get_running_loop().time() >= deadline:
                raise MineruError("TASK_TIMEOUT", "MinerU parsing timed out")
            await asyncio.sleep(self.settings.knowledge_mineru_poll_seconds)

    async def _download_batch_markdown(
        self, batch_id: str, document: AiKnowledgeDocument
    ) -> bytes:
        results = await self._wait_for_batch_results(batch_id)
        if document.local_path is None:
            return b"\n\n".join(
                [await self._download_markdown(url) for _, url in results]
            )
        parts = await self._prepare_pdf_parts(document.id, document.local_path)
        by_name = {name: url for name, url in results}
        if len(by_name) != len(parts):
            raise MineruError("BATCH_RESULT_COUNT_MISMATCH", "MinerU batch result count mismatch")
        markdowns: list[bytes] = []
        for part in parts:
            url = by_name.get(part.path.name)
            if url is None:
                raise MineruError("BATCH_RESULT_MISSING", "MinerU batch result is missing")
            content = await self._download_markdown(url)
            text = content.decode("utf-8")
            markdowns.append(offset_page_markers(text, part.page_offset).encode("utf-8"))
        return b"\n\n".join(markdowns)

    async def _prepare_pdf_parts(self, document_id: str, local_path: str) -> list[_PdfPart]:
        return await anyio.to_thread.run_sync(_split_pdf_if_needed, document_id, Path(local_path))

    async def _cleanup_pdf_parts(self, document_id: str) -> None:
        directory = PARTS_DIR / document_id
        if not await directory.exists():
            return
        async for path in directory.iterdir():
            if await path.is_file():
                await path.unlink()
        await directory.rmdir()

    @staticmethod
    async def _read_file(path: str) -> AsyncIterator[bytes]:
        async with await anyio.open_file(path, "rb") as file:
            while chunk := await file.read(1024 * 1024):
                yield chunk

    async def _download_markdown(self, result_url: str) -> bytes:
        payload = await self.mineru_client.download_result(result_url)
        if not result_url.lower().split("?", 1)[0].endswith(".zip"):
            return payload
        with ZipFile(io.BytesIO(payload)) as archive:
            markdown_names = [
                name for name in archive.namelist()
                if name.lower().endswith((".md", ".markdown"))
            ]
            if not markdown_names:
                raise MineruError("MARKDOWN_MISSING", "MinerU ZIP does not contain Markdown")
            return archive.read(markdown_names[0])

    async def _load_or_download_markdown(self, document: AiKnowledgeDocument) -> bytes:
        if document.parsed_markdown_path is not None:
            path = anyio.Path(document.parsed_markdown_path)
            if await path.exists():
                return await path.read_bytes()
        if document.markdown_url is None:
            raise MineruError("MARKDOWN_NOT_READY", "MinerU Markdown is not ready")
        markdown = await self._download_markdown(document.markdown_url)
        parsed_path = await self._save_markdown(document.id, markdown)
        async with self.session_factory.begin() as session:
            item = await KnowledgeDocumentRepository(session).get(document.id)
            if item is not None:
                await KnowledgeDocumentRepository(session).set_parsed_markdown_path(
                    item, parsed_path
                )
        return markdown

    async def _save_markdown(self, document_id: str, markdown: bytes) -> str:
        await PARSED_MARKDOWN_DIR.mkdir(parents=True, exist_ok=True)
        path = PARSED_MARKDOWN_DIR / f"{document_id}.md"
        async with await path.open("wb") as file:
            await file.write(markdown)
        return str(path)

    async def _get_document(self, document_id: str) -> AiKnowledgeDocument | None:
        async with self.session_factory() as session:
            return await KnowledgeDocumentRepository(session).get(document_id)

    async def _mark_parsing(self, document_id: str, task_id: str) -> None:
        async with self.session_factory.begin() as session:
            item = await KnowledgeDocumentRepository(session).get(document_id)
            if item is not None:
                await KnowledgeDocumentRepository(session).set_parsing(item, task_id)

    async def _mark_batch_parsing(self, document_id: str, batch_id: str) -> None:
        async with self.session_factory.begin() as session:
            item = await KnowledgeDocumentRepository(session).get(document_id)
            if item is not None:
                await KnowledgeDocumentRepository(session).set_batch_parsing(item, batch_id)

    async def _mark_indexing(
        self,
        document_id: str,
        markdown_url: str | None,
        source_hash: str,
        parsed_markdown_path: str,
    ) -> None:
        async with self.session_factory.begin() as session:
            item = await KnowledgeDocumentRepository(session).get(document_id)
            if item is not None:
                await KnowledgeDocumentRepository(session).set_indexing(
                    item, markdown_url, source_hash, parsed_markdown_path
                )

    async def _activate(self, document_id: str, chunk_count: int) -> None:
        async with self.session_factory.begin() as session:
            item = await KnowledgeDocumentRepository(session).get(document_id)
            if item is not None:
                await KnowledgeDocumentRepository(session).activate(item, chunk_count)

    async def _fail(self, document_id: str, error_code: str) -> None:
        async with self.session_factory.begin() as session:
            item = await KnowledgeDocumentRepository(session).get(document_id)
            if item is not None and item.status != "ACTIVE":
                await KnowledgeDocumentRepository(session).fail(item, error_code)


def _split_pdf_if_needed(document_id: str, source: Path) -> list[_PdfPart]:
    with fitz.open(source) as document:
        page_count = document.page_count
        if page_count <= MAX_PAGES_PER_PART:
            return [_PdfPart(source, 0)]
        part_count = (page_count + MAX_PAGES_PER_PART - 1) // MAX_PAGES_PER_PART
        if part_count > MAX_PARTS_PER_BATCH:
            raise MineruError("PDF_TOO_MANY_PARTS", "PDF exceeds MinerU batch file limit")
        directory = PARTS_ROOT / document_id
        directory.mkdir(parents=True, exist_ok=True)
        parts: list[_PdfPart] = []
        for index, start in enumerate(range(0, page_count, MAX_PAGES_PER_PART), start=1):
            target = directory / f"{document_id}.part-{index:03d}.pdf"
            if not target.exists():
                split = fitz.open()
                split.insert_pdf(
                    document,
                    from_page=start,
                    to_page=min(start + MAX_PAGES_PER_PART, page_count) - 1,
                )
                split.save(target)
                split.close()
            parts.append(_PdfPart(target, start))
        return parts
