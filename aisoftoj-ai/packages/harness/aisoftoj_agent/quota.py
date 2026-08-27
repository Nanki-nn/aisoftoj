from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import UTC, date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import delete, func, select
from sqlalchemy.dialects.mysql import insert as mysql_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from .persistence.models import (
    AiDailyTokenUsage,
    AiQuotaConfig,
    AiRun,
    AiTokenReservation,
    AiUserQuotaOverride,
)

BEIJING = ZoneInfo("Asia/Shanghai")
DEFAULT_DAILY_TOKEN_LIMIT = 30_000
CONFIG_ID = 1
RESERVED = "RESERVED"
SETTLED = "SETTLED"
RELEASED = "RELEASED"
CHARGED_ESTIMATE = "CHARGED_ESTIMATE"

logger = logging.getLogger(__name__)


@dataclass(frozen=True, slots=True)
class QuotaSnapshot:
    limit: int
    consumed: int
    reserved: int
    remaining: int
    reset_at: datetime
    updated_by_user_id: int | None = None
    updated_at: datetime | None = None
    limit_source: str = "global"


@dataclass(frozen=True, slots=True)
class AdminQuotaUsage:
    user_id: int
    usage_date: date
    limit: int
    consumed: int
    reserved: int
    remaining: int
    limit_source: str


class DailyTokenQuotaExceeded(RuntimeError):
    def __init__(self, snapshot: QuotaSnapshot) -> None:
        super().__init__("daily AI token quota exceeded")
        self.snapshot = snapshot


class DailyTokenQuotaUnavailable(RuntimeError):
    pass


class DailyTokenQuotaService:
    def __init__(self, session_factory: async_sessionmaker[AsyncSession]) -> None:
        self.session_factory = session_factory

    async def status(self, user_id: int, *, now: datetime | None = None) -> QuotaSnapshot:
        usage_date = beijing_date(now)
        async with self.session_factory() as session:
            config = await self._config(session)
            override = await self._override(session, user_id)
            usage = await session.scalar(
                select(AiDailyTokenUsage).where(
                    AiDailyTokenUsage.user_id == user_id,
                    AiDailyTokenUsage.usage_date == usage_date,
                )
            )
            return snapshot(config, usage, usage_date, override)

    async def require_available(self, user_id: int) -> QuotaSnapshot:
        current = await self.status(user_id)
        if current.remaining <= 0:
            raise DailyTokenQuotaExceeded(current)
        return current

    async def global_status(self) -> QuotaSnapshot:
        async with self.session_factory() as session:
            config = await self._config(session)
            return snapshot(config, None, beijing_date())

    async def usage_for_users(
        self,
        user_ids: list[int],
        usage_date: date,
    ) -> list[AdminQuotaUsage]:
        async with self.session_factory() as session:
            config = await self._config(session)
            usages: dict[int, AiDailyTokenUsage] = {}
            if user_ids:
                usage_rows = await session.scalars(
                    select(AiDailyTokenUsage).where(
                        AiDailyTokenUsage.user_id.in_(user_ids),
                        AiDailyTokenUsage.usage_date == usage_date,
                    )
                )
                usages = {row.user_id: row for row in usage_rows}
            overrides: dict[int, AiUserQuotaOverride] = {}
            if user_ids:
                override_rows = await session.scalars(
                    select(AiUserQuotaOverride).where(
                        AiUserQuotaOverride.user_id.in_(user_ids)
                    )
                )
                overrides = {row.user_id: row for row in override_rows}
            return [
                admin_usage(
                    config,
                    usages.get(user_id),
                    overrides.get(user_id),
                    user_id,
                    usage_date,
                )
                for user_id in user_ids
            ]

    async def set_user_limit(
        self,
        user_id: int,
        daily_token_limit: int,
        admin_user_id: int,
    ) -> QuotaSnapshot:
        async with self.session_factory.begin() as session:
            config = await self._config(session, for_share=True)
            values = {
                "user_id": user_id,
                "daily_token_limit": daily_token_limit,
                "updated_by_user_id": admin_user_id,
            }
            dialect = session.bind.dialect.name if session.bind is not None else ""
            if dialect == "mysql":
                mysql_statement = mysql_insert(AiUserQuotaOverride).values(**values)
                await session.execute(
                    mysql_statement.on_duplicate_key_update(
                        daily_token_limit=mysql_statement.inserted.daily_token_limit,
                        updated_by_user_id=mysql_statement.inserted.updated_by_user_id,
                        update_time=func.now(),
                    )
                )
            elif dialect == "sqlite":
                sqlite_statement = sqlite_insert(AiUserQuotaOverride).values(**values)
                await session.execute(
                    sqlite_statement.on_conflict_do_update(
                        index_elements=["user_id"],
                        set_={
                            "daily_token_limit": daily_token_limit,
                            "updated_by_user_id": admin_user_id,
                            "update_time": func.now(),
                        },
                    )
                )
            else:
                existing = await session.get(AiUserQuotaOverride, user_id)
                if existing is None:
                    session.add(AiUserQuotaOverride(**values))
                else:
                    existing.daily_token_limit = daily_token_limit
                    existing.updated_by_user_id = admin_user_id
            await session.flush()
            override = await self._override(session, user_id)
            usage_date = beijing_date()
            usage = await session.scalar(
                select(AiDailyTokenUsage).where(
                    AiDailyTokenUsage.user_id == user_id,
                    AiDailyTokenUsage.usage_date == usage_date,
                )
            )
            logger.info(
                "event=ai_user_quota_updated admin_user_id=%s user_id=%s new_limit=%s",
                admin_user_id,
                user_id,
                daily_token_limit,
            )
            return snapshot(config, usage, usage_date, override)

    async def remove_user_limit(self, user_id: int, admin_user_id: int) -> QuotaSnapshot:
        async with self.session_factory.begin() as session:
            config = await self._config(session, for_share=True)
            await session.execute(
                delete(AiUserQuotaOverride).where(AiUserQuotaOverride.user_id == user_id)
            )
            usage_date = beijing_date()
            usage = await session.scalar(
                select(AiDailyTokenUsage).where(
                    AiDailyTokenUsage.user_id == user_id,
                    AiDailyTokenUsage.usage_date == usage_date,
                )
            )
            logger.info(
                "event=ai_user_quota_removed admin_user_id=%s user_id=%s",
                admin_user_id,
                user_id,
            )
            return snapshot(config, usage, usage_date)

    async def update_limit(self, daily_token_limit: int, admin_user_id: int) -> QuotaSnapshot:
        async with self.session_factory.begin() as session:
            config = await self._config(session, for_update=True)
            previous = config.daily_token_limit
            config.daily_token_limit = daily_token_limit
            config.updated_by_user_id = admin_user_id
            await session.flush()
            await session.refresh(config)
            logger.info(
                "event=ai_quota_config_updated admin_user_id=%s old_limit=%s new_limit=%s",
                admin_user_id,
                previous,
                daily_token_limit,
            )
            return snapshot(config, None, beijing_date())

    async def reserve(
        self,
        *,
        run_id: str,
        user_id: int,
        tokens: int,
        now: datetime | None = None,
    ) -> AiTokenReservation:
        usage_date = beijing_date(now)
        async with self.session_factory.begin() as session:
            config = await self._config(session, for_share=True)
            override = await self._override(session, user_id, for_share=True)
            usage = await self._usage(session, user_id, usage_date, for_update=True)
            current = snapshot(config, usage, usage_date, override)
            if tokens <= 0 or tokens > current.remaining:
                raise DailyTokenQuotaExceeded(current)
            sequence = (
                int(
                    await session.scalar(
                        select(func.max(AiTokenReservation.model_call_sequence)).where(
                            AiTokenReservation.run_id == run_id
                        )
                    )
                    or 0
                )
                + 1
            )
            reservation = AiTokenReservation(
                run_id=run_id,
                user_id=user_id,
                usage_date=usage_date,
                model_call_sequence=sequence,
                reserved_tokens=tokens,
                status=RESERVED,
            )
            usage.reserved_tokens += tokens
            session.add(reservation)
            await session.flush()
            await session.refresh(reservation)
            return reservation

    async def settle(
        self,
        reservation_id: int,
        *,
        prompt_tokens: int,
        completion_tokens: int,
        usage_source: str,
        estimated: bool = False,
    ) -> None:
        actual = max(0, prompt_tokens) + max(0, completion_tokens)
        async with self.session_factory.begin() as session:
            observed = await session.get(AiTokenReservation, reservation_id)
            if observed is None or observed.status != RESERVED:
                return
            await self._config(session, for_share=True)
            usage = await self._usage(
                session, observed.user_id, observed.usage_date, for_update=True
            )
            reservation = await session.scalar(
                select(AiTokenReservation)
                .where(AiTokenReservation.id == reservation_id)
                .with_for_update()
                .execution_options(populate_existing=True)
            )
            if reservation is None or reservation.status != RESERVED:
                return
            usage.reserved_tokens = max(0, usage.reserved_tokens - reservation.reserved_tokens)
            usage.consumed_tokens += actual
            reservation.prompt_tokens = max(0, prompt_tokens)
            reservation.completion_tokens = max(0, completion_tokens)
            reservation.usage_source = usage_source
            reservation.status = CHARGED_ESTIMATE if estimated else SETTLED
            run = await session.scalar(
                select(AiRun).where(AiRun.id == reservation.run_id).with_for_update()
            )
            if run is not None:
                run.prompt_tokens = (run.prompt_tokens or 0) + max(0, prompt_tokens)
                run.completion_tokens = (run.completion_tokens or 0) + max(0, completion_tokens)
            if actual > reservation.reserved_tokens:
                logger.warning(
                    "event=ai_quota_actual_exceeded_reservation run_id=%s "
                    "reservation_id=%s reserved=%s actual=%s",
                    reservation.run_id,
                    reservation.id,
                    reservation.reserved_tokens,
                    actual,
                )

    async def release(self, reservation_id: int) -> None:
        async with self.session_factory.begin() as session:
            observed = await session.get(AiTokenReservation, reservation_id)
            if observed is None or observed.status != RESERVED:
                return
            await self._config(session, for_share=True)
            usage = await self._usage(
                session, observed.user_id, observed.usage_date, for_update=True
            )
            reservation = await session.scalar(
                select(AiTokenReservation)
                .where(AiTokenReservation.id == reservation_id)
                .with_for_update()
                .execution_options(populate_existing=True)
            )
            if reservation is None or reservation.status != RESERVED:
                return
            usage.reserved_tokens = max(0, usage.reserved_tokens - reservation.reserved_tokens)
            reservation.status = RELEASED

    async def recover_unsettled(self) -> int:
        recovered = 0
        async with self.session_factory() as lookup:
            ids = list(
                (
                    await lookup.scalars(
                        select(AiTokenReservation.id)
                        .where(AiTokenReservation.status == RESERVED)
                        .order_by(AiTokenReservation.id)
                    )
                ).all()
            )
        for reservation_id in ids:
            async with self.session_factory() as session:
                reservation = await session.get(AiTokenReservation, reservation_id)
            if reservation is None:
                continue
            await self.settle(
                reservation_id,
                prompt_tokens=reservation.reserved_tokens,
                completion_tokens=0,
                usage_source="estimated",
                estimated=True,
            )
            recovered += 1
        return recovered

    async def _config(
        self,
        session: AsyncSession,
        *,
        for_update: bool = False,
        for_share: bool = False,
    ) -> AiQuotaConfig:
        statement = select(AiQuotaConfig).where(AiQuotaConfig.id == CONFIG_ID)
        if for_update:
            statement = statement.with_for_update()
        elif for_share:
            statement = statement.with_for_update(read=True)
        config = await session.scalar(statement)
        if config is None:
            raise DailyTokenQuotaUnavailable("AI quota configuration is unavailable")
        return config

    async def _usage(
        self,
        session: AsyncSession,
        user_id: int,
        usage_date: date,
        *,
        for_update: bool,
    ) -> AiDailyTokenUsage:
        dialect = session.bind.dialect.name if session.bind is not None else ""
        values = {
            "user_id": user_id,
            "usage_date": usage_date,
            "consumed_tokens": 0,
            "reserved_tokens": 0,
        }
        if dialect == "mysql":
            await session.execute(
                mysql_insert(AiDailyTokenUsage).values(**values).prefix_with("IGNORE")
            )
        elif dialect == "sqlite":
            await session.execute(
                sqlite_insert(AiDailyTokenUsage)
                .values(**values)
                .on_conflict_do_nothing(index_elements=["user_id", "usage_date"])
            )
        statement = select(AiDailyTokenUsage).where(
            AiDailyTokenUsage.user_id == user_id,
            AiDailyTokenUsage.usage_date == usage_date,
        )
        if for_update:
            statement = statement.with_for_update()
        usage = await session.scalar(statement)
        if usage is None:
            raise RuntimeError("daily token usage initialization failed")
        return usage

    async def _override(
        self,
        session: AsyncSession,
        user_id: int,
        *,
        for_share: bool = False,
    ) -> AiUserQuotaOverride | None:
        statement = select(AiUserQuotaOverride).where(
            AiUserQuotaOverride.user_id == user_id
        )
        if for_share:
            statement = statement.with_for_update(read=True)
        override: AiUserQuotaOverride | None = await session.scalar(statement)
        return override


def beijing_date(now: datetime | None = None) -> date:
    instant = now or datetime.now(UTC)
    if instant.tzinfo is None:
        instant = instant.replace(tzinfo=UTC)
    return instant.astimezone(BEIJING).date()


def reset_at(usage_date: date) -> datetime:
    return datetime.combine(usage_date + timedelta(days=1), time.min, tzinfo=BEIJING)


def snapshot(
    config: AiQuotaConfig,
    usage: AiDailyTokenUsage | None,
    usage_date: date,
    override: AiUserQuotaOverride | None = None,
) -> QuotaSnapshot:
    consumed = usage.consumed_tokens if usage is not None else 0
    reserved = usage.reserved_tokens if usage is not None else 0
    limit = override.daily_token_limit if override is not None else config.daily_token_limit
    return QuotaSnapshot(
        limit=limit,
        consumed=consumed,
        reserved=reserved,
        remaining=max(0, limit - consumed - reserved),
        reset_at=reset_at(usage_date),
        updated_by_user_id=config.updated_by_user_id,
        updated_at=config.update_time,
        limit_source="user" if override is not None else "global",
    )


def admin_usage(
    config: AiQuotaConfig,
    usage: AiDailyTokenUsage | None,
    override: AiUserQuotaOverride | None,
    user_id: int,
    usage_date: date,
) -> AdminQuotaUsage:
    consumed = usage.consumed_tokens if usage is not None else 0
    reserved = usage.reserved_tokens if usage is not None else 0
    limit = override.daily_token_limit if override is not None else config.daily_token_limit
    return AdminQuotaUsage(
        user_id=user_id,
        usage_date=usage_date,
        limit=limit,
        consumed=consumed,
        reserved=reserved,
        remaining=max(0, limit - consumed - reserved),
        limit_source="user" if override is not None else "global",
    )
