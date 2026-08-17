from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from dataclasses import dataclass

from fastapi import FastAPI

from config import Settings, load_settings


@dataclass(frozen=True, slots=True)
class AppState:
    settings: Settings
    ready: bool


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    app.state.container = AppState(settings=load_settings(), ready=True)
    yield
