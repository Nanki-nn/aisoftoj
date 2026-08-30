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
        """检索管理员已导入的学习资料。

        当用户的问题涉及已上传的教材、讲义、课程资料或其具体表述时使用。
        传入贴近用户原意的完整问题或核心短句，不要只截取一个孤立词；服务端会自动
        生成关键词和术语变体并执行多路混合检索。结果会返回可用于回答的文档标题、
        章节、页码和原文片段。只能依据实际命中内容回答，不得补写未命中的资料内容。
        """
        del runtime
        if service is None:
            return {"status": "unavailable", "reason": "feature_disabled", "sources": []}
        return await service.search(query)

    return search_knowledge
