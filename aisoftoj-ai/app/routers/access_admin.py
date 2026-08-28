from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, HTTPException, Path, Query, status
from sqlalchemy.exc import SQLAlchemyError

from app.dependencies import Container, CurrentUser
from packages.harness.aisoftoj_agent.access_control import (
    AI_ACCESS_CONFIG_UNAVAILABLE,
    AccessConfigSnapshot,
    AiAccessControlService,
    AiAccessControlUnavailable,
)
from packages.harness.aisoftoj_agent.contracts.api import (
    AccessConfigResponse,
    AccessConfigUpdateRequest,
    RolloutMutationResponse,
    RolloutStatusBatchRequest,
    RolloutStatusBatchResponse,
    RolloutUserPageResponse,
    RolloutUserResponse,
)
from packages.harness.aisoftoj_agent.integrations.aisoftoj.client import PlatformError

router = APIRouter(prefix="/api/ai/admin", tags=["access-admin"])


def require_admin(user: CurrentUser) -> None:
    if user.role.upper() != "ADMIN":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="admin required")


def require_service(container: Container) -> AiAccessControlService:
    if container.access_control_service is None:
        raise HTTPException(status_code=503, detail=AI_ACCESS_CONFIG_UNAVAILABLE)
    return container.access_control_service


def config_response(value: AccessConfigSnapshot) -> AccessConfigResponse:
    return AccessConfigResponse(
        globally_enabled=value.globally_enabled,
        rollout_user_count=value.rollout_user_count,
        updated_by_user_id=value.updated_by_user_id,
        updated_at=value.updated_at,
    )


def translate_access_error(exc: BaseException) -> HTTPException:
    return HTTPException(status_code=503, detail=AI_ACCESS_CONFIG_UNAVAILABLE)


@router.get("/access-config", response_model=AccessConfigResponse)
async def get_access_config(user: CurrentUser, container: Container) -> AccessConfigResponse:
    require_admin(user)
    try:
        return config_response(await require_service(container).status())
    except (AiAccessControlUnavailable, SQLAlchemyError) as exc:
        raise translate_access_error(exc) from exc


@router.patch("/access-config", response_model=AccessConfigResponse)
async def update_access_config(
    body: AccessConfigUpdateRequest,
    user: CurrentUser,
    container: Container,
) -> AccessConfigResponse:
    require_admin(user)
    try:
        value = await require_service(container).update_global(
            body.globally_enabled, user.user_id
        )
        return config_response(value)
    except (AiAccessControlUnavailable, SQLAlchemyError) as exc:
        raise translate_access_error(exc) from exc


@router.post("/rollout-user-status:batch-get", response_model=RolloutStatusBatchResponse)
async def get_rollout_statuses(
    body: RolloutStatusBatchRequest,
    user: CurrentUser,
    container: Container,
) -> RolloutStatusBatchResponse:
    require_admin(user)
    service = require_service(container)
    try:
        config = await service.status()
        statuses = await service.rollout_statuses(body.user_ids)
    except (AiAccessControlUnavailable, SQLAlchemyError) as exc:
        raise translate_access_error(exc) from exc
    return RolloutStatusBatchResponse(
        globally_enabled=config.globally_enabled,
        statuses=statuses,
    )


@router.get("/rollout-users", response_model=RolloutUserPageResponse)
async def list_rollout_users(
    user: CurrentUser,
    container: Container,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
) -> RolloutUserPageResponse:
    require_admin(user)
    try:
        rows, total = await require_service(container).list_rollout_users(page, page_size)
        details = (
            await container.platform_client.get_admin_users_by_ids(
                user.bearer_token, [row.user_id for row in rows]
            )
            if rows
            else None
        )
    except PlatformError as exc:
        raise HTTPException(status_code=503, detail="AI_PLATFORM_UNAVAILABLE") from exc
    except (AiAccessControlUnavailable, SQLAlchemyError) as exc:
        raise translate_access_error(exc) from exc

    details_by_id = {item.id: item for item in details.records} if details else {}
    missing_ids = set(details.missing_user_ids) if details else set()
    records: list[RolloutUserResponse] = []
    for row in rows:
        account = details_by_id.get(row.user_id)
        if row.user_id in missing_ids or account is None:
            account_status = "missing"
        elif account.is_deleted:
            account_status = "deleted"
        elif not account.is_enabled:
            account_status = "disabled"
        else:
            account_status = "active"
        records.append(
            RolloutUserResponse(
                user_id=row.user_id,
                login_name=account.login_name if account else None,
                nick_name=account.nick_name if account else None,
                email=account.email if account else None,
                role=account.role if account else None,
                account_status=account_status,
                created_by_user_id=row.created_by_user_id,
                updated_by_user_id=row.updated_by_user_id,
                created_at=row.create_time,
                updated_at=row.update_time,
            )
        )
    return RolloutUserPageResponse(
        records=records,
        total=total,
        page=page,
        page_size=page_size,
    )


@router.put("/rollout-users/{user_id}", response_model=RolloutMutationResponse)
async def add_rollout_user(
    user: CurrentUser,
    container: Container,
    user_id: Annotated[int, Path(gt=0)],
) -> RolloutMutationResponse:
    require_admin(user)
    try:
        batch = await container.platform_client.get_admin_users_by_ids(
            user.bearer_token, [user_id]
        )
        account = next((item for item in batch.records if item.id == user_id), None)
        if account is None or user_id in batch.missing_user_ids or account.is_deleted:
            raise HTTPException(status_code=404, detail="AI_ROLLOUT_USER_NOT_FOUND")
        if not account.is_enabled:
            raise HTTPException(status_code=409, detail="AI_ROLLOUT_USER_DISABLED")
        if account.role.upper() == "ADMIN":
            raise HTTPException(status_code=409, detail="AI_ROLLOUT_ADMIN_IMPLICIT_ACCESS")
        await require_service(container).add_rollout_user(user_id, user.user_id)
    except HTTPException:
        raise
    except PlatformError as exc:
        raise HTTPException(status_code=503, detail="AI_PLATFORM_UNAVAILABLE") from exc
    except (AiAccessControlUnavailable, SQLAlchemyError) as exc:
        raise translate_access_error(exc) from exc
    return RolloutMutationResponse(user_id=user_id, enabled=True)


@router.delete("/rollout-users/{user_id}", response_model=RolloutMutationResponse)
async def remove_rollout_user(
    user: CurrentUser,
    container: Container,
    user_id: Annotated[int, Path(gt=0)],
) -> RolloutMutationResponse:
    require_admin(user)
    try:
        await require_service(container).remove_rollout_user(user_id, user.user_id)
    except (AiAccessControlUnavailable, SQLAlchemyError) as exc:
        raise translate_access_error(exc) from exc
    return RolloutMutationResponse(user_id=user_id, enabled=False)
