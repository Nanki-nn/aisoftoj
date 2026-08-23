from __future__ import annotations

from collections.abc import Awaitable, Callable
from typing import Any

from langchain.agents.middleware import AgentMiddleware
from langchain.tools.tool_node import ToolCallRequest
from langchain_core.messages import ToolMessage
from langgraph.types import Command

from ..tools import AGENT_TOOL_NAMES

ALLOWED_TOOL_NAMES = AGENT_TOOL_NAMES


class ToolPolicyError(RuntimeError):
    pass


class ToolPolicyMiddleware(AgentMiddleware[Any, Any, Any]):
    async def awrap_tool_call(
        self,
        request: ToolCallRequest,
        handler: Callable[[ToolCallRequest], Awaitable[ToolMessage | Command[Any]]],
    ) -> ToolMessage | Command[Any]:
        name = request.tool_call.get("name")
        if name not in ALLOWED_TOOL_NAMES:
            raise ToolPolicyError("tool is not allowed")
        return await handler(request)
