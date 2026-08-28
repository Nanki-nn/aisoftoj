from __future__ import annotations

from fastapi import APIRouter

from app.dependencies import AiCurrentUser, Container
from packages.harness.aisoftoj_agent.contracts.api import SkillListResponse, SkillResponse

router = APIRouter(prefix="/api/ai/skills", tags=["skills"])


@router.get("", response_model=SkillListResponse)
async def list_skills(_user: AiCurrentUser, container: Container) -> SkillListResponse:
    items = [
        SkillResponse(
            name=skill.name,
            description=skill.description,
            category=skill.category,
            enabled=skill.enabled,
            license=skill.license,
        )
        for skill in container.skill_registry.list_all()
    ]
    return SkillListResponse(items=items, total=len(items))
