from __future__ import annotations

from dataclasses import dataclass

from fastapi import HTTPException, status

from config import Settings
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


def is_rollout_allowed(user: TrustedUser, settings: Settings) -> bool:
    allowed = getattr(settings, "rollout_allowed_user_ids", None)
    # Lightweight test containers predating the rollout setting remain open;
    # production Settings always provides an explicit (possibly empty) set.
    return user.role == "admin" or allowed is None or user.user_id in allowed


async def capability_for(
    user: TrustedUser, settings: Settings, platform_client: PlatformClient
) -> AiCapability:
    if not is_rollout_allowed(user, settings):
        return AiCapability(False, "AI_ROLLOUT_NOT_ENABLED")
    try:
        available = await platform_client.is_ai_assistant_available(user.bearer_token)
    except PlatformError:
        return AiCapability(False, "AI_AVAILABILITY_UNAVAILABLE")
    if not available:
        return AiCapability(False, "AI_DISABLED_DURING_EXAM")
    return AiCapability(True)


async def require_ai_access(
    user: TrustedUser, settings: Settings, platform_client: PlatformClient
) -> None:
    capability = await capability_for(user, settings, platform_client)
    if capability.enabled:
        return
    if capability.reason == "AI_AVAILABILITY_UNAVAILABLE":
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=capability.reason,
        )
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
