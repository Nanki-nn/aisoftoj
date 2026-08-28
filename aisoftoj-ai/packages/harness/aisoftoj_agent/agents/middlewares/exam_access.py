from __future__ import annotations

from collections.abc import Awaitable, Callable
from typing import Any

from langchain.agents.middleware import AgentMiddleware, ModelRequest, ModelResponse
from langchain.tools.tool_node import ToolCallRequest
from langchain_core.messages import ToolMessage
from langgraph.types import Command

from app.auth.access import require_exam_available

from ...integrations.aisoftoj.client import PlatformClient
from ..context import AgentContext


def _token(request: Any) -> str:
    context = request.runtime.context
    if not isinstance(context, AgentContext):
        raise RuntimeError("agent context unavailable")
    return context.bearer_token


class ExamAccessMiddleware(AgentMiddleware[Any, Any, Any]):
    def __init__(self, platform_client: PlatformClient) -> None:
        self.platform_client = platform_client

    async def awrap_model_call(
        self,
        request: ModelRequest[Any],
        handler: Callable[[ModelRequest[Any]], Awaitable[ModelResponse[Any]]],
    ) -> ModelResponse[Any]:
        token = _token(request)
        if hasattr(self.platform_client, "is_ai_assistant_available"):
            await require_exam_available(self.platform_client, token)
        response = await handler(request)
        if hasattr(self.platform_client, "is_ai_assistant_available"):
            await require_exam_available(self.platform_client, token)
        return response

    async def awrap_tool_call(
        self,
        request: ToolCallRequest,
        handler: Callable[[ToolCallRequest], Awaitable[ToolMessage | Command[Any]]],
    ) -> ToolMessage | Command[Any]:
        token = _token(request)
        if hasattr(self.platform_client, "is_ai_assistant_available"):
            await require_exam_available(self.platform_client, token)
        result = await handler(request)
        if hasattr(self.platform_client, "is_ai_assistant_available"):
            await require_exam_available(self.platform_client, token)
        return result
