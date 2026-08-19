from __future__ import annotations

import httpx
import pytest

from packages.harness.aisoftoj_agent.integrations.aisoftoj.client import (
    PlatformClient,
    PlatformError,
)


def response(data: object, status_code: int = 200) -> httpx.Response:
    return httpx.Response(
        status_code,
        json={"code": status_code, "message": "ok", "data": data, "timestamp": 1},
    )


async def test_client_does_not_use_system_proxy(monkeypatch: pytest.MonkeyPatch) -> None:
    captured: dict[str, object] = {}
    async_client = httpx.AsyncClient

    def create_client(*args: object, **kwargs: object) -> httpx.AsyncClient:
        captured.update(kwargs)
        return async_client(*args, **kwargs)

    monkeypatch.setattr(httpx, "AsyncClient", create_client)

    client = PlatformClient(
        base_url="http://127.0.0.1:8080/",
        service_key="service-key",
    )
    await client.close()

    assert captured["base_url"] == "http://127.0.0.1:8080"
    assert captured["trust_env"] is False


async def test_profile_forwards_both_credentials_and_validates_contract() -> None:
    async def handler(request: httpx.Request) -> httpx.Response:
        assert request.headers["Authorization"] == "Bearer jwt-value"
        assert request.headers["X-AI-Service-Key"] == "service-key"
        return response(
            {
                "userId": 7,
                "username": "reader",
                "nickname": None,
                "role": "USER",
                "joinDate": None,
                "lastLoginDate": None,
                "practiceSessionCount": 2,
                "wrongQuestionCount": 1,
            }
        )

    client = PlatformClient(
        base_url="http://127.0.0.1:8080",
        service_key="service-key",
        transport=httpx.MockTransport(handler),
    )
    profile = await client.get_profile("jwt-value")
    await client.close()

    assert profile.user_id == 7
    assert profile.practice_session_count == 2


async def test_invalid_response_is_not_exposed() -> None:
    client = PlatformClient(
        base_url="http://127.0.0.1:8080",
        service_key="service-key",
        transport=httpx.MockTransport(lambda _request: response({"unexpected": "secret"})),
    )

    with pytest.raises(PlatformError) as captured:
        await client.get_profile("jwt")
    await client.close()

    assert captured.value.code == "PLATFORM_INVALID_RESPONSE"
    assert "secret" not in str(captured.value)
