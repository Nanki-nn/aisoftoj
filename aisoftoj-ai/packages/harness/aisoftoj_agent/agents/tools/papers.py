from __future__ import annotations

from langchain.tools import ToolRuntime
from langchain_core.tools import BaseTool, tool

from ...integrations.aisoftoj.client import PlatformClient
from ..context import AgentContext


def build_list_papers_tool(client: PlatformClient) -> BaseTool:
    @tool("list_papers")
    async def list_papers(runtime: ToolRuntime[AgentContext]) -> list[dict[str, object]]:
        """列出已发布试卷以及当前用户在每份试卷上的练习状态。"""
        papers = await client.list_papers(runtime.context.bearer_token)
        return [paper.model_dump(mode="json") for paper in papers]

    return list_papers
