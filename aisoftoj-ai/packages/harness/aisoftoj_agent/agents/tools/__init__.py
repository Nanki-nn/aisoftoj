from __future__ import annotations

from langchain_core.tools import BaseTool

from ...integrations.aisoftoj.client import PlatformClient
from .knowledge_search import KnowledgeSearch, build_search_knowledge_tool
from .papers import build_list_papers_tool
from .practice_history import build_list_practice_history_tool
from .profile import build_get_my_profile_tool
from .questions import build_get_question_tool
from .textbook_trace import TraceService, build_trace_question_to_textbook_tool
from .wrong_questions import build_review_wrong_question_tool

PLATFORM_TOOL_NAMES = frozenset(
    {
        "get_my_profile",
        "list_papers",
        "get_question",
        "review_wrong_question",
        "list_practice_history",
        "trace_question_to_textbook",
        "search_knowledge",
    }
)
SKILL_TOOL_NAMES = frozenset({"describe_skill", "load_skill"})
AGENT_TOOL_NAMES = PLATFORM_TOOL_NAMES | SKILL_TOOL_NAMES


def build_platform_tools(
    client: PlatformClient,
    textbook_trace_service: TraceService | None = None,
    knowledge_search_service: KnowledgeSearch | None = None,
) -> list[BaseTool]:
    return [
        build_get_my_profile_tool(client),
        build_list_papers_tool(client),
        build_get_question_tool(client),
        build_review_wrong_question_tool(client),
        build_list_practice_history_tool(client),
        build_trace_question_to_textbook_tool(textbook_trace_service),
        build_search_knowledge_tool(knowledge_search_service),
    ]


def build_agent_tools(
    client: PlatformClient,
    skill_tools: list[BaseTool],
    textbook_trace_service: TraceService | None = None,
    knowledge_search_service: KnowledgeSearch | None = None,
) -> list[BaseTool]:
    tools = [
        *build_platform_tools(client, textbook_trace_service, knowledge_search_service),
        *skill_tools,
    ]
    names = [tool.name for tool in tools]
    if len(names) != len(set(names)) or set(names) != AGENT_TOOL_NAMES:
        raise ValueError("agent tool set must contain the expected read-only tools")
    return tools


__all__ = [
    "AGENT_TOOL_NAMES",
    "PLATFORM_TOOL_NAMES",
    "SKILL_TOOL_NAMES",
    "build_agent_tools",
    "build_platform_tools",
]
