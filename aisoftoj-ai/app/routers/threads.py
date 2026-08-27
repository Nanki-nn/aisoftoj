from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query, Response, status
from sqlalchemy import select

from app.dependencies import AiCurrentUser, DatabaseSession
from packages.harness.aisoftoj_agent.contracts.api import (
    MessagePageResponse,
    MessageResponse,
    ThreadCreateRequest,
    ThreadPageResponse,
    ThreadResponse,
    ThreadUpdateRequest,
)
from packages.harness.aisoftoj_agent.persistence.models import AiRun, AiThread
from packages.harness.aisoftoj_agent.persistence.repositories.messages import MessageRepository
from packages.harness.aisoftoj_agent.persistence.repositories.threads import ThreadRepository

router = APIRouter(prefix="/api/ai/threads", tags=["threads"])


def thread_response(thread: AiThread) -> ThreadResponse:
    return ThreadResponse(
        id=thread.id,
        title=thread.title,
        created_at=thread.create_time,
        updated_at=thread.update_time,
    )


@router.post("", response_model=ThreadResponse, status_code=status.HTTP_201_CREATED)
async def create_thread(
    body: ThreadCreateRequest,
    user: AiCurrentUser,
    session: DatabaseSession,
) -> ThreadResponse:
    async with session.begin():
        thread = await ThreadRepository(session).create(user.user_id, body.title)
    return thread_response(thread)


@router.get("", response_model=ThreadPageResponse)
async def list_threads(
    user: AiCurrentUser,
    session: DatabaseSession,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
) -> ThreadPageResponse:
    items, total = await ThreadRepository(session).list_owned(user.user_id, page, page_size)
    return ThreadPageResponse(
        items=[thread_response(item) for item in items],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/{thread_id}", response_model=ThreadResponse)
async def get_thread(
    thread_id: str, user: AiCurrentUser, session: DatabaseSession
) -> ThreadResponse:
    thread = await ThreadRepository(session).get_owned(user.user_id, thread_id)
    if thread is None:
        raise HTTPException(status_code=404, detail="thread not found")
    return thread_response(thread)


@router.patch("/{thread_id}", response_model=ThreadResponse)
async def update_thread(
    thread_id: str,
    body: ThreadUpdateRequest,
    user: AiCurrentUser,
    session: DatabaseSession,
) -> ThreadResponse:
    async with session.begin():
        thread = await ThreadRepository(session).get_owned(user.user_id, thread_id, for_update=True)
        if thread is None:
            raise HTTPException(status_code=404, detail="thread not found")
        thread.title = body.title
        await session.flush()
    return thread_response(thread)


@router.delete("/{thread_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_thread(thread_id: str, user: AiCurrentUser, session: DatabaseSession) -> Response:
    async with session.begin():
        repository = ThreadRepository(session)
        thread = await repository.get_owned(user.user_id, thread_id, for_update=True)
        if thread is None:
            raise HTTPException(status_code=404, detail="thread not found")
        active = await session.scalar(
            select(AiRun.id).where(
                AiRun.thread_id == thread_id,
                AiRun.status.in_({"queued", "running"}),
            )
        )
        if active is not None:
            raise HTTPException(status_code=409, detail="thread has active run")
        await repository.soft_delete(thread)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{thread_id}/messages", response_model=MessagePageResponse)
async def list_messages(
    thread_id: str,
    user: AiCurrentUser,
    session: DatabaseSession,
    before_sequence: int | None = Query(default=None, ge=1),
    limit: int = Query(default=50, ge=1, le=100),
) -> MessagePageResponse:
    thread = await ThreadRepository(session).get_owned(user.user_id, thread_id)
    if thread is None:
        raise HTTPException(status_code=404, detail="thread not found")
    messages = await MessageRepository(session).list_before(thread_id, before_sequence, limit + 1)
    has_more = len(messages) > limit
    if has_more:
        messages = messages[-limit:]
    items = [
        MessageResponse(
            id=item.id,
            thread_id=item.thread_id,
            run_id=item.run_id or "",
            role=item.role,
            content=item.content,
            sequence=item.sequence,
            created_at=item.create_time,
        )
        for item in messages
    ]
    return MessagePageResponse(
        items=items,
        next_before_sequence=items[0].sequence if has_more and items else None,
        has_more=has_more,
    )
