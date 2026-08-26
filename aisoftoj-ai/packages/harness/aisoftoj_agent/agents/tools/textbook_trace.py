from __future__ import annotations

from typing import Annotated, Any, Protocol

from langchain.tools import ToolRuntime
from langchain_core.tools import BaseTool, tool
from pydantic import Field

from ..context import AgentContext


class TraceService(Protocol):
    async def trace(self, bearer_token: str, question_id: int) -> dict[str, Any]: ...


def build_trace_question_to_textbook_tool(service: TraceService | None) -> BaseTool:
    @tool("trace_question_to_textbook")
    async def trace_question_to_textbook(
        question_id: Annotated[int, Field(gt=0)],
        runtime: ToolRuntime[AgentContext],
    ) -> dict[str, Any]:
        """查找一道软考题对应的教材知识点、章节、页码和可验证短证据。"""
        if service is None:
            return {
                "status": "unavailable",
                "reason": "feature_disabled",
                "questionId": question_id,
                "cacheStatus": "bypass",
                "sources": [],
            }
        return await service.trace(runtime.context.bearer_token, question_id)

    return trace_question_to_textbook
