from __future__ import annotations

import re
from pathlib import Path
from typing import Any

import yaml

from .types import Skill, SkillConfigError

_SKILL_NAME = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
_FRONTMATTER = re.compile(r"\A---\r?\n(.*?)\r?\n---(?:\r?\n|\Z)", re.DOTALL)
_ALLOWED_FIELDS = {"name", "description", "license"}


class _DuplicateKeyError(ValueError):
    pass


class _UniqueKeyLoader(yaml.SafeLoader):
    pass


def _construct_unique_mapping(
    loader: _UniqueKeyLoader, node: yaml.MappingNode, deep: bool = False
) -> dict[Any, Any]:
    mapping: dict[Any, Any] = {}
    for key_node, value_node in node.value:
        key = loader.construct_object(key_node, deep=deep)
        if key in mapping:
            raise _DuplicateKeyError(str(key))
        mapping[key] = loader.construct_object(value_node, deep=deep)
    return mapping


_UniqueKeyLoader.add_constructor(
    yaml.resolver.BaseResolver.DEFAULT_MAPPING_TAG,
    _construct_unique_mapping,
)


def parse_skill_file(skill_file: Path, *, expected_name: str, max_file_bytes: int) -> Skill:
    label = expected_name or "<unknown>"
    try:
        if skill_file.is_symlink() or not skill_file.is_file():
            raise SkillConfigError(f"invalid Skill file: {label}")
        raw = skill_file.read_bytes()
    except SkillConfigError:
        raise
    except OSError:
        raise SkillConfigError(f"unable to read Skill file: {label}") from None
    if len(raw) > max_file_bytes:
        raise SkillConfigError(f"Skill file exceeds size limit: {label}")
    try:
        text = raw.decode("utf-8")
    except UnicodeDecodeError:
        raise SkillConfigError(f"Skill file is not valid UTF-8: {label}") from None

    match = _FRONTMATTER.match(text)
    if match is None:
        raise SkillConfigError(f"Skill frontmatter is missing or malformed: {label}")
    try:
        metadata = yaml.load(match.group(1), Loader=_UniqueKeyLoader)
    except (_DuplicateKeyError, yaml.YAMLError):
        raise SkillConfigError(f"Skill frontmatter is invalid: {label}") from None
    if not isinstance(metadata, dict):
        raise SkillConfigError(f"Skill frontmatter must be an object: {label}")
    if set(metadata) - _ALLOWED_FIELDS:
        raise SkillConfigError(f"Skill frontmatter has unsupported fields: {label}")

    name = _required_text(metadata.get("name"), "name", label, max_length=64)
    if not _SKILL_NAME.fullmatch(name):
        raise SkillConfigError(f"Skill name is invalid: {label}")
    if name != expected_name:
        raise SkillConfigError(f"Skill name does not match its directory: {label}")
    description = _required_text(
        metadata.get("description"), "description", label, max_length=500
    )
    license_name = _optional_text(metadata.get("license"), "license", label, max_length=200)
    content = text[match.end() :].strip()
    if not content:
        raise SkillConfigError(f"Skill content must not be blank: {label}")
    return Skill(
        name=name,
        description=description,
        license=license_name,
        category="public",
        enabled=True,
        skill_file=skill_file.resolve(),
        content=content,
    )


def is_valid_skill_name(value: str) -> bool:
    return len(value) <= 64 and _SKILL_NAME.fullmatch(value) is not None


def _required_text(
    value: object, field: str, label: str, *, max_length: int
) -> str:
    if not isinstance(value, str):
        raise SkillConfigError(f"Skill {field} must be text: {label}")
    normalized = value.strip()
    if not normalized or len(normalized) > max_length or "\n" in normalized or "\r" in normalized:
        raise SkillConfigError(f"Skill {field} is invalid: {label}")
    return normalized


def _optional_text(
    value: object, field: str, label: str, *, max_length: int
) -> str | None:
    if value is None:
        return None
    return _required_text(value, field, label, max_length=max_length)
