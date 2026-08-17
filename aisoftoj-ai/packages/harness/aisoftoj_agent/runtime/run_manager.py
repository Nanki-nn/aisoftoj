from __future__ import annotations

import asyncio
from collections.abc import Awaitable, Callable


class CapacityExceeded(RuntimeError):
    pass


class RunManager:
    def __init__(self, *, max_runs: int, max_user_runs: int) -> None:
        self.max_runs = max_runs
        self.max_user_runs = max_user_runs
        self._global_in_use = 0
        self._user_in_use: dict[int, int] = {}
        self._tasks: dict[str, asyncio.Task[None]] = {}
        self._task_users: dict[str, int] = {}
        self._lock = asyncio.Lock()
        self._closing = False

    async def reserve(self, user_id: int) -> None:
        async with self._lock:
            if self._closing:
                raise CapacityExceeded("service is shutting down")
            user_count = self._user_in_use.get(user_id, 0)
            if self._global_in_use >= self.max_runs or user_count >= self.max_user_runs:
                raise CapacityExceeded("run capacity exceeded")
            self._global_in_use += 1
            self._user_in_use[user_id] = user_count + 1

    async def release(self, user_id: int) -> None:
        async with self._lock:
            self._release_locked(user_id)

    async def start(
        self,
        run_id: str,
        user_id: int,
        factory: Callable[[], Awaitable[None]],
    ) -> None:
        async with self._lock:
            if run_id in self._tasks:
                raise RuntimeError("run task already exists")
            task = asyncio.create_task(self._run(run_id, user_id, factory), name=f"ai-run-{run_id}")
            self._tasks[run_id] = task
            self._task_users[run_id] = user_id

    async def cancel(self, run_id: str) -> bool:
        async with self._lock:
            task = self._tasks.get(run_id)
            if task is None or task.done():
                return False
            task.cancel()
            return True

    async def shutdown(self, timeout_seconds: float) -> None:
        async with self._lock:
            self._closing = True
            tasks = list(self._tasks.values())
        if not tasks:
            return
        _done, pending = await asyncio.wait(tasks, timeout=timeout_seconds)
        for task in pending:
            task.cancel()
        if pending:
            await asyncio.gather(*pending, return_exceptions=True)

    async def _run(
        self,
        run_id: str,
        user_id: int,
        factory: Callable[[], Awaitable[None]],
    ) -> None:
        try:
            await factory()
        finally:
            async with self._lock:
                self._tasks.pop(run_id, None)
                self._task_users.pop(run_id, None)
                self._release_locked(user_id)

    def _release_locked(self, user_id: int) -> None:
        if self._global_in_use > 0:
            self._global_in_use -= 1
        remaining = self._user_in_use.get(user_id, 0) - 1
        if remaining > 0:
            self._user_in_use[user_id] = remaining
        else:
            self._user_in_use.pop(user_id, None)
