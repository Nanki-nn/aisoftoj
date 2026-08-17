from __future__ import annotations

import asyncio
from dataclasses import dataclass

from ..contracts.events import PersistedEvent


@dataclass(slots=True, eq=False)
class StreamSubscription:
    run_id: str
    queue: asyncio.Queue[PersistedEvent | None]
    overflowed: bool = False
    _closed: bool = False

    async def receive(self) -> PersistedEvent | None:
        if self._closed:
            return None
        event = await self.queue.get()
        if event is None:
            self._closed = True
        return event

    def close(self) -> None:
        if not self._closed:
            try:
                self.queue.put_nowait(None)
            except asyncio.QueueFull:
                pass


class StreamBridge:
    def __init__(self, queue_capacity: int = 256) -> None:
        if queue_capacity < 1:
            raise ValueError("queue_capacity must be positive")
        self.queue_capacity = queue_capacity
        self._subscriptions: dict[str, set[StreamSubscription]] = {}
        self._lock = asyncio.Lock()

    async def subscribe(self, run_id: str) -> StreamSubscription:
        subscription = StreamSubscription(
            run_id=run_id,
            queue=asyncio.Queue(maxsize=self.queue_capacity),
        )
        async with self._lock:
            self._subscriptions.setdefault(run_id, set()).add(subscription)
        return subscription

    async def unsubscribe(self, subscription: StreamSubscription) -> None:
        async with self._lock:
            subscriptions = self._subscriptions.get(subscription.run_id)
            if subscriptions is not None:
                subscriptions.discard(subscription)
                if not subscriptions:
                    self._subscriptions.pop(subscription.run_id, None)
        subscription.close()

    async def publish(self, event: PersistedEvent) -> None:
        async with self._lock:
            subscriptions = list(self._subscriptions.get(event.run_id, set()))
        for subscription in subscriptions:
            if subscription.overflowed or subscription._closed:
                continue
            try:
                subscription.queue.put_nowait(event)
            except asyncio.QueueFull:
                subscription.overflowed = True
                while not subscription.queue.empty():
                    subscription.queue.get_nowait()
                subscription.close()

    async def close(self, run_id: str) -> None:
        async with self._lock:
            subscriptions = list(self._subscriptions.get(run_id, set()))
        for subscription in subscriptions:
            subscription.close()
