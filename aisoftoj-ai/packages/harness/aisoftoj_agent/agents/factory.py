from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from deepagents import (
    GeneralPurposeSubagentProfile,
    HarnessProfile,
    create_deep_agent,
    register_harness_profile,
)
from deepagents.backends import StateBackend
from langchain_core.language_models import BaseChatModel
from langchain_core.tools import BaseTool
from langgraph.checkpoint.memory import InMemorySaver

from config import Settings

from ..integrations.aisoftoj.client import PlatformClient
from ..quota import DailyTokenQuotaService
from ..skills import SkillRegistry
from .context import AgentContext
from .middlewares import build_middlewares
from .models import build_chat_model
from .prompt import SYSTEM_PROMPT
from .tools import build_agent_tools

EXCLUDED_TOOLS = frozenset(
    {"ls", "read_file", "write_file", "edit_file", "delete", "glob", "grep", "execute", "task"}
)


@dataclass(frozen=True, slots=True)
class AgentGraph:
    graph: Any
    checkpointer: InMemorySaver
    skill_registry: SkillRegistry


def register_read_only_harness_profile() -> None:
    register_harness_profile(
        "openai",
        HarnessProfile(
            excluded_tools=EXCLUDED_TOOLS,
            general_purpose_subagent=GeneralPurposeSubagentProfile(enabled=False),
        ),
    )


def build_agent_graph(
    settings: Settings,
    platform_client: PlatformClient,
    *,
    skill_registry: SkillRegistry,
    skill_tools: list[BaseTool],
    quota_service: DailyTokenQuotaService | None = None,
    model: BaseChatModel | None = None,
) -> AgentGraph:
    register_read_only_harness_profile()
    checkpointer = InMemorySaver()
    graph = create_deep_agent(
        model=model or build_chat_model(settings),
        tools=build_agent_tools(platform_client, skill_tools),
        system_prompt=SYSTEM_PROMPT,
        middleware=build_middlewares(
            settings, skill_registry, platform_client, quota_service
        ),
        subagents=[],
        skills=None,
        memory=None,
        backend=StateBackend(),
        context_schema=AgentContext,
        checkpointer=checkpointer,
        name="aisoftoj-assistant",
    )
    return AgentGraph(
        graph=graph,
        checkpointer=checkpointer,
        skill_registry=skill_registry,
    )
