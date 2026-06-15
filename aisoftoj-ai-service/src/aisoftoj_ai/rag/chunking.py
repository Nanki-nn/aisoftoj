import hashlib
import uuid

from langchain_text_splitters import (
    MarkdownHeaderTextSplitter,
    RecursiveCharacterTextSplitter,
)

from aisoftoj_ai.rag.models import Chunk, DocumentBlock

HEADERS = [(f"{'#' * level}", f"h{level}") for level in range(1, 7)]


def split_blocks(
    blocks: list[DocumentBlock],
    knowledge_base_id: str,
    document_id: str,
    version: int,
    chunk_size: int = 600,
    overlap: int = 100,
) -> list[Chunk]:
    """按标题感知和字符窗口切分文档块，保留元数据供 embedding 使用。"""
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=overlap,
        separators=["\n\n", "\n", "。", "；", "，", " ", ""],
        keep_separator="end",
    )
    markdown_splitter = MarkdownHeaderTextSplitter(
        headers_to_split_on=HEADERS,
        strip_headers=True,
    )
    chunks: list[Chunk] = []

    for block in blocks:
        if block.content_type != "text":
            chunks.append(_make_chunk(block, knowledge_base_id, document_id, version))
            continue

        if block.heading_path:
            chunks.extend(
                _split_text_block(
                    block,
                    text_splitter,
                    knowledge_base_id,
                    document_id,
                    version,
                )
            )
            continue

        documents = markdown_splitter.split_text(block.content)
        for document in documents:
            heading_path = [
                document.metadata[key]
                for key in (f"h{level}" for level in range(1, 7))
                if key in document.metadata
            ]
            markdown_block = block.model_copy(
                update={
                    "content": document.page_content,
                    "heading_path": heading_path,
                }
            )
            chunks.extend(
                _split_text_block(
                    markdown_block,
                    text_splitter,
                    knowledge_base_id,
                    document_id,
                    version,
                )
            )

    return [chunk for chunk in chunks if chunk.content.strip() or chunk.asset_url]


def _split_text_block(
    block: DocumentBlock,
    splitter: RecursiveCharacterTextSplitter,
    knowledge_base_id: str,
    document_id: str,
    version: int,
) -> list[Chunk]:
    """对文本块进行递归切分，生成 Chunk。"""
    return [
        _make_chunk(
            block.model_copy(update={"content": text}),
            knowledge_base_id,
            document_id,
            version,
        )
        for text in splitter.split_text(block.content)
        if text.strip()
    ]


def _make_chunk(
    block: DocumentBlock,
    knowledge_base_id: str,
    document_id: str,
    version: int,
) -> Chunk:
    """根据文档位置和内容生成稳定的 Chunk ID。"""
    raw_id = "|".join(
        [
            document_id,
            str(version),
            "/".join(block.heading_path),
            str(block.page),
            block.content,
            block.asset_url or "",
        ]
    )
    digest = hashlib.sha256(raw_id.encode()).hexdigest()[:32]
    return Chunk(
        id=str(uuid.UUID(hex=digest)),
        knowledge_base_id=knowledge_base_id,
        document_id=document_id,
        version=version,
        content=block.content,
        content_type=block.content_type,
        heading_path=block.heading_path,
        page=block.page,
        bbox=block.bbox,
        asset_url=block.asset_url,
    )
