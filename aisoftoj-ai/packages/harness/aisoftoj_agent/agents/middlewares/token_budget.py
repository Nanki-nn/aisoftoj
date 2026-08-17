from __future__ import annotations

from typing import Any

from langchain.agents.middleware import AgentMiddleware


class TokenBudgetExceeded(RuntimeError):
    pass


class TokenBudgetMiddleware(AgentMiddleware[Any, Any, Any]):
    def __init__(self, max_tokens: int) -> None:
        self.max_tokens = max_tokens

    async def abefore_model(self, state: Any, runtime: Any) -> None:
        messages = state.get("messages", []) if isinstance(state, dict) else []
        approximate_tokens = sum(len(str(message.content)) for message in messages) // 4
        if approximate_tokens >= self.max_tokens:
            raise TokenBudgetExceeded("agent token budget exceeded")
