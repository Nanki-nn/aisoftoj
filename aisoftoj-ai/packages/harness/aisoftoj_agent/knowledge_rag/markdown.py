from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass
from uuid import NAMESPACE_URL, uuid5

from .models import KnowledgeChunk

_HEADING = re.compile(r"^(#{1,6})\s+(.+?)\s*$")
_PAGE_MARKER = re.compile(
    r"^<!--\s*(?:page_idx|page(?:\s+number)?)\s*[:=]\s*(\d+)\s*-->$",
    re.IGNORECASE,
)


def offset_page_markers(markdown: str, page_offset: int) -> str:
    """Adjust MinerU page markers after combining split PDF results."""
    if page_offset <= 0:
        return markdown
    marker = re.compile(
        r"^(?P<prefix><!--\s*(?:page_idx|page(?:\s+number)?)\s*[:=]\s*)(?P<value>\d+)(?P<suffix>\s*-->)$",
        re.IGNORECASE,
    )

    def replace(match: re.Match[str]) -> str:
        value = int(match.group("value")) + page_offset
        return f"{match.group('prefix')}{value}{match.group('suffix')}"

    return "\n".join(marker.sub(replace, line) for line in markdown.split("\n"))


@dataclass(frozen=True, slots=True)
class _Block:
    text: str
    page_start: int | None
    page_end: int | None


def build_markdown_chunks(
    markdown: str,
    *,
    document_id: str,
    index_version: str,
    title: str,
    target_chars: int,
    overlap_chars: int,
) -> list[KnowledgeChunk]:
    if overlap_chars >= target_chars:
        raise ValueError("knowledge chunk overlap must be below target size")
    chunks: list[KnowledgeChunk] = []
    ordinal = 0
    for heading_path, blocks in _sections(markdown):
        for block in _pack_blocks(blocks, target_chars, overlap_chars):
            ordinal += 1
            digest = hashlib.sha256(block.text.encode("utf-8")).hexdigest()
            chunks.append(
                KnowledgeChunk(
                    chunk_id=str(
                        uuid5(
                            NAMESPACE_URL,
                            f"aisoftoj:knowledge:{document_id}:{index_version}:{ordinal}:{digest}",
                        )
                    ),
                    document_id=document_id,
                    index_version=index_version,
                    title=title,
                    heading_path=heading_path,
                    ordinal=ordinal,
                    text=block.text,
                    page_start=block.page_start,
                    page_end=block.page_end,
                )
            )
    return chunks


def _sections(markdown: str) -> list[tuple[list[str], list[_Block]]]:
    path: list[str] = []
    blocks: list[_Block] = []
    lines: list[str] = []
    page_start: int | None = None
    page_end: int | None = None
    result: list[tuple[list[str], list[_Block]]] = []
    current_page: int | None = None

    def flush_block() -> None:
        nonlocal page_start, page_end
        text = _normalize_block(lines)
        if text:
            blocks.append(_Block(text, page_start, page_end))
        lines.clear()
        page_start = None
        page_end = None

    def flush_section() -> None:
        flush_block()
        if blocks:
            result.append((list(path), list(blocks)))
            blocks.clear()

    for raw_line in markdown.replace("\r\n", "\n").split("\n"):
        marker = _PAGE_MARKER.fullmatch(raw_line.strip())
        if marker:
            marker_value = int(marker.group(1))
            current_page = (
                marker_value + 1
                if "page_idx" in marker.group(0).lower()
                else marker_value
            )
            if lines and page_end is None:
                page_end = current_page - 1 if current_page > 1 else current_page
            continue
        heading = _HEADING.match(raw_line)
        if heading:
            flush_section()
            level = len(heading.group(1))
            path = path[: level - 1]
            path.append(heading.group(2).strip())
            continue
        if not raw_line.strip():
            flush_block()
            continue
        if page_start is None:
            page_start = current_page
        page_end = current_page
        lines.append(raw_line)
    flush_section()
    return result


def _normalize_block(lines: list[str]) -> str:
    if not lines:
        return ""
    stripped = [line.rstrip() for line in lines]
    is_table = any("|" in line for line in stripped) and any(
        line.strip().startswith("|")
        and set(
            line.replace("|", "").replace(":", "").replace("-", "").strip()
        )
        == set()
        for line in stripped
        if line.strip()
    )
    is_code = any(line.lstrip().startswith("```") for line in stripped)
    if is_table or is_code:
        return "\n".join(line.strip() for line in stripped).strip()
    return " ".join(" ".join(stripped).split())


def _pack_blocks(blocks: list[_Block], target_chars: int, overlap_chars: int) -> list[_Block]:
    result: list[_Block] = []
    current_text = ""
    current_start: int | None = None
    current_end: int | None = None
    for block in blocks:
        for fragment in _split_long_block(block, target_chars):
            if current_text and len(current_text) + len(fragment.text) + 1 > target_chars:
                result.append(_Block(current_text, current_start, current_end))
                suffix = current_text[-overlap_chars:].strip() if overlap_chars else ""
                current_text = suffix
                current_start = current_end
            current_text = (
                f"{current_text}\n{fragment.text}".strip()
                if current_text
                else fragment.text
            )
            current_start = _min_page(current_start, fragment.page_start)
            current_end = _max_page(current_end, fragment.page_end)
    if current_text:
        result.append(_Block(current_text, current_start, current_end))
    return result


def _split_long_block(block: _Block, target_chars: int) -> list[_Block]:
    result: list[_Block] = []
    value = block.text
    while len(value) > target_chars:
        cut = max(value.rfind("。", 0, target_chars + 1), value.rfind(". ", 0, target_chars + 1))
        cut = cut + 1 if cut >= target_chars // 2 else target_chars
        result.append(_Block(value[:cut].strip(), block.page_start, block.page_end))
        value = value[cut:].strip()
    if value:
        result.append(_Block(value, block.page_start, block.page_end))
    return result


def _min_page(left: int | None, right: int | None) -> int | None:
    return right if left is None else left if right is None else min(left, right)


def _max_page(left: int | None, right: int | None) -> int | None:
    return right if left is None else left if right is None else max(left, right)
