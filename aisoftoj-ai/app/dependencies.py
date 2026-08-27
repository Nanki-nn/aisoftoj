from __future__ import annotations

from collections.abc import AsyncIterator
from typing import Annotated

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.access import require_ai_access
from app.auth.dependencies import get_trusted_user
from app.lifespan import AppState
from packages.harness.aisoftoj_agent.integrations.aisoftoj.context import TrustedUser


def get_container(request: Request) -> AppState:
    container = getattr(request.app.state, "container", None)
    if not isinstance(container, AppState) or not container.ready:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="not ready")
    return container


async def get_session(request: Request) -> AsyncIterator[AsyncSession]:
    async with get_container(request).session_factory() as session:
        yield session


CurrentUser = Annotated[TrustedUser, Depends(get_trusted_user)]


async def get_ai_user(request: Request, user: CurrentUser) -> TrustedUser:
    container = get_container(request)
    await require_ai_access(user, container.settings, container.platform_client)
    return user


AiCurrentUser = Annotated[TrustedUser, Depends(get_ai_user)]
DatabaseSession = Annotated[AsyncSession, Depends(get_session)]
Container = Annotated[AppState, Depends(get_container)]
