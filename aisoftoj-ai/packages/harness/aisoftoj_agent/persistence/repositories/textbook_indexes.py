from __future__ import annotations

from datetime import UTC, datetime
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import AiTextbookIndex


class TextbookIndexRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_active(self, textbook_id: int) -> AiTextbookIndex | None:
        result = await self.session.execute(
            select(AiTextbookIndex).where(
                AiTextbookIndex.textbook_id == textbook_id,
                AiTextbookIndex.status == "ACTIVE",
            )
        )
        return result.scalar_one_or_none()

    async def get_reusable(
        self,
        textbook_id: int,
        source_hash: str,
        catalog_hash: str,
        embedding_model: str,
        retrieval_profile_version: str,
    ) -> AiTextbookIndex | None:
        result = await self.session.execute(
            select(AiTextbookIndex).where(
                AiTextbookIndex.textbook_id == textbook_id,
                AiTextbookIndex.source_hash == source_hash,
                AiTextbookIndex.catalog_hash == catalog_hash,
                AiTextbookIndex.embedding_model == embedding_model,
                AiTextbookIndex.retrieval_profile_version == retrieval_profile_version,
                AiTextbookIndex.status.in_(["ACTIVE", "RETIRED"]),
            )
        )
        return result.scalar_one_or_none()

    async def create_building(
        self,
        *,
        textbook_id: int,
        index_version: str,
        source_hash: str,
        catalog_hash: str,
        retrieval_profile_version: str,
        parser_name: str,
        parser_version: str,
        embedding_model: str,
        reranker_model: str,
        collection_name: str,
    ) -> AiTextbookIndex:
        item = AiTextbookIndex(
            id=str(uuid4()),
            textbook_id=textbook_id,
            index_version=index_version,
            source_hash=source_hash,
            catalog_hash=catalog_hash,
            retrieval_profile_version=retrieval_profile_version,
            parser_name=parser_name,
            parser_version=parser_version,
            embedding_model=embedding_model,
            reranker_model=reranker_model,
            collection_name=collection_name,
            chunk_count=0,
            status="BUILDING",
        )
        self.session.add(item)
        await self.session.flush()
        return item

    async def activate(self, item: AiTextbookIndex, chunk_count: int) -> None:
        now = datetime.now(UTC).replace(tzinfo=None)
        current = await self.get_active(item.textbook_id)
        if current is not None and current.id != item.id:
            current.status = "RETIRED"
            current.retired_at = now
            await self.session.flush()
        item.status = "ACTIVE"
        item.chunk_count = chunk_count
        item.activated_at = now
        item.error_code = None
        await self.session.flush()

    async def fail(self, item: AiTextbookIndex, error_code: str) -> None:
        item.status = "FAILED"
        item.error_code = error_code[:64]
        await self.session.flush()

    async def fail_unfinished(self) -> int:
        result = await self.session.execute(
            select(AiTextbookIndex).where(AiTextbookIndex.status == "BUILDING")
        )
        items = list(result.scalars().all())
        for item in items:
            item.status = "FAILED"
            item.error_code = "SERVICE_RESTARTED"
        await self.session.flush()
        return len(items)
