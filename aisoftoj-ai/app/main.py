from __future__ import annotations

from uuid import uuid4

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from app.lifespan import lifespan
from app.routers.health import router as health_router
from app.routers.runs import router as runs_router
from app.routers.threads import router as threads_router
from packages.harness.aisoftoj_agent.contracts.errors import ErrorResponse


def create_app() -> FastAPI:
    application = FastAPI(title="aisoftoj AI", version="0.1.0", lifespan=lifespan)
    application.include_router(health_router)
    application.include_router(threads_router)
    application.include_router(runs_router)

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

    return application


app = create_app()
