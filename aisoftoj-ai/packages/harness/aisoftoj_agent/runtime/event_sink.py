from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from ..contracts.events import PersistedEvent
from ..persistence.repositories.runs import RunRepository
from .stream_bridge import StreamBridge


class ToolEventPersistenceError(RuntimeError):
    pass


class RunEventSink:
    def __init__(
        self,
        session_factory: async_sessionmaker[AsyncSession],
        stream_bridge: StreamBridge,
        run_id: str,
    ) -> None:
        self.session_factory = session_factory
        self.stream_bridge = stream_bridge
        self.run_id = run_id

    async def emit(self, event_type: str, payload: dict[str, Any]) -> None:
        try:
            async with self.session_factory.begin() as session:
                stored = await RunRepository(session).append_event(
                    self.run_id, event_type, payload
                )
        except Exception as exc:
            raise ToolEventPersistenceError("could not persist tool event") from exc

        await self.stream_bridge.publish(
            PersistedEvent(
                run_id=stored.run_id,
                sequence=stored.sequence,
                type=stored.event_type,
                created_at=(stored.create_time or datetime.now(UTC)).replace(tzinfo=UTC),
                data=stored.payload,
            )
        )
