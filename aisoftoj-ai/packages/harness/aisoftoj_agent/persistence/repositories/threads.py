from __future__ import annotations

from datetime import UTC, datetime
from uuid import uuid4

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import AiThread


class ThreadRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create(self, user_id: int, title: str | None) -> AiThread:
        thread = AiThread(id=str(uuid4()), user_id=user_id, title=title)
        self.session.add(thread)
        await self.session.flush()
        return thread

    async def get_owned(
        self, user_id: int, thread_id: str, *, for_update: bool = False
    ) -> AiThread | None:
        statement = select(AiThread).where(
            AiThread.id == thread_id,
            AiThread.user_id == user_id,
            AiThread.is_deleted.is_(False),
        )
        if for_update:
            statement = statement.with_for_update()
        result = await self.session.execute(statement)
        return result.scalar_one_or_none()

    async def list_owned(
        self, user_id: int, page: int, page_size: int
    ) -> tuple[list[AiThread], int]:
        filters = (AiThread.user_id == user_id, AiThread.is_deleted.is_(False))
        total = await self.session.scalar(
            select(func.count()).select_from(AiThread).where(*filters)
        )
        statement = (
            select(AiThread)
            .where(*filters)
            .order_by(AiThread.update_time.desc(), AiThread.id.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        items = list((await self.session.scalars(statement)).all())
        return items, int(total or 0)

    async def soft_delete(self, thread: AiThread) -> None:
        thread.is_deleted = True
        thread.delete_time = datetime.now(UTC).replace(tzinfo=None)
        await self.session.flush()
