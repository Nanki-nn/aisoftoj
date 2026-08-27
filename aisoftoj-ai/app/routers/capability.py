from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel

from app.auth.access import capability_for
from app.dependencies import Container, CurrentUser

router = APIRouter(prefix="/api/ai", tags=["capability"])


class CapabilityResponse(BaseModel):
    ai_enabled: bool
    reason: str | None = None


@router.get("/capability", response_model=CapabilityResponse)
async def get_capability(user: CurrentUser, container: Container) -> CapabilityResponse:
    value = await capability_for(user, container.settings, container.platform_client)
    return CapabilityResponse(ai_enabled=value.enabled, reason=value.reason)
