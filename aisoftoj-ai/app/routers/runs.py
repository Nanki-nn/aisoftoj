from __future__ import annotations

import asyncio
import json
import time
from collections.abc import AsyncIterator
from datetime import UTC
from typing import Annotated

from fastapi import APIRouter, Header, HTTPException, Query, Request, Response, status
from fastapi.responses import StreamingResponse
from sqlalchemy.exc import SQLAlchemyError

from app.dependencies import AiCurrentUser, Container, DatabaseSession
from packages.harness.aisoftoj_agent.agents.context import AgentContext
from packages.harness.aisoftoj_agent.contracts.api import (
    RunCreateRequest,
    RunPageResponse,
    RunResponse,
)
from packages.harness.aisoftoj_agent.contracts.events import (
    EventPage,
    PersistedEvent,
    StreamEnd,
    StreamReset,
)
from packages.harness.aisoftoj_agent.persistence.models import AiRun
from packages.harness.aisoftoj_agent.persistence.repositories.messages import MessageRepository
from packages.harness.aisoftoj_agent.persistence.repositories.runs import (
    TERMINAL_STATUSES,
    RunRepository,
)
from packages.harness.aisoftoj_agent.persistence.repositories.threads import ThreadRepository
from packages.harness.aisoftoj_agent.runtime.run_manager import CapacityExceeded

router = APIRouter(prefix="/api/ai/threads/{thread_id}/runs", tags=["runs"])


def run_response(run: AiRun) -> RunResponse:
    return RunResponse(
        id=run.id,
        thread_id=run.thread_id,
        status=run.status,
        input_message_id=run.input_message_id,
        output_message_id=run.output_message_id,
        error_code=run.error_code,
        model_name=run.model_name,
        prompt_tokens=run.prompt_tokens,
        completion_tokens=run.completion_tokens,
        started_at=run.started_at,
        finished_at=run.finished_at,
        created_at=run.create_time,
        updated_at=run.update_time,
    )


async def owned_run(
    thread_id: str, run_id: str, user: AiCurrentUser, session: DatabaseSession
) -> AiRun:
    thread = await ThreadRepository(session).get_owned(user.user_id, thread_id)
    if thread is None:
        raise HTTPException(status_code=404, detail="run not found")
    run = await RunRepository(session).get(run_id)
    if run is None or run.thread_id != thread_id:
        raise HTTPException(status_code=404, detail="run not found")
    return run


@router.post("", response_model=RunResponse, status_code=status.HTTP_202_ACCEPTED)
async def create_run(
    thread_id: str,
    body: RunCreateRequest,
    user: AiCurrentUser,
    session: DatabaseSession,
    container: Container,
    response: Response,
    idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None,
) -> RunResponse:
    key = (idempotency_key or "").strip()
    if not key or len(key) > 128 or not key.isascii() or not key.isprintable():
        raise HTTPException(status_code=400, detail="invalid idempotency key")
    thread = await ThreadRepository(session).get_owned(user.user_id, thread_id)
    if thread is None:
        raise HTTPException(status_code=404, detail="thread not found")
    existing = await RunRepository(session).get_by_idempotency(thread_id, key)
    if existing is not None:
        response.status_code = status.HTTP_200_OK
        return run_response(existing)
    # Ownership/idempotency reads autobegin a transaction. End it before
    # reserving capacity.
    await session.rollback()
    if container.quota_service is None:
        raise HTTPException(status_code=503, detail="AI_QUOTA_UNAVAILABLE")
    try:
        await container.quota_service.require_available(user.user_id)
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=503, detail="AI_QUOTA_UNAVAILABLE") from exc
    try:
        await container.run_manager.reserve(user.user_id)
    except CapacityExceeded as exc:
        raise HTTPException(status_code=429, detail="run capacity exceeded") from exc
    run: AiRun | None = None
    try:
        async with session.begin():
            locked_thread = await ThreadRepository(session).get_owned(
                user.user_id, thread_id, for_update=True
            )
            if locked_thread is None:
                raise HTTPException(status_code=404, detail="thread not found")
            repository = RunRepository(session)
            existing = await repository.get_by_idempotency(thread_id, key)
            if existing is not None:
                run = existing
                response.status_code = status.HTTP_200_OK
            else:
                message = await MessageRepository(session).create(thread_id, "user", body.message)
                run = await repository.create(
                    thread_id,
                    key,
                    message.id,
                    container.settings.llm_default_model,
                    body.context.question_id if body.context is not None else None,
                )
                message.run_id = run.id
                if locked_thread.title is None:
                    locked_thread.title = body.message[:120]
                await repository.append_event(
                    run.id, "run.created", {"input_message_id": message.id}
                )
        if run is None:
            raise RuntimeError("run creation failed")
        if response.status_code == status.HTTP_200_OK:
            await container.run_manager.release(user.user_id)
            return run_response(run)
        context = AgentContext(
            user_id=user.user_id,
            username=user.username,
            nickname=user.nickname,
            role=user.role,
            thread_id=thread_id,
            run_id=run.id,
            bearer_token=user.bearer_token,
        )
        await container.run_manager.start(
            run.id,
            user.user_id,
            lambda: container.worker.execute(run.id, context),
        )
        return run_response(run)
    except Exception:
        await container.run_manager.release(user.user_id)
        raise


@router.get("", response_model=RunPageResponse)
async def list_runs(
    thread_id: str,
    user: AiCurrentUser,
    session: DatabaseSession,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
) -> RunPageResponse:
    thread = await ThreadRepository(session).get_owned(user.user_id, thread_id)
    if thread is None:
        raise HTTPException(status_code=404, detail="thread not found")
    items, total = await RunRepository(session).list_for_thread(thread_id, page, page_size)
    return RunPageResponse(
        items=[run_response(item) for item in items],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/{run_id}", response_model=RunResponse)
async def get_run(
    thread_id: str, run_id: str, user: AiCurrentUser, session: DatabaseSession
) -> RunResponse:
    return run_response(await owned_run(thread_id, run_id, user, session))


@router.post("/{run_id}/cancel", response_model=RunResponse)
async def cancel_run(
    thread_id: str,
    run_id: str,
    user: AiCurrentUser,
    session: DatabaseSession,
    container: Container,
    response: Response,
) -> RunResponse:
    run = await owned_run(thread_id, run_id, user, session)
    if run.status in TERMINAL_STATUSES:
        response.status_code = status.HTTP_200_OK
        return run_response(run)
    await container.run_manager.cancel(run_id)
    response.status_code = status.HTTP_202_ACCEPTED
    return run_response(run)


@router.get("/{run_id}/events", response_model=EventPage)
async def list_run_events(
    thread_id: str,
    run_id: str,
    user: AiCurrentUser,
    session: DatabaseSession,
    after_sequence: int = Query(default=0, ge=0),
    limit: int = Query(default=200, ge=1, le=500),
) -> EventPage:
    await owned_run(thread_id, run_id, user, session)
    items, has_more = await RunRepository(session).list_event_page(
        run_id, after_sequence, limit
    )
    events = [
        PersistedEvent(
            run_id=item.run_id,
            sequence=item.sequence,
            type=item.event_type,
            created_at=item.create_time.replace(tzinfo=UTC),
            data=item.payload,
        )
        for item in items
    ]
    return EventPage(
        items=events,
        next_after_sequence=events[-1].sequence if has_more and events else None,
        has_more=has_more,
    )


@router.get("/{run_id}/stream")
async def stream_run(
    request: Request,
    thread_id: str,
    run_id: str,
    user: AiCurrentUser,
    session: DatabaseSession,
    container: Container,
    after_seq: int = Query(default=0, ge=0),
    last_event_id: Annotated[str | None, Header(alias="Last-Event-ID")] = None,
) -> StreamingResponse:
    await owned_run(thread_id, run_id, user, session)
    if last_event_id is not None:
        try:
            header_sequence = int(last_event_id)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail="invalid Last-Event-ID") from exc
        if after_seq != 0 and after_seq != header_sequence:
            raise HTTPException(status_code=400, detail="event cursors disagree")
        after_seq = header_sequence
    subscription = await container.stream_bridge.subscribe(run_id)

    async def generate() -> AsyncIterator[str]:
        last_sequence = after_seq
        try:
            async with container.session_factory() as event_session:
                events = await RunRepository(event_session).list_events_after(run_id, after_seq)
            for stored_event in events:
                last_sequence = stored_event.sequence
                yield format_event(
                    PersistedEvent(
                        run_id=stored_event.run_id,
                        sequence=stored_event.sequence,
                        type=stored_event.event_type,
                        created_at=stored_event.create_time.replace(tzinfo=UTC),
                        data=stored_event.payload,
                    )
                )
            async with container.session_factory() as current_session:
                current = await RunRepository(current_session).get(run_id)
            if current is None:
                return
            if current.status in TERMINAL_STATUSES:
                yield format_control(
                    "stream.end",
                    StreamEnd(
                        run_id=run_id,
                        status=current.status,
                        last_sequence=last_sequence,
                    ).model_dump(mode="json"),
                )
                return
            while not await request.is_disconnected():
                try:
                    live_event = await asyncio.wait_for(subscription.receive(), timeout=15)
                except TimeoutError:
                    yield f": ping {int(time.time() * 1000)}\n\n"
                    continue
                if live_event is None:
                    if subscription.overflowed:
                        yield format_control(
                            "stream.reset",
                            StreamReset(
                                run_id=run_id,
                                reason="slow_consumer",
                                last_sequence=last_sequence,
                            ).model_dump(mode="json"),
                        )
                    else:
                        async with container.session_factory() as terminal_session:
                            terminal = await RunRepository(terminal_session).get(run_id)
                        if terminal is not None and terminal.status in TERMINAL_STATUSES:
                            yield format_control(
                                "stream.end",
                                StreamEnd(
                                    run_id=run_id,
                                    status=terminal.status,
                                    last_sequence=last_sequence,
                                ).model_dump(mode="json"),
                            )
                    return
                if live_event.sequence <= last_sequence:
                    continue
                last_sequence = live_event.sequence
                yield format_event(live_event)
        finally:
            await container.stream_bridge.unsubscribe(subscription)

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-store", "X-Accel-Buffering": "no"},
    )


def format_event(event: PersistedEvent) -> str:
    payload = json.dumps(event.model_dump(mode="json"), ensure_ascii=False, separators=(",", ":"))
    return f"id: {event.sequence}\nevent: {event.type}\ndata: {payload}\n\n"


def format_control(name: str, data: dict[str, object]) -> str:
    payload = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
    return f"event: {name}\ndata: {payload}\n\n"
