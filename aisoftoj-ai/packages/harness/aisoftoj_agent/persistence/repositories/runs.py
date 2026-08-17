from __future__ import annotations

from datetime import UTC, datetime
from typing import Any, cast
from uuid import uuid4

from sqlalchemy import func, select, update
from sqlalchemy.engine import CursorResult
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import AiRun, AiRunEvent

TERMINAL_STATUSES = {"completed", "failed", "cancelled", "interrupted"}
ACTIVE_STATUSES = {"queued", "running"}


class RunRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create(
        self,
        thread_id: str,
        idempotency_key: str,
        input_message_id: str,
        model_name: str,
    ) -> AiRun:
        run = AiRun(
            id=str(uuid4()),
            thread_id=thread_id,
            idempotency_key=idempotency_key,
            status="queued",
            input_message_id=input_message_id,
            model_name=model_name,
        )
        self.session.add(run)
        await self.session.flush()
        return run

    async def get(self, run_id: str) -> AiRun | None:
        run: AiRun | None = await self.session.get(AiRun, run_id)
        return run

    async def get_by_idempotency(self, thread_id: str, key: str) -> AiRun | None:
        result = await self.session.execute(
            select(AiRun).where(
                AiRun.thread_id == thread_id,
                AiRun.idempotency_key == key,
            )
        )
        return result.scalar_one_or_none()

    async def list_for_thread(
        self, thread_id: str, page: int, page_size: int
    ) -> tuple[list[AiRun], int]:
        total = await self.session.scalar(
            select(func.count()).select_from(AiRun).where(AiRun.thread_id == thread_id)
        )
        statement = (
            select(AiRun)
            .where(AiRun.thread_id == thread_id)
            .order_by(AiRun.create_time.desc(), AiRun.id.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        return list((await self.session.scalars(statement)).all()), int(total or 0)

    async def transition(
        self,
        run: AiRun,
        status: str,
        *,
        error_code: str | None = None,
        output_message_id: str | None = None,
        prompt_tokens: int | None = None,
        completion_tokens: int | None = None,
    ) -> None:
        now = datetime.now(UTC).replace(tzinfo=None)
        if status == "running" and run.status == "queued":
            run.started_at = now
        if status in TERMINAL_STATUSES:
            run.finished_at = now
        run.status = status
        run.error_code = error_code
        run.output_message_id = output_message_id
        run.prompt_tokens = prompt_tokens
        run.completion_tokens = completion_tokens
        await self.session.flush()

    async def append_event(
        self, run_id: str, event_type: str, payload: dict[str, Any]
    ) -> AiRunEvent:
        await self.session.scalar(select(AiRun.id).where(AiRun.id == run_id).with_for_update())
        current = await self.session.scalar(
            select(func.max(AiRunEvent.sequence)).where(AiRunEvent.run_id == run_id)
        )
        event = AiRunEvent(
            run_id=run_id,
            sequence=int(current or 0) + 1,
            event_type=event_type,
            payload=payload,
        )
        self.session.add(event)
        await self.session.flush()
        return event

    async def list_events_after(self, run_id: str, sequence: int) -> list[AiRunEvent]:
        statement = (
            select(AiRunEvent)
            .where(AiRunEvent.run_id == run_id, AiRunEvent.sequence > sequence)
            .order_by(AiRunEvent.sequence)
        )
        return list((await self.session.scalars(statement)).all())

    async def interrupt_unfinished(self) -> int:
        result = cast(
            CursorResult[Any],
            await self.session.execute(
                update(AiRun)
                .where(AiRun.status.in_(ACTIVE_STATUSES))
                .values(
                    status="interrupted",
                    error_code="SERVICE_RESTARTED",
                    finished_at=datetime.now(UTC).replace(tzinfo=None),
                )
            ),
        )
        return int(result.rowcount or 0)
