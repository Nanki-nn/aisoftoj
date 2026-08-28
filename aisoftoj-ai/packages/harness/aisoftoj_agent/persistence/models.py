from __future__ import annotations

from datetime import date, datetime
from typing import Any

from sqlalchemy import (
    CHAR,
    JSON,
    BigInteger,
    Boolean,
    Computed,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class AiThread(Base):
    __tablename__ = "ai_threads"
    __mapper_args__ = {"eager_defaults": True}
    __table_args__ = (
        Index("ix_ai_threads_owner_list", "user_id", "is_deleted", "update_time", "id"),
    )

    id: Mapped[str] = mapped_column(CHAR(36), primary_key=True)
    user_id: Mapped[int] = mapped_column(Integer, nullable=False)
    title: Mapped[str | None] = mapped_column(String(120))
    is_deleted: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    create_time: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )
    update_time: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now(), nullable=False
    )
    delete_time: Mapped[datetime | None] = mapped_column(DateTime)


class AiMessage(Base):
    __tablename__ = "ai_messages"
    __mapper_args__ = {"eager_defaults": True}
    __table_args__ = (
        UniqueConstraint("thread_id", "sequence", name="uq_ai_messages_thread_sequence"),
        UniqueConstraint("run_id", "role", name="uq_ai_messages_run_role"),
    )

    id: Mapped[str] = mapped_column(CHAR(36), primary_key=True)
    thread_id: Mapped[str] = mapped_column(
        CHAR(36), ForeignKey("ai_threads.id", ondelete="CASCADE"), nullable=False
    )
    run_id: Mapped[str | None] = mapped_column(CHAR(36), ForeignKey("ai_runs.id"))
    role: Mapped[str] = mapped_column(String(16), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    sequence: Mapped[int] = mapped_column(Integer, nullable=False)
    create_time: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )


class AiRun(Base):
    __tablename__ = "ai_runs"
    __mapper_args__ = {"eager_defaults": True}
    __table_args__ = (
        UniqueConstraint("thread_id", "idempotency_key", name="uq_ai_runs_idempotency"),
        UniqueConstraint("thread_id", "active_marker", name="uq_ai_runs_active"),
        Index("ix_ai_runs_thread_created", "thread_id", "create_time", "id"),
    )

    id: Mapped[str] = mapped_column(CHAR(36), primary_key=True)
    thread_id: Mapped[str] = mapped_column(
        CHAR(36), ForeignKey("ai_threads.id", ondelete="CASCADE"), nullable=False
    )
    idempotency_key: Mapped[str] = mapped_column(String(128), nullable=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False)
    input_message_id: Mapped[str] = mapped_column(
        CHAR(36), ForeignKey("ai_messages.id"), nullable=False
    )
    output_message_id: Mapped[str | None] = mapped_column(CHAR(36), ForeignKey("ai_messages.id"))
    error_code: Mapped[str | None] = mapped_column(String(64))
    model_name: Mapped[str] = mapped_column(String(128), nullable=False)
    question_id: Mapped[int | None] = mapped_column(Integer)
    prompt_tokens: Mapped[int | None] = mapped_column(Integer)
    completion_tokens: Mapped[int | None] = mapped_column(Integer)
    started_at: Mapped[datetime | None] = mapped_column(DateTime)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime)
    create_time: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )
    update_time: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now(), nullable=False
    )
    active_marker: Mapped[int | None] = mapped_column(
        Integer,
        Computed("CASE WHEN status IN ('queued','running') THEN 1 ELSE NULL END", persisted=True),
    )


class AiRunEvent(Base):
    __tablename__ = "ai_run_events"
    __mapper_args__ = {"eager_defaults": True}
    __table_args__ = (UniqueConstraint("run_id", "sequence", name="uq_ai_run_events_sequence"),)

    # SQLite only auto-increments an INTEGER PRIMARY KEY; keep BIGINT on MySQL.
    id: Mapped[int] = mapped_column(
        BigInteger().with_variant(Integer, "sqlite"), primary_key=True, autoincrement=True
    )
    run_id: Mapped[str] = mapped_column(
        CHAR(36), ForeignKey("ai_runs.id", ondelete="CASCADE"), nullable=False
    )
    sequence: Mapped[int] = mapped_column(Integer, nullable=False)
    event_type: Mapped[str] = mapped_column(String(32), nullable=False)
    payload: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)
    create_time: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )


class AiThreadSummary(Base):
    __tablename__ = "ai_thread_summaries"
    __mapper_args__ = {"eager_defaults": True}

    thread_id: Mapped[str] = mapped_column(
        CHAR(36), ForeignKey("ai_threads.id", ondelete="CASCADE"), primary_key=True
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)
    summarized_through_sequence: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    create_time: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )
    update_time: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now(), nullable=False
    )


class AiQuotaConfig(Base):
    __tablename__ = "ai_quota_config"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    daily_token_limit: Mapped[int] = mapped_column(Integer, nullable=False, default=30_000)
    updated_by_user_id: Mapped[int | None] = mapped_column(Integer)
    create_time: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )
    update_time: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now(), nullable=False
    )


class AiAccessConfig(Base):
    __tablename__ = "ai_access_config"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    globally_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    updated_by_user_id: Mapped[int | None] = mapped_column(Integer)
    create_time: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )
    update_time: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now(), nullable=False
    )


class AiRolloutUser(Base):
    __tablename__ = "ai_rollout_users"

    user_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    created_by_user_id: Mapped[int] = mapped_column(Integer, nullable=False)
    updated_by_user_id: Mapped[int] = mapped_column(Integer, nullable=False)
    create_time: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )
    update_time: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now(), nullable=False
    )


class AiAccessAuditLog(Base):
    __tablename__ = "ai_access_audit_log"
    __table_args__ = (Index("ix_ai_access_audit_created", "create_time", "id"),)

    id: Mapped[int] = mapped_column(
        BigInteger().with_variant(Integer, "sqlite"),
        primary_key=True,
        autoincrement=True,
    )
    action: Mapped[str] = mapped_column(String(32), nullable=False)
    admin_user_id: Mapped[int] = mapped_column(Integer, nullable=False)
    target_user_id: Mapped[int | None] = mapped_column(Integer)
    old_value: Mapped[bool] = mapped_column(Boolean, nullable=False)
    new_value: Mapped[bool] = mapped_column(Boolean, nullable=False)
    create_time: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )


class AiUserQuotaOverride(Base):
    __tablename__ = "ai_user_quota_overrides"

    user_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    daily_token_limit: Mapped[int] = mapped_column(Integer, nullable=False)
    updated_by_user_id: Mapped[int] = mapped_column(Integer, nullable=False)
    create_time: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )
    update_time: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now(), nullable=False
    )


class AiDailyTokenUsage(Base):
    __tablename__ = "ai_daily_token_usage"
    __table_args__ = (
        UniqueConstraint("user_id", "usage_date", name="uq_ai_daily_token_usage_user_date"),
    )

    id: Mapped[int] = mapped_column(
        BigInteger().with_variant(Integer, "sqlite"),
        primary_key=True,
        autoincrement=True,
    )
    user_id: Mapped[int] = mapped_column(Integer, nullable=False)
    usage_date: Mapped[date] = mapped_column(Date, nullable=False)
    consumed_tokens: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    reserved_tokens: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    create_time: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )
    update_time: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now(), nullable=False
    )


class AiTokenReservation(Base):
    __tablename__ = "ai_token_reservations"
    __table_args__ = (
        UniqueConstraint("run_id", "model_call_sequence", name="uq_ai_token_reservation_run_call"),
        Index("ix_ai_token_reservations_status", "status", "create_time"),
    )

    id: Mapped[int] = mapped_column(
        BigInteger().with_variant(Integer, "sqlite"),
        primary_key=True,
        autoincrement=True,
    )
    run_id: Mapped[str] = mapped_column(
        CHAR(36), ForeignKey("ai_runs.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[int] = mapped_column(Integer, nullable=False)
    usage_date: Mapped[date] = mapped_column(Date, nullable=False)
    model_call_sequence: Mapped[int] = mapped_column(Integer, nullable=False)
    reserved_tokens: Mapped[int] = mapped_column(Integer, nullable=False)
    prompt_tokens: Mapped[int | None] = mapped_column(Integer)
    completion_tokens: Mapped[int | None] = mapped_column(Integer)
    usage_source: Mapped[str | None] = mapped_column(String(16))
    status: Mapped[str] = mapped_column(String(24), nullable=False)
    create_time: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )
    update_time: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now(), nullable=False
    )
