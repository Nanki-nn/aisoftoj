from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request, status

router = APIRouter(tags=["health"])


@router.get("/livez")
async def livez() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/readyz")
async def readyz(request: Request) -> dict[str, str]:
    container = getattr(request.app.state, "container", None)
    if container is None or not container.ready:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="not ready")
    return {"status": "ready"}
