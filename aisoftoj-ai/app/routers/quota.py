from __future__ import annotations

from datetime import date, datetime
from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy.exc import SQLAlchemyError

from app.dependencies import Container, CurrentUser
from packages.harness.aisoftoj_agent.contracts.api import (
    AdminQuotaUsageItem,
    AdminQuotaUsagePage,
    QuotaConfigResponse,
    QuotaConfigUpdateRequest,
    QuotaResponse,
)
from packages.harness.aisoftoj_agent.integrations.aisoftoj.client import PlatformError
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


@router.get("/admin/quota-usage", response_model=AdminQuotaUsagePage)
async def list_quota_usage(
    user: CurrentUser,
    container: Container,
    usage_date: Annotated[date | None, Query(alias="date")] = None,
    keyword: Annotated[str | None, Query(max_length=100)] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 10,
) -> AdminQuotaUsagePage:
    if user.role != "ADMIN":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="admin required")
    selected_date = usage_date or datetime.now(BEIJING).date()
    normalized_keyword = keyword.strip() if keyword else None
    try:
        users = await container.platform_client.list_admin_users(
            user.bearer_token,
            keyword=normalized_keyword,
            page=page,
            page_size=page_size,
        )
        usages = await require_quota_service(container).usage_for_users(
            [item.id for item in users.records],
            selected_date,
        )
    except PlatformError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.code) from exc
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=503, detail="AI_QUOTA_UNAVAILABLE") from exc
    usage_by_user = {item.user_id: item for item in usages}
    records = []
    for account in users.records:
        usage = usage_by_user[account.id]
        records.append(
            AdminQuotaUsageItem(
                user_id=account.id,
                login_name=account.login_name,
                nick_name=account.nick_name,
                email=account.email,
                usage_date=usage.usage_date,
                limit=usage.limit,
                consumed=usage.consumed,
                reserved=usage.reserved,
                remaining=usage.remaining,
            )
        )
    return AdminQuotaUsagePage(
        records=records,
        total=users.total,
        page=users.page,
        page_size=users.page_size,
        usage_date=selected_date,
    )
