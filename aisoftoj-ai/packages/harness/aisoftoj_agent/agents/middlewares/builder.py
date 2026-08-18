from __future__ import annotations

from typing import Any

from langchain.agents.middleware import AgentMiddleware

from config import Settings

from .loop_detection import LoopDetectionMiddleware
from .persistent_summary import PersistentSummaryMiddleware
from .token_budget import TokenBudgetMiddleware
from .tool_audit import ToolAuditMiddleware
from .tool_errors import ToolErrorMiddleware
from .tool_events import ToolEventMiddleware
from .tool_policy import ToolPolicyMiddleware


def build_middlewares(settings: Settings) -> list[AgentMiddleware[Any, Any, Any]]:
    return [
        PersistentSummaryMiddleware(),
        TokenBudgetMiddleware(settings.agent_max_run_tokens),
        ToolAuditMiddleware(),
        ToolEventMiddleware(),
        ToolPolicyMiddleware(),
        ToolErrorMiddleware(),
        LoopDetectionMiddleware(settings.agent_loop_hard_repetitions),
    ]
