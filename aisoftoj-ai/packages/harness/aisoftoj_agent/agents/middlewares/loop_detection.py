from __future__ import annotations

from collections import Counter
from typing import Any

from langchain.agents.middleware import AgentMiddleware
from langchain_core.messages import AIMessage


class AgentLoopDetected(RuntimeError):
    pass


class LoopDetectionMiddleware(AgentMiddleware[Any, Any, Any]):
    def __init__(self, hard_repetitions: int) -> None:
        self.hard_repetitions = hard_repetitions

    async def abefore_model(self, state: Any, runtime: Any) -> None:
        messages = state.get("messages", []) if isinstance(state, dict) else []
        signatures: list[str] = []
        for message in messages:
            if isinstance(message, AIMessage):
                for call in message.tool_calls:
                    signatures.append(f"{call.get('name')}:{call.get('args')!r}")
        if signatures and Counter(signatures).most_common(1)[0][1] >= self.hard_repetitions:
            raise AgentLoopDetected("repeated tool loop detected")
