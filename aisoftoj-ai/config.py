from __future__ import annotations

import os
from pathlib import Path
from typing import Any, Literal

import yaml
from pydantic import (
    BaseModel,
    Field,
    HttpUrl,
    SecretStr,
    StrictInt,
    field_validator,
    model_validator,
)

PROJECT_ROOT = Path(__file__).resolve().parent


class Settings(BaseModel):
    database_url: SecretStr
    platform_base_url: HttpUrl = HttpUrl("http://127.0.0.1:8080")
    platform_service_key: SecretStr
    platform_connect_timeout_seconds: float = Field(default=2, gt=0)
    platform_read_timeout_seconds: float = Field(default=5, gt=0)
    platform_max_response_bytes: int = Field(default=2_097_152, gt=0)

    textbook_rag_enabled: bool = False
    qdrant_url: HttpUrl = HttpUrl("http://127.0.0.1:6333")
    qdrant_api_key: SecretStr | None = None
    qdrant_collection: str = Field(default="aisoftoj_textbook_chunks", min_length=1)
    textbook_allowed_hosts: list[str] = Field(default_factory=list)
    textbook_download_timeout_seconds: float = Field(default=30, gt=0)
    textbook_download_max_bytes: int = Field(default=100 * 1024 * 1024, gt=0)
    textbook_download_max_redirects: int = Field(default=3, ge=0, le=5)
    textbook_embedding_base_url: HttpUrl | None = None
    textbook_embedding_api_key: SecretStr | None = None
    textbook_embedding_model: str = Field(default="text-embedding-3-small", min_length=1)
    textbook_embedding_dimensions: int = Field(default=1536, gt=0)
    textbook_embedding_batch_size: int = Field(default=32, ge=1, le=256)
    textbook_chunk_target_chars: int = Field(default=900, ge=200, le=4000)
    textbook_chunk_overlap_chars: int = Field(default=120, ge=0, le=1000)
    textbook_retrieval_candidates: int = Field(default=12, ge=1, le=50)
    textbook_retrieval_sources: int = Field(default=3, ge=1, le=10)
    textbook_retrieval_min_score: float = Field(default=0.55, ge=0, le=1)
    textbook_retrieval_profile_version: str = Field(default="textbook-rag-v1", min_length=1)
    textbook_negative_cache_ttl_seconds: int = Field(default=3600, ge=60, le=604_800)

    knowledge_rag_enabled: bool = False
    knowledge_qdrant_collection: str = Field(default="aisoftoj_knowledge", min_length=1)
    knowledge_embedding_base_url: HttpUrl | None = None
    knowledge_embedding_api_key: SecretStr | None = None
    knowledge_embedding_model: str = Field(default="text-embedding-3-small", min_length=1)
    knowledge_embedding_dimensions: int = Field(default=1536, gt=0)
    knowledge_embedding_batch_size: int = Field(default=32, ge=1, le=256)
    knowledge_bm25_model: str = Field(default="Qdrant/bm25", min_length=1)
    knowledge_chunk_target_chars: int = Field(default=1_200, ge=200, le=8_000)
    knowledge_chunk_overlap_chars: int = Field(default=160, ge=0, le=2_000)
    knowledge_retrieval_candidates: int = Field(default=8, ge=1, le=30)
    knowledge_retrieval_min_score: float = Field(default=0, ge=0, le=1)
    knowledge_retrieval_query_variants: int = Field(default=3, ge=1, le=5)
    knowledge_retrieval_fusion_k: int = Field(default=60, ge=1, le=200)
    knowledge_mineru_poll_seconds: float = Field(default=3, ge=1, le=30)
    knowledge_mineru_max_wait_seconds: int = Field(default=1_800, ge=60, le=14_400)

    llm_base_url: HttpUrl
    llm_endpoint_mode: Literal["openai_base", "direct_endpoint"] = "openai_base"
    llm_api_key: SecretStr
    llm_default_model: str = Field(min_length=1)
    llm_request_timeout_seconds: float = Field(default=60, gt=0)
    llm_max_retries: int = Field(default=1, ge=0, le=3)

    mineru_api_key: SecretStr | None = None

    agent_max_run_tokens: int = Field(default=32_000, gt=0)
    agent_max_output_tokens: int = Field(default=2_048, gt=0)
    agent_quota_reservation_margin_percent: int = Field(default=10, ge=0, le=100)
    agent_max_run_seconds: int = Field(default=180, gt=0)
    agent_summary_trigger_tokens: int = Field(default=24_000, gt=0)
    agent_summary_keep_messages: int = Field(default=12, ge=2)
    agent_max_concurrent_runs: int = Field(default=4, ge=1)
    agent_max_user_concurrent_runs: int = Field(default=2, ge=1)
    agent_max_user_message_chars: int = Field(default=20_000, ge=1)
    agent_loop_warn_repetitions: int = Field(default=3, ge=2)
    agent_loop_hard_repetitions: int = Field(default=5, ge=3)
    shutdown_drain_seconds: int = Field(default=15, ge=0)

    skills_root: str = Field(default="skills/public", min_length=1)
    skills_max_file_bytes: StrictInt = Field(default=256 * 1024, gt=0)
    skills_max_count: StrictInt = Field(default=100, gt=0)
    skills_max_index_chars: StrictInt = Field(default=12_000, gt=0)
    skills_max_resources_per_skill: StrictInt = Field(default=100, gt=0)
    skills_max_total_resource_bytes: StrictInt = Field(default=2 * 1024 * 1024, gt=0)
    skills_read_max_chars: StrictInt = Field(default=20_000, gt=0)

    host: str = "127.0.0.1"
    port: int = Field(default=8000, ge=1, le=65_535)
    log_level: str = "info"
    rollout_allowed_user_ids: frozenset[int] = Field(default_factory=frozenset)

    @field_validator("database_url")
    @classmethod
    def validate_database_url(cls, value: SecretStr) -> SecretStr:
        raw = value.get_secret_value()
        if not raw.startswith("mysql+asyncmy://"):
            raise ValueError("database_url must use mysql+asyncmy")
        database_name = raw.split("?", 1)[0].rstrip("/").rsplit("/", 1)[-1]
        if database_name != "aisoftoj" and not database_name.startswith("aisoftoj_test"):
            raise ValueError("database_url must target the aisoftoj database")
        return value

    @field_validator("platform_base_url")
    @classmethod
    def validate_platform_base_url(cls, value: HttpUrl) -> HttpUrl:
        if value.host not in {"127.0.0.1", "localhost", "::1"}:
            raise ValueError("platform_base_url must use a loopback host")
        return value

    @field_validator("skills_root")
    @classmethod
    def validate_skills_root(cls, value: str) -> str:
        normalized = value.strip()
        path = Path(normalized)
        if not normalized or path.is_absolute() or ".." in path.parts:
            raise ValueError("skills_root must be a project-relative path")
        resolved = (PROJECT_ROOT / path).resolve()
        try:
            resolved.relative_to(PROJECT_ROOT.resolve())
        except ValueError:
            raise ValueError("skills_root must stay within the project root") from None
        return normalized

    @field_validator("textbook_allowed_hosts")
    @classmethod
    def validate_textbook_allowed_hosts(cls, value: list[str]) -> list[str]:
        normalized = sorted({host.strip().lower().rstrip(".") for host in value if host.strip()})
        if any("/" in host or ":" in host for host in normalized):
            raise ValueError("textbook_allowed_hosts must contain hostnames only")
        return normalized

    @model_validator(mode="after")
    def validate_limits(self) -> Settings:
        if self.agent_max_user_concurrent_runs > self.agent_max_concurrent_runs:
            raise ValueError("per-user concurrency cannot exceed global concurrency")
        if self.agent_loop_warn_repetitions >= self.agent_loop_hard_repetitions:
            raise ValueError("loop warning threshold must be below hard threshold")
        if self.textbook_chunk_overlap_chars >= self.textbook_chunk_target_chars:
            raise ValueError("textbook chunk overlap must be below target size")
        if self.textbook_retrieval_sources > self.textbook_retrieval_candidates:
            raise ValueError("textbook source count cannot exceed candidate count")
        if self.knowledge_chunk_overlap_chars >= self.knowledge_chunk_target_chars:
            raise ValueError("knowledge chunk overlap must be below target size")
        if self.textbook_rag_enabled and not self.textbook_allowed_hosts:
            raise ValueError("textbook_allowed_hosts is required when textbook RAG is enabled")
        if (
            self.textbook_rag_enabled
            and self.llm_endpoint_mode == "direct_endpoint"
            and self.textbook_embedding_base_url is None
        ):
            raise ValueError(
                "textbook_embedding_base_url is required with direct_endpoint mode"
            )
        if self.knowledge_rag_enabled and self.mineru_api_key is None:
            raise ValueError("mineru_api_key is required when knowledge RAG is enabled")
        if (
            self.knowledge_rag_enabled
            and self.llm_endpoint_mode == "direct_endpoint"
            and self.knowledge_embedding_base_url is None
        ):
            raise ValueError(
                "knowledge_embedding_base_url is required with direct_endpoint mode"
            )
        return self

    @field_validator("rollout_allowed_user_ids", mode="before")
    @classmethod
    def parse_rollout_allowed_user_ids(cls, value: object) -> object:
        if isinstance(value, str):
            if not value.strip():
                return frozenset()
            try:
                return frozenset(int(item.strip()) for item in value.split(","))
            except ValueError as exc:
                raise ValueError("rollout user ids must be comma-separated integers") from exc
        return value

    @property
    def resolved_textbook_embedding_base_url(self) -> str:
        value = self.textbook_embedding_base_url or self.llm_base_url
        return str(value).rstrip("/")

    @property
    def resolved_textbook_embedding_api_key(self) -> str:
        value = self.textbook_embedding_api_key or self.llm_api_key
        return value.get_secret_value()

    @property
    def resolved_knowledge_embedding_base_url(self) -> str:
        value = self.knowledge_embedding_base_url or self.llm_base_url
        return str(value).rstrip("/")

    @property
    def resolved_knowledge_embedding_api_key(self) -> str:
        if self.knowledge_embedding_api_key is None:
            return ""
        return self.knowledge_embedding_api_key.get_secret_value()

    @property
    def resolved_skills_root(self) -> Path:
        return PROJECT_ROOT / self.skills_root

    @classmethod
    def from_yaml(cls, path: str | Path) -> Settings:
        config_path = Path(path)
        if config_path.suffix not in {".yaml", ".yml"}:
            raise ValueError("configuration file must be YAML")
        with config_path.open("r", encoding="utf-8") as handle:
            payload: Any = yaml.safe_load(handle)
        if not isinstance(payload, dict):
            raise ValueError("configuration root must be an object")
        overrides = {
            "database_url": os.environ.get("AI_DATABASE_URL"),
            "platform_service_key": os.environ.get("AI_INTERNAL_SERVICE_KEY"),
            "llm_api_key": os.environ.get("LLM_API_KEY"),
            "mineru_api_key": os.environ.get("MINERU_API_KEY"),
            "rollout_allowed_user_ids": os.environ.get("AI_ROLLOUT_ALLOWED_USER_IDS"),
        }
        payload.update({key: value for key, value in overrides.items() if value is not None})
        return cls.model_validate(payload)


def load_settings() -> Settings:
    path = os.environ.get("AGENT_CONFIG_FILE", "config.yaml")
    return Settings.from_yaml(path)
