from __future__ import annotations

import asyncio
from datetime import UTC, datetime
from typing import Any

from langchain_core.messages import (
    AIMessage,
    AIMessageChunk,
    BaseMessage,
    HumanMessage,
    SystemMessage,
)
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from ..agents.context import AgentContext
from ..agents.factory import AgentGraph
from ..contracts.events import PersistedEvent
from ..integrations.aisoftoj.client import PlatformError
from ..persistence.models import AiRunEvent
from ..persistence.repositories.messages import MessageRepository
from ..persistence.repositories.runs import RunRepository
from ..persistence.repositories.summaries import SummaryRepository
from .stream_bridge import StreamBridge


class Worker:
    def __init__(
        self,
        session_factory: async_sessionmaker[AsyncSession],
        agent: AgentGraph,
        stream_bridge: StreamBridge,
        *,
        max_run_seconds: int,
    ) -> None:
        self.session_factory = session_factory
        self.agent = agent
        self.stream_bridge = stream_bridge
        self.max_run_seconds = max_run_seconds

    async def execute(self, run_id: str, context: AgentContext) -> None:
        try:
            async with asyncio.timeout(self.max_run_seconds):
                await self._execute(run_id, context)
        except asyncio.CancelledError:
            await self._finish_failure(run_id, "cancelled", None)
            raise
        except TimeoutError:
            await self._finish_failure(run_id, "failed", "MODEL_TIMEOUT")
        except PlatformError as exc:
            await self._finish_failure(run_id, "failed", exc.code)
        except Exception:
            await self._finish_failure(run_id, "failed", "AGENT_FAILED")
        finally:
            await self.agent.checkpointer.adelete_thread(run_id)
            await self.stream_bridge.close(run_id)

    async def _execute(self, run_id: str, context: AgentContext) -> None:
        await self._transition_and_event(run_id, "running", "run.started", {})
        messages = await self._load_messages(context.thread_id)
        await self._append_event(run_id, "message.started", {"role": "assistant"})
        final_text = ""
        async for chunk in self.agent.graph.astream(
            {"messages": messages, "todos": [], "files": {}},
            context=context,
            config={"configurable": {"thread_id": run_id}},
            stream_mode="messages",
        ):
            message = chunk[0] if isinstance(chunk, tuple) else chunk
            if not isinstance(message, AIMessageChunk):
                continue
            delta = message.content if isinstance(message.content, str) else ""
            if not delta:
                continue
            final_text += delta
            await self._append_event(run_id, "message.delta", {"delta": delta})
        await self._complete(run_id, context.thread_id, final_text)

    async def _load_messages(self, thread_id: str) -> list[BaseMessage]:
        async with self.session_factory() as session:
            summary = await SummaryRepository(session).get(thread_id)
            through = summary.summarized_through_sequence if summary is not None else 0
            stored = await MessageRepository(session).list_after(thread_id, through)
        messages: list[BaseMessage] = []
        if summary is not None:
            messages.append(SystemMessage(content=f"此前对话摘要：{summary.content}"))
        for item in stored:
            if item.role == "user":
                messages.append(HumanMessage(content=item.content))
            else:
                messages.append(AIMessage(content=item.content))
        return messages

    async def _complete(self, run_id: str, thread_id: str, content: str) -> None:
        async with self.session_factory.begin() as session:
            run_repository = RunRepository(session)
            run = await run_repository.get(run_id)
            if run is None or run.status not in {"queued", "running"}:
                return
            message = await MessageRepository(session).create(
                thread_id, "assistant", content, run_id=run_id
            )
            await run_repository.transition(run, "completed", output_message_id=message.id)
            message_event = await run_repository.append_event(
                run_id, "message.completed", {"message_id": message.id}
            )
            run_event = await run_repository.append_event(
                run_id, "run.completed", {"status": "completed", "error_code": None}
            )
        await self._publish(message_event)
        await self._publish(run_event)

    async def _finish_failure(self, run_id: str, status: str, error_code: str | None) -> None:
        event: AiRunEvent | None = None
        async with self.session_factory.begin() as session:
            repository = RunRepository(session)
            run = await repository.get(run_id)
            if run is None or run.status not in {"queued", "running"}:
                return
            await repository.transition(run, status, error_code=error_code)
            event = await repository.append_event(
                run_id,
                f"run.{status}",
                {"status": status, "error_code": error_code},
            )
        if event is not None:
            await self._publish(event)

    async def _transition_and_event(
        self, run_id: str, status: str, event_type: str, payload: dict[str, Any]
    ) -> None:
        async with self.session_factory.begin() as session:
            repository = RunRepository(session)
            run = await repository.get(run_id)
            if run is None:
                raise LookupError("run not found")
            await repository.transition(run, status)
            event = await repository.append_event(run_id, event_type, payload)
        await self._publish(event)

    async def _append_event(self, run_id: str, event_type: str, payload: dict[str, Any]) -> None:
        async with self.session_factory.begin() as session:
            event = await RunRepository(session).append_event(run_id, event_type, payload)
        await self._publish(event)

    async def _publish(self, event: AiRunEvent) -> None:
        await self.stream_bridge.publish(
            PersistedEvent(
                run_id=event.run_id,
                sequence=event.sequence,
                type=event.event_type,
                created_at=(event.create_time or datetime.now(UTC)),
                data=event.payload,
            )
        )
