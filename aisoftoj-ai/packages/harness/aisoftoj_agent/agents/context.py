from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(frozen=True, slots=True)
class AgentContext:
    user_id: int
    username: str
    nickname: str | None
    thread_id: str
    run_id: str
    bearer_token: str = field(repr=False)
