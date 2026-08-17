from __future__ import annotations

import asyncio

import pytest

from packages.harness.aisoftoj_agent.runtime.run_manager import CapacityExceeded, RunManager


async def test_global_and_user_capacity_is_reserved_before_start() -> None:
    manager = RunManager(max_runs=2, max_user_runs=1)
    await manager.reserve(7)

    with pytest.raises(CapacityExceeded):
        await manager.reserve(7)
    await manager.reserve(8)
    with pytest.raises(CapacityExceeded):
        await manager.reserve(9)

    await manager.release(7)
    await manager.release(8)


async def test_task_completion_releases_capacity() -> None:
    manager = RunManager(max_runs=1, max_user_runs=1)
    finished = asyncio.Event()
    await manager.reserve(7)

    async def run() -> None:
        finished.set()

    await manager.start("run", 7, run)
    await finished.wait()
    await asyncio.sleep(0)
    await manager.reserve(8)
    await manager.release(8)
