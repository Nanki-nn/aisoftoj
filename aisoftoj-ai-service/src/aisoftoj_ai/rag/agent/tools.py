from langchain_core.tools import tool

from aisoftoj_ai.clients.searxng import Searxng
from aisoftoj_ai.rag.retrieval import HybridSearch


def build_tools(search: HybridSearch, searxng: Searxng):
    """构造知识库检索和联网搜索工具。"""
    @tool("检索知识库", description="从指定知识库检索与问题相关的内容")
    async def search_knowledge_base(query: str, knowledge_base_ids: list[str]):
        """调用知识库检索工具。"""
        return await search.search(query, knowledge_base_ids)

    @tool("搜索互联网", description="当知识库资料不足时搜索互联网补充公开资料")
    async def search_web(query: str):
        """调用联网搜索工具补充公开资料。"""
        return await searxng.search(query)

    return search_knowledge_base, search_web
