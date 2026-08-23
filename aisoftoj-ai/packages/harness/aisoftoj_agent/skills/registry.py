from __future__ import annotations

from collections.abc import Iterable
from dataclasses import replace
from html import escape
from pathlib import Path
from types import MappingProxyType

from .parser import parse_skill_file
from .types import Skill, SkillConfigError


class SkillRegistry:
    """Validated, process-level snapshot of repository-bundled Skills."""

    def __init__(self, skills: Iterable[Skill], *, max_index_chars: int) -> None:
        indexed: dict[str, Skill] = {}
        for skill in skills:
            if skill.name in indexed:
                raise SkillConfigError(f"duplicate Skill name: {skill.name}")
            indexed[skill.name] = skill
        ordered = dict(sorted(indexed.items()))
        index_text = "\n".join(
            f"- {skill.name}: {skill.description}" for skill in ordered.values()
        )
        if len(escape(index_text)) > max_index_chars:
            raise SkillConfigError("Skill metadata index exceeds size limit")
        self._skills = MappingProxyType(ordered)
        self._index_text = index_text

    @classmethod
    def from_directory(
        cls,
        root: Path,
        *,
        max_file_bytes: int,
        max_count: int,
        max_index_chars: int,
        max_resources_per_skill: int = 100,
        max_total_resource_bytes: int = 2 * 1024 * 1024,
    ) -> SkillRegistry:
        if root.is_symlink() or not root.exists() or not root.is_dir():
            raise SkillConfigError("configured Skill root is missing or invalid")
        try:
            resolved_root = root.resolve(strict=True)
            entries = sorted(root.iterdir(), key=lambda item: item.name)
        except OSError:
            raise SkillConfigError("configured Skill root cannot be read") from None
        if len(entries) > max_count:
            raise SkillConfigError("Skill count exceeds configured limit")

        skills: list[Skill] = []
        for directory in entries:
            if directory.is_symlink() or not directory.is_dir() or directory.name.startswith("."):
                raise SkillConfigError(f"invalid entry in Skill root: {directory.name}")
            _ensure_within_root(directory, resolved_root, directory.name)
            skill_file = directory / "SKILL.md"
            if skill_file.is_symlink():
                raise SkillConfigError(f"Skill file cannot be a symbolic link: {directory.name}")
            _ensure_within_root(skill_file, resolved_root, directory.name)
            skill = parse_skill_file(
                skill_file,
                expected_name=directory.name,
                max_file_bytes=max_file_bytes,
            )
            resources = _snapshot_resources(
                directory,
                resolved_root=resolved_root,
                parsed_skill_content=skill.content,
                max_file_bytes=max_file_bytes,
                max_resources=max_resources_per_skill,
                max_total_bytes=max_total_resource_bytes,
            )
            skills.append(replace(skill, resources=MappingProxyType(resources)))
        return cls(skills, max_index_chars=max_index_chars)

    @classmethod
    def empty(cls, *, max_index_chars: int = 1) -> SkillRegistry:
        return cls((), max_index_chars=max_index_chars)

    @property
    def index_text(self) -> str:
        return self._index_text

    def list_all(self) -> tuple[Skill, ...]:
        return tuple(self._skills.values())

    def get(self, name: str) -> Skill | None:
        return self._skills.get(name.strip())

    def read_content(self, name: str) -> str | None:
        skill = self.get(name)
        return skill.content if skill is not None else None

    def resource_paths(self, name: str) -> tuple[str, ...]:
        skill = self.get(name)
        return tuple(skill.resources) if skill is not None else ()

    def read_resource(self, name: str, path: str) -> str | None:
        skill = self.get(name)
        return skill.resources.get(path) if skill is not None else None

    def search(self, query: str, *, limit: int = 5) -> tuple[Skill, ...]:
        normalized = query.strip().casefold()
        if not normalized or limit <= 0:
            return ()
        ranked: list[tuple[int, str, Skill]] = []
        for skill in self._skills.values():
            name = skill.name.casefold()
            description = skill.description.casefold()
            if normalized == name:
                score = 0
            elif name.startswith(normalized):
                score = 1
            elif normalized in name:
                score = 2
            elif normalized in description:
                score = 3
            else:
                continue
            ranked.append((score, skill.name, skill))
        ranked.sort(key=lambda item: (item[0], item[1]))
        return tuple(item[2] for item in ranked[:limit])


def _ensure_within_root(path: Path, root: Path, label: str) -> None:
    try:
        path.resolve(strict=True).relative_to(root)
    except (OSError, ValueError):
        raise SkillConfigError(f"Skill path is invalid or outside its root: {label}") from None


def is_valid_skill_resource_path(value: str) -> bool:
    if not value or len(value) > 512 or value.startswith("/") or value.endswith("/"):
        return False
    if "\\" in value or ":" in value or "\x00" in value:
        return False
    if any(ord(character) < 32 or ord(character) == 127 for character in value):
        return False
    return all(part not in {"", ".", ".."} for part in value.split("/"))


def _snapshot_resources(
    directory: Path,
    *,
    resolved_root: Path,
    parsed_skill_content: str,
    max_file_bytes: int,
    max_resources: int,
    max_total_bytes: int,
) -> dict[str, str]:
    if max_resources <= 0 or max_total_bytes <= 0:
        raise SkillConfigError("Skill resource limits must be positive")
    try:
        resolved_directory = directory.resolve(strict=True)
        entries = sorted(directory.rglob("*"), key=lambda item: item.as_posix())
    except OSError:
        raise SkillConfigError(f"unable to scan Skill resources: {directory.name}") from None

    resources: dict[str, str] = {}
    folded_paths: set[str] = set()
    total_bytes = 0
    for entry in entries:
        if entry.is_symlink():
            raise SkillConfigError(f"Skill resource cannot be a symbolic link: {directory.name}")
        if entry.is_dir():
            continue
        if not entry.is_file():
            raise SkillConfigError(f"invalid Skill resource: {directory.name}")
        _ensure_within_root(entry, resolved_root, directory.name)
        try:
            resolved_entry = entry.resolve(strict=True)
            relative_path = resolved_entry.relative_to(resolved_directory).as_posix()
            raw = entry.read_bytes()
        except (OSError, ValueError):
            raise SkillConfigError(f"invalid Skill resource: {directory.name}") from None
        if not is_valid_skill_resource_path(relative_path):
            raise SkillConfigError(f"Skill resource path is invalid: {directory.name}")
        folded_path = relative_path.casefold()
        if folded_path in folded_paths:
            raise SkillConfigError(f"Skill resource paths collide: {directory.name}")
        folded_paths.add(folded_path)
        if len(resources) >= max_resources:
            raise SkillConfigError(f"Skill resource count exceeds limit: {directory.name}")
        if len(raw) > max_file_bytes:
            raise SkillConfigError(f"Skill resource exceeds size limit: {directory.name}")
        total_bytes += len(raw)
        if total_bytes > max_total_bytes:
            raise SkillConfigError(f"Skill resources exceed total size limit: {directory.name}")
        try:
            text = raw.decode("utf-8")
        except UnicodeDecodeError:
            raise SkillConfigError(f"Skill resource is not valid UTF-8: {directory.name}") from None
        resources[relative_path] = parsed_skill_content if relative_path == "SKILL.md" else text

    if "SKILL.md" not in resources:
        raise SkillConfigError(f"invalid Skill file: {directory.name}")
    return dict(sorted(resources.items()))
