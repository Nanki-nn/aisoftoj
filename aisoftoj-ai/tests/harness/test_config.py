from __future__ import annotations

from pathlib import Path

import pytest
from pydantic import ValidationError

from config import PROJECT_ROOT, Settings


def valid_settings() -> dict[str, object]:
    return {
        "database_url": "mysql+asyncmy://user:secret@127.0.0.1/aisoftoj",
        "platform_base_url": "http://127.0.0.1:8080",
        "platform_service_key": "service-secret",
        "llm_base_url": "https://gateway.example/v1",
        "llm_api_key": "llm-secret",
        "llm_default_model": "model-name",
    }


def test_secrets_are_redacted() -> None:
    settings = Settings.model_validate(valid_settings())

    rendered = repr(settings)

    assert "service-secret" not in rendered
    assert "llm-secret" not in rendered
    assert "mysql+asyncmy" not in rendered


def test_platform_must_be_loopback() -> None:
    payload = valid_settings()
    payload["platform_base_url"] = "https://platform.example"

    with pytest.raises(ValidationError):
        Settings.model_validate(payload)


def test_legacy_separate_database_is_rejected() -> None:
    payload = valid_settings()
    payload["database_url"] = (
        "mysql+asyncmy://user:secret@127.0.0.1/aisoftoj_ai"
    )

    with pytest.raises(ValidationError, match="aisoftoj database"):
        Settings.model_validate(payload)


def test_config_file_must_be_yaml(tmp_path: Path) -> None:
    path = tmp_path / "config.json"
    path.write_text("{}", encoding="utf-8")

    with pytest.raises(ValueError, match="YAML"):
        Settings.from_yaml(path)


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("skills_max_file_bytes", True),
        ("skills_max_count", 0),
        ("skills_max_index_chars", -1),
        ("skills_read_max_chars", False),
    ],
)
def test_skill_limits_are_strict_positive_integers(field: str, value: object) -> None:
    payload = valid_settings()
    payload[field] = value
    with pytest.raises(ValidationError):
        Settings.model_validate(payload)


@pytest.mark.parametrize("path", ["/tmp/skills", "../skills", "skills/../../outside"])
def test_skill_root_must_stay_inside_project(path: str) -> None:
    payload = valid_settings()
    payload["skills_root"] = path
    with pytest.raises(ValidationError, match="skills_root"):
        Settings.model_validate(payload)


def test_default_skill_root_is_project_relative() -> None:
    settings = Settings.model_validate(valid_settings())
    assert settings.resolved_skills_root == PROJECT_ROOT / "skills" / "public"


def test_textbook_rag_requires_an_explicit_download_host_allowlist() -> None:
    payload = valid_settings()
    payload["textbook_rag_enabled"] = True
    with pytest.raises(ValidationError, match="textbook_allowed_hosts"):
        Settings.model_validate(payload)


def test_textbook_rag_resolves_embedding_credentials_without_exposing_them() -> None:
    payload = valid_settings()
    payload.update(
        {
            "textbook_rag_enabled": True,
            "textbook_allowed_hosts": ["Download.Example.COM."],
            "textbook_embedding_api_key": "embedding-secret",
        }
    )
    settings = Settings.model_validate(payload)
    assert settings.textbook_allowed_hosts == ["download.example.com"]
    assert settings.resolved_textbook_embedding_api_key == "embedding-secret"
    assert "embedding-secret" not in repr(settings)
