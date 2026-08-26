from __future__ import annotations

import asyncio
import logging
import time
from typing import Any, NoReturn, cast

import httpx
from pydantic import TypeAdapter, ValidationError

from .models import (
    AdminUserBatch,
    AdminUserPage,
    Paper,
    PracticeHistoryPage,
    Profile,
    Question,
    ResultEnvelope,
    TextbookCatalog,
    TextbookTraceQuestion,
    WrongQuestionReview,
)

logger = logging.getLogger(__name__)


def _safe_text(value: object, limit: int = 128) -> str:
    return " ".join(str(value).split())[:limit]


def _validation_summary(error: BaseException) -> str:
    if not isinstance(error, ValidationError):
        return _safe_text(type(error).__name__)
    parts: list[str] = []
    for item in error.errors(include_url=False, include_context=False, include_input=False)[:5]:
        location = ".".join(str(part) for part in item.get("loc", ())) or "response"
        parts.append(f"{_safe_text(location, 96)}:{_safe_text(item.get('type', 'invalid'), 48)}")
    return _safe_text(",".join(parts), 384)


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
            trust_env=False,
        )

    async def close(self) -> None:
        await self._client.aclose()

    async def get_profile(self, bearer_token: str) -> Profile:
        return cast(Profile, await self._get("/internal/ai/me", bearer_token, Profile))

    async def list_admin_users(
        self,
        bearer_token: str,
        *,
        keyword: str | None,
        page: int,
        page_size: int,
    ) -> AdminUserPage:
        params: dict[str, Any] = {"page": page, "pageSize": page_size}
        if keyword:
            params["keyword"] = keyword
        return cast(
            AdminUserPage,
            await self._get(
                "/admin/users",
                bearer_token,
                AdminUserPage,
                params=params,
            ),
        )

    async def get_admin_users_by_ids(
        self,
        bearer_token: str,
        user_ids: list[int],
    ) -> AdminUserBatch:
        return cast(
            AdminUserBatch,
            await self._request(
                "POST",
                "/internal/ai/admin/users:batch-get",
                bearer_token,
                AdminUserBatch,
                json_body={"userIds": user_ids},
            ),
        )

    async def list_papers(self, bearer_token: str) -> list[Paper]:
        return cast(list[Paper], await self._get("/internal/ai/papers", bearer_token, list[Paper]))

    async def get_question(self, bearer_token: str, question_id: int) -> Question:
        return cast(
            Question,
            await self._get(f"/internal/ai/questions/{question_id}", bearer_token, Question),
        )

    async def is_ai_assistant_available(self, bearer_token: str) -> bool:
        return cast(
            bool,
            await self._get("/internal/ai/assistant-availability", bearer_token, bool),
        )

    async def get_textbook_trace_question(
        self, bearer_token: str, question_id: int
    ) -> TextbookTraceQuestion:
        return cast(
            TextbookTraceQuestion,
            await self._get(
                f"/internal/ai/questions/{question_id}/textbook-trace-context",
                bearer_token,
                TextbookTraceQuestion,
            ),
        )

    async def get_active_textbook_catalog(
        self, bearer_token: str, subject_name: str
    ) -> TextbookCatalog:
        return cast(
            TextbookCatalog,
            await self._get(
                "/internal/ai/textbooks/active",
                bearer_token,
                TextbookCatalog,
                params={"subjectName": subject_name},
            ),
        )

    async def get_textbook_catalog(
        self, bearer_token: str, textbook_id: int
    ) -> TextbookCatalog:
        return cast(
            TextbookCatalog,
            await self._get(
                f"/internal/ai/textbooks/{textbook_id}",
                bearer_token,
                TextbookCatalog,
            ),
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
        return await self._request(
            "GET", path, bearer_token, data_type, params=params
        )

    async def _request(
        self,
        method: str,
        path: str,
        bearer_token: str,
        data_type: Any,
        *,
        params: dict[str, Any] | None = None,
        json_body: dict[str, Any] | None = None,
    ) -> Any:
        headers = {
            "Authorization": f"Bearer {bearer_token}",
            "X-AI-Service-Key": self._service_key,
        }
        started = time.monotonic()
        response: httpx.Response | None = None
        for attempt in range(2):
            try:
                response = await self._client.request(
                    method,
                    path,
                    headers=headers,
                    params=params,
                    json=json_body,
                )
            except (httpx.TimeoutException, httpx.TransportError) as exc:
                if attempt == 0:
                    await asyncio.sleep(0.1)
                    continue
                self._raise_failure(
                    method,
                    path,
                    "PLATFORM_UNAVAILABLE",
                    503,
                    attempt + 1,
                    started,
                    cause=exc,
                )
            if response.status_code >= 500 and attempt == 0:
                await asyncio.sleep(0.1)
                continue
            break
        assert response is not None
        if len(response.content) > self._max_response_bytes:
            self._raise_failure(
                method, path, "PLATFORM_RESPONSE_TOO_LARGE", 502, attempt + 1, started, response
            )
        if response.status_code == 401:
            self._raise_failure(method, path, "AUTH_EXPIRED", 401, attempt + 1, started, response)
        if response.status_code == 403:
            self._raise_failure(
                method, path, "PLATFORM_FORBIDDEN", 403, attempt + 1, started, response
            )
        if response.status_code == 404:
            self._raise_failure(
                method, path, "PLATFORM_NOT_FOUND", 404, attempt + 1, started, response
            )
        if response.status_code == 409:
            self._raise_failure(
                method, path, "PLATFORM_CONFLICT", 409, attempt + 1, started, response
            )
        if response.status_code >= 500:
            self._raise_failure(
                method, path, "PLATFORM_UNAVAILABLE", 503, attempt + 1, started, response
            )
        if response.status_code >= 400:
            self._raise_failure(
                method,
                path,
                "PLATFORM_BAD_REQUEST",
                response.status_code,
                attempt + 1,
                started,
                response,
            )
        try:
            envelope_type = ResultEnvelope[data_type]
            envelope = TypeAdapter(envelope_type).validate_json(response.content)
        except (ValidationError, ValueError, TypeError) as exc:
            self._raise_failure(
                method,
                path,
                "PLATFORM_INVALID_RESPONSE",
                502,
                attempt + 1,
                started,
                response,
                validation=_validation_summary(exc),
                cause=exc,
            )
        if envelope.code != 200:
            self._raise_failure(
                method,
                path,
                "PLATFORM_INVALID_RESPONSE",
                502,
                attempt + 1,
                started,
                response,
                validation="envelope.code:not_200",
            )
        return envelope.data

    def _raise_failure(
        self,
        method: str,
        path: str,
        code: str,
        status_code: int,
        attempts: int,
        started: float,
        response: httpx.Response | None = None,
        *,
        validation: str = "none",
        cause: BaseException | None = None,
    ) -> NoReturn:
        content_type = "none"
        response_bytes = 0
        http_status: int | str = "none"
        if response is not None:
            http_status = response.status_code
            response_bytes = len(response.content)
            content_type = _safe_text(response.headers.get("content-type", "none"), 64)
        logger.warning(
            "event=platform_request_failed method=%s path=%s http_status=%s code=%s "
            "attempts=%d duration_ms=%d response_bytes=%d content_type=%s "
            "validation=%s exception=%s",
            _safe_text(method, 16),
            _safe_text(path, 256),
            http_status,
            code,
            attempts,
            max(0, int((time.monotonic() - started) * 1000)),
            response_bytes,
            content_type,
            validation,
            type(cause).__name__ if cause is not None else "none",
        )
        raise PlatformError(code, status_code) from cause
