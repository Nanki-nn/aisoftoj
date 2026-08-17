from __future__ import annotations

from pathlib import Path

import pytest
from pydantic import ValidationError

from config import Settings


def valid_settings() -> dict[str, object]:
    return {
        "database_url": "mysql+asyncmy://user:secret@127.0.0.1/aisoftoj_ai",
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


def test_config_file_must_be_yaml(tmp_path: Path) -> None:
    path = tmp_path / "config.json"
    path.write_text("{}", encoding="utf-8")

    with pytest.raises(ValueError, match="YAML"):
        Settings.from_yaml(path)
