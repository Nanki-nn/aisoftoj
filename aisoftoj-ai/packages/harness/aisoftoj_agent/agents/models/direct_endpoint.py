from __future__ import annotations

import json
from collections.abc import AsyncIterator, Callable, Sequence
from typing import Any

import httpx
from langchain_core.callbacks import AsyncCallbackManagerForLLMRun, CallbackManagerForLLMRun
from langchain_core.language_models import BaseChatModel
from langchain_core.language_models.base import LangSmithParams
from langchain_core.messages import (
    AIMessage,
    AIMessageChunk,
    BaseMessage,
    HumanMessage,
    SystemMessage,
    ToolMessage,
)
from langchain_core.outputs import ChatGeneration, ChatGenerationChunk, ChatResult
from langchain_core.tools import BaseTool
from langchain_core.utils.function_calling import convert_to_openai_tool
from pydantic import Field, SecretStr


class DirectEndpointChatModel(BaseChatModel):
    """OpenAI-compatible chat payloads sent to an exact endpoint URL."""

    endpoint: str
    api_key: SecretStr
    model_name: str
    timeout_seconds: float = 120
    max_output_tokens: int = 2048
    transport: Any = Field(default=None, exclude=True)

    @property
    def _llm_type(self) -> str:
        return "openai"

    @property
    def _identifying_params(self) -> dict[str, Any]:
        return {"model_name": self.model_name, "endpoint": self.endpoint}

    def _get_ls_params(self, stop: list[str] | None = None, **_kwargs: Any) -> LangSmithParams:
        return LangSmithParams(ls_provider="openai", ls_model_name=self.model_name)

    def bind_tools(
        self,
        tools: Sequence[dict[str, Any] | type | Callable[..., Any] | BaseTool],
        *,
        tool_choice: str | dict[str, Any] | None = None,
        **kwargs: Any,
    ) -> Any:
        formatted = [convert_to_openai_tool(item) for item in tools]
        return self.bind(tools=formatted, tool_choice=tool_choice, **kwargs)

    def _generate(
        self,
        messages: list[BaseMessage],
        stop: list[str] | None = None,
        run_manager: CallbackManagerForLLMRun | None = None,
        **kwargs: Any,
    ) -> ChatResult:
        with httpx.Client(timeout=self.timeout_seconds, transport=self.transport) as client:
            response = client.post(
                self.endpoint,
                headers=self._headers(),
                json=self._payload(messages, stop, kwargs, stream=False),
            )
        return self._parse_response(response)

    async def _agenerate(
        self,
        messages: list[BaseMessage],
        stop: list[str] | None = None,
        run_manager: AsyncCallbackManagerForLLMRun | None = None,
        **kwargs: Any,
    ) -> ChatResult:
        async with httpx.AsyncClient(
            timeout=self.timeout_seconds, transport=self.transport
        ) as client:
            response = await client.post(
                self.endpoint,
                headers=self._headers(),
                json=self._payload(messages, stop, kwargs, stream=False),
            )
        return self._parse_response(response)

    async def _astream(
        self,
        messages: list[BaseMessage],
        stop: list[str] | None = None,
        run_manager: AsyncCallbackManagerForLLMRun | None = None,
        **kwargs: Any,
    ) -> AsyncIterator[ChatGenerationChunk]:
        async with httpx.AsyncClient(
            timeout=self.timeout_seconds, transport=self.transport
        ) as client:
            async with client.stream(
                "POST",
                self.endpoint,
                headers=self._headers(),
                json=self._payload(messages, stop, kwargs, stream=True),
            ) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    chunk = _stream_chunk(line)
                    if chunk is None:
                        continue
                    if run_manager is not None:
                        content = chunk.message.content
                        await run_manager.on_llm_new_token(str(content or ""), chunk=chunk)
                    yield chunk

    def _headers(self) -> dict[str, str]:
        return {"Authorization": f"Bearer {self.api_key.get_secret_value()}"}

    def _payload(
        self,
        messages: list[BaseMessage],
        stop: list[str] | None,
        kwargs: dict[str, Any],
        *,
        stream: bool,
    ) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "model": self.model_name,
            "messages": [_message_dict(message) for message in messages],
            "stream": stream,
            "max_tokens": int(kwargs.get("max_tokens") or self.max_output_tokens),
        }
        if stream:
            payload["stream_options"] = {"include_usage": True}
        for name in ("tools", "tool_choice", "response_format"):
            if kwargs.get(name):
                payload[name] = kwargs[name]
        if stop:
            payload["stop"] = stop
        return payload

    @staticmethod
    def _parse_response(response: httpx.Response) -> ChatResult:
        response.raise_for_status()
        body = response.json()
        choice = (body.get("choices") or [{}])[0]
        message = choice.get("message") or {}
        ai_message = AIMessage(
            content=message.get("content") or "",
            additional_kwargs=_reasoning_kwargs(message),
            tool_calls=[
                {
                    "name": item.get("function", {}).get("name", ""),
                    "args": _json_args(item.get("function", {}).get("arguments", "{}")),
                    "id": item.get("id", ""),
                    "type": "tool_call",
                }
                for item in message.get("tool_calls") or []
            ],
            usage_metadata=_usage(body.get("usage")),
            response_metadata={"finish_reason": choice.get("finish_reason")},
        )
        return ChatResult(generations=[ChatGeneration(message=ai_message)])


def _message_dict(message: BaseMessage) -> dict[str, Any]:
    if isinstance(message, SystemMessage):
        return {"role": "system", "content": message.content}
    if isinstance(message, HumanMessage):
        return {"role": "user", "content": message.content}
    if isinstance(message, ToolMessage):
        return {"role": "tool", "content": message.content, "tool_call_id": message.tool_call_id}
    if isinstance(message, AIMessage):
        result: dict[str, Any] = {"role": "assistant", "content": message.content}
        result.update(_reasoning_kwargs(message.additional_kwargs))
        if message.tool_calls:
            result["tool_calls"] = [
                {
                    "id": item["id"],
                    "type": "function",
                    "function": {
                        "name": item["name"],
                        "arguments": json.dumps(
                            item["args"], ensure_ascii=False, separators=(",", ":")
                        ),
                    },
                }
                for item in message.tool_calls
            ]
        return result
    raise TypeError(f"unsupported message type: {type(message).__name__}")


def _reasoning_kwargs(value: dict[str, Any]) -> dict[str, Any]:
    reasoning = value.get("reasoning_content")
    return {"reasoning_content": reasoning} if isinstance(reasoning, str) and reasoning else {}


def _json_args(value: str) -> dict[str, Any]:
    parsed = json.loads(value or "{}")
    return parsed if isinstance(parsed, dict) else {}


def _usage(value: Any) -> dict[str, int] | None:
    if not isinstance(value, dict):
        return None
    return {
        "input_tokens": int(value.get("prompt_tokens") or 0),
        "output_tokens": int(value.get("completion_tokens") or 0),
        "total_tokens": int(value.get("total_tokens") or 0),
    }


def _stream_chunk(line: str) -> ChatGenerationChunk | None:
    line = line.strip()
    if not line:
        return None
    if line.startswith("data:"):
        line = line.removeprefix("data:").strip()
    if line == "[DONE]":
        return None
    body = json.loads(line)
    choice = (body.get("choices") or [{}])[0]
    delta = choice.get("delta") or {}
    tool_call_chunks = []
    for item in delta.get("tool_calls") or []:
        function = item.get("function") or {}
        tool_call_chunks.append(
            {
                "name": function.get("name"),
                "args": function.get("arguments"),
                "id": item.get("id"),
                "index": item.get("index"),
            }
        )
    message = AIMessageChunk(
        content=delta.get("content") or "",
        additional_kwargs=_reasoning_kwargs(delta),
        tool_call_chunks=tool_call_chunks,
        usage_metadata=_usage(body.get("usage")),
        response_metadata={"finish_reason": choice.get("finish_reason")},
    )
    return ChatGenerationChunk(message=message)
