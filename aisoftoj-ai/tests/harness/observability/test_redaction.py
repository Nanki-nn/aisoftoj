from __future__ import annotations

import pytest

from packages.harness.aisoftoj_agent.observability.redaction import (
    HIDDEN_REASONING,
    REDACTED,
    SecretRedactor,
)


def test_redacts_sensitive_keys_without_removing_token_metrics() -> None:
    redactor = SecretRedactor([])

    result = redactor({
        "authorization": "Bearer abcdefgh1234",
        "platform-service-key": "platform-secret",
        "nested": {
            "access_token": "access-secret",
            "Set.Cookie": "session-secret",
        },
        "prompt_tokens": 321,
        "completion_tokens": 45,
    })

    assert result == {
        "authorization": REDACTED,
        "platform-service-key": REDACTED,
        "nested": {"access_token": REDACTED, "Set.Cookie": REDACTED},
        "prompt_tokens": 321,
        "completion_tokens": 45,
    }


def test_redacts_explicit_secrets_and_bearer_values_inside_text() -> None:
    redactor = SecretRedactor(["llm-secret-123", "service-secret-456"])

    result = redactor({
        "text": (
            "keys llm-secret-123 and service-secret-456; "
            "Authorization: Bearer abcdefgh.123456"
        )
    })

    rendered = result["text"]
    assert "llm-secret-123" not in rendered
    assert "service-secret-456" not in rendered
    assert "abcdefgh.123456" not in rendered
    assert rendered.count(REDACTED) == 3


@pytest.mark.parametrize(
    "credential",
    [
        "sk-proj-abcdefghijklmnop",
        "sk-ant-abcdefghijklmnop",
        "sk-abcdefghijklmnop",
        "AIzaabcdefghijklmnopqrst",
        "ghp_abcdefghijklmnopqrst",
        "github_pat_abcdefghijklmnopqrst",
        "xoxb-abcdefghijklmnop",
        "xoxp-abcdefghijklmnop",
    ],
)
def test_redacts_supported_credential_patterns(credential: str) -> None:
    rendered = SecretRedactor([])({"text": f"before {credential} after"})[
        "text"
    ]

    assert credential not in rendered
    assert rendered == f"before {REDACTED} after"


def test_short_prefix_and_short_explicit_secret_are_preserved() -> None:
    payload = {"text": "sk-short and common"}

    assert SecretRedactor(["common"])(payload) == payload


def test_preserves_complete_business_content_without_mutating_input() -> None:
    payload = {
        "question": "令牌桶算法是什么？",
        "answer": ["完整解析", {"score": 0.9, "reasoning": "可见业务依据"}],
        "tuple": ("选项 A", "选项 B"),
    }

    result = SecretRedactor([])(payload)

    assert result == payload
    assert result is not payload
    assert result["answer"] is not payload["answer"]


def test_hides_provider_reasoning_but_preserves_visible_text() -> None:
    payload = {
        "additional_kwargs": {"reasoning_content": "private chain"},
        "content": [
            {
                "type": "reasoning",
                "reasoning": "private block",
                "signature": "provider-private",
            },
            {"type": "thinking", "thinking": "private thought"},
            {"type": "text", "text": "visible answer"},
        ],
    }

    result = SecretRedactor([])(payload)

    assert result["additional_kwargs"]["reasoning_content"] == HIDDEN_REASONING
    assert result["content"][0] == {
        "type": "reasoning",
        "reasoning": HIDDEN_REASONING,
        "signature": HIDDEN_REASONING,
    }
    assert result["content"][1] == {
        "type": "thinking",
        "thinking": HIDDEN_REASONING,
    }
    assert result["content"][2]["text"] == "visible answer"
