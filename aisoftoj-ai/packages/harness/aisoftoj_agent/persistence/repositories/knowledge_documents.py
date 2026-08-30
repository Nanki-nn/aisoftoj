from __future__ import annotations

from datetime import UTC, datetime
from uuid import uuid4

from sqlalchemy import ColumnElement, desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import AiKnowledgeDocument


class KnowledgeDocumentRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create(
        self,
        *,
        title: str,
        source_url: str,
        local_path: str | None = None,
        is_ocr: bool,
        embedding_model: str,
        collection_name: str,
        index_version: str,
    ) -> AiKnowledgeDocument:
        item = AiKnowledgeDocument(
            id=str(uuid4()),
            title=title,
            source_url=source_url,
            local_path=local_path,
            is_ocr=is_ocr,
            index_version=index_version,
            embedding_model=embedding_model,
            collection_name=collection_name,
            status="QUEUED",
        )
        self.session.add(item)
        await self.session.flush()
        return item

    async def get(self, document_id: str) -> AiKnowledgeDocument | None:
        return await self.session.get(AiKnowledgeDocument, document_id)

    async def update_title(self, item: AiKnowledgeDocument, title: str) -> None:
        item.title = title
        await self.session.flush()

    async def delete(self, item: AiKnowledgeDocument) -> None:
        await self.session.delete(item)
        await self.session.flush()

    async def list_page(
        self, *, page: int, page_size: int, keyword: str | None, status: str | None
    ) -> tuple[list[AiKnowledgeDocument], int]:
        query = select(AiKnowledgeDocument)
        count_query = select(func.count()).select_from(AiKnowledgeDocument)
        if keyword:
            condition: ColumnElement[bool] = AiKnowledgeDocument.title.ilike(f"%{keyword}%")
            query = query.where(condition)
            count_query = count_query.where(condition)
        if status:
            condition = AiKnowledgeDocument.status == status
            query = query.where(condition)
            count_query = count_query.where(condition)
        query = query.order_by(desc(AiKnowledgeDocument.created_at)).offset(
            (page - 1) * page_size
        ).limit(page_size)
        result = await self.session.execute(query)
        total = int(await self.session.scalar(count_query) or 0)
        return list(result.scalars()), total

    async def list_active(self) -> list[AiKnowledgeDocument]:
        result = await self.session.execute(
            select(AiKnowledgeDocument).where(AiKnowledgeDocument.status == "ACTIVE")
        )
        return list(result.scalars())

    async def list_resumable(self) -> list[AiKnowledgeDocument]:
        result = await self.session.execute(
            select(AiKnowledgeDocument).where(
                AiKnowledgeDocument.status.in_(["QUEUED", "PARSING", "INDEXING"])
            )
        )
        return list(result.scalars())

    async def set_parsing(self, item: AiKnowledgeDocument, task_id: str) -> None:
        item.mineru_task_id = task_id
        item.status = "PARSING"
        item.error_code = None
        await self.session.flush()

    async def set_batch_parsing(self, item: AiKnowledgeDocument, batch_id: str) -> None:
        item.mineru_batch_id = batch_id
        item.status = "PARSING"
        item.error_code = None
        await self.session.flush()

    async def set_indexing(
        self,
        item: AiKnowledgeDocument,
        markdown_url: str | None,
        source_hash: str,
        parsed_markdown_path: str,
    ) -> None:
        item.markdown_url = markdown_url
        item.source_hash = source_hash
        item.parsed_markdown_path = parsed_markdown_path
        item.status = "INDEXING"
        item.error_code = None
        await self.session.flush()

    async def set_parsed_markdown_path(self, item: AiKnowledgeDocument, path: str) -> None:
        item.parsed_markdown_path = path
        await self.session.flush()

    async def activate(self, item: AiKnowledgeDocument, chunk_count: int) -> None:
        item.status = "ACTIVE"
        item.chunk_count = chunk_count
        item.error_code = None
        item.activated_at = datetime.now(UTC).replace(tzinfo=None)
        await self.session.flush()

    async def fail(self, item: AiKnowledgeDocument, error_code: int | str) -> None:
        item.status = "FAILED"
        item.error_code = str(error_code)[:64]
        await self.session.flush()
