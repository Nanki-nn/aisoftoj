from __future__ import annotations

from fastapi import APIRouter, HTTPException, status

from app.dependencies import Container, CurrentUser

router = APIRouter(prefix="/api/ai/admin", tags=["textbook-indexes"])


@router.post(
    "/textbooks/{textbook_id}/indexes",
    status_code=status.HTTP_202_ACCEPTED,
)
async def create_textbook_index(
    textbook_id: int, user: CurrentUser, container: Container
) -> dict[str, object]:
    if textbook_id <= 0:
        raise HTTPException(status_code=400, detail="invalid textbook id")
    if user.role != "ADMIN":
        raise HTTPException(status_code=403, detail="admin role required")
    if container.textbook_index_tasks is None:
        raise HTTPException(status_code=503, detail="textbook RAG is disabled")
    return await container.textbook_index_tasks.start(user.bearer_token, textbook_id)


@router.get("/textbook-index-tasks/{task_id}")
async def get_textbook_index_task(
    task_id: str, user: CurrentUser, container: Container
) -> dict[str, object]:
    if user.role != "ADMIN":
        raise HTTPException(status_code=403, detail="admin role required")
    if container.textbook_index_tasks is None:
        raise HTTPException(status_code=503, detail="textbook RAG is disabled")
    task = await container.textbook_index_tasks.get(task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="index task not found")
    return task
