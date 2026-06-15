from dataclasses import dataclass
from functools import lru_cache

from aisoftoj_ai.clients.mineru import Mineru
from aisoftoj_ai.clients.qdrant import QdrantStore
from aisoftoj_ai.clients.reranker import Reranker
from aisoftoj_ai.clients.searxng import Searxng
from aisoftoj_ai.clients.storage import LocalStorage
from aisoftoj_ai.clients.vllm import VllmChat, VllmEmbedding
from aisoftoj_ai.config import get_settings
from aisoftoj_ai.rag.ingestion import IngestionPipeline
from aisoftoj_ai.rag.retrieval import HybridSearch


@dataclass(frozen=True)
class Services:
    """应用共享组件。第一次调用 get_services 时创建所有 Client，之后复用。"""

    chat: VllmChat
    embedding: VllmEmbedding
    store: QdrantStore
    reranker: Reranker
    search: HybridSearch
    searxng: Searxng
    pipeline: IngestionPipeline


@lru_cache
def get_services() -> Services:
    """懒加载并缓存 AI 服务依赖。"""
    settings = get_settings()
    chat = VllmChat(settings.chat_base_url, settings.chat_api_key, settings.chat_model)
    embedding = VllmEmbedding(
        settings.embedding_base_url,
        settings.embedding_api_key,
        settings.embedding_model,
    )
    store = QdrantStore(
        settings.qdrant_url,
        settings.qdrant_api_key,
        settings.qdrant_collection,
        settings.embedding_dimension,
        settings.qdrant_upsert_max_bytes,
        settings.qdrant_upsert_max_points,
    )
    reranker = Reranker(
        settings.reranker_base_url,
        settings.reranker_path,
        settings.reranker_api_key,
        settings.reranker_model,
    )
    pipeline = IngestionPipeline(
        mineru=Mineru(
            settings.mineru_url,
            settings.mineru_poll_interval_seconds,
        ),
        store=store,
        embedding=embedding,
        storage=LocalStorage(
            settings.local_storage_dir,
            settings.local_storage_base_url,
        ),
        chunk_size=settings.chunk_size,
        chunk_overlap=settings.chunk_overlap,
    )
    return Services(
        chat=chat,
        embedding=embedding,
        store=store,
        reranker=reranker,
        search=HybridSearch(
            store,
            embedding,
            reranker,
            settings.retrieve_limit,
            settings.rerank_limit,
        ),
        searxng=Searxng(settings.searxng_url),
        pipeline=pipeline,
    )
