from __future__ import annotations

from uuid import uuid4

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse

from app.lifespan import lifespan
from app.routers.capability import router as capability_router
from app.routers.health import router as health_router
from app.routers.quota import router as quota_router
from app.routers.runs import router as runs_router
from app.routers.skills import router as skills_router
from app.routers.threads import router as threads_router
from packages.harness.aisoftoj_agent.contracts.errors import ErrorResponse
from packages.harness.aisoftoj_agent.quota import (
    DailyTokenQuotaExceeded,
    DailyTokenQuotaUnavailable,
)


def create_app() -> FastAPI:
    application = FastAPI(title="aisoftoj AI", version="0.1.0", lifespan=lifespan)
    application.include_router(health_router)
    application.include_router(capability_router)
    application.include_router(threads_router)
    application.include_router(runs_router)
    application.include_router(skills_router)
    application.include_router(quota_router)

    @application.exception_handler(DailyTokenQuotaUnavailable)
    async def quota_unavailable(request: Request, _exc: Exception) -> JSONResponse:
        request_id = request.headers.get("X-Request-ID") or str(uuid4())
        return JSONResponse(
            status_code=503,
            content=ErrorResponse(
                error={
                    "code": "AI_QUOTA_UNAVAILABLE",
                    "message": "AI quota is temporarily unavailable",
                    "request_id": request_id,
                }
            ).model_dump(mode="json"),
            headers={"X-Request-ID": request_id},
        )

    @application.exception_handler(DailyTokenQuotaExceeded)
    async def quota_exceeded(request: Request, exc: DailyTokenQuotaExceeded) -> JSONResponse:
        request_id = request.headers.get("X-Request-ID") or str(uuid4())
        value = exc.snapshot
        return JSONResponse(
            status_code=429,
            content={
                "error": {
                    "code": "AI_DAILY_TOKEN_QUOTA_EXCEEDED",
                    "message": "daily AI token quota exceeded",
                    "request_id": request_id,
                    "limit": value.limit,
                    "consumed": value.consumed,
                    "reserved": value.reserved,
                    "remaining": value.remaining,
                    "reset_at": value.reset_at.isoformat(),
                }
            },
            headers={"X-Request-ID": request_id},
        )

    @application.exception_handler(Exception)
    async def unhandled_exception(request: Request, exc: Exception) -> JSONResponse:
        request_id = request.headers.get("X-Request-ID") or str(uuid4())
        return JSONResponse(
            status_code=500,
            content=ErrorResponse(
                error={
                    "code": "INTERNAL_ERROR",
                    "message": "internal server error",
                    "request_id": request_id,
                }
            ).model_dump(mode="json"),
            headers={"X-Request-ID": request_id},
        )

    @application.exception_handler(HTTPException)
    async def http_exception(request: Request, exc: HTTPException) -> JSONResponse:
        request_id = request.headers.get("X-Request-ID") or str(uuid4())
        mapped_code = {
            400: "BAD_REQUEST",
            401: "UNAUTHORIZED",
            403: "FORBIDDEN",
            404: "NOT_FOUND",
            409: "CONFLICT",
            429: "RATE_LIMITED",
            503: "NOT_READY",
        }.get(exc.status_code, "HTTP_ERROR")
        message = exc.detail if isinstance(exc.detail, str) else "request failed"
        code = message if message.startswith("AI_") else mapped_code
        return JSONResponse(
            status_code=exc.status_code,
            content=ErrorResponse(
                error={"code": code, "message": message, "request_id": request_id}
            ).model_dump(mode="json"),
            headers={"X-Request-ID": request_id},
        )

    return application


app = create_app()
