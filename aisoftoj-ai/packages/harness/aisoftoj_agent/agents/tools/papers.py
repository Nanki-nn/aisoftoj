from __future__ import annotations

from typing import Any, TypedDict

from langchain.tools import ToolRuntime
from langchain_core.tools import BaseTool, tool

from ...integrations.aisoftoj.client import PlatformClient
from ...integrations.aisoftoj.models import Paper
from ..context import AgentContext


class PaperListOutput(TypedDict):
    total: int
    records: list[dict[str, Any]]


def format_paper_list(papers: list[Paper]) -> PaperListOutput:
    records = [paper.model_dump(mode="json") for paper in papers]
    return {"total": len(records), "records": records}


def build_list_papers_tool(client: PlatformClient) -> BaseTool:
    @tool("list_papers")
    async def list_papers(runtime: ToolRuntime[AgentContext]) -> PaperListOutput:
        """列出已发布试卷、准确总数以及当前用户在每份试卷上的练习状态。"""
        papers = await client.list_papers(runtime.context.bearer_token)
        return format_paper_list(papers)

    return list_papers
