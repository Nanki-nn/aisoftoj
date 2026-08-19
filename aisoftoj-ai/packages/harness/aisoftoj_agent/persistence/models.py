from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy import (
    CHAR,
    JSON,
    BigInteger,
    Boolean,
    Computed,
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
