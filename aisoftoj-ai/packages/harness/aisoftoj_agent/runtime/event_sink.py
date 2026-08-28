from __future__ import annotations

from collections.abc import Awaitable, Callable
from datetime import UTC, datetime
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from ..contracts.events import PersistedEvent
from ..persistence.repositories.runs import RunRepository
from .event_sequence import RunEventSequence
from .stream_bridge import StreamBridge


class ToolEventPersistenceError(RuntimeError):
    pass


class RunEventSink:
    def __init__(
        self,
        session_factory: async_sessionmaker[AsyncSession],
        stream_bridge: StreamBridge,
        event_sequence: RunEventSequence,
        run_id: str,
        access_check: Callable[[], Awaitable[None]] | None = None,
    ) -> None:
        self.session_factory = session_factory
        self.stream_bridge = stream_bridge
        self.event_sequence = event_sequence
        self.run_id = run_id
        self.access_check = access_check

    async def emit(self, event_type: str, payload: dict[str, Any]) -> None:
        if self.access_check is not None:
            await self.access_check()
        try:
            sequence = await self.event_sequence.next(self.run_id)
            async with self.session_factory.begin() as session:
                stored = await RunRepository(session).append_event(
                    self.run_id, event_type, payload, sequence=sequence
                )
        except Exception as exc:
            raise ToolEventPersistenceError("could not persist tool event") from exc

        if self.access_check is not None:
            await self.access_check()
        await self.stream_bridge.publish(
            PersistedEvent(
                run_id=stored.run_id,
                sequence=stored.sequence,
                type=stored.event_type,
                created_at=(stored.create_time or datetime.now(UTC)).replace(tzinfo=UTC),
                data=stored.payload,
            )
        )
