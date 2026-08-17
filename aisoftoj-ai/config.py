from __future__ import annotations

import os
from pathlib import Path
from typing import Any, Literal

import yaml
from pydantic import BaseModel, Field, HttpUrl, SecretStr, field_validator, model_validator


class Settings(BaseModel):
    database_url: SecretStr
    platform_base_url: HttpUrl = HttpUrl("http://127.0.0.1:8080")
    platform_service_key: SecretStr
    platform_connect_timeout_seconds: float = Field(default=2, gt=0)
    platform_read_timeout_seconds: float = Field(default=5, gt=0)
    platform_max_response_bytes: int = Field(default=2_097_152, gt=0)

    llm_base_url: HttpUrl
    llm_endpoint_mode: Literal["openai_base", "direct_endpoint"] = "openai_base"
    llm_api_key: SecretStr
    llm_default_model: str = Field(min_length=1)
    llm_request_timeout_seconds: float = Field(default=60, gt=0)
    llm_max_retries: int = Field(default=1, ge=0, le=3)

    agent_max_run_tokens: int = Field(default=32_000, gt=0)
    agent_max_run_seconds: int = Field(default=180, gt=0)
    agent_summary_trigger_tokens: int = Field(default=24_000, gt=0)
    agent_summary_keep_messages: int = Field(default=12, ge=2)
    agent_max_concurrent_runs: int = Field(default=4, ge=1)
    agent_max_user_concurrent_runs: int = Field(default=2, ge=1)
    agent_max_user_message_chars: int = Field(default=20_000, ge=1)
    agent_loop_warn_repetitions: int = Field(default=3, ge=2)
    agent_loop_hard_repetitions: int = Field(default=5, ge=3)
    shutdown_drain_seconds: int = Field(default=15, ge=0)

    host: str = "127.0.0.1"
    port: int = Field(default=8000, ge=1, le=65_535)
    log_level: str = "info"

    @field_validator("database_url")
    @classmethod
    def validate_database_url(cls, value: SecretStr) -> SecretStr:
        raw = value.get_secret_value()
        if not raw.startswith("mysql+asyncmy://"):
            raise ValueError("database_url must use mysql+asyncmy")
        database_name = raw.split("?", 1)[0].rstrip("/").rsplit("/", 1)[-1]
        if database_name != "aisoftoj_ai" and not database_name.startswith("aisoftoj_ai_test"):
            raise ValueError("database_url must target the aisoftoj_ai database")
        return value

    @field_validator("platform_base_url")
    @classmethod
    def validate_platform_base_url(cls, value: HttpUrl) -> HttpUrl:
        if value.host not in {"127.0.0.1", "localhost", "::1"}:
            raise ValueError("platform_base_url must use a loopback host")
        return value

    @model_validator(mode="after")
    def validate_limits(self) -> Settings:
        if self.agent_max_user_concurrent_runs > self.agent_max_concurrent_runs:
            raise ValueError("per-user concurrency cannot exceed global concurrency")
        if self.agent_loop_warn_repetitions >= self.agent_loop_hard_repetitions:
            raise ValueError("loop warning threshold must be below hard threshold")
        return self

    @classmethod
    def from_yaml(cls, path: str | Path) -> Settings:
        config_path = Path(path)
        if config_path.suffix not in {".yaml", ".yml"}:
            raise ValueError("configuration file must be YAML")
        with config_path.open("r", encoding="utf-8") as handle:
            payload: Any = yaml.safe_load(handle)
        if not isinstance(payload, dict):
            raise ValueError("configuration root must be an object")
        return cls.model_validate(payload)


def load_settings() -> Settings:
    path = os.environ.get("AGENT_CONFIG_FILE", "config.yaml")
    return Settings.from_yaml(path)
