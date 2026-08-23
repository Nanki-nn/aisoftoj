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
_PLATFORM_ERROR_CODES = {
    "AUTH_EXPIRED",
    "PLATFORM_FORBIDDEN",
    "PLATFORM_NOT_FOUND",
    "PLATFORM_CONFLICT",
    "PLATFORM_UNAVAILABLE",
    "PLATFORM_BAD_REQUEST",
    "PLATFORM_RESPONSE_TOO_LARGE",
    "PLATFORM_INVALID_RESPONSE",
}
_RETRYABLE_ERROR_CODES = {"PLATFORM_UNAVAILABLE"}
_SKILL_ERROR_CODES = {
    "SKILL_NAME_INVALID",
    "SKILL_NOT_FOUND",
    "SKILL_PATH_INVALID",
    "SKILL_READ_RANGE_INVALID",
    "SKILL_FILE_NOT_FOUND",
}


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
    if tool_name == "describe_skill":
        query = args.get("query")
        return {"query_chars": min(len(query), 500) if isinstance(query, str) else 0}
    if tool_name == "load_skill":
        return {
            "has_path": isinstance(args.get("path"), str),
            "offset": _non_negative_int(args.get("offset")),
            "limit": min(20_000, _positive_int(args.get("limit"), 20_000)),
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
    if tool_name == "describe_skill":
        return {"total": _non_negative_int(data.get("total"))}
    if tool_name == "load_skill":
        skill = data.get("skill")
        skill_data = skill if isinstance(skill, dict) else {}
        return {
            "status": "success",
            "truncated": skill_data.get("truncated") is True,
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


def structured_tool_error_code(result: ToolMessage | Command[Any]) -> str | None:
    message = _tool_message(result)
    data = _message_data(message)
    if not isinstance(data, dict) or data.get("status") != "error":
        return None
    code = data.get("error_code")
    return code if isinstance(code, str) and code in _SKILL_ERROR_CODES else None


def _failure_code(error: BaseException | None) -> str:
    if isinstance(error, PlatformError):
        if error.code == "AUTH_EXPIRED":
            return "authentication_expired"
        if error.code == "PLATFORM_FORBIDDEN":
            return "access_denied"
        return "tool_unavailable"
    return "tool_execution_failed"


def safe_failure_reason(
    error: BaseException | None = None,
    message: ToolMessage | None = None,
) -> dict[str, object]:
    code = "TOOL_EXECUTION_FAILED"
    status_code: int | None = None
    if isinstance(error, PlatformError):
        code = error.code if error.code in _PLATFORM_ERROR_CODES else "PLATFORM_ERROR"
        status_code = error.status_code
    elif message is not None:
        artifact = message.artifact if isinstance(message.artifact, dict) else {}
        detail = artifact.get("error")
        detail = detail if isinstance(detail, dict) else {}
        raw_code = detail.get("code")
        if isinstance(raw_code, str) and raw_code in _PLATFORM_ERROR_CODES:
            code = raw_code
        raw_status = detail.get("status_code")
        if (
            isinstance(raw_status, int)
            and not isinstance(raw_status, bool)
            and 400 <= raw_status <= 599
        ):
            status_code = raw_status
        data = _message_data(message)
        if isinstance(data, dict):
            skill_code = data.get("error_code")
            if isinstance(skill_code, str) and skill_code in _SKILL_ERROR_CODES:
                code = skill_code
    return {
        "code": code,
        "status_code": status_code,
        "retryable": code in _RETRYABLE_ERROR_CODES,
    }


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
                    "reason": safe_failure_reason(error=exc),
                    "duration_ms": max(0, int((time.monotonic() - started) * 1000)),
                },
            )
            raise

        message = _tool_message(result)
        duration_ms = max(0, int((time.monotonic() - started) * 1000))
        skill_error_code = structured_tool_error_code(result)
        if (
            message is not None and getattr(message, "status", None) == "error"
        ) or skill_error_code is not None:
            await sink.emit(
                "tool.failed",
                {
                    "call_id": call_id,
                    "tool_name": tool_name,
                    "message": "skill_error" if skill_error_code else "tool_unavailable",
                    "reason": safe_failure_reason(message=message),
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
