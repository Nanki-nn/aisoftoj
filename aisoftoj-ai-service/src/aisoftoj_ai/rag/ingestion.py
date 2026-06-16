import mimetypes
from collections.abc import Awaitable, Callable
from pathlib import Path

from aisoftoj_ai.clients.mineru import Mineru
from aisoftoj_ai.clients.qdrant import QdrantStore
from aisoftoj_ai.clients.storage import LocalStorage
from aisoftoj_ai.clients.vllm import VllmEmbedding
from aisoftoj_ai.rag.chunking import split_blocks
from aisoftoj_ai.rag.models import Chunk, DocumentBlock


class IngestionPipeline:
    """文档入库管道：解析、存储资源、切块、向量化并写入 Qdrant。"""
    def __init__(
        self,
        mineru: Mineru,
        store: QdrantStore,
        embedding: VllmEmbedding,
        storage: LocalStorage,
        chunk_size: int,
        chunk_overlap: int,
    ):
        """保存 MinerU、Qdrant、Embedding 和存储组件。"""
        self.mineru = mineru
        self.store = store
        self.embedding = embedding
        self.storage = storage
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap

    async def ingest_file(
        self,
        file_path: str,
        knowledge_base_id: str,
        document_id: str,
        version: int,
    ) -> int:
        """通过 MinerU 解析本地文件并完成索引。"""
        raise RuntimeError("Use the recoverable MinerU task flow")

    async def ingest_url(
        self,
        url: str,
        knowledge_base_id: str,
        document_id: str,
        version: int,
    ) -> int:
        """通过 MinerU 解析远程 URL 并完成索引。"""
        blocks = await self.mineru.parse_url(url)
        chunks = await self.index_blocks(blocks, knowledge_base_id, document_id, version)
        return len(chunks)

    async def index_blocks(
        self,
        blocks: list[DocumentBlock],
        knowledge_base_id: str,
        document_id: str,
        version: int,
        chunk_size: int | None = None,
        chunk_overlap: int | None = None,
        on_stage: Callable[[str], Awaitable[None]] | None = None,
    ) -> list[Chunk]:
        """统一执行资源存储、切块、向量化和入库。"""
        await self._store_assets(blocks, document_id, version)
        chunks = split_blocks(
            blocks,
            knowledge_base_id=knowledge_base_id,
            document_id=document_id,
            version=version,
            chunk_size=chunk_size or self.chunk_size,
            overlap=self.chunk_overlap if chunk_overlap is None else chunk_overlap,
        )
        if not chunks:
            raise RuntimeError("Document produced no chunks")
        if on_stage:
            await on_stage("embedding")
        vectors = await self._embed(chunks)
        await self.store.ensure_collection()
        if on_stage:
            await on_stage("indexing")
        await self.store.upsert(chunks, vectors)
        await self.store.deactivate_old_versions(document_id, version)
        return chunks

    async def _store_assets(
        self,
        blocks: list[DocumentBlock],
        document_id: str,
        version: int,
    ) -> None:
        """上传切块中的本地图片资源并替换为可访问 URL。"""
        for index, block in enumerate(blocks):
            if not block.asset_url:
                continue
            if block.asset_url.startswith("data:"):
                media_type = block.asset_url.split(";", 1)[0].split(":", 1)[-1]
                suffix = mimetypes.guess_extension(media_type) or ".bin"
                key = f"documents/{document_id}/{version}/images/{index}{suffix}"
                block.asset_url = await self.storage.write_data_url(block.asset_url, key)
                continue
            path = Path(block.asset_url)
            if not path.exists():
                continue
            suffix = path.suffix or ".png"
            key = f"documents/{document_id}/{version}/{index}{suffix}"
            block.asset_url = await self.storage.upload(str(path), key)

    async def _embed(self, chunks: list[Chunk]) -> list[list[float]]:
        """根据块类型生成文本或图片向量。"""
        vectors: list[list[float] | None] = [None] * len(chunks)
        text_indexes = [
            index
            for index, chunk in enumerate(chunks)
            if chunk.content_type != "image" or not chunk.asset_url
        ]
        if text_indexes:
            texts = [
                "\n".join([*chunks[index].heading_path, chunks[index].content])
                for index in text_indexes
            ]
            embedded = await self.embedding.embed_texts(texts)
            for index, vector in zip(text_indexes, embedded, strict=True):
                vectors[index] = vector

        for index, chunk in enumerate(chunks):
            if vectors[index] is None:
                vectors[index] = await self.embedding.embed_image(
                    await self.storage.as_data_url(chunk.asset_url or ""),
                    "\n".join([*chunk.heading_path, chunk.content]),
                )
        return [vector for vector in vectors if vector is not None]
