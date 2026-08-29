from __future__ import annotations

from typing import Any

from langchain.agents.middleware import AgentMiddleware

from config import Settings

from ...access_control import AiAccessControlService
from ...integrations.aisoftoj.client import PlatformClient
from ...quota import DailyTokenQuotaService
from ...skills import SkillRegistry
from .access_control import AccessControlMiddleware
from .current_time import CurrentTimeMiddleware
from .daily_token_quota import DailyTokenQuotaMiddleware
from .exam_access import ExamAccessMiddleware
from .loop_detection import LoopDetectionMiddleware
from .persistent_summary import PersistentSummaryMiddleware
from .skill_activation import SkillActivationMiddleware
from .token_budget import TokenBudgetMiddleware
from .tool_audit import ToolAuditMiddleware
from .tool_errors import ToolErrorMiddleware
from .tool_events import ToolEventMiddleware
from .tool_policy import ToolPolicyMiddleware


def build_middlewares(
    settings: Settings,
    skill_registry: SkillRegistry,
    platform_client: PlatformClient,
    quota_service: DailyTokenQuotaService | None = None,
    access_control_service: AiAccessControlService | None = None,
) -> list[AgentMiddleware[Any, Any, Any]]:
    middlewares: list[AgentMiddleware[Any, Any, Any]] = []
    if access_control_service is not None:
        middlewares.append(AccessControlMiddleware(access_control_service))
    middlewares.extend([
        CurrentTimeMiddleware(),
        ExamAccessMiddleware(platform_client),
        PersistentSummaryMiddleware(),
        SkillActivationMiddleware(skill_registry),
        TokenBudgetMiddleware(settings.agent_max_run_tokens),
    ])
    if quota_service is not None:
        middlewares.append(
            DailyTokenQuotaMiddleware(
                quota_service,
                max_output_tokens=settings.agent_max_output_tokens,
                reservation_margin_percent=settings.agent_quota_reservation_margin_percent,
            )
        )
    middlewares.extend(
        [
            ToolAuditMiddleware(),
            ToolEventMiddleware(),
            ToolPolicyMiddleware(),
            ToolErrorMiddleware(),
            LoopDetectionMiddleware(settings.agent_loop_hard_repetitions),
        ]
    )
    return middlewares
