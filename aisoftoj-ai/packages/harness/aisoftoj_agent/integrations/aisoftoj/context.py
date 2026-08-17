from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(frozen=True, slots=True)
class TrustedUser:
    user_id: int
    username: str
    nickname: str | None
    role: str
    bearer_token: str = field(repr=False)
