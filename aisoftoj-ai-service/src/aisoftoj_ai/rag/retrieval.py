from aisoftoj_ai.clients.qdrant import QdrantStore
from aisoftoj_ai.clients.reranker import Reranker
from aisoftoj_ai.clients.vllm import VllmEmbedding
from aisoftoj_ai.rag.models import SearchResult


class HybridSearch:
    """先召回再重排的混合检索器。"""
    def __init__(
        self,
        store: QdrantStore,
        embedding: VllmEmbedding,
        reranker: Reranker,
        retrieve_limit: int = 20,
        rerank_limit: int = 8,
    ):
        """保存检索依赖与阈值配置。"""
        self.store = store
        self.embedding = embedding
        self.reranker = reranker
        self.retrieve_limit = retrieve_limit
        self.rerank_limit = rerank_limit

    async def search(
        self,
        query: str,
        knowledge_base_ids: list[str],
        limit: int | None = None,
    ) -> list[SearchResult]:
        """先从 Qdrant 召回，再使用重排模型截取 Top 结果。"""
        if not knowledge_base_ids:
            return []
        dense = (await self.embedding.embed_texts([query]))[0]
        recalled = await self.store.search(
            query=query,
            dense_vector=dense,
            knowledge_base_ids=knowledge_base_ids,
            limit=self.retrieve_limit,
        )
        return await self.reranker.rerank(
            query,
            recalled,
            limit or self.rerank_limit,
        )
