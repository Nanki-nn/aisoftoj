from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass, field
from pathlib import Path


class SkillConfigError(RuntimeError):
    """Raised when a repository-bundled Skill is unsafe or malformed."""


@dataclass(frozen=True, slots=True)
class Skill:
    name: str
    description: str
    license: str | None
    category: str
    enabled: bool
    skill_file: Path
    content: str
    resources: Mapping[str, str] = field(default_factory=dict)
