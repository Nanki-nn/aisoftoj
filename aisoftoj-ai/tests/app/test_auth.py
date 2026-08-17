from __future__ import annotations

import asyncio
from typing import Annotated

import httpx
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient

from app.auth.dependencies import get_trusted_user
from packages.harness.aisoftoj_agent.integrations.aisoftoj.client import PlatformClient
from packages.harness.aisoftoj_agent.integrations.aisoftoj.context import TrustedUser


def build_app() -> tuple[FastAPI, PlatformClient]:
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.headers["Authorization"] == "Bearer valid-jwt"
        return httpx.Response(
            200,
            json={
                "code": 200,
                "message": "ok",
                "timestamp": 1,
                "data": {
                    "userId": 7,
                    "username": "reader",
                    "nickname": None,
                    "role": "USER",
                    "joinDate": None,
                    "lastLoginDate": None,
                    "practiceSessionCount": 0,
                    "wrongQuestionCount": 0,
                },
            },
        )

    platform = PlatformClient(
        base_url="http://127.0.0.1:8080",
        service_key="service-key",
        transport=httpx.MockTransport(handler),
    )
    app = FastAPI()
    app.state.platform_client = platform

    @app.get("/protected")
    async def protected(
        user: Annotated[TrustedUser, Depends(get_trusted_user)],
    ) -> dict[str, int]:
        return {"user_id": user.user_id}

    return app, platform


def test_authentication_is_resolved_by_java_profile() -> None:
    app, platform = build_app()
    with TestClient(app) as client:
        response = client.get("/protected", headers={"Authorization": "Bearer valid-jwt"})
    asyncio.run(platform.close())

    assert response.status_code == 200
    assert response.json() == {"user_id": 7}


def test_bearer_scheme_is_case_sensitive() -> None:
    app, platform = build_app()
    with TestClient(app) as client:
        response = client.get("/protected", headers={"Authorization": "bearer valid-jwt"})
    asyncio.run(platform.close())

    assert response.status_code == 401
