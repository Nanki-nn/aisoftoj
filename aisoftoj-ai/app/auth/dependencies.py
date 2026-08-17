from __future__ import annotations

from typing import Annotated

from fastapi import Header, HTTPException, Request, status

from packages.harness.aisoftoj_agent.integrations.aisoftoj import PlatformClient, PlatformError
from packages.harness.aisoftoj_agent.integrations.aisoftoj.context import TrustedUser


def get_platform_client(request: Request) -> PlatformClient:
    client = getattr(request.app.state, "platform_client", None)
    if not isinstance(client, PlatformClient):
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="not ready")
    return client


async def get_trusted_user(
    request: Request,
    authorization: Annotated[str | None, Header()] = None,
) -> TrustedUser:
    if authorization is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="missing bearer token")
    scheme, separator, token = authorization.partition(" ")
    if scheme != "Bearer" or not separator or not token.strip():
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid bearer token")
    client = get_platform_client(request)
    try:
        profile = await client.get_profile(token.strip())
    except PlatformError as exc:
        status_code = exc.status_code if exc.status_code in {401, 403} else 503
        raise HTTPException(status_code=status_code, detail=exc.code) from exc
    return TrustedUser(
        user_id=profile.user_id,
        username=profile.username,
        nickname=profile.nickname,
        role=profile.role,
        bearer_token=token.strip(),
    )
