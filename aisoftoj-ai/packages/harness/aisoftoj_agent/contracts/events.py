from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

PersistedEventType = Literal[
    "run.created",
    "run.started",
    "message.started",
    "message.delta",
    "tool.started",
    "tool.completed",
    "tool.failed",
    "message.completed",
    "run.completed",
    "run.failed",
    "run.cancelled",
    "run.interrupted",
]


class PersistedEvent(BaseModel):
    model_config = ConfigDict(extra="forbid")

    run_id: str
    sequence: int = Field(gt=0)
    type: PersistedEventType
    created_at: datetime
    data: dict[str, Any]


class StreamEnd(BaseModel):
    run_id: str
    status: Literal["completed", "failed", "cancelled", "interrupted"]
    last_sequence: int = Field(ge=0)


class StreamReset(BaseModel):
    run_id: str
    reason: Literal["slow_consumer"]
    last_sequence: int = Field(ge=0)


class EventPage(BaseModel):
    items: list[PersistedEvent]
    next_after_sequence: int | None
    has_more: bool
