from __future__ import annotations

import hashlib
import hmac
from typing import Any

RETRYABLE_ERROR_CODES = frozenset({-10001, -60007, -60009, -60020, -60021, -60022})
NON_RETRYABLE_ERROR_CODES = frozenset(
    {-60002, -60003, -60004, -60005, -60006, -60017, -60018, -60019}
)


def is_retryable_error(code: int | str | None, status_code: int | None = None) -> bool:
    if status_code is not None and (status_code == 429 or status_code >= 500):
        return True
    if isinstance(code, int):
        return code in RETRYABLE_ERROR_CODES
    return False


class MineruError(RuntimeError):
    """A sanitized error returned by the MinerU integration."""

    def __init__(
        self,
        code: int | str,
        message: str,
        *,
        status_code: int | None = None,
        trace_id: str | None = None,
        retryable: bool | None = None,
    ) -> None:
        self.code = code
        self.message = " ".join(message.split())[:512]
        self.status_code = status_code
        self.trace_id = trace_id
        self.retryable = is_retryable_error(code, status_code) if retryable is None else retryable
        super().__init__(self.message)

    @classmethod
    def invalid_response(cls, detail: str) -> MineruError:
        return cls("INVALID_RESPONSE", detail, retryable=False)


def envelope_error(payload: object, status_code: int | None = None) -> MineruError:
    if isinstance(payload, dict):
        code = payload.get("code", f"HTTP_{status_code or 502}")
        message = payload.get("msg") or payload.get("message") or "MinerU request failed"
        trace_id = payload.get("trace_id")
        return MineruError(
            code if isinstance(code, (int, str)) else "UPSTREAM_ERROR",
            str(message),
            status_code=status_code,
            trace_id=str(trace_id) if trace_id is not None else None,
        )
    return MineruError(
        f"HTTP_{status_code or 502}", "MinerU request failed", status_code=status_code
    )


def json_object(payload: Any) -> dict[str, Any] | None:
    return payload if isinstance(payload, dict) else None


def verify_callback_signature(*, uid: str, seed: str, content: str, checksum: str) -> bool:
    """Verify MinerU's ``SHA256(uid + seed + content)`` callback signature."""
    expected = hashlib.sha256(f"{uid}{seed}{content}".encode()).hexdigest()
    return hmac.compare_digest(expected, checksum)
