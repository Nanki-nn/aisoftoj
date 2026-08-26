from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import AsyncMock

from langchain_core.messages import AIMessage, AIMessageChunk

from packages.harness.aisoftoj_agent.agents.context import AgentContext
from packages.harness.aisoftoj_agent.runtime.worker import Worker, _message_text


class FakeGraph:
    async def astream(self, *_args: object, **_kwargs: object):
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


def test_message_text_excludes_provider_reasoning_blocks() -> None:
    message = AIMessage(
        content=[
            {"type": "thinking", "thinking": "private"},
            {"type": "text", "text": "visible"},
        ],
        additional_kwargs={"reasoning_content": "also private"},
    )

    assert _message_text(message) == "visible"
