from __future__ import annotations

from langchain_core.tools import BaseTool

from ...integrations.aisoftoj.client import PlatformClient
from .papers import build_list_papers_tool
from .practice_history import build_list_practice_history_tool
from .profile import build_get_my_profile_tool
from .questions import build_get_question_tool
from .wrong_questions import build_review_wrong_question_tool

PLATFORM_TOOL_NAMES = frozenset(
    {
        "get_my_profile",
        "list_papers",
        "get_question",
        "review_wrong_question",
        "list_practice_history",
    }
)
SKILL_TOOL_NAMES = frozenset({"describe_skill", "load_skill"})
AGENT_TOOL_NAMES = PLATFORM_TOOL_NAMES | SKILL_TOOL_NAMES


def build_platform_tools(client: PlatformClient) -> list[BaseTool]:
    return [
        build_get_my_profile_tool(client),
        build_list_papers_tool(client),
        build_get_question_tool(client),
        build_review_wrong_question_tool(client),
        build_list_practice_history_tool(client),
    ]


def build_agent_tools(
    client: PlatformClient, skill_tools: list[BaseTool]
) -> list[BaseTool]:
    tools = [*build_platform_tools(client), *skill_tools]
    names = [tool.name for tool in tools]
    if len(names) != len(set(names)) or set(names) != AGENT_TOOL_NAMES:
        raise ValueError("agent tool set must contain the expected seven read-only tools")
    return tools


__all__ = [
    "AGENT_TOOL_NAMES",
    "PLATFORM_TOOL_NAMES",
    "SKILL_TOOL_NAMES",
    "build_agent_tools",
    "build_platform_tools",
]
