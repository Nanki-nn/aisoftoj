from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

ENV_FILE = Path(__file__).resolve().parents[2] / ".env"


class Settings(BaseSettings):
    """从 .env 和环境变量加载知构 AI 服务配置。"""
    model_config = SettingsConfigDict(env_file=ENV_FILE, extra="ignore")

    ai_service_host: str = "0.0.0.0"
    ai_service_port: int = 8090
    cors_allowed_origins: str = (
        "http://localhost:3000,http://127.0.0.1:3000,"
        "http://localhost:5173,http://127.0.0.1:5173"
    )

    qdrant_url: str
    qdrant_api_key: str = ""
    qdrant_collection: str = "aisoftoj_knowledge"
    qdrant_upsert_max_bytes: int = 24 * 1024 * 1024
    qdrant_upsert_max_points: int = 128

    redis_url: str = "redis://localhost:6379/0"

    mineru_url: str
    mineru_poll_interval_seconds: float = 2.0
    mineru_task_timeout_seconds: int = 3600

    chat_base_url: str = "http://localhost:8001/v1"
    chat_api_key: str = "EMPTY"
    chat_model: str = "qwen3.6-27b"

    embedding_base_url: str = "http://localhost:8002/v1"
    embedding_api_key: str = "EMPTY"
    embedding_model: str = "qwen3-vl-embedding"
    embedding_dimension: int = 2048

    reranker_base_url: str = "http://localhost:8003"
    reranker_api_key: str = "EMPTY"
    reranker_model: str = "qwen3-reranker"
    reranker_path: str = "/rerank"

    searxng_url: str = "http://localhost:8088"

    local_storage_dir: str = "./data/assets"
    local_storage_base_url: str = "http://localhost:8090/assets"
    internal_callback_url: str = ""
    internal_callback_secret: str = ""
    internal_api_secret: str = ""

    chunk_size: int = 600
    chunk_overlap: int = 100
    retrieve_limit: int = 20
    rerank_limit: int = 8

    @property
    def allowed_origins(self) -> list[str]:
        """将 CORS 配置拆分为 FastAPI 所需的来源列表。"""
        return [origin.strip() for origin in self.cors_allowed_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    """缓存并返回 Settings 实例。"""
    return Settings()
