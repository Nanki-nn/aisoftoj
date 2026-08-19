from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass(frozen=True, slots=True)
class AgentContext:
    user_id: int
    username: str
    nickname: str | None
    thread_id: str
    run_id: str
    bearer_token: str = field(repr=False)
    question_id: int | None = None
    event_sink: Any = field(default=None, repr=False, compare=False)
