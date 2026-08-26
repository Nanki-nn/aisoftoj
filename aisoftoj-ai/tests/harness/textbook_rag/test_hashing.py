from __future__ import annotations

from pydantic import HttpUrl

from packages.harness.aisoftoj_agent.integrations.aisoftoj.models import (
    QuestionOption,
    TextbookTraceQuestion,
)
from packages.harness.aisoftoj_agent.textbook_rag.hashing import (
    catalog_content_hash,
    question_content_hash,
)
from tests.harness.textbook_rag.test_retrieval import catalog


def question(content: str) -> TextbookTraceQuestion:
    return TextbookTraceQuestion(
        question_id=9,
        name="架构题",
        content=content,
        options=[QuestionOption(key="A", content="管道过滤器")],
        analysis="考查架构风格",
        question_type="single_choice",
        difficulty="medium",
        subject_name="系统架构设计师",
    )


def test_question_hash_is_whitespace_stable_but_content_sensitive() -> None:
    assert question_content_hash(question("选择正确答案")) == question_content_hash(
        question("  选择正确答案\n")
    )
    assert question_content_hash(question("选择正确答案")) != question_content_hash(
        question("选择错误答案")
    )


def test_catalog_hash_ignores_current_link_but_tracks_page_mapping() -> None:
    original = catalog()
    relinked = original.model_copy(
        update={"official_url": HttpUrl("https://books.example.com/current.pdf")}
    )
    remapped_section = original.sections[1].model_copy(update={"pdf_page_start": 93})
    remapped = original.model_copy(
        update={"sections": [original.sections[0], remapped_section]}
    )

    assert catalog_content_hash(original) == catalog_content_hash(relinked)
    assert catalog_content_hash(original) != catalog_content_hash(remapped)
