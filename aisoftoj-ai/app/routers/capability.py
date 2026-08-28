from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.auth.access import capability_for
from app.dependencies import Container, CurrentUser

router = APIRouter(prefix="/api/ai", tags=["capability"])


class CapabilityResponse(BaseModel):
    ai_enabled: bool
    reason: str | None = None


@router.get("/capability", response_model=CapabilityResponse)
async def get_capability(user: CurrentUser, container: Container) -> CapabilityResponse:
    if container.access_control_service is None:
        raise HTTPException(status_code=503, detail="AI_ACCESS_CONFIG_UNAVAILABLE")
    value = await capability_for(
        user,
        container.access_control_service,
        container.platform_client,
    )
    return CapabilityResponse(ai_enabled=value.enabled, reason=value.reason)
