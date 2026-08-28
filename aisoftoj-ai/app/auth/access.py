from __future__ import annotations

from dataclasses import dataclass

from fastapi import HTTPException, status
from sqlalchemy.exc import SQLAlchemyError

from packages.harness.aisoftoj_agent.access_control import (
    AI_ACCESS_CONFIG_UNAVAILABLE,
    AiAccessControlService,
    AiAccessControlUnavailable,
)
from packages.harness.aisoftoj_agent.integrations.aisoftoj.client import (
    PlatformClient,
    PlatformError,
)
from packages.harness.aisoftoj_agent.integrations.aisoftoj.context import TrustedUser


class AiDisabledDuringExam(RuntimeError):
    pass


@dataclass(frozen=True, slots=True)
class AiCapability:
    enabled: bool
    reason: str | None = None


async def capability_for(
    user: TrustedUser,
    access_control_service: AiAccessControlService,
    platform_client: PlatformClient,
) -> AiCapability:
    try:
        access = await access_control_service.decision(user.user_id, user.role)
    except (AiAccessControlUnavailable, SQLAlchemyError) as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=AI_ACCESS_CONFIG_UNAVAILABLE,
        ) from exc
    if not access.enabled:
        return AiCapability(False, access.reason)
    try:
        available = await platform_client.is_ai_assistant_available(user.bearer_token)
    except PlatformError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI_AVAILABILITY_UNAVAILABLE",
        ) from exc
    if not available:
        return AiCapability(False, "AI_DISABLED_DURING_EXAM")
    return AiCapability(True)


async def require_ai_access(
    user: TrustedUser,
    access_control_service: AiAccessControlService,
    platform_client: PlatformClient,
) -> None:
    capability = await capability_for(user, access_control_service, platform_client)
    if capability.enabled:
        return
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=capability.reason)


async def require_exam_available(
    platform_client: PlatformClient, bearer_token: str
) -> None:
    try:
        result = platform_client.is_ai_assistant_available(bearer_token)
        available = await result if hasattr(result, "__await__") else bool(result)
    except PlatformError:
        raise
    if not available:
        raise AiDisabledDuringExam("AI_DISABLED_DURING_EXAM")
