from __future__ import annotations

from typing import Annotated

from langchain.tools import ToolRuntime
from langchain_core.tools import BaseTool, tool
from pydantic import Field

from ...integrations.aisoftoj.client import PlatformClient
from ..context import AgentContext


def build_get_question_tool(client: PlatformClient) -> BaseTool:
    @tool("get_question")
    async def get_question(
        question_id: Annotated[int, Field(gt=0)],
        runtime: ToolRuntime[AgentContext],
    ) -> dict[str, object]:
        """按题目 ID 读取题干、选项、题型、难度、标准答案和官方解析。"""
        question = await client.get_question(runtime.context.bearer_token, question_id)
        return question.model_dump(mode="json")

    return get_question
