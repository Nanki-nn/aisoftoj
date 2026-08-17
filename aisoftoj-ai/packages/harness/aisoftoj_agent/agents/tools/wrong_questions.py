from __future__ import annotations

from typing import Annotated

from langchain.tools import ToolRuntime
from langchain_core.tools import BaseTool, tool
from pydantic import Field

from ...integrations.aisoftoj.client import PlatformClient
from ..context import AgentContext


def build_review_wrong_question_tool(client: PlatformClient) -> BaseTool:
    @tool("review_wrong_question")
    async def review_wrong_question(
        wrong_question_id: Annotated[int, Field(gt=0)],
        runtime: ToolRuntime[AgentContext],
    ) -> dict[str, object]:
        """复盘当前用户的一条错题记录，包含该次作答和标准答案。"""
        review = await client.review_wrong_question(runtime.context.bearer_token, wrong_question_id)
        return review.model_dump(mode="json")

    return review_wrong_question
