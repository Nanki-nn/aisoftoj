from __future__ import annotations

from fastapi import FastAPI

from app.lifespan import lifespan
from app.routers.health import router as health_router


def create_app() -> FastAPI:
    application = FastAPI(title="aisoftoj AI", version="0.1.0", lifespan=lifespan)
    application.include_router(health_router)
    return application


app = create_app()
