from __future__ import annotations

import pytest

from packages.harness.aisoftoj_agent.observability.config import LangSmithConfig


def enabled_env(**overrides: str) -> dict[str, str]:
    result = {
        "LANGSMITH_TRACING": "true",
        "LANGSMITH_API_KEY": "lsv2_test_secret_value",
    }
    result.update(overrides)
    return result


def test_tracing_is_disabled_without_environment() -> None:
    config = LangSmithConfig.from_env({})

    assert config.enabled is False
    assert config.api_key is None


def test_disabled_tracing_ignores_unrelated_langsmith_values() -> None:
    config = LangSmithConfig.from_env({
        "LANGSMITH_TRACING": "false",
        "LANGSMITH_TRACING_SAMPLING_RATE": "not-a-number",
    })

    assert config.enabled is False


def test_enabled_tracing_requires_api_key() -> None:
    with pytest.raises(ValueError, match="LANGSMITH_API_KEY"):
        LangSmithConfig.from_env({"LANGSMITH_TRACING": "true"})


@pytest.mark.parametrize("value", ["nan", "inf", "-0.1", "1.1"])
def test_sampling_rate_must_be_finite_unit_interval(value: str) -> None:
    with pytest.raises(ValueError, match="SAMPLING_RATE"):
        LangSmithConfig.from_env(
            enabled_env(LANGSMITH_TRACING_SAMPLING_RATE=value)
        )


@pytest.mark.parametrize("value", ["nan", "inf", "0", "0.09", "10.1"])
def test_flush_timeout_must_be_finite_and_bounded(value: str) -> None:
    with pytest.raises(ValueError, match="FLUSH_TIMEOUT"):
        LangSmithConfig.from_env(
            enabled_env(LANGSMITH_FLUSH_TIMEOUT_SECONDS=value)
        )


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("LANGSMITH_ENDPOINT", "ftp://api.example"),
        ("LANGSMITH_ENDPOINT", "https:///missing-host"),
        ("LANGSMITH_PROJECT", ""),
        ("LANGSMITH_PROJECT", "bad\nproject"),
        ("LANGSMITH_ENVIRONMENT", "bad environment"),
        ("LANGSMITH_AGENT_VERSION", "bad/version"),
    ],
)
def test_enabled_configuration_rejects_invalid_strings(
    field: str, value: str
) -> None:
    with pytest.raises(ValueError, match=field):
        LangSmithConfig.from_env(enabled_env(**{field: value}))


@pytest.mark.parametrize("value", ["1", "TRUE", "yes", "On"])
def test_documented_true_values_enable_tracing(value: str) -> None:
    assert LangSmithConfig.from_env(
        enabled_env(LANGSMITH_TRACING=value)
    ).enabled


@pytest.mark.parametrize("value", ["0", "FALSE", "no", "Off", ""])
def test_documented_false_values_disable_tracing(value: str) -> None:
    assert not LangSmithConfig.from_env({"LANGSMITH_TRACING": value}).enabled


def test_unknown_boolean_value_is_rejected() -> None:
    with pytest.raises(ValueError, match="LANGSMITH_TRACING"):
        LangSmithConfig.from_env({"LANGSMITH_TRACING": "sometimes"})


def test_enabled_configuration_uses_documented_defaults() -> None:
    config = LangSmithConfig.from_env(enabled_env())

    assert config.api_key is not None
    assert config.api_key.get_secret_value() == "lsv2_test_secret_value"
    assert config.endpoint == "https://api.smith.langchain.com"
    assert config.project == "aisoftoj-agent-dev"
    assert config.environment == "development"
    assert config.agent_version == "local"
    assert config.sampling_rate == 1.0
    assert config.flush_timeout_seconds == 2.0


def test_enabled_configuration_accepts_documented_overrides() -> None:
    config = LangSmithConfig.from_env(
        enabled_env(
            LANGSMITH_ENDPOINT="https://eu.api.smith.langchain.com",
            LANGSMITH_PROJECT="aisoftoj production",
            LANGSMITH_ENVIRONMENT="production",
            LANGSMITH_AGENT_VERSION="release-2026.08.27",
            LANGSMITH_TRACING_SAMPLING_RATE="0.2",
            LANGSMITH_FLUSH_TIMEOUT_SECONDS="3.5",
        )
    )

    assert config.endpoint == "https://eu.api.smith.langchain.com"
    assert config.project == "aisoftoj production"
    assert config.environment == "production"
    assert config.agent_version == "release-2026.08.27"
    assert config.sampling_rate == 0.2
    assert config.flush_timeout_seconds == 3.5
