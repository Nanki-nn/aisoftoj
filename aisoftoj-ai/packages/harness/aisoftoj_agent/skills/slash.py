from __future__ import annotations

import re

_SLASH_SKILL = re.compile(r"^/([a-z0-9]+(?:-[a-z0-9]+)*)(?:\s+|$)")


def parse_slash_skill_name(text: str) -> str | None:
    match = _SLASH_SKILL.match(text)
    return match.group(1) if match is not None else None
