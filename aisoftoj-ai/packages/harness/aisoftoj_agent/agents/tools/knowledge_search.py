from __future__ import annotations

from typing import Annotated, Any, Protocol

from langchain.tools import ToolRuntime
from langchain_core.tools import BaseTool, tool
from pydantic import Field

from ..context import AgentContext


class KnowledgeSearch(Protocol):
    async def search(self, query: str) -> dict[str, Any]: ...


def build_search_knowledge_tool(service: KnowledgeSearch | None) -> BaseTool:
    @tool("search_knowledge")
    async def search_knowledge(
        query: Annotated[str, Field(min_length=1, max_length=2_000)],
        runtime: ToolRuntime[AgentContext],
    ) -> dict[str, Any]:
        """检索管理员已导入的知识库，返回可引用的文档段落和标题路径。"""
        del runtime
        if service is None:
            return {"status": "unavailable", "reason": "feature_disabled", "sources": []}
        return await service.search(query)

    return search_knowledge
