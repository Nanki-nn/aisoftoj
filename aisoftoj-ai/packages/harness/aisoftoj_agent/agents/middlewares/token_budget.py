from __future__ import annotations

from collections.abc import Awaitable, Callable
from typing import Any

from langchain.agents.middleware import AgentMiddleware, ModelRequest, ModelResponse


class TokenBudgetExceeded(RuntimeError):
    pass


class TokenBudgetMiddleware(AgentMiddleware[Any, Any, Any]):
    def __init__(self, max_tokens: int) -> None:
        self.max_tokens = max_tokens

    async def awrap_model_call(
        self,
        request: ModelRequest[Any],
        handler: Callable[[ModelRequest[Any]], Awaitable[ModelResponse[Any]]],
    ) -> ModelResponse[Any]:
        messages = list(request.messages)
        if request.system_message is not None:
            messages.append(request.system_message)
        approximate_tokens = sum(len(str(message.content)) for message in messages) // 4
        if approximate_tokens >= self.max_tokens:
            raise TokenBudgetExceeded("agent token budget exceeded")
        return await handler(request)
