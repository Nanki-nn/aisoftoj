from __future__ import annotations

import pytest
from langchain_core.messages import AIMessage, HumanMessage

from packages.harness.aisoftoj_agent.agents.middlewares.loop_detection import (
    AgentLoopDetected,
    LoopDetectionMiddleware,
)
from packages.harness.aisoftoj_agent.agents.middlewares.token_budget import (
    TokenBudgetExceeded,
    TokenBudgetMiddleware,
)


async def test_token_budget_fails_before_an_unbounded_model_call() -> None:
    middleware = TokenBudgetMiddleware(max_tokens=2)

    with pytest.raises(TokenBudgetExceeded):
        await middleware.abefore_model({"messages": [HumanMessage(content="123456789012")]}, None)


async def test_repeated_identical_tool_calls_are_stopped() -> None:
    middleware = LoopDetectionMiddleware(hard_repetitions=3)
    messages = [
        AIMessage(
            content="",
            tool_calls=[{"name": "get_question", "args": {"question_id": 1}, "id": str(i)}],
        )
        for i in range(3)
    ]

    with pytest.raises(AgentLoopDetected):
        await middleware.abefore_model({"messages": messages}, None)
