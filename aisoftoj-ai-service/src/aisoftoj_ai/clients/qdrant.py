from qdrant_client import AsyncQdrantClient, models

from aisoftoj_ai.rag.models import Chunk, SearchResult
from aisoftoj_ai.rag.sparse import sparse_vector


class QdrantStore:
    """封装 Qdrant 集合管理、写入与混合检索。"""
    def __init__(
        self,
        url: str,
        api_key: str,
        collection: str,
        embedding_dimension: int,
        upsert_max_bytes: int = 24 * 1024 * 1024,
        upsert_max_points: int = 128,
    ):
        """初始化 Qdrant 连接与集合元信息。"""
        self.client = AsyncQdrantClient(url=url, api_key=api_key or None)
        self.collection = collection
        self.embedding_dimension = embedding_dimension
        self.upsert_max_bytes = upsert_max_bytes
        self.upsert_max_points = upsert_max_points

    async def ensure_collection(self) -> None:
        """确保集合和常用 payload 索引已创建。"""
        if await self.client.collection_exists(self.collection):
            return
        await self.client.create_collection(
            collection_name=self.collection,
            vectors_config={
                "dense": models.VectorParams(
                    size=self.embedding_dimension,
                    distance=models.Distance.COSINE,
                )
            },
            sparse_vectors_config={
                "sparse": models.SparseVectorParams(modifier=models.Modifier.IDF)
            },
        )
        for field in ("knowledge_base_id", "document_id", "active", "content_type"):
            schema = (
                models.PayloadSchemaType.BOOL
                if field == "active"
                else models.PayloadSchemaType.KEYWORD
            )
            await self.client.create_payload_index(
                collection_name=self.collection,
                field_name=field,
                field_schema=schema,
            )

    async def upsert(
        self,
        chunks: list[Chunk],
        dense_vectors: list[list[float]],
    ) -> None:
        """写入分块向量及其 payload。"""
        batch: list[models.PointStruct] = []
        batch_bytes = 0
        for chunk, dense in zip(chunks, dense_vectors, strict=True):
            search_text = "\n".join([*chunk.heading_path, chunk.content])
            point = models.PointStruct(
                id=chunk.id,
                vector={"dense": dense, "sparse": sparse_vector(search_text)},
                payload=chunk.model_dump(),
            )
            point_bytes = len(point.model_dump_json(exclude_none=True).encode("utf-8"))
            if point_bytes > self.upsert_max_bytes:
                raise RuntimeError(
                    f"Qdrant point {chunk.id} is too large to index "
                    f"({point_bytes} bytes, limit {self.upsert_max_bytes})"
                )
            if batch and (
                len(batch) >= self.upsert_max_points
                or batch_bytes + point_bytes > self.upsert_max_bytes
            ):
                await self._upsert_batch(batch)
                batch = []
                batch_bytes = 0
            batch.append(point)
            batch_bytes += point_bytes

        if batch:
            await self._upsert_batch(batch)

    async def _upsert_batch(self, points: list[models.PointStruct]) -> None:
        await self.client.upsert(
            collection_name=self.collection,
            points=points,
            wait=True,
        )

    async def deactivate_old_versions(self, document_id: str, version: int) -> None:
        """将同一文档旧版本标记为非激活。"""
        await self.client.set_payload(
            collection_name=self.collection,
            payload={"active": False},
            points=models.Filter(
                must=[
                    models.FieldCondition(
                        key="document_id",
                        match=models.MatchValue(value=document_id),
                    )
                ],
                must_not=[
                    models.FieldCondition(
                        key="version",
                        match=models.MatchValue(value=version),
                    )
                ],
            ),
            wait=True,
        )

    async def delete_document(self, document_id: str) -> None:
        """按文档 ID 删除对应向量数据。"""
        if not await self.client.collection_exists(self.collection):
            return
        await self.client.delete(
            collection_name=self.collection,
            points_selector=models.FilterSelector(
                filter=models.Filter(
                    must=[
                        models.FieldCondition(
                            key="document_id",
                            match=models.MatchValue(value=document_id),
                        )
                    ]
                )
            ),
            wait=True,
        )

    async def delete_document_version(self, document_id: str, version: int) -> None:
        if not await self.client.collection_exists(self.collection):
            return
        await self.client.delete(
            collection_name=self.collection,
            points_selector=models.FilterSelector(
                filter=models.Filter(
                    must=[
                        models.FieldCondition(
                            key="document_id",
                            match=models.MatchValue(value=document_id),
                        ),
                        models.FieldCondition(
                            key="version",
                            match=models.MatchValue(value=version),
                        ),
                    ]
                )
            ),
            wait=True,
        )

    async def move_document(self, document_id: str, knowledge_base_id: str) -> None:
        if not await self.client.collection_exists(self.collection):
            return
        await self.client.set_payload(
            collection_name=self.collection,
            payload={"knowledge_base_id": knowledge_base_id},
            points=models.Filter(
                must=[
                    models.FieldCondition(
                        key="document_id",
                        match=models.MatchValue(value=document_id),
                    )
                ]
            ),
            wait=True,
        )

    async def list_chunks(self, document_id: str, limit: int = 100) -> list[dict]:
        """列出指定文档的所有 payload。"""
        if not await self.client.collection_exists(self.collection):
            return []
        points, _ = await self.client.scroll(
            collection_name=self.collection,
            scroll_filter=models.Filter(
                must=[
                    models.FieldCondition(
                        key="document_id",
                        match=models.MatchValue(value=document_id),
                    )
                ]
            ),
            limit=limit,
            with_payload=True,
            with_vectors=False,
        )
        return [point.payload or {} for point in points]

    async def search(
        self,
        query: str,
        dense_vector: list[float],
        knowledge_base_ids: list[str],
        limit: int,
    ) -> list[SearchResult]:
        """使用 dense + sparse RRF 执行混合检索。"""
        if not await self.client.collection_exists(self.collection):
            return []
        filters = [
            models.FieldCondition(key="active", match=models.MatchValue(value=True)),
            models.FieldCondition(
                key="knowledge_base_id",
                match=models.MatchAny(any=knowledge_base_ids),
            ),
        ]
        response = await self.client.query_points(
            collection_name=self.collection,
            prefetch=[
                models.Prefetch(query=dense_vector, using="dense", limit=limit),
                models.Prefetch(query=sparse_vector(query), using="sparse", limit=limit),
            ],
            query=models.RrfQuery(rrf=models.Rrf()),
            query_filter=models.Filter(must=filters),
            limit=limit,
            with_payload=True,
        )
        results: list[SearchResult] = []
        for point in response.points:
            payload = point.payload or {}
            results.append(
                SearchResult(
                    id=str(point.id),
                    content=payload.get("content", ""),
                    score=float(point.score or 0),
                    document_id=payload.get("document_id"),
                    title=(payload.get("heading_path") or [None])[-1],
                    heading_path=payload.get("heading_path", []),
                    page=payload.get("page"),
                    asset_url=payload.get("asset_url"),
                )
            )
        return results
