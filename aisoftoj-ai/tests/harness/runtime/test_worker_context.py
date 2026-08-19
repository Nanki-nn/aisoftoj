from __future__ import annotations

from langchain_core.messages import BaseMessage, HumanMessage, SystemMessage

from packages.harness.aisoftoj_agent.runtime.worker import with_current_question_context


def test_current_question_context_is_inserted_before_latest_user_message() -> None:
    original: list[BaseMessage] = [
        HumanMessage(content="上一题"),
        HumanMessage(content="讲讲这题"),
    ]

    result = with_current_question_context(original, 123)

    assert result[0] is original[0]
    assert isinstance(result[1], SystemMessage)
    assert "题目 ID 123" in str(result[1].content)
    assert "get_question(question_id=123)" in str(result[1].content)
    assert result[2] is original[1]


def test_missing_question_context_keeps_messages_unchanged() -> None:
    messages: list[BaseMessage] = [HumanMessage(content="今天学什么")]
    assert with_current_question_context(messages, None) is messages
