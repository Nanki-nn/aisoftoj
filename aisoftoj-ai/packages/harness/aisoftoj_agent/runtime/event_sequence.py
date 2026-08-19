from __future__ import annotations

import asyncio


class RunEventSequence:
    """Allocates one monotonic transport sequence for all events in a run."""

    def __init__(self) -> None:
        self._values: dict[str, int] = {}
        self._lock = asyncio.Lock()

    async def initialize(self, run_id: str, persisted_sequence: int) -> None:
        async with self._lock:
            self._values[run_id] = max(
                persisted_sequence,
                self._values.get(run_id, 0),
            )

    async def next(self, run_id: str) -> int:
        async with self._lock:
            if run_id not in self._values:
                raise RuntimeError("run event sequence is not initialized")
            sequence = self._values[run_id] + 1
            self._values[run_id] = sequence
            return sequence

    async def close(self, run_id: str) -> None:
        async with self._lock:
            self._values.pop(run_id, None)
