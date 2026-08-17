from __future__ import annotations

from langchain.tools import ToolRuntime
from langchain_core.tools import BaseTool, tool

from ...integrations.aisoftoj.client import PlatformClient
from ..context import AgentContext


def build_get_my_profile_tool(client: PlatformClient) -> BaseTool:
    @tool("get_my_profile")
    async def get_my_profile(runtime: ToolRuntime[AgentContext]) -> dict[str, object]:
        """读取当前登录用户的基础资料和练习统计。"""
        profile = await client.get_profile(runtime.context.bearer_token)
        return profile.model_dump(mode="json")

    return get_my_profile
