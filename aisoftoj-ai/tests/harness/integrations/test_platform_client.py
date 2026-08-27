from __future__ import annotations

import logging

import httpx
import pytest

from packages.harness.aisoftoj_agent.integrations.aisoftoj.client import (
    PlatformClient,
    PlatformError,
)


class CaptureHandler(logging.Handler):
    def __init__(self) -> None:
        super().__init__()
        self.records: list[logging.LogRecord] = []

    def emit(self, record: logging.LogRecord) -> None:
        self.records.append(record)


def capture_platform_logs() -> tuple[logging.Logger, CaptureHandler]:
    logger = logging.getLogger(
        "packages.harness.aisoftoj_agent.integrations.aisoftoj.client"
    )
    handler = CaptureHandler()
    logger.addHandler(handler)
    logger.setLevel(logging.WARNING)
    return logger, handler


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


async def test_admin_user_page_forwards_filters_and_validates_contract() -> None:
    async def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/admin/users"
        assert dict(request.url.params) == {
            "keyword": "nan",
            "page": "2",
            "pageSize": "20",
        }
        return response(
            {
                "records": [
                    {
                        "id": 7,
                        "loginName": "reader",
                        "nickName": "软考学员",
                        "email": "reader@example.com",
                    }
                ],
                "total": 21,
                "page": 2,
                "pageSize": 20,
            }
        )

    client = PlatformClient(
        base_url="http://127.0.0.1:8080",
        service_key="service-key",
        transport=httpx.MockTransport(handler),
    )
    page = await client.list_admin_users(
        "jwt-value", keyword="nan", page=2, page_size=20
    )
    await client.close()

    assert page.total == 21
    assert page.records[0].login_name == "reader"


async def test_invalid_response_is_not_exposed() -> None:
    logger, handler = capture_platform_logs()
    client = PlatformClient(
        base_url="http://127.0.0.1:8080",
        service_key="service-key-must-not-log",
        transport=httpx.MockTransport(
            lambda _request: response({"unexpected": "response-body-must-not-log"})
        ),
    )

    try:
        with pytest.raises(PlatformError) as captured:
            await client.get_profile("jwt-must-not-log")
    finally:
        await client.close()
        logger.removeHandler(handler)

    assert captured.value.code == "PLATFORM_INVALID_RESPONSE"
    rendered = "\n".join(record.getMessage() for record in handler.records)
    assert "event=platform_request_failed" in rendered
    assert "path=/internal/ai/me" in rendered
    assert "http_status=200" in rendered
    assert "code=PLATFORM_INVALID_RESPONSE" in rendered
    assert "validation=data.userId:missing" in rendered
    assert "jwt-must-not-log" not in rendered
    assert "service-key-must-not-log" not in rendered
    assert "response-body-must-not-log" not in rendered


async def test_retried_server_error_logs_only_the_final_failure() -> None:
    attempts = 0

    def handler(_request: httpx.Request) -> httpx.Response:
        nonlocal attempts
        attempts += 1
        return httpx.Response(503, text="upstream-secret")

    logger, capture = capture_platform_logs()
    client = PlatformClient(
        base_url="http://127.0.0.1:8080",
        service_key="service-key",
        transport=httpx.MockTransport(handler),
    )
    try:
        with pytest.raises(PlatformError):
            await client.get_profile("jwt")
    finally:
        await client.close()
        logger.removeHandler(capture)

    rendered = [record.getMessage() for record in capture.records]
    assert attempts == 2
    assert len(rendered) == 1
    assert "attempts=2" in rendered[0]
    assert "http_status=503" in rendered[0]
    assert "upstream-secret" not in rendered[0]


async def test_transport_failure_logs_exception_type_without_credentials() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("jwt-network-secret", request=request)

    logger, capture = capture_platform_logs()
    client = PlatformClient(
        base_url="http://127.0.0.1:8080",
        service_key="service-network-secret",
        transport=httpx.MockTransport(handler),
    )
    try:
        with pytest.raises(PlatformError):
            await client.get_profile("jwt-network-secret")
    finally:
        await client.close()
        logger.removeHandler(capture)

    rendered = "\n".join(record.getMessage() for record in capture.records)
    assert "exception=ConnectError" in rendered
    assert "http_status=none" in rendered
    assert "jwt-network-secret" not in rendered
    assert "service-network-secret" not in rendered
