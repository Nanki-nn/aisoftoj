from __future__ import annotations

from collections.abc import Awaitable, Callable
from typing import Any

from langchain.agents.middleware import AgentMiddleware, ModelRequest, ModelResponse
from langchain.tools.tool_node import ToolCallRequest
from langchain_core.messages import ToolMessage
from langgraph.types import Command

from ...access_control import AiAccessControlService
from ..context import AgentContext


def _context(request: Any) -> AgentContext:
    context = request.runtime.context
    if not isinstance(context, AgentContext):
        raise RuntimeError("agent context unavailable")
    return context


class AccessControlMiddleware(AgentMiddleware[Any, Any, Any]):
    def __init__(self, access_control_service: AiAccessControlService) -> None:
        self.access_control_service = access_control_service

    async def awrap_model_call(
        self,
        request: ModelRequest[Any],
        handler: Callable[[ModelRequest[Any]], Awaitable[ModelResponse[Any]]],
    ) -> ModelResponse[Any]:
        context = _context(request)
        await self.access_control_service.require_allowed(context.user_id, context.role)
        return await handler(request)

    async def awrap_tool_call(
        self,
        request: ToolCallRequest,
        handler: Callable[[ToolCallRequest], Awaitable[ToolMessage | Command[Any]]],
    ) -> ToolMessage | Command[Any]:
        context = _context(request)
        await self.access_control_service.require_allowed(context.user_id, context.role)
        return await handler(request)
