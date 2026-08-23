from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


def trim_title(value: str) -> str:
    trimmed = value.strip()
    if len(trimmed) > 120:
        raise ValueError("title too long")
    return trimmed


class ThreadCreateRequest(BaseModel):
    title: str | None = None

    @field_validator("title")
    @classmethod
    def validate_title(cls, value: str | None) -> str | None:
        return None if value is None else trim_title(value) or None


class ThreadUpdateRequest(BaseModel):
    title: str = Field(min_length=1, max_length=120)

    @field_validator("title")
    @classmethod
    def validate_title(cls, value: str) -> str:
        trimmed = value.strip()
        if not trimmed:
            raise ValueError("title cannot be blank")
        return trimmed


class ThreadResponse(BaseModel):
    id: str
    title: str | None
    created_at: datetime
    updated_at: datetime


class ThreadPageResponse(BaseModel):
    items: list[ThreadResponse]
    total: int = Field(ge=0)
    page: int = Field(ge=1)
    page_size: int = Field(ge=1, le=100)


class MessageResponse(BaseModel):
    id: str
    thread_id: str
    run_id: str
    role: Literal["user", "assistant"]
    content: str
    sequence: int = Field(gt=0)
    created_at: datetime


class MessagePageResponse(BaseModel):
    items: list[MessageResponse]
    next_before_sequence: int | None
    has_more: bool


class RunContext(BaseModel):
    model_config = ConfigDict(extra="forbid")

    question_id: int | None = Field(default=None, strict=True, gt=0, le=2_147_483_647)


class RunCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    message: str = Field(min_length=1)
    context: RunContext | None = None

    @field_validator("message")
    @classmethod
    def validate_message(cls, value: str) -> str:
        trimmed = value.strip()
        if not trimmed:
            raise ValueError("message cannot be blank")
        return trimmed


RunStatus = Literal["queued", "running", "completed", "failed", "cancelled", "interrupted"]


class RunResponse(BaseModel):
    id: str
    thread_id: str
    status: RunStatus
    input_message_id: str
    output_message_id: str | None
    error_code: str | None
    model_name: str
    prompt_tokens: int | None
    completion_tokens: int | None
    started_at: datetime | None
    finished_at: datetime | None
    created_at: datetime
    updated_at: datetime


class RunPageResponse(BaseModel):
    items: list[RunResponse]
    total: int = Field(ge=0)
    page: int = Field(ge=1)
    page_size: int = Field(ge=1, le=100)


class SkillResponse(BaseModel):
    name: str
    description: str
    category: str
    enabled: bool
    license: str | None


class SkillListResponse(BaseModel):
    items: list[SkillResponse]
    total: int = Field(ge=0)
