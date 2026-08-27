from __future__ import annotations

import re
from pathlib import Path

import pytest
import yaml

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
    assert "优先以这两项可信数据为依据" in skill.content


def test_bundled_essay_writing_coach_is_discoverable_and_complete() -> None:
    registry = SkillRegistry.from_directory(
        PROJECT_ROOT / "skills" / "public",
        max_file_bytes=256 * 1024,
        max_count=100,
        max_index_chars=12_000,
    )
    skill = registry.get("essay-writing-coach")

    assert skill is not None
    assert skill.license == "internal"
    assert registry.search("论文审题")[0] == skill
    assert registry.search("软考论文摘要")[0] == skill
    assert registry.search("essay-writing-coach")[0] == skill
    assert registry.resource_paths(skill.name) == (
        "SKILL.md",
        "references/example-cards.md",
        "references/quality-checklist.md",
        "references/sources.md",
        "references/topic-patterns.md",
        "references/writing-framework.md",
    )
    assert "分阶段教练模式" in skill.content
    assert "直接产出模式" in skill.content
    assert "不得改变用户角色" in skill.content
    assert "references/example-cards.md" in skill.content
    assert "检查质量属性与技术机制的因果关系" in skill.content


def test_essay_example_cards_have_valid_sources_and_compact_original_structure() -> None:
    registry = SkillRegistry.from_directory(
        PROJECT_ROOT / "skills" / "public",
        max_file_bytes=256 * 1024,
        max_count=100,
        max_index_chars=12_000,
    )
    cards = registry.read_resource("essay-writing-coach", "references/example-cards.md")
    sources = registry.read_resource("essay-writing-coach", "references/sources.md")

    assert cards is not None
    assert sources is not None
    source_ids = set(re.findall(r"`([a-z][a-z0-9-]+-202608\d{2})`", sources))
    cards_list = cards.split("\n## 卡片：")[1:]
    assert len(cards_list) == 7
    for card in cards_list:
        card_ids = set(re.findall(r"`([a-z][a-z0-9-]+-202608\d{2})`", card))
        assert card_ids
        assert card_ids <= source_ids
        assert len(card) <= 1600
        assert not any(line.startswith(">") for line in card.splitlines())
        assert max(len(paragraph) for paragraph in card.split("\n\n")) <= 400
    assert "fangcai-five-part-20260825" not in cards
    assert "csdn-soa-partial-20260825" not in cards


def test_essay_writing_coach_eval_cases_cover_high_risk_contracts() -> None:
    fixture_path = PROJECT_ROOT / "tests" / "evals" / "essay-writing-coach" / "cases.yaml"
    payload = yaml.safe_load(fixture_path.read_text(encoding="utf-8"))
    cases = payload["cases"]

    assert payload["skill"] == "essay-writing-coach"
    assert {case["id"] for case in cases} == {
        "prompt-only",
        "complete-microservices-project",
        "direct-draft-without-metrics",
        "availability-review",
        "word-limit-conflict",
        "abstract-only",
        "readonly-boundary",
        "resource-fallback",
    }
    resource_paths = {
        path
        for case in cases
        for key in ("expected_resources", "optional_resources", "forbidden_resources")
        for path in case.get(key, [])
    }
    assert all(path.startswith("references/") for path in resource_paths)
    fallback = next(case for case in cases if case["id"] == "resource-fallback")
    assert fallback["simulated_error"] == {
        "path": "references/example-cards.md",
        "error_code": "SKILL_FILE_NOT_FOUND",
    }


def test_essay_writing_coach_forward_results_are_complete_and_traceable() -> None:
    eval_root = PROJECT_ROOT / "tests" / "evals" / "essay-writing-coach"
    verdicts = yaml.safe_load((eval_root / "verdicts.yaml").read_text(encoding="utf-8"))
    results = sorted((eval_root / "results").glob("*.md"))

    assert verdicts["method"] == "fresh-subagent-forward-test"
    assert len(verdicts["cases"]) == 8
    assert all(case["verdict"].startswith("pass") for case in verdicts["cases"])
    assert len(results) == 9
    for result in results:
        lines = result.read_text(encoding="utf-8").splitlines()
        assert lines[0].startswith("case_id: ")
        assert lines[1].startswith("resources_consulted: ")

    availability = (eval_root / "results" / "availability-review.md").read_text(encoding="utf-8")
    assert "references/topic-patterns.md" in availability.splitlines()[1]
    assert "references/quality-checklist.md" in availability.splitlines()[1]
    abstract = (eval_root / "results" / "abstract-only.md").read_text(encoding="utf-8")
    assert "example-cards.md" not in abstract.splitlines()[1]
    fallback_result = (eval_root / "results" / "resource-fallback.md").read_text(encoding="utf-8")
    assert "范文卡资源无法读取" in fallback_result
    assert "不会虚构" in fallback_result


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
