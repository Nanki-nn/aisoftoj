from __future__ import annotations

from uuid import uuid4

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import AiMessage


class MessageRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def next_sequence(self, thread_id: str) -> int:
        value = await self.session.scalar(
            select(func.max(AiMessage.sequence)).where(AiMessage.thread_id == thread_id)
        )
        return int(value or 0) + 1

    async def create(
        self,
        thread_id: str,
        role: str,
        content: str,
        *,
        run_id: str | None = None,
    ) -> AiMessage:
        message = AiMessage(
            id=str(uuid4()),
            thread_id=thread_id,
            run_id=run_id,
            role=role,
            content=content,
            sequence=await self.next_sequence(thread_id),
        )
        self.session.add(message)
        await self.session.flush()
        return message

    async def list_before(
        self, thread_id: str, before_sequence: int | None, limit: int
    ) -> list[AiMessage]:
        statement = select(AiMessage).where(AiMessage.thread_id == thread_id)
        if before_sequence is not None:
            statement = statement.where(AiMessage.sequence < before_sequence)
        descending = statement.order_by(AiMessage.sequence.desc()).limit(limit)
        return list(reversed((await self.session.scalars(descending)).all()))

    async def list_after(self, thread_id: str, sequence: int) -> list[AiMessage]:
        statement = (
            select(AiMessage)
            .where(AiMessage.thread_id == thread_id, AiMessage.sequence > sequence)
            .order_by(AiMessage.sequence)
        )
        return list((await self.session.scalars(statement)).all())
