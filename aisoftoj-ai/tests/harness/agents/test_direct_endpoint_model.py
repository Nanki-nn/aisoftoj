from __future__ import annotations

import json

import httpx
from langchain_core.messages import HumanMessage
from langchain_core.tools import tool
from pydantic import SecretStr

from packages.harness.aisoftoj_agent.agents.models.direct_endpoint import (
    DirectEndpointChatModel,
)


async def test_direct_endpoint_sends_tools_to_exact_url() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert str(request.url) == "https://gateway.example/chat"
        assert request.headers["Authorization"] == "Bearer secret"
        payload = json.loads(request.content)
        assert payload["tools"][0]["function"]["name"] == "lookup"
        return httpx.Response(
            200,
            json={
                "choices": [
                    {
                        "message": {
                            "content": "",
                            "tool_calls": [
                                {
                                    "id": "call-1",
                                    "type": "function",
                                    "function": {"name": "lookup", "arguments": '{"value":7}'},
                                }
                            ],
                        },
                        "finish_reason": "tool_calls",
                    }
                ]
            },
        )

    @tool
    def lookup(value: int) -> int:
        """Return a test value."""
        return value

    model = DirectEndpointChatModel(
        endpoint="https://gateway.example/chat",
        api_key=SecretStr("secret"),
        model_name="test-model",
        transport=httpx.MockTransport(handler),
    ).bind_tools([lookup])

    response = await model.ainvoke([HumanMessage(content="lookup")])

    assert response.tool_calls == [
        {"name": "lookup", "args": {"value": 7}, "id": "call-1", "type": "tool_call"}
    ]
