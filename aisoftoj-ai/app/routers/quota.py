from __future__ import annotations

from fastapi import APIRouter, HTTPException, status
from sqlalchemy.exc import SQLAlchemyError

from app.dependencies import Container, CurrentUser
from packages.harness.aisoftoj_agent.contracts.api import (
    QuotaConfigResponse,
    QuotaConfigUpdateRequest,
    QuotaResponse,
)
from packages.harness.aisoftoj_agent.quota import (
    BEIJING,
    DailyTokenQuotaService,
    QuotaSnapshot,
)

router = APIRouter(prefix="/api/ai", tags=["quota"])


def quota_response(value: QuotaSnapshot) -> QuotaResponse:
    return QuotaResponse(
        limit=value.limit,
        consumed=value.consumed,
        reserved=value.reserved,
        remaining=value.remaining,
        reset_at=value.reset_at,
    )


def config_response(value: QuotaSnapshot) -> QuotaConfigResponse:
    updated_at = value.updated_at
    if updated_at is not None:
        updated_at = (
            updated_at.replace(tzinfo=BEIJING)
            if updated_at.tzinfo is None
            else updated_at.astimezone(BEIJING)
        )
    return QuotaConfigResponse(
        daily_token_limit=value.limit,
        updated_by_user_id=value.updated_by_user_id,
        updated_at=updated_at,
    )


def require_quota_service(container: Container) -> DailyTokenQuotaService:
    if container.quota_service is None:
        raise HTTPException(status_code=503, detail="AI_QUOTA_UNAVAILABLE")
    return container.quota_service


@router.get("/quota", response_model=QuotaResponse)
async def get_quota(user: CurrentUser, container: Container) -> QuotaResponse:
    try:
        value = await require_quota_service(container).status(user.user_id)
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=503, detail="AI_QUOTA_UNAVAILABLE") from exc
    return quota_response(value)


@router.get("/admin/quota-config", response_model=QuotaConfigResponse)
async def get_quota_config(user: CurrentUser, container: Container) -> QuotaConfigResponse:
    if user.role != "ADMIN":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="admin required")
    try:
        value = await require_quota_service(container).status(user.user_id)
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=503, detail="AI_QUOTA_UNAVAILABLE") from exc
    return config_response(value)


@router.patch("/admin/quota-config", response_model=QuotaConfigResponse)
async def update_quota_config(
    body: QuotaConfigUpdateRequest,
    user: CurrentUser,
    container: Container,
) -> QuotaConfigResponse:
    if user.role != "ADMIN":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="admin required")
    try:
        updated = await require_quota_service(container).update_limit(
            body.daily_token_limit, user.user_id
        )
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=503, detail="AI_QUOTA_UNAVAILABLE") from exc
    return config_response(updated)
