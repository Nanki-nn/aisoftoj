from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path
from types import SimpleNamespace
from typing import Any
from unittest.mock import AsyncMock

from langchain_core.messages import AIMessage, AIMessageChunk, HumanMessage

from packages.harness.aisoftoj_agent.agents.context import AgentContext
from packages.harness.aisoftoj_agent.runtime.worker import (
    Worker,
    _message_text,
    current_activated_skill,
)
from packages.harness.aisoftoj_agent.skills import CURRENT_INPUT_KEY, Skill, SkillRegistry


class FakeGraph:
    def __init__(self) -> None:
        self.kwargs: dict[str, object] = {}

    async def astream(self, *_args: object, **_kwargs: object):
        self.kwargs = _kwargs
        metadata = {"langgraph_node": "model"}
        yield "messages", (AIMessageChunk(content="我先读取练习记录。"), metadata)
        yield "messages", (
            AIMessageChunk(
                content="",
                tool_call_chunks=[{
                    "name": "list_practice_history",
                    "args": "{}",
                    "id": "call-1",
                    "index": 0,
                    "type": "tool_call_chunk",
                }],
            ),
            metadata,
        )
        yield "values", {
            "messages": [AIMessage(
                content="我先读取练习记录。",
                tool_calls=[{
                    "name": "list_practice_history",
                    "args": {},
                    "id": "call-1",
                    "type": "tool_call",
                }],
            )]
        }
        yield "messages", (AIMessageChunk(content="内部节点文字"), {"langgraph_node": "tools"})
        yield "messages", (
            AIMessageChunk(
                content=[
                    {"type": "reasoning", "reasoning": "隐藏推理"},
                    {"type": "text", "text": "## 今日安排\n\n- 复习错题"},
                ],
                additional_kwargs={"reasoning_content": "也不能输出"},
            ),
            metadata,
        )
        yield "values", {"messages": [AIMessage(content="## 今日安排\n\n- 复习错题")]}


class RecordingTracing:
    def __init__(self) -> None:
        self.calls: list[dict[str, object]] = []

    @contextmanager
    def trace_run(self, **metadata: object) -> Iterator[dict[str, Any]]:
        self.calls.append(metadata)
        yield {
            "run_name": "aisoftoj-agent-run",
            "tags": ["environment:test"],
            "metadata": metadata,
        }


async def test_worker_separates_tool_preamble_from_final_markdown() -> None:
    worker = Worker(
        session_factory=object(),  # type: ignore[arg-type]
        agent=SimpleNamespace(graph=FakeGraph()),  # type: ignore[arg-type]
        stream_bridge=object(),  # type: ignore[arg-type]
        max_run_seconds=30,
    )
    worker._load_run_context = AsyncMock(return_value=(None, "input-1"))  # type: ignore[method-assign]
    worker._load_messages = AsyncMock(return_value=[])  # type: ignore[method-assign]
    worker._transition_and_event = AsyncMock()  # type: ignore[method-assign]
    worker._append_event = AsyncMock()  # type: ignore[method-assign]
    worker._publish_delta = AsyncMock()  # type: ignore[method-assign]
    worker._complete = AsyncMock()  # type: ignore[method-assign]
    context = AgentContext(
        user_id=1,
        username="tester",
        nickname=None,
        thread_id="thread-1",
        run_id="run-1",
        bearer_token="secret",
    )

    await worker._execute("run-1", context)

    worker._append_event.assert_any_await(
        "run-1",
        "process.note",
        {"text": "我先读取练习记录。"},
    )
    worker._complete.assert_awaited_once_with(
        "run-1",
        "thread-1",
        "## 今日安排\n\n- 复习错题",
    )
    streamed = "".join(call.args[1] for call in worker._publish_delta.await_args_list)
    assert streamed == "我先读取练习记录。## 今日安排\n\n- 复习错题"
    assert "内部节点文字" not in streamed
    assert "隐藏推理" not in streamed


async def test_worker_passes_business_metadata_to_root_trace() -> None:
    tracing = RecordingTracing()
    graph = FakeGraph()
    worker = Worker(
        session_factory=object(),  # type: ignore[arg-type]
        agent=SimpleNamespace(graph=graph),  # type: ignore[arg-type]
        stream_bridge=object(),  # type: ignore[arg-type]
        max_run_seconds=30,
        tracing=tracing,  # type: ignore[arg-type]
        model_name="test-model",
    )
    worker._load_run_context = AsyncMock(return_value=(123, "input-1"))  # type: ignore[method-assign]
    worker._load_messages = AsyncMock(return_value=[])  # type: ignore[method-assign]
    worker._transition_and_event = AsyncMock()  # type: ignore[method-assign]
    worker._append_event = AsyncMock()  # type: ignore[method-assign]
    worker._publish_delta = AsyncMock()  # type: ignore[method-assign]
    worker._complete = AsyncMock()  # type: ignore[method-assign]
    context = AgentContext(
        user_id=1,
        username="tester",
        nickname=None,
        thread_id="thread-1",
        run_id="run-1",
        bearer_token="secret",
    )

    await worker._execute("run-1", context)

    assert tracing.calls == [{
        "run_id": "run-1",
        "thread_id": "thread-1",
        "user_id": 1,
        "question_id": 123,
        "model": "test-model",
    }]
    config = graph.kwargs["config"]
    assert isinstance(config, dict)
    assert config["run_name"] == "aisoftoj-agent-run"
    assert config["configurable"] == {"thread_id": "run-1"}
    assert config["metadata"]["question_id"] == 123


def test_message_text_excludes_provider_reasoning_blocks() -> None:
    message = AIMessage(
        content=[
            {"type": "thinking", "thinking": "private"},
            {"type": "text", "text": "visible"},
        ],
        additional_kwargs={"reasoning_content": "also private"},
    )

    assert _message_text(message) == "visible"


def test_current_activated_skill_uses_only_enabled_skill_on_current_input(
    tmp_path: Path,
) -> None:
    skill = Skill(
        name="essay-writing-coach",
        description="论文写作辅导",
        license="internal",
        category="public",
        enabled=True,
        skill_file=tmp_path / "essay-writing-coach" / "SKILL.md",
        content="# 论文写作辅导",
    )
    registry = SkillRegistry([skill], max_index_chars=1000)
    messages = [
        HumanMessage(id="old", content="/essay-writing-coach 历史消息"),
        HumanMessage(
            id="current",
            content="/essay-writing-coach 架构师论文怎么写",
            additional_kwargs={CURRENT_INPUT_KEY: True},
        ),
    ]

    assert current_activated_skill(messages, registry) is skill
