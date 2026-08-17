from __future__ import annotations

from langchain_core.tools import BaseTool

from ...integrations.aisoftoj.client import PlatformClient
from .papers import build_list_papers_tool
from .practice_history import build_list_practice_history_tool
from .profile import build_get_my_profile_tool
from .questions import build_get_question_tool
from .wrong_questions import build_review_wrong_question_tool


def build_platform_tools(client: PlatformClient) -> list[BaseTool]:
    return [
        build_get_my_profile_tool(client),
        build_list_papers_tool(client),
        build_get_question_tool(client),
        build_review_wrong_question_tool(client),
        build_list_practice_history_tool(client),
    ]


__all__ = ["build_platform_tools"]
