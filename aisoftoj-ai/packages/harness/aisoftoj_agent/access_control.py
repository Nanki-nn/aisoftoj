from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime
from typing import Any, cast

from sqlalchemy import delete, func, select
from sqlalchemy.dialects.mysql import insert as mysql_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.engine import CursorResult
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from .persistence.models import AiAccessAuditLog, AiAccessConfig, AiRolloutUser

ACCESS_CONFIG_ID = 1
AI_GLOBALLY_DISABLED = "AI_GLOBALLY_DISABLED"
AI_ROLLOUT_NOT_ENABLED = "AI_ROLLOUT_NOT_ENABLED"
AI_ACCESS_CONFIG_UNAVAILABLE = "AI_ACCESS_CONFIG_UNAVAILABLE"

logger = logging.getLogger(__name__)


class AiAccessControlUnavailable(RuntimeError):
    pass


class AiAccessDenied(RuntimeError):
    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


@dataclass(frozen=True, slots=True)
class AccessDecision:
    enabled: bool
    reason: str | None = None


@dataclass(frozen=True, slots=True)
class AccessConfigSnapshot:
    globally_enabled: bool
    rollout_user_count: int
    updated_by_user_id: int | None
    updated_at: datetime | None


class AiAccessControlService:
    def __init__(self, session_factory: async_sessionmaker[AsyncSession]) -> None:
        self.session_factory = session_factory

    async def decision(self, user_id: int, role: str) -> AccessDecision:
        try:
            async with self.session_factory() as session:
                config = await self._config(session)
                if not config.globally_enabled:
                    return AccessDecision(False, AI_GLOBALLY_DISABLED)
                if role.upper() == "ADMIN":
                    return AccessDecision(True)
                rollout_user = await session.get(AiRolloutUser, user_id)
                if rollout_user is None:
                    return AccessDecision(False, AI_ROLLOUT_NOT_ENABLED)
                return AccessDecision(True)
        except SQLAlchemyError as exc:
            raise AiAccessControlUnavailable(AI_ACCESS_CONFIG_UNAVAILABLE) from exc

    async def require_allowed(self, user_id: int, role: str) -> None:
        decision = await self.decision(user_id, role)
        if not decision.enabled:
            raise AiAccessDenied(decision.reason or AI_ROLLOUT_NOT_ENABLED)

    async def status(self) -> AccessConfigSnapshot:
        async with self.session_factory() as session:
            config = await self._config(session)
            count = await session.scalar(select(func.count()).select_from(AiRolloutUser))
            return AccessConfigSnapshot(
                globally_enabled=config.globally_enabled,
                rollout_user_count=int(count or 0),
                updated_by_user_id=config.updated_by_user_id,
                updated_at=config.update_time,
            )

    async def update_global(
        self, globally_enabled: bool, admin_user_id: int
    ) -> AccessConfigSnapshot:
        async with self.session_factory.begin() as session:
            config = await self._config(session, for_update=True)
            old_value = bool(config.globally_enabled)
            config.globally_enabled = globally_enabled
            config.updated_by_user_id = admin_user_id
            session.add(
                AiAccessAuditLog(
                    action="GLOBAL_ENABLE" if globally_enabled else "GLOBAL_DISABLE",
                    admin_user_id=admin_user_id,
                    target_user_id=None,
                    old_value=old_value,
                    new_value=globally_enabled,
                )
            )
            await session.flush()
            await session.refresh(config)
            count = await session.scalar(select(func.count()).select_from(AiRolloutUser))
            logger.info(
                "event=ai_access_global_updated admin_user_id=%s old_value=%s new_value=%s",
                admin_user_id,
                old_value,
                globally_enabled,
            )
            return AccessConfigSnapshot(
                globally_enabled=config.globally_enabled,
                rollout_user_count=int(count or 0),
                updated_by_user_id=config.updated_by_user_id,
                updated_at=config.update_time,
            )

    async def list_rollout_users(
        self, page: int, page_size: int
    ) -> tuple[list[AiRolloutUser], int]:
        async with self.session_factory() as session:
            await self._config(session)
            total = await session.scalar(select(func.count()).select_from(AiRolloutUser))
            rows = await session.scalars(
                select(AiRolloutUser)
                .order_by(AiRolloutUser.user_id)
                .offset((page - 1) * page_size)
                .limit(page_size)
            )
            return list(rows), int(total or 0)

    async def rollout_statuses(self, user_ids: list[int]) -> dict[int, bool]:
        unique_ids = list(dict.fromkeys(user_ids))
        async with self.session_factory() as session:
            await self._config(session)
            existing: set[int] = set()
            if unique_ids:
                rows = await session.scalars(
                    select(AiRolloutUser.user_id).where(AiRolloutUser.user_id.in_(unique_ids))
                )
                existing = set(rows)
            return {user_id: user_id in existing for user_id in unique_ids}

    async def add_rollout_user(self, user_id: int, admin_user_id: int) -> bool:
        async with self.session_factory.begin() as session:
            await self._config(session, for_update=True)
            existing = await session.get(AiRolloutUser, user_id)
            if existing is not None:
                return False
            values = {
                "user_id": user_id,
                "created_by_user_id": admin_user_id,
                "updated_by_user_id": admin_user_id,
            }
            dialect = session.bind.dialect.name if session.bind is not None else ""
            if dialect == "mysql":
                mysql_statement = mysql_insert(AiRolloutUser).values(**values).prefix_with("IGNORE")
                result = cast(CursorResult[Any], await session.execute(mysql_statement))
                inserted = bool(result.rowcount)
            elif dialect == "sqlite":
                sqlite_statement = (
                    sqlite_insert(AiRolloutUser).values(**values).on_conflict_do_nothing()
                )
                result = cast(CursorResult[Any], await session.execute(sqlite_statement))
                inserted = bool(result.rowcount)
            else:
                session.add(AiRolloutUser(**values))
                inserted = True
            if inserted:
                session.add(
                    AiAccessAuditLog(
                        action="ROLLOUT_ADD",
                        admin_user_id=admin_user_id,
                        target_user_id=user_id,
                        old_value=False,
                        new_value=True,
                    )
                )
            await session.flush()
            logger.info(
                "event=ai_rollout_user_added admin_user_id=%s user_id=%s inserted=%s",
                admin_user_id,
                user_id,
                inserted,
            )
            return inserted

    async def remove_rollout_user(self, user_id: int, admin_user_id: int) -> bool:
        async with self.session_factory.begin() as session:
            await self._config(session, for_update=True)
            result = cast(
                CursorResult[Any],
                await session.execute(
                    delete(AiRolloutUser).where(AiRolloutUser.user_id == user_id)
                ),
            )
            removed = bool(result.rowcount)
            if removed:
                session.add(
                    AiAccessAuditLog(
                        action="ROLLOUT_REMOVE",
                        admin_user_id=admin_user_id,
                        target_user_id=user_id,
                        old_value=True,
                        new_value=False,
                    )
                )
            await session.flush()
            logger.info(
                "event=ai_rollout_user_removed admin_user_id=%s user_id=%s removed=%s",
                admin_user_id,
                user_id,
                removed,
            )
            return removed

    async def _config(
        self,
        session: AsyncSession,
        *,
        for_update: bool = False,
    ) -> AiAccessConfig:
        statement = select(AiAccessConfig).where(AiAccessConfig.id == ACCESS_CONFIG_ID)
        if for_update:
            statement = statement.with_for_update()
        config = await session.scalar(statement)
        if config is None:
            raise AiAccessControlUnavailable(AI_ACCESS_CONFIG_UNAVAILABLE)
        return config
