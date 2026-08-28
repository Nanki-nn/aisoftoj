from __future__ import annotations

import json
import re
from collections.abc import Iterable, Mapping
from typing import Any, cast

REDACTED = "[REDACTED]"
HIDDEN_REASONING = "[HIDDEN_REASONING]"

_SENSITIVE_KEYS = frozenset({
    "apikey",
    "authorization",
    "cookie",
    "setcookie",
    "token",
    "accesstoken",
    "refreshtoken",
    "bearertoken",
    "password",
    "secret",
    "servicekey",
    "llmapikey",
    "platformservicekey",
    "langsmithapikey",
})
_REASONING_CONTENT_KEY = "reasoningcontent"
_PRIVATE_BLOCK_TYPES = frozenset({"reasoning", "thinking"})
_CONTENT_KEYS = frozenset({"input", "inputs", "output", "outputs", "messages", "content", "text"})
_KEY_SEPARATORS = re.compile(r"[_\-. ]")
_CREDENTIAL_PATTERNS = (
    re.compile(r"sk-proj-[A-Za-z0-9_-]{16,}"),
    re.compile(r"sk-ant-[A-Za-z0-9_-]{16,}"),
    re.compile(r"github_pat_[A-Za-z0-9_]{20,}"),
    re.compile(r"ghp_[A-Za-z0-9]{20,}"),
    re.compile(r"AIza[A-Za-z0-9_-]{20,}"),
    re.compile(r"xox[bp]-[A-Za-z0-9-]{16,}"),
    re.compile(r"sk-[A-Za-z0-9_-]{16,}"),
    re.compile(r"(?i)Bearer[ ]+[A-Za-z0-9._~+/-]{8,}=*"),
)


class SecretRedactor:
    def __init__(self, secrets: Iterable[str], *, hide_content: bool = False) -> None:
        self._secrets = tuple(sorted(
            {item for item in secrets if len(item) >= 8},
            key=len,
            reverse=True,
        ))
        self._hide_content = hide_content

    def __call__(self, payload: dict[str, Any]) -> dict[str, Any]:
        return cast(dict[str, Any], self._redact(payload))

    def _redact(self, value: Any) -> Any:
        if isinstance(value, Mapping):
            private_block = _private_block_type(value)
            result: dict[Any, Any] = {}
            for key, item in value.items():
                normalized_key = _normalize_key(key)
                if normalized_key in _SENSITIVE_KEYS:
                    result[key] = REDACTED
                elif self._hide_content and normalized_key in _CONTENT_KEYS:
                    result[key] = _content_summary(item)
                elif normalized_key == _REASONING_CONTENT_KEY:
                    result[key] = HIDDEN_REASONING
                elif private_block is not None and normalized_key != "type":
                    result[key] = HIDDEN_REASONING
                else:
                    result[key] = self._redact(item)
            return result
        if isinstance(value, list):
            return [self._redact(item) for item in value]
        if isinstance(value, tuple):
            return tuple(self._redact(item) for item in value)
        if isinstance(value, str):
            return self._redact_text(value)
        return value

    def _redact_text(self, value: str) -> str:
        result = value
        for secret in self._secrets:
            result = result.replace(secret, REDACTED)
        for pattern in _CREDENTIAL_PATTERNS:
            result = pattern.sub(REDACTED, result)
        return result


def _normalize_key(value: object) -> str:
    if not isinstance(value, str):
        return ""
    return _KEY_SEPARATORS.sub("", value.lower())


def _private_block_type(value: Mapping[object, object]) -> str | None:
    for key, item in value.items():
        if _normalize_key(key) == "type" and isinstance(item, str):
            normalized_type = item.lower()
            return (
                normalized_type
                if normalized_type in _PRIVATE_BLOCK_TYPES
                else None
            )
    return None


def _content_summary(value: object) -> dict[str, object]:
    try:
        serialized = value if isinstance(value, str) else json.dumps(value, ensure_ascii=False)
    except (TypeError, ValueError):
        serialized = ""
    return {"redacted": True, "chars": len(serialized)}
