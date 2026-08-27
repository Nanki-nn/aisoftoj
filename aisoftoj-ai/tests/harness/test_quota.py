from __future__ import annotations

from datetime import UTC, datetime

import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from packages.harness.aisoftoj_agent.persistence.models import AiQuotaConfig, Base
from packages.harness.aisoftoj_agent.persistence.repositories.messages import MessageRepository
from packages.harness.aisoftoj_agent.persistence.repositories.runs import RunRepository
from packages.harness.aisoftoj_agent.persistence.repositories.threads import ThreadRepository
from packages.harness.aisoftoj_agent.quota import (
    CHARGED_ESTIMATE,
    DailyTokenQuotaExceeded,
    DailyTokenQuotaService,
)


async def quota_fixture():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    async with factory.begin() as session:
        session.add(AiQuotaConfig(id=1, daily_token_limit=30_000))
        thread = await ThreadRepository(session).create(7, None)
        message = await MessageRepository(session).create(thread.id, "user", "hello")
        run = await RunRepository(session).create(thread.id, "quota-test", message.id, "test-model")
        message.run_id = run.id
    return engine, factory, run.id


async def test_quota_is_per_user_and_resets_by_beijing_date() -> None:
    engine, factory, run_id = await quota_fixture()
    service = DailyTokenQuotaService(factory)
    before_midnight = datetime(2026, 8, 26, 15, 59, tzinfo=UTC)
    after_midnight = datetime(2026, 8, 26, 16, 1, tzinfo=UTC)

    reservation = await service.reserve(run_id=run_id, user_id=7, tokens=5_000, now=before_midnight)
    assert (await service.status(7, now=before_midnight)).remaining == 25_000
    assert (await service.status(8, now=before_midnight)).remaining == 30_000
    assert (await service.status(7, now=after_midnight)).remaining == 30_000

    await service.settle(
        reservation.id,
        prompt_tokens=2_000,
        completion_tokens=1_000,
        usage_source="provider",
    )
    old_day = await service.status(7, now=before_midnight)
    assert old_day.consumed == 3_000
    assert old_day.reserved == 0
    async with factory.begin() as session:
        run = await RunRepository(session).get(run_id)
        assert run is not None
        assert (run.prompt_tokens, run.completion_tokens) == (2_000, 1_000)
        await RunRepository(session).transition(run, "completed")
    async with factory() as session:
        completed = await RunRepository(session).get(run_id)
        assert completed is not None
        assert (completed.prompt_tokens, completed.completion_tokens) == (2_000, 1_000)
    await engine.dispose()


async def test_quota_update_is_immediate_and_rejects_new_reservation() -> None:
    engine, factory, run_id = await quota_fixture()
    service = DailyTokenQuotaService(factory)
    reservation = await service.reserve(run_id=run_id, user_id=7, tokens=20_000)
    await service.settle(
        reservation.id,
        prompt_tokens=18_000,
        completion_tokens=2_000,
        usage_source="provider",
    )
    await service.update_limit(15_000, 1)
    assert (await service.status(7)).remaining == 0
    with pytest.raises(DailyTokenQuotaExceeded):
        await service.reserve(run_id=run_id, user_id=7, tokens=1)
    await service.update_limit(25_000, 1)
    assert (await service.status(7)).remaining == 5_000
    await engine.dispose()


async def test_release_and_crash_recovery_are_idempotent() -> None:
    engine, factory, run_id = await quota_fixture()
    service = DailyTokenQuotaService(factory)
    released = await service.reserve(run_id=run_id, user_id=7, tokens=2_000)
    await service.release(released.id)
    await service.release(released.id)
    assert (await service.status(7)).remaining == 30_000

    abandoned = await service.reserve(run_id=run_id, user_id=7, tokens=3_000)
    assert await service.recover_unsettled() == 1
    assert await service.recover_unsettled() == 0
    state = await service.status(7)
    assert state.consumed == 3_000
    async with factory() as session:
        current = await session.get(type(abandoned), abandoned.id)
        assert current is not None
        assert current.status == CHARGED_ESTIMATE
    await engine.dispose()


async def test_user_limit_override_takes_precedence_and_can_be_removed() -> None:
    engine, factory, _run_id = await quota_fixture()
    service = DailyTokenQuotaService(factory)

    overridden = await service.set_user_limit(7, 45_000, admin_user_id=1)
    assert overridden.limit == 45_000
    assert overridden.limit_source == "user"
    assert (await service.global_status()).limit == 30_000
    await service.update_limit(20_000, admin_user_id=1)
    assert (await service.status(7)).limit == 45_000
    assert (await service.status(8)).limit == 20_000

    restored = await service.remove_user_limit(7, admin_user_id=1)
    assert restored.limit == 20_000
    assert restored.limit_source == "global"
    await engine.dispose()
