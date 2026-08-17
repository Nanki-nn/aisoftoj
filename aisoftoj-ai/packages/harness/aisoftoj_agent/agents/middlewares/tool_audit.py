from __future__ import annotations

import logging
import time
from collections.abc import Awaitable, Callable
from typing import Any

from langchain.agents.middleware import AgentMiddleware
from langchain.tools.tool_node import ToolCallRequest
from langchain_core.messages import ToolMessage
from langgraph.types import Command

logger = logging.getLogger(__name__)


class ToolAuditMiddleware(AgentMiddleware[Any, Any, Any]):
    async def awrap_tool_call(
        self,
        request: ToolCallRequest,
        handler: Callable[[ToolCallRequest], Awaitable[ToolMessage | Command[Any]]],
    ) -> ToolMessage | Command[Any]:
        started = time.monotonic()
        name = str(request.tool_call.get("name", "unknown"))
        args = request.tool_call.get("args", {})
        argument_keys = sorted(args) if isinstance(args, dict) else []
        try:
            result = await handler(request)
        except Exception:
            logger.info(
                "agent tool failed name=%s argument_keys=%s duration_ms=%d",
                name,
                argument_keys,
                int((time.monotonic() - started) * 1000),
            )
            raise
        logger.info(
            "agent tool completed name=%s argument_keys=%s duration_ms=%d",
            name,
            argument_keys,
            int((time.monotonic() - started) * 1000),
        )
        return result
