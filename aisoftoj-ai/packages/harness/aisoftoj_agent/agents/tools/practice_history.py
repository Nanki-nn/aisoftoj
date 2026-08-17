from __future__ import annotations

from typing import Annotated

from langchain.tools import ToolRuntime
from langchain_core.tools import BaseTool, tool
from pydantic import Field

from ...integrations.aisoftoj.client import PlatformClient
from ..context import AgentContext


def build_list_practice_history_tool(client: PlatformClient) -> BaseTool:
    @tool("list_practice_history")
    async def list_practice_history(
        runtime: ToolRuntime[AgentContext],
        page: Annotated[int, Field(ge=1)] = 1,
        page_size: Annotated[int, Field(ge=1, le=20)] = 10,
    ) -> dict[str, object]:
        """分页读取当前用户的练习历史和全量汇总。"""
        history = await client.list_practice_history(runtime.context.bearer_token, page, page_size)
        return history.model_dump(mode="json")

    return list_practice_history
