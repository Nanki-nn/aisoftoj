from pathlib import Path
from uuid import uuid4

import pytest

from aisoftoj_ai.clients.storage import LocalStorage
from aisoftoj_ai.rag.models import Chunk
from aisoftoj_ai.rag.tasks import ingest_file_task


class FakeRedis:
    def __init__(self):
        self.values = {}

    async def hset(self, key, field, value):
        self.values.setdefault(key, {})[field] = value

    async def hgetall(self, key):
        return self.values.get(key, {})

    async def expire(self, key, seconds):
        return True


class FailingMineru:
    async def submit_file(self, file_path, options):
        raise RuntimeError("MinerU unavailable")


class Pipeline:
    chunk_size = 800
    chunk_overlap = 120

    def __init__(self, storage_dir, mineru=None):
        self.storage = LocalStorage(str(storage_dir), "http://storage")
        self.mineru = mineru

    async def index_blocks(
        self,
        blocks,
        knowledge_base_id,
        document_id,
        version,
        chunk_size,
        chunk_overlap,
        on_stage=None,
    ):
        if on_stage:
            await on_stage("embedding")
            await on_stage("indexing")
        return [
            Chunk(
                id=f"chunk-{index}",
                knowledge_base_id=knowledge_base_id,
                document_id=document_id,
                version=version,
                content=block.content,
                content_type=block.content_type,
            )
            for index, block in enumerate(blocks, start=1)
        ]


def _test_directory() -> Path:
    directory = Path("data/test-runtime") / str(uuid4())
    directory.mkdir(parents=True, exist_ok=True)
    return directory


async def test_ingest_file_task_persists_artifacts_after_success():
    directory = _test_directory()
    source = directory / "document.md"
    source.write_text("# Knowledge\n\nProduction content.", encoding="utf-8")

    result = await ingest_file_task(
        {"pipeline": Pipeline(directory / "artifacts"), "redis": FakeRedis()},
        str(source),
        "kb-1",
        "doc-1",
        1,
    )

    assert result["chunkCount"] == 1
    assert (directory / "artifacts/documents/doc-1/1/document.md").exists()


async def test_ingest_file_task_keeps_source_for_retry_after_failure():
    directory = _test_directory()
    source = directory / "document.pdf"
    source.write_bytes(b"pdf")

    with pytest.raises(RuntimeError, match="MinerU unavailable"):
        await ingest_file_task(
            {
                "pipeline": Pipeline(directory / "artifacts", FailingMineru()),
                "redis": FakeRedis(),
            },
            str(source),
            "kb-1",
            "doc-1",
            1,
        )

    assert Path(source).exists()
