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
    """Merge adjacent text blocks before applying the requested sliding window."""
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=overlap,
        separators=["\n\n", "\n", "。", "！", "？", "；", "，", " ", ""],
        keep_separator="end",
    )
    markdown_splitter = MarkdownHeaderTextSplitter(
        headers_to_split_on=HEADERS,
        strip_headers=True,
    )

    normalized_blocks: list[DocumentBlock] = []
    for block in blocks:
        if block.content_type != "text" or block.heading_path:
            normalized_blocks.append(block)
            continue

        documents = markdown_splitter.split_text(block.content)
        for document in documents:
            heading_path = [
                document.metadata[key]
                for key in (f"h{level}" for level in range(1, 7))
                if key in document.metadata
            ]
            normalized_blocks.append(
                block.model_copy(
                    update={
                        "content": document.page_content,
                        "heading_path": heading_path,
                    }
                )
            )

    chunks: list[Chunk] = []
    for block in _merge_adjacent_text_blocks(normalized_blocks):
        if block.content_type == "text":
            chunks.extend(
                _split_text_block(
                    block,
                    text_splitter,
                    knowledge_base_id,
                    document_id,
                    version,
                )
            )
        else:
            chunks.append(_make_chunk(block, knowledge_base_id, document_id, version))

    return [chunk for chunk in chunks if chunk.content.strip() or chunk.asset_url]


def _merge_adjacent_text_blocks(blocks: list[DocumentBlock]) -> list[DocumentBlock]:
    """Use non-text blocks and heading changes as semantic merge boundaries."""
    merged: list[DocumentBlock] = []
    pending: DocumentBlock | None = None

    for block in blocks:
        if block.content_type != "text":
            if pending is not None:
                merged.append(pending)
                pending = None
            merged.append(block)
            continue

        content = block.content.strip()
        if not content:
            continue
        if pending is None or pending.heading_path != block.heading_path:
            if pending is not None:
                merged.append(pending)
            pending = block.model_copy(update={"content": content})
            continue

        same_box = pending.page == block.page and pending.bbox == block.bbox
        pending = pending.model_copy(
            update={
                "content": f"{pending.content.rstrip()}\n\n{content}",
                "bbox": pending.bbox if same_box else None,
            }
        )

    if pending is not None:
        merged.append(pending)
    return merged


def _split_text_block(
    block: DocumentBlock,
    splitter: RecursiveCharacterTextSplitter,
    knowledge_base_id: str,
    document_id: str,
    version: int,
) -> list[Chunk]:
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
    raw_id = "|".join(
        [
            document_id,
            str(version),
            "/".join(block.heading_path),
            str(block.page),
            str(block.bbox),
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
