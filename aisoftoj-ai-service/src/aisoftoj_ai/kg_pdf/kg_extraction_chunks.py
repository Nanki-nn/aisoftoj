import hashlib
import re

from aisoftoj_ai.kg_pdf.models import KgBlockBinding, KgExtractionChunk


def build_kg_extraction_chunks(
    document_id: str,
    bindings: list[KgBlockBinding],
    max_group_chars: int = 2400,
) -> list[KgExtractionChunk]:
    """Create structure-bound KG chunks from natural paragraph groups."""
    chunks: list[KgExtractionChunk] = []
    pending: list[tuple[str, int | None, str]] = []
    pending_heading_id = ""
    pending_heading_path: list[str] = []

    def flush() -> None:
        nonlocal pending, pending_heading_id, pending_heading_path
        if not pending:
            return
        text = "\n\n".join(part for part, _, _ in pending if part.strip()).strip()
        pages = [page for _, page, _ in pending if page is not None]
        page_start = min(pages) if pages else None
        page_end = max(pages) if pages else None
        index = len(chunks) + 1
        chunk_id = _chunk_id(document_id, page_start, index, text)
        chunks.append(
            KgExtractionChunk(
                document_id=document_id,
                kg_chunk_id=chunk_id,
                source_page_range=_page_range(page_start, page_end),
                page_start=page_start,
                page_end=page_end,
                heading_path=list(pending_heading_path),
                parent_heading_id=pending_heading_id,
                text=text,
            )
        )
        pending = []

    for binding in bindings:
        block = binding.block
        paragraphs = _paragraphs(_format_block_text(binding))
        if not paragraphs:
            continue
        if pending and binding.parent_heading_id != pending_heading_id:
            flush()
        if not pending:
            pending_heading_id = binding.parent_heading_id
            pending_heading_path = list(binding.heading_path)

        for paragraph in paragraphs:
            current_length = sum(len(part) for part, _, _ in pending)
            if pending and current_length + len(paragraph) > max_group_chars:
                flush()
                pending_heading_id = binding.parent_heading_id
                pending_heading_path = list(binding.heading_path)
            pending.append((paragraph, block.page, block.content_type))

    flush()
    _attach_neighbor_summaries(chunks)
    return chunks


def _format_block_text(binding: KgBlockBinding) -> str:
    block = binding.block
    text = block.content.strip()
    if block.content_type == "table":
        return f"表格：{text}"
    if block.content_type == "formula":
        return f"公式：{text}"
    if block.content_type == "image":
        caption = text or block.asset_url or "image"
        return f"图片：{caption}"
    if block.content_type == "caption":
        return f"图注：{text}"
    if block.content_type == "footnote":
        return f"脚注：{text}"
    return text


def _paragraphs(text: str) -> list[str]:
    return [part.strip() for part in re.split(r"\n\s*\n+", text) if part.strip()]


def _chunk_id(document_id: str, page_start: int | None, index: int, text: str) -> str:
    digest = hashlib.sha1(f"{document_id}|{index}|{text}".encode()).hexdigest()[:8]
    page = page_start if page_start is not None else "unknown"
    return f"kg_chunk_page_{page}_{index:03d}_{digest}"


def _page_range(start: int | None, end: int | None) -> str:
    if start is None and end is None:
        return ""
    if start == end or end is None:
        return str(start)
    if start is None:
        return str(end)
    return f"{start}-{end}"


def _attach_neighbor_summaries(chunks: list[KgExtractionChunk]) -> None:
    summaries = [_summary(chunk.text) for chunk in chunks]
    for index, chunk in enumerate(chunks):
        chunk.previous_context_summary = summaries[index - 1] if index > 0 else ""
        chunk.next_context_summary = summaries[index + 1] if index + 1 < len(chunks) else ""


def _summary(text: str, limit: int = 160) -> str:
    compact = re.sub(r"\s+", " ", text).strip()
    if len(compact) <= limit:
        return compact
    return compact[:limit].rstrip() + "..."
