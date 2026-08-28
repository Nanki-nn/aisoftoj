from __future__ import annotations

import pytest
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from packages.harness.aisoftoj_agent.access_control import (
    AI_GLOBALLY_DISABLED,
    AI_ROLLOUT_NOT_ENABLED,
    AiAccessControlService,
    AiAccessControlUnavailable,
)
from packages.harness.aisoftoj_agent.persistence.models import (
    AiAccessAuditLog,
    AiAccessConfig,
    AiRolloutUser,
    Base,
)


@pytest.fixture
async def access_service():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    yield AiAccessControlService(factory), factory
    await engine.dispose()


async def test_missing_config_fails_closed(access_service) -> None:
    service, _factory = access_service
    with pytest.raises(AiAccessControlUnavailable):
        await service.decision(7, "USER")


async def test_global_switch_admin_and_rollout_matrix(access_service) -> None:
    service, factory = access_service
    async with factory.begin() as session:
        session.add(AiAccessConfig(id=1, globally_enabled=True))

    assert (await service.decision(1, "ADMIN")).enabled is True
    denied = await service.decision(7, "USER")
    assert denied.enabled is False
    assert denied.reason == AI_ROLLOUT_NOT_ENABLED

    assert await service.add_rollout_user(7, 1) is True
    assert await service.add_rollout_user(7, 2) is False
    assert (await service.decision(7, "USER")).enabled is True

    await service.update_global(False, 1)
    admin_denied = await service.decision(1, "ADMIN")
    rollout_denied = await service.decision(7, "USER")
    assert admin_denied.reason == AI_GLOBALLY_DISABLED
    assert rollout_denied.reason == AI_GLOBALLY_DISABLED


async def test_mutations_are_idempotent_and_audited(access_service) -> None:
    service, factory = access_service
    async with factory.begin() as session:
        session.add(AiAccessConfig(id=1, globally_enabled=True))

    assert await service.add_rollout_user(9, 1) is True
    assert await service.add_rollout_user(9, 2) is False
    assert await service.remove_rollout_user(9, 1) is True
    assert await service.remove_rollout_user(9, 1) is False
    await service.update_global(False, 1)

    async with factory() as session:
        rollout_count = await session.scalar(select(func.count()).select_from(AiRolloutUser))
        audits = list(
            await session.scalars(
                select(AiAccessAuditLog).order_by(AiAccessAuditLog.id)
            )
        )

    assert rollout_count == 0
    assert [audit.action for audit in audits] == [
        "ROLLOUT_ADD",
        "ROLLOUT_REMOVE",
        "GLOBAL_DISABLE",
    ]
