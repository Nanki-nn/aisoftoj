from __future__ import annotations

import math
import os
import re
from collections.abc import Mapping
from dataclasses import dataclass
from urllib.parse import urlsplit

from pydantic import SecretStr

DEFAULT_ENDPOINT = "https://api.smith.langchain.com"
DEFAULT_PROJECT = "aisoftoj-agent-dev"
DEFAULT_ENVIRONMENT = "development"
DEFAULT_AGENT_VERSION = "local"
DEFAULT_SAMPLING_RATE = 1.0
DEFAULT_FLUSH_TIMEOUT_SECONDS = 2.0

_SAFE_LABEL = re.compile(r"[A-Za-z0-9][A-Za-z0-9._-]{0,63}")
_TRUE_VALUES = frozenset({"1", "true", "yes", "on"})
_FALSE_VALUES = frozenset({"", "0", "false", "no", "off"})


@dataclass(frozen=True, slots=True)
class LangSmithConfig:
    enabled: bool
    api_key: SecretStr | None
    endpoint: str
    project: str
    sampling_rate: float
    environment: str
    agent_version: str
    flush_timeout_seconds: float

    @classmethod
    def from_env(
        cls, environ: Mapping[str, str] | None = None
    ) -> LangSmithConfig:
        source = os.environ if environ is None else environ
        enabled = _parse_bool(source.get("LANGSMITH_TRACING", "false"))
        if not enabled:
            return cls(
                enabled=False,
                api_key=None,
                endpoint=DEFAULT_ENDPOINT,
                project=DEFAULT_PROJECT,
                sampling_rate=DEFAULT_SAMPLING_RATE,
                environment=DEFAULT_ENVIRONMENT,
                agent_version=DEFAULT_AGENT_VERSION,
                flush_timeout_seconds=DEFAULT_FLUSH_TIMEOUT_SECONDS,
            )

        api_key = source.get("LANGSMITH_API_KEY", "").strip()
        if not api_key:
            raise ValueError(
                "LANGSMITH_API_KEY is required when LANGSMITH_TRACING is enabled"
            )

        endpoint = source.get("LANGSMITH_ENDPOINT", DEFAULT_ENDPOINT).strip()
        _validate_endpoint(endpoint)
        project = source.get("LANGSMITH_PROJECT", DEFAULT_PROJECT).strip()
        _validate_project(project)
        environment = source.get(
            "LANGSMITH_ENVIRONMENT", DEFAULT_ENVIRONMENT
        ).strip()
        _validate_label("LANGSMITH_ENVIRONMENT", environment)
        agent_version = source.get(
            "LANGSMITH_AGENT_VERSION", DEFAULT_AGENT_VERSION
        ).strip()
        _validate_label("LANGSMITH_AGENT_VERSION", agent_version)
        sampling_rate = _parse_float(
            "LANGSMITH_TRACING_SAMPLING_RATE",
            source.get(
                "LANGSMITH_TRACING_SAMPLING_RATE",
                str(DEFAULT_SAMPLING_RATE),
            ),
        )
        if not 0 <= sampling_rate <= 1:
            raise ValueError(
                "LANGSMITH_TRACING_SAMPLING_RATE must be between 0 and 1"
            )
        flush_timeout = _parse_float(
            "LANGSMITH_FLUSH_TIMEOUT_SECONDS",
            source.get(
                "LANGSMITH_FLUSH_TIMEOUT_SECONDS",
                str(DEFAULT_FLUSH_TIMEOUT_SECONDS),
            ),
        )
        if not 0.1 <= flush_timeout <= 10:
            raise ValueError(
                "LANGSMITH_FLUSH_TIMEOUT_SECONDS must be between 0.1 and 10"
            )

        return cls(
            enabled=True,
            api_key=SecretStr(api_key),
            endpoint=endpoint,
            project=project,
            sampling_rate=sampling_rate,
            environment=environment,
            agent_version=agent_version,
            flush_timeout_seconds=flush_timeout,
        )


def _parse_bool(value: str) -> bool:
    normalized = value.strip().lower()
    if normalized in _TRUE_VALUES:
        return True
    if normalized in _FALSE_VALUES:
        return False
    raise ValueError(
        "LANGSMITH_TRACING must be one of true/false, 1/0, yes/no, or on/off"
    )


def _parse_float(name: str, value: str) -> float:
    try:
        parsed = float(value)
    except ValueError as exc:
        raise ValueError(f"{name} must be a finite number") from exc
    if not math.isfinite(parsed):
        raise ValueError(f"{name} must be a finite number")
    return parsed


def _validate_endpoint(value: str) -> None:
    parsed = urlsplit(value)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise ValueError("LANGSMITH_ENDPOINT must be an HTTP(S) URL")


def _validate_project(value: str) -> None:
    if not 1 <= len(value) <= 128 or not value.isprintable():
        raise ValueError(
            "LANGSMITH_PROJECT must contain 1 to 128 printable characters"
        )


def _validate_label(name: str, value: str) -> None:
    if _SAFE_LABEL.fullmatch(value) is None:
        raise ValueError(
            f"{name} must start with an alphanumeric character and contain only "
            "letters, numbers, dots, underscores, or hyphens"
        )
