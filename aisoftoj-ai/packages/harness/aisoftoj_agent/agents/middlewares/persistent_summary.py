from __future__ import annotations

from typing import Any

from langchain.agents.middleware import AgentMiddleware


class PersistentSummaryMiddleware(AgentMiddleware[Any, Any, Any]):
    """Replace Deep Agents' in-state summary slot.

    Thread history and its durable summary are assembled by the Worker before invocation,
    so this slot intentionally performs no additional in-state summarization.
    """

    @property
    def name(self) -> str:
        return "SummarizationMiddleware"
