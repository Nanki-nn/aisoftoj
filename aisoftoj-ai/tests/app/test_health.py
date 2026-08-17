from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from dataclasses import dataclass

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.main import create_app


@dataclass(frozen=True)
class FakeState:
    ready: bool


def test_liveness_does_not_require_dependencies() -> None:
    app = create_app()
    app.router.lifespan_context = _empty_lifespan
    with TestClient(app) as client:
        response = client.get("/livez")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_readiness_rejects_uninitialized_container() -> None:
    app = create_app()
    app.router.lifespan_context = _empty_lifespan
    with TestClient(app) as client:
        response = client.get("/readyz")

    assert response.status_code == 503


@asynccontextmanager
async def _empty_lifespan(_app: FastAPI) -> AsyncIterator[None]:
    yield
