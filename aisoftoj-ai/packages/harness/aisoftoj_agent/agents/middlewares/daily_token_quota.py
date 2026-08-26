from __future__ import annotations

import json
import math
from collections.abc import Awaitable, Callable
from typing import Any

import httpx
from langchain.agents.middleware import AgentMiddleware, ModelRequest, ModelResponse
from langchain_core.messages import BaseMessage
from sqlalchemy.exc import SQLAlchemyError

from ...quota import DailyTokenQuotaService, DailyTokenQuotaUnavailable


class DailyTokenQuotaMiddleware(AgentMiddleware[Any, Any, Any]):
    def __init__(
        self,
        quota_service: DailyTokenQuotaService,
        *,
        max_output_tokens: int,
        reservation_margin_percent: int,
    ) -> None:
        self.quota_service = quota_service
        self.max_output_tokens = max_output_tokens
        self.reservation_margin_percent = reservation_margin_percent

    async def awrap_model_call(
        self,
        request: ModelRequest[Any],
        handler: Callable[[ModelRequest[Any]], Awaitable[ModelResponse[Any]]],
    ) -> ModelResponse[Any]:
        context = request.runtime.context
        prompt_estimate = estimate_request_tokens(request)
        reserved = math.ceil(prompt_estimate * (100 + self.reservation_margin_percent) / 100)
        reserved += self.max_output_tokens
        try:
            reservation = await self.quota_service.reserve(
                run_id=context.run_id,
                user_id=context.user_id,
                tokens=reserved,
            )
        except (SQLAlchemyError, DailyTokenQuotaUnavailable) as exc:
            raise DailyTokenQuotaUnavailable("AI quota is unavailable") from exc
        try:
            response = await handler(
                request.override(
                    model_settings={
                        **request.model_settings,
                        "max_tokens": self.max_output_tokens,
                    }
                )
            )
        except BaseException as model_error:
            try:
                if is_definitive_provider_failure(model_error):
                    await self.quota_service.release(reservation.id)
                else:
                    await self.quota_service.settle(
                        reservation.id,
                        prompt_tokens=reservation.reserved_tokens,
                        completion_tokens=0,
                        usage_source="estimated",
                        estimated=True,
                    )
            except SQLAlchemyError as quota_error:
                raise DailyTokenQuotaUnavailable("AI quota is unavailable") from quota_error
            raise
        prompt_tokens, completion_tokens, source = response_usage(response, prompt_estimate)
        try:
            await self.quota_service.settle(
                reservation.id,
                prompt_tokens=prompt_tokens,
                completion_tokens=completion_tokens,
                usage_source=source,
                estimated=source == "estimated",
            )
        except SQLAlchemyError as exc:
            raise DailyTokenQuotaUnavailable("AI quota is unavailable") from exc
        return response


def is_definitive_provider_failure(error: BaseException) -> bool:
    return isinstance(error, httpx.HTTPStatusError) or isinstance(
        getattr(error, "status_code", None), int
    )


def estimate_request_tokens(request: ModelRequest[Any]) -> int:
    messages = list(request.messages)
    if request.system_message is not None:
        messages.append(request.system_message)
    return max(1, sum(estimate_message_tokens(message) for message in messages))


def estimate_message_tokens(message: BaseMessage) -> int:
    content = message.content
    if isinstance(content, str):
        serialized = content
    else:
        serialized = json.dumps(content, ensure_ascii=False, separators=(",", ":"))
    tool_calls = getattr(message, "tool_calls", None)
    if tool_calls:
        serialized += json.dumps(tool_calls, ensure_ascii=False, separators=(",", ":"))
    return max(1, math.ceil(len(serialized) / 4))


def response_usage(response: ModelResponse[Any], prompt_estimate: int) -> tuple[int, int, str]:
    prompt_tokens = 0
    completion_tokens = 0
    has_usage = False
    for message in response.result:
        metadata = getattr(message, "usage_metadata", None)
        if metadata:
            prompt_tokens += int(metadata.get("input_tokens") or 0)
            completion_tokens += int(metadata.get("output_tokens") or 0)
            has_usage = True
    if has_usage:
        return prompt_tokens, completion_tokens, "provider"
    output_estimate = sum(estimate_message_tokens(message) for message in response.result)
    return prompt_estimate, output_estimate, "estimated"
