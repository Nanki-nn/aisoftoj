from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, HttpUrl, field_validator, model_validator
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


class AdminUserSummary(JavaModel):
    id: int = Field(gt=0)
    login_name: str | None = None
    nick_name: str | None = None
    email: str | None = None


class AdminUserPage(JavaModel):
    records: list[AdminUserSummary]
    total: int = Field(ge=0)
    page: int = Field(ge=1)
    page_size: int = Field(ge=1, le=100)


class AdminUserDetail(JavaModel):
    id: int = Field(gt=0)
    login_name: str | None = None
    nick_name: str | None = None
    email: str | None = None
    role: str = Field(min_length=1)
    is_enabled: bool
    is_deleted: bool


class AdminUserBatch(JavaModel):
    records: list[AdminUserDetail]
    missing_user_ids: list[int]


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
    correct_answer: str | None = None
    analysis: str | None = None


class TextbookTraceQuestion(Question):
    analysis: str | None
    subject_name: str = Field(min_length=1)


class TextbookSection(JavaModel):
    id: int = Field(gt=0)
    parent_id: int | None = Field(default=None, gt=0)
    level: int = Field(ge=1)
    section_code: str = Field(min_length=1)
    title: str = Field(min_length=1)
    printed_page_start: int = Field(ge=0)
    printed_page_end: int = Field(ge=0)
    pdf_page_start: int = Field(ge=1)
    pdf_page_end: int = Field(ge=1)
    sort_order: int = Field(ge=0)

    @model_validator(mode="after")
    def validate_page_ranges(self) -> TextbookSection:
        if self.printed_page_end < self.printed_page_start:
            raise ValueError("printed page range is reversed")
        if self.pdf_page_end < self.pdf_page_start:
            raise ValueError("PDF page range is reversed")
        return self


class KnowledgePointSource(JavaModel):
    id: int = Field(gt=0)
    section_id: int = Field(gt=0)
    printed_page_start: int = Field(ge=0)
    printed_page_end: int = Field(ge=0)
    pdf_page_start: int = Field(ge=1)
    pdf_page_end: int = Field(ge=1)
    primary: bool

    @model_validator(mode="after")
    def validate_page_ranges(self) -> KnowledgePointSource:
        if self.printed_page_end < self.printed_page_start:
            raise ValueError("printed page range is reversed")
        if self.pdf_page_end < self.pdf_page_start:
            raise ValueError("PDF page range is reversed")
        return self


class KnowledgePoint(JavaModel):
    id: int = Field(gt=0)
    parent_id: int | None = Field(default=None, gt=0)
    level: int = Field(ge=1, le=2)
    code: str = Field(min_length=1)
    name: str = Field(min_length=1)
    description: str | None
    sources: list[KnowledgePointSource]


class TextbookCatalog(JavaModel):
    textbook_id: int = Field(gt=0)
    subject_name: str = Field(min_length=1)
    name: str = Field(min_length=1)
    edition: str = Field(min_length=1)
    isbn: str | None
    official_url: HttpUrl
    viewer_page_template: str | None
    sections: list[TextbookSection]
    knowledge_points: list[KnowledgePoint]

    @field_validator("official_url")
    @classmethod
    def validate_official_url(cls, value: HttpUrl) -> HttpUrl:
        if value.scheme != "https":
            raise ValueError("official textbook URL must use HTTPS")
        return value

    @field_validator("viewer_page_template")
    @classmethod
    def validate_viewer_page_template(cls, value: str | None) -> str | None:
        if value is not None and "{pdfPage}" not in value:
            raise ValueError("viewer page template must contain {pdfPage}")
        return value


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
