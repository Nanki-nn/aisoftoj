from __future__ import annotations

import json
import re
import time
from collections.abc import Awaitable, Callable
from typing import Any
from uuid import uuid4

from langchain.agents.middleware import AgentMiddleware
from langchain.tools.tool_node import ToolCallRequest
from langchain_core.messages import ToolMessage
from langgraph.types import Command

from ...integrations.aisoftoj.client import PlatformError

_SAFE_TOOL_NAME = re.compile(r"^[A-Za-z0-9_.-]{1,64}$")
_QUESTION_TYPES = {
    "single_choice",
    "multiple_choice",
    "judgement",
    "fill_blank",
    "case_analysis",
    "essay",
    "unknown",
}
_DIFFICULTIES = {"easy", "medium", "hard", "unknown"}


def _non_negative_int(value: object, default: int = 0) -> int:
    if isinstance(value, int) and not isinstance(value, bool) and value >= 0:
        return value
    return default


def _positive_int(value: object, default: int = 1) -> int:
    if isinstance(value, int) and not isinstance(value, bool) and value > 0:
        return value
    return default


def safe_tool_name(value: object) -> str:
    name = value if isinstance(value, str) else ""
    return name if _SAFE_TOOL_NAME.fullmatch(name) else "unknown_tool"


def safe_tool_input(tool_name: str, value: object) -> dict[str, object]:
    args = value if isinstance(value, dict) else {}
    if tool_name == "get_question":
        return {"question_id": _positive_int(args.get("question_id"))}
    if tool_name == "review_wrong_question":
        return {"wrong_question_id": _positive_int(args.get("wrong_question_id"))}
    if tool_name == "list_practice_history":
        return {
            "page": _positive_int(args.get("page")),
            "page_size": min(20, _positive_int(args.get("page_size"), 10)),
        }
    return {}


def _enum(value: object, allowed: set[str]) -> str:
    return value if isinstance(value, str) and value in allowed else "unknown"


def safe_tool_summary(tool_name: str, value: object) -> dict[str, object]:
    data = value if isinstance(value, dict) else {}
    if tool_name == "get_my_profile":
        return {
            "practice_session_count": _non_negative_int(data.get("practice_session_count")),
            "wrong_question_count": _non_negative_int(data.get("wrong_question_count")),
        }
    if tool_name == "list_papers":
        return {"total": _non_negative_int(data.get("total"))}
    if tool_name == "get_question":
        return {
            "question_type": _enum(data.get("question_type"), _QUESTION_TYPES),
            "difficulty": _enum(data.get("difficulty"), _DIFFICULTIES),
        }
    if tool_name == "review_wrong_question":
        importance = data.get("importance")
        return {
            "question_type": _enum(data.get("question_type"), _QUESTION_TYPES),
            "difficulty": _enum(data.get("difficulty"), _DIFFICULTIES),
            "error_count": max(1, _non_negative_int(data.get("error_count"), 1)),
            "importance": importance[:32] if isinstance(importance, str) else "",
        }
    if tool_name == "list_practice_history":
        records = data.get("records")
        summary_value = data.get("summary")
        summary: dict[str, Any] = summary_value if isinstance(summary_value, dict) else {}
        return {
            "record_count": len(records) if isinstance(records, list) else 0,
            "total": _non_negative_int(data.get("total")),
            "total_count": _non_negative_int(summary.get("total_count")),
            "in_progress_count": _non_negative_int(summary.get("in_progress_count")),
            "completed_count": _non_negative_int(summary.get("completed_count")),
            "answered_count": _non_negative_int(summary.get("answered_count")),
        }
    return {"status": "completed"}


def _tool_message(result: ToolMessage | Command[Any]) -> ToolMessage | None:
    if isinstance(result, ToolMessage):
        return result
    update = getattr(result, "update", None)
    if not isinstance(update, dict):
        return None
    messages = update.get("messages")
    if isinstance(messages, list):
        return next((item for item in reversed(messages) if isinstance(item, ToolMessage)), None)
    return messages if isinstance(messages, ToolMessage) else None


def _message_data(message: ToolMessage | None) -> object:
    if message is None:
        return {}
    artifact = getattr(message, "artifact", None)
    if isinstance(artifact, dict):
        return artifact
    content = message.content
    if not isinstance(content, str):
        return {}
    try:
        return json.loads(content)
    except (TypeError, ValueError):
        return {}


def _failure_code(error: BaseException | None) -> str:
    if isinstance(error, PlatformError):
        if error.code == "AUTH_EXPIRED":
            return "authentication_expired"
        if error.code == "PLATFORM_FORBIDDEN":
            return "access_denied"
        return "tool_unavailable"
    return "tool_execution_failed"


class ToolEventMiddleware(AgentMiddleware[Any, Any, Any]):
    async def awrap_tool_call(
        self,
        request: ToolCallRequest,
        handler: Callable[[ToolCallRequest], Awaitable[ToolMessage | Command[Any]]],
    ) -> ToolMessage | Command[Any]:
        context = getattr(request.runtime, "context", None)
        sink = getattr(context, "event_sink", None)
        if sink is None:
            return await handler(request)

        tool_name = safe_tool_name(request.tool_call.get("name"))
        raw_call_id = request.tool_call.get("id")
        call_id = (
            raw_call_id
            if isinstance(raw_call_id, str) and 0 < len(raw_call_id) <= 128
            else str(uuid4())
        )
        started = time.monotonic()
        await sink.emit(
            "tool.started",
            {
                "call_id": call_id,
                "tool_name": tool_name,
                "input": safe_tool_input(tool_name, request.tool_call.get("args")),
            },
        )
        try:
            result = await handler(request)
        except Exception as exc:
            await sink.emit(
                "tool.failed",
                {
                    "call_id": call_id,
                    "tool_name": tool_name,
                    "message": _failure_code(exc),
                    "duration_ms": max(0, int((time.monotonic() - started) * 1000)),
                },
            )
            raise

        message = _tool_message(result)
        duration_ms = max(0, int((time.monotonic() - started) * 1000))
        if message is not None and getattr(message, "status", None) == "error":
            await sink.emit(
                "tool.failed",
                {
                    "call_id": call_id,
                    "tool_name": tool_name,
                    "message": "tool_unavailable",
                    "duration_ms": duration_ms,
                },
            )
        else:
            await sink.emit(
                "tool.completed",
                {
                    "call_id": call_id,
                    "tool_name": tool_name,
                    "summary": safe_tool_summary(tool_name, _message_data(message)),
                    "duration_ms": duration_ms,
                },
            )
        return result
