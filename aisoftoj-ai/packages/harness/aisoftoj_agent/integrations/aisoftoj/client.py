from __future__ import annotations

import asyncio
from typing import Any, cast

import httpx
from pydantic import TypeAdapter, ValidationError

from .models import (
    Paper,
    PracticeHistoryPage,
    Profile,
    Question,
    ResultEnvelope,
    WrongQuestionReview,
)


class PlatformError(RuntimeError):
    def __init__(self, code: str, status_code: int = 502) -> None:
        super().__init__(code)
        self.code = code
        self.status_code = status_code


class PlatformClient:
    def __init__(
        self,
        *,
        base_url: str,
        service_key: str,
        connect_timeout: float = 2,
        read_timeout: float = 5,
        max_response_bytes: int = 2_097_152,
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> None:
        self._service_key = service_key
        self._max_response_bytes = max_response_bytes
        self._client = httpx.AsyncClient(
            base_url=base_url.rstrip("/"),
            timeout=httpx.Timeout(read_timeout, connect=connect_timeout),
            transport=transport,
            headers={"Accept": "application/json"},
        )

    async def close(self) -> None:
        await self._client.aclose()

    async def get_profile(self, bearer_token: str) -> Profile:
        return cast(Profile, await self._get("/internal/ai/me", bearer_token, Profile))

    async def list_papers(self, bearer_token: str) -> list[Paper]:
        return cast(list[Paper], await self._get("/internal/ai/papers", bearer_token, list[Paper]))

    async def get_question(self, bearer_token: str, question_id: int) -> Question:
        return cast(
            Question,
            await self._get(f"/internal/ai/questions/{question_id}", bearer_token, Question),
        )

    async def review_wrong_question(
        self, bearer_token: str, wrong_question_id: int
    ) -> WrongQuestionReview:
        return cast(
            WrongQuestionReview,
            await self._get(
                f"/internal/ai/wrong-questions/{wrong_question_id}/review",
                bearer_token,
                WrongQuestionReview,
            ),
        )

    async def list_practice_history(
        self, bearer_token: str, page: int, page_size: int
    ) -> PracticeHistoryPage:
        return cast(
            PracticeHistoryPage,
            await self._get(
                "/internal/ai/practice-history",
                bearer_token,
                PracticeHistoryPage,
                params={"page": page, "pageSize": page_size},
            ),
        )

    async def _get(
        self,
        path: str,
        bearer_token: str,
        data_type: Any,
        *,
        params: dict[str, Any] | None = None,
    ) -> Any:
        headers = {
            "Authorization": f"Bearer {bearer_token}",
            "X-AI-Service-Key": self._service_key,
        }
        response: httpx.Response | None = None
        for attempt in range(2):
            try:
                response = await self._client.get(path, headers=headers, params=params)
            except (httpx.TimeoutException, httpx.TransportError) as exc:
                if attempt == 0:
                    await asyncio.sleep(0.1)
                    continue
                raise PlatformError("PLATFORM_UNAVAILABLE", 503) from exc
            if response.status_code >= 500 and attempt == 0:
                await asyncio.sleep(0.1)
                continue
            break
        assert response is not None
        if len(response.content) > self._max_response_bytes:
            raise PlatformError("PLATFORM_RESPONSE_TOO_LARGE")
        if response.status_code == 401:
            raise PlatformError("AUTH_EXPIRED", 401)
        if response.status_code == 403:
            raise PlatformError("PLATFORM_FORBIDDEN", 403)
        if response.status_code == 404:
            raise PlatformError("PLATFORM_NOT_FOUND", 404)
        if response.status_code == 409:
            raise PlatformError("PLATFORM_CONFLICT", 409)
        if response.status_code >= 500:
            raise PlatformError("PLATFORM_UNAVAILABLE", 503)
        if response.status_code >= 400:
            raise PlatformError("PLATFORM_BAD_REQUEST", response.status_code)
        try:
            envelope_type = ResultEnvelope[data_type]
            envelope = TypeAdapter(envelope_type).validate_json(response.content)
        except (ValidationError, ValueError, TypeError) as exc:
            raise PlatformError("PLATFORM_INVALID_RESPONSE") from exc
        if envelope.code != 200:
            raise PlatformError("PLATFORM_INVALID_RESPONSE")
        return envelope.data
