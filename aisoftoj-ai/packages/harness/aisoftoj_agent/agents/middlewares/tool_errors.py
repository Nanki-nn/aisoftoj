from __future__ import annotations

from collections.abc import Awaitable, Callable
from typing import Any

from langchain.agents.middleware import AgentMiddleware
from langchain.tools.tool_node import ToolCallRequest
from langchain_core.messages import ToolMessage
from langgraph.types import Command

from ...integrations.aisoftoj.client import PlatformError


class ToolErrorMiddleware(AgentMiddleware[Any, Any, Any]):
    async def awrap_tool_call(
        self,
        request: ToolCallRequest,
        handler: Callable[[ToolCallRequest], Awaitable[ToolMessage | Command[Any]]],
    ) -> ToolMessage | Command[Any]:
        try:
            return await handler(request)
        except PlatformError as exc:
            if exc.code in {"AUTH_EXPIRED", "PLATFORM_FORBIDDEN"}:
                raise
            return ToolMessage(
                content=f"平台读取失败：{exc.code}",
                name=str(request.tool_call.get("name", "platform_tool")),
                tool_call_id=str(request.tool_call.get("id", "unknown")),
                status="error",
            )
