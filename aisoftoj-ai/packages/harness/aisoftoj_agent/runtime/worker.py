from __future__ import annotations

import asyncio
from dataclasses import replace
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
from ..skills import CURRENT_INPUT_KEY
from .event_sequence import RunEventSequence
from .event_sink import RunEventSink, ToolEventPersistenceError
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
        self.event_sequence = RunEventSequence()
        self.max_run_seconds = max_run_seconds

    async def execute(self, run_id: str, context: AgentContext) -> None:
        await self._initialize_event_sequence(run_id)
        try:
            async with asyncio.timeout(self.max_run_seconds):
                await self._execute(run_id, context)
        except asyncio.CancelledError:
            await self._finish_failure(run_id, "cancelled", None)
            raise
        except TimeoutError:
            await self._finish_failure(run_id, "failed", "MODEL_TIMEOUT")
        except ToolEventPersistenceError:
            await self._finish_failure(run_id, "failed", "EVENT_PERSISTENCE_FAILED")
        except PlatformError as exc:
            await self._finish_failure(run_id, "failed", exc.code)
        except Exception:
            await self._finish_failure(run_id, "failed", "AGENT_FAILED")
        finally:
            await self.agent.checkpointer.adelete_thread(run_id)
            await self.stream_bridge.close(run_id)
            await self.event_sequence.close(run_id)

    async def _execute(self, run_id: str, context: AgentContext) -> None:
        question_id, input_message_id = await self._load_run_context(run_id)
        await self._transition_and_event(run_id, "running", "run.started", {})
        messages = await self._load_messages(
            context.thread_id, current_input_id=input_message_id
        )
        messages = with_current_question_context(messages, question_id)
        await self._append_event(run_id, "message.started", {"role": "assistant"})
        runtime_context = replace(
            context,
            question_id=question_id,
            event_sink=RunEventSink(
                self.session_factory,
                self.stream_bridge,
                self.event_sequence,
                run_id,
            ),
        )
        final_text = ""
        async for chunk in self.agent.graph.astream(
            {"messages": messages, "todos": [], "files": {}},
            context=runtime_context,
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
            await self._publish_delta(run_id, delta)
        await self._complete(run_id, context.thread_id, final_text)

    async def _load_question_id(self, run_id: str) -> int | None:
        question_id, _input_message_id = await self._load_run_context(run_id)
        return question_id

    async def _load_run_context(self, run_id: str) -> tuple[int | None, str]:
        async with self.session_factory() as session:
            run = await RunRepository(session).get(run_id)
            if run is None:
                raise LookupError("run not found")
            return run.question_id, run.input_message_id

    async def _initialize_event_sequence(self, run_id: str) -> None:
        async with self.session_factory() as session:
            persisted_sequence = await RunRepository(session).max_event_sequence(run_id)
        await self.event_sequence.initialize(run_id, persisted_sequence)

    async def _load_messages(
        self, thread_id: str, *, current_input_id: str | None = None
    ) -> list[BaseMessage]:
        async with self.session_factory() as session:
            summary = await SummaryRepository(session).get(thread_id)
            through = summary.summarized_through_sequence if summary is not None else 0
            stored = await MessageRepository(session).list_after(thread_id, through)
        messages: list[BaseMessage] = []
        if summary is not None:
            messages.append(SystemMessage(content=f"此前对话摘要：{summary.content}"))
        for item in stored:
            if item.role == "user":
                additional_kwargs = (
                    {CURRENT_INPUT_KEY: True} if item.id == current_input_id else {}
                )
                messages.append(
                    HumanMessage(
                        id=item.id,
                        content=item.content,
                        additional_kwargs=additional_kwargs,
                    )
                )
            else:
                messages.append(AIMessage(id=item.id, content=item.content))
        return messages

    async def _complete(self, run_id: str, thread_id: str, content: str) -> None:
        message_sequence = await self.event_sequence.next(run_id)
        run_sequence = await self.event_sequence.next(run_id)
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
                run_id,
                "message.completed",
                {"message_id": message.id},
                sequence=message_sequence,
            )
            run_event = await run_repository.append_event(
                run_id,
                "run.completed",
                {"status": "completed", "error_code": None},
                sequence=run_sequence,
            )
        await self._publish(message_event)
        await self._publish(run_event)

    async def _finish_failure(self, run_id: str, status: str, error_code: str | None) -> None:
        event: AiRunEvent | None = None
        sequence = await self.event_sequence.next(run_id)
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
                sequence=sequence,
            )
        if event is not None:
            await self._publish(event)

    async def _transition_and_event(
        self, run_id: str, status: str, event_type: str, payload: dict[str, Any]
    ) -> None:
        sequence = await self.event_sequence.next(run_id)
        async with self.session_factory.begin() as session:
            repository = RunRepository(session)
            run = await repository.get(run_id)
            if run is None:
                raise LookupError("run not found")
            await repository.transition(run, status)
            event = await repository.append_event(
                run_id, event_type, payload, sequence=sequence
            )
        await self._publish(event)

    async def _append_event(self, run_id: str, event_type: str, payload: dict[str, Any]) -> None:
        sequence = await self.event_sequence.next(run_id)
        async with self.session_factory.begin() as session:
            event = await RunRepository(session).append_event(
                run_id, event_type, payload, sequence=sequence
            )
        await self._publish(event)

    async def _publish_delta(self, run_id: str, delta: str) -> None:
        await self.stream_bridge.publish(
            PersistedEvent(
                run_id=run_id,
                sequence=await self.event_sequence.next(run_id),
                type="message.delta",
                created_at=datetime.now(UTC),
                data={"delta": delta},
            )
        )

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


def with_current_question_context(
    messages: list[BaseMessage], question_id: int | None
) -> list[BaseMessage]:
    if question_id is None:
        return messages
    instruction = SystemMessage(
        content=(
            f"可信页面上下文：用户发送本次消息时正在查看题目 ID {question_id}。"
            "当本次消息涉及‘这题’、‘当前题’、选项或题目讲解时，"
            f"必须先调用 get_question(question_id={question_id})，再依据工具结果回答。"
            "该 ID 只用于理解本次最新用户消息，不得重新解释更早消息中的指代。"
        )
    )
    result = list(messages)
    insert_at = len(result) - 1 if result and isinstance(result[-1], HumanMessage) else len(result)
    result.insert(insert_at, instruction)
    return result
