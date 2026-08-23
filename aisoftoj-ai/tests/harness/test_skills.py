from __future__ import annotations

from pathlib import Path

import pytest

from config import PROJECT_ROOT
from packages.harness.aisoftoj_agent.skills import (
    Skill,
    SkillConfigError,
    SkillRegistry,
    build_skill_tools,
    is_valid_skill_resource_path,
    parse_slash_skill_name,
)


def write_skill(
    root: Path,
    name: str = "question-help",
    *,
    frontmatter_name: str | None = None,
    description: str = "讲解题目和考点。",
    content: str = "# 题目讲解\n\n先读取题目。",
) -> Path:
    directory = root / name
    directory.mkdir(parents=True)
    skill_file = directory / "SKILL.md"
    skill_file.write_text(
        "---\n"
        f"name: {frontmatter_name or name}\n"
        f"description: {description}\n"
        "license: internal\n"
        "---\n\n"
        f"{content}\n",
        encoding="utf-8",
    )
    return skill_file


def load_registry(root: Path, **overrides: int) -> SkillRegistry:
    return SkillRegistry.from_directory(
        root,
        max_file_bytes=overrides.get("max_file_bytes", 4096),
        max_count=overrides.get("max_count", 10),
        max_index_chars=overrides.get("max_index_chars", 2000),
        max_resources_per_skill=overrides.get("max_resources_per_skill", 100),
        max_total_resource_bytes=overrides.get("max_total_resource_bytes", 2 * 1024 * 1024),
    )


def test_registry_loads_sorted_snapshot_and_resources(tmp_path: Path) -> None:
    root = tmp_path / "skills"
    skill_file = write_skill(root)
    reference = skill_file.parent / "references" / "details.md"
    reference.parent.mkdir()
    reference.write_text("参考-v1", encoding="utf-8")
    registry = load_registry(root)

    skill = registry.get("question-help")
    assert skill is not None
    assert registry.search("考点") == (skill,)
    assert registry.resource_paths(skill.name) == (
        "SKILL.md",
        "references/details.md",
    )
    original = registry.read_content(skill.name)
    skill_file.write_text("changed", encoding="utf-8")
    reference.write_text("参考-v2", encoding="utf-8")
    assert registry.read_content(skill.name) == original
    assert registry.read_resource(skill.name, "references/details.md") == "参考-v1"


@pytest.mark.parametrize(
    ("name", "frontmatter_name"),
    [("UpperCase", None), ("bad_name", None), ("question-help", "different")],
)
def test_registry_rejects_invalid_names(
    tmp_path: Path, name: str, frontmatter_name: str | None
) -> None:
    root = tmp_path / "skills"
    write_skill(root, name, frontmatter_name=frontmatter_name)
    with pytest.raises(SkillConfigError):
        load_registry(root)


def test_registry_rejects_malformed_limits_and_hidden_root_entries(tmp_path: Path) -> None:
    with pytest.raises(SkillConfigError):
        load_registry(tmp_path / "missing")

    root = tmp_path / "duplicate"
    skill = write_skill(root)
    skill.write_text(
        "---\nname: question-help\nname: duplicate\ndescription: x\n---\nbody",
        encoding="utf-8",
    )
    with pytest.raises(SkillConfigError):
        load_registry(root)

    hidden_root = tmp_path / "hidden"
    hidden_root.mkdir()
    (hidden_root / ".DS_Store").write_text("x", encoding="utf-8")
    with pytest.raises(SkillConfigError):
        load_registry(hidden_root)

    size_root = tmp_path / "size"
    write_skill(size_root, content="x" * 200)
    with pytest.raises(SkillConfigError):
        load_registry(size_root, max_file_bytes=100)


def test_registry_rejects_utf8_count_total_and_casefold_collisions(tmp_path: Path) -> None:
    utf8_root = tmp_path / "utf8"
    skill_file = write_skill(utf8_root)
    binary = skill_file.parent / "binary.md"
    binary.write_bytes(b"\xff")
    with pytest.raises(SkillConfigError):
        load_registry(utf8_root)

    count_root = tmp_path / "count"
    count_file = write_skill(count_root)
    (count_file.parent / "extra.md").write_text("x", encoding="utf-8")
    with pytest.raises(SkillConfigError):
        load_registry(count_root, max_resources_per_skill=1)
    with pytest.raises(SkillConfigError):
        load_registry(count_root, max_total_resource_bytes=10)

    collision_root = tmp_path / "collision"
    collision_file = write_skill(collision_root)
    (collision_file.parent / "A.md").write_text("a", encoding="utf-8")
    (collision_file.parent / "a.md").write_text("b", encoding="utf-8")
    case_variants = [
        item for item in collision_file.parent.iterdir() if item.name.casefold() == "a.md"
    ]
    if len(case_variants) < 2:
        return
    with pytest.raises(SkillConfigError):
        load_registry(collision_root)


def test_registry_rejects_symbolic_links_when_supported(tmp_path: Path) -> None:
    root = tmp_path / "skills"
    root.mkdir()
    target = tmp_path / "target"
    write_skill(target, "linked")
    try:
        (root / "linked").symlink_to(target / "linked", target_is_directory=True)
    except OSError:
        pytest.skip("symbolic links unavailable")
    with pytest.raises(SkillConfigError):
        load_registry(root)


@pytest.mark.parametrize(
    "path",
    [
        "../secret.md",
        "references\\secret.md",
        "C:/secret.md",
        "/absolute.md",
        "references//details.md",
        "references/./details.md",
        "references/details.md/",
        "references/\x00details.md",
        "x" * 513,
    ],
)
def test_resource_path_validation(path: str) -> None:
    assert is_valid_skill_resource_path(path) is False


def test_skill_tools_use_uniform_pagination_and_stable_errors(tmp_path: Path) -> None:
    root = tmp_path / "skills"
    skill_file = write_skill(root, content="abcdef")
    reference = skill_file.parent / "details.md"
    reference.write_text("uvwxyz", encoding="utf-8")
    describe, load = build_skill_tools(load_registry(root), read_max_chars=4)

    found = describe.invoke({"query": "考点"})
    assert found["status"] == "success"
    assert found["items"][0]["name"] == "question-help"
    assert describe.invoke({"query": "missing"})["next"] is None

    main = load.invoke({"name": "question-help", "limit": 99})
    explicit_main = load.invoke({"name": "question-help", "path": "SKILL.md", "limit": 99})
    assert main["skill"]["content"] == explicit_main["skill"]["content"] == "abcd"
    assert main["skill"]["path"] is None
    assert main["skill"]["next_offset"] == 4
    assert main["skill"]["resources"] == ["SKILL.md", "details.md"]

    eof = load.invoke({"name": "question-help", "offset": 999})
    assert eof["skill"]["content"] == ""
    assert eof["skill"]["next_offset"] is None
    assert eof["skill"]["truncated"] is False

    errors = [
        load.invoke({"name": "Bad"})["error_code"],
        load.invoke({"name": "missing"})["error_code"],
        load.invoke({"name": "question-help", "path": "../x"})["error_code"],
        load.invoke({"name": "question-help", "path": "missing.md"})["error_code"],
        load.invoke({"name": "question-help", "offset": True})["error_code"],
        load.invoke({"name": "question-help", "limit": 0})["error_code"],
        load.invoke({"name": "question-help", "limit": 2_147_483_648})["error_code"],
    ]
    assert errors == [
        "SKILL_NAME_INVALID",
        "SKILL_NOT_FOUND",
        "SKILL_PATH_INVALID",
        "SKILL_FILE_NOT_FOUND",
        "SKILL_READ_RANGE_INVALID",
        "SKILL_READ_RANGE_INVALID",
        "SKILL_READ_RANGE_INVALID",
    ]


@pytest.mark.parametrize(
    ("text", "expected"),
    [
        ("/question-explanation 讲讲这题", "question-explanation"),
        ("/question-explanation", "question-explanation"),
        (" /question-explanation", None),
        ("/Question-Explanation", None),
        ("/question_explanation", None),
    ],
)
def test_parse_slash_skill_name(text: str, expected: str | None) -> None:
    assert parse_slash_skill_name(text) == expected


def test_bundled_question_explanation_skill_is_loadable() -> None:
    registry = SkillRegistry.from_directory(
        PROJECT_ROOT / "skills" / "public",
        max_file_bytes=256 * 1024,
        max_count=100,
        max_index_chars=12_000,
    )
    skill = registry.get("question-explanation")
    assert skill is not None
    assert "get_question" in skill.content
    assert "不得声称某个选项一定正确" in skill.content


def test_registry_rejects_duplicate_objects(tmp_path: Path) -> None:
    skill = Skill(
        name="duplicate",
        description="duplicate",
        license=None,
        category="public",
        enabled=True,
        skill_file=tmp_path / "SKILL.md",
        content="body",
    )
    with pytest.raises(SkillConfigError):
        SkillRegistry([skill, skill], max_index_chars=100)
