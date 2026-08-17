from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from ..models import AiThreadSummary


class SummaryRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get(self, thread_id: str) -> AiThreadSummary | None:
        return await self.session.get(AiThreadSummary, thread_id)

    async def advance(self, thread_id: str, content: str, through_sequence: int) -> AiThreadSummary:
        summary = await self.get(thread_id)
        if summary is None:
            summary = AiThreadSummary(
                thread_id=thread_id,
                content=content,
                summarized_through_sequence=through_sequence,
            )
            self.session.add(summary)
        elif through_sequence > summary.summarized_through_sequence:
            summary.content = content
            summary.summarized_through_sequence = through_sequence
        await self.session.flush()
        return summary
