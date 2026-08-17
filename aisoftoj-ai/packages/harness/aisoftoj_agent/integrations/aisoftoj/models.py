from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel


class JavaModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        extra="ignore",
    )


class ResultEnvelope[T](JavaModel):
    code: int
    message: str
    data: T
    timestamp: int


class Profile(JavaModel):
    user_id: int = Field(gt=0)
    username: str = Field(min_length=1)
    nickname: str | None
    role: str = Field(min_length=1)
    join_date: datetime | None
    last_login_date: datetime | None
    practice_session_count: int = Field(ge=0)
    wrong_question_count: int = Field(ge=0)


class Paper(JavaModel):
    paper_id: int = Field(gt=0)
    name: str = Field(min_length=1)
    subject_name: str | None
    category: str = Field(min_length=1)
    year: int | None
    month: int | None = Field(default=None, ge=1, le=12)
    question_count: int = Field(ge=0)
    practice_status: Literal["not_started", "in_progress", "completed"]
    completed_question_count: int = Field(ge=0)
    ongoing_session_id: int | None = Field(default=None, gt=0)
    last_practice_time: datetime | None


class QuestionOption(JavaModel):
    key: str = Field(min_length=1)
    content: str


QuestionType = Literal[
    "single_choice",
    "multiple_choice",
    "judgement",
    "fill_blank",
    "case_analysis",
    "essay",
    "unknown",
]
Difficulty = Literal["easy", "medium", "hard", "unknown"]


class Question(JavaModel):
    question_id: int = Field(gt=0)
    name: str = Field(min_length=1)
    content: str = Field(min_length=1)
    options: list[QuestionOption]
    question_type: QuestionType
    difficulty: Difficulty


class WrongQuestionReview(JavaModel):
    wrong_question_id: int = Field(gt=0)
    question_id: int = Field(gt=0)
    paper_id: int = Field(gt=0)
    paper_name: str = Field(min_length=1)
    question_name: str = Field(min_length=1)
    question_content: str = Field(min_length=1)
    options: list[QuestionOption]
    question_type: QuestionType
    difficulty: Difficulty
    user_answer: str
    correct_answer: str = Field(min_length=1)
    analysis: str | None
    error_count: int = Field(ge=1)
    importance: str = Field(min_length=1)
    last_wrong_time: datetime
    spend_time: int | None = Field(default=None, ge=0)


class PracticeHistoryItem(JavaModel):
    session_id: int = Field(gt=0)
    paper_name: str = Field(min_length=1)
    exam_mode: Literal["practice", "exam"]
    exam_type: Literal["综合知识", "案例分析", "论文"]
    created_at: datetime
    answered_count: int = Field(ge=0)
    question_count: int = Field(ge=0)
    status: Literal["in_progress", "completed"]


class PracticeHistorySummary(JavaModel):
    total_count: int = Field(ge=0)
    in_progress_count: int = Field(ge=0)
    completed_count: int = Field(ge=0)
    answered_count: int = Field(ge=0)


class PracticeHistoryPage(JavaModel):
    records: list[PracticeHistoryItem]
    total: int = Field(ge=0)
    page: int = Field(ge=1)
    page_size: int = Field(ge=1, le=20)
    summary: PracticeHistorySummary
