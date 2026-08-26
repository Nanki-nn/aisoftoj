from __future__ import annotations

import hashlib
import re
from collections import defaultdict
from uuid import NAMESPACE_URL, uuid5

from ..integrations.aisoftoj.models import TextbookCatalog, TextbookSection
from .models import PageText, TextbookChunk

_PARAGRAPH_BREAK = re.compile(r"\n\s*\n+")


def build_chunks(
    catalog: TextbookCatalog,
    pages: list[PageText],
    *,
    index_version: str,
    target_chars: int,
    overlap_chars: int,
) -> list[TextbookChunk]:
    if overlap_chars >= target_chars:
        raise ValueError("chunk overlap must be below target size")
    sections = {section.id: section for section in catalog.sections}
    paths = {section.id: _chapter_path(section, sections) for section in catalog.sections}
    grouped: dict[int, list[tuple[int, str]]] = defaultdict(list)
    for page in pages:
        section = _section_for_page(page.pdf_page, catalog.sections)
        if section is None:
            continue
        for paragraph in _paragraphs(page.text, target_chars):
            grouped[section.id].append((page.pdf_page, paragraph))

    chunks: list[TextbookChunk] = []
    for section in sorted(catalog.sections, key=lambda item: (item.sort_order, item.id)):
        fragments = grouped.get(section.id, [])
        for ordinal, (text, page_start, page_end) in enumerate(
            _pack_fragments(fragments, target_chars, overlap_chars), start=1
        ):
            printed_start = _printed_page(section, page_start)
            printed_end = _printed_page(section, page_end)
            digest = hashlib.sha256(text.encode("utf-8")).hexdigest()
            stable_id = str(
                uuid5(
                    NAMESPACE_URL,
                    f"aisoftoj:textbook:{catalog.textbook_id}:{index_version}:"
                    f"{section.id}:{ordinal}:{digest}",
                )
            )
            chunks.append(
                TextbookChunk(
                    chunk_id=stable_id,
                    textbook_id=catalog.textbook_id,
                    index_version=index_version,
                    section_id=section.id,
                    chapter_path=paths[section.id],
                    pdf_page_start=page_start,
                    pdf_page_end=page_end,
                    printed_page_start=printed_start,
                    printed_page_end=printed_end,
                    chunk_hash=digest,
                    text=text,
                )
            )
    return chunks


def _chapter_path(
    section: TextbookSection, sections: dict[int, TextbookSection]
) -> list[str]:
    path: list[str] = []
    current: TextbookSection | None = section
    visited: set[int] = set()
    while current is not None:
        if current.id in visited:
            raise ValueError("textbook section hierarchy contains a cycle")
        visited.add(current.id)
        label = f"{current.section_code} {current.title}".strip()
        path.append(label)
        current = sections.get(current.parent_id) if current.parent_id is not None else None
    return list(reversed(path))


def _section_for_page(
    pdf_page: int, sections: list[TextbookSection]
) -> TextbookSection | None:
    candidates = [
        section
        for section in sections
        if section.pdf_page_start <= pdf_page <= section.pdf_page_end
    ]
    if not candidates:
        return None
    return max(
        candidates,
        key=lambda item: (
            item.level,
            -(item.pdf_page_end - item.pdf_page_start),
            item.sort_order,
        ),
    )


def _paragraphs(text: str, target_chars: int) -> list[str]:
    compact = text.replace("\x00", "").strip()
    if not compact:
        return []
    result: list[str] = []
    for paragraph in _PARAGRAPH_BREAK.split(compact):
        value = " ".join(paragraph.split())
        while len(value) > target_chars:
            cut = value.rfind("。", 0, target_chars + 1)
            if cut < target_chars // 2:
                cut = target_chars
            else:
                cut += 1
            result.append(value[:cut].strip())
            value = value[cut:].strip()
        if value:
            result.append(value)
    return result


def _pack_fragments(
    fragments: list[tuple[int, str]], target_chars: int, overlap_chars: int
) -> list[tuple[str, int, int]]:
    result: list[tuple[str, int, int]] = []
    current: list[tuple[int, str]] = []
    current_length = 0
    for page, text in fragments:
        added = len(text) + (1 if current else 0)
        if current and current_length + added > target_chars:
            joined = "\n".join(item[1] for item in current)
            result.append((joined, current[0][0], current[-1][0]))
            available_overlap = max(0, target_chars - len(text) - 1)
            carry_chars = min(overlap_chars, available_overlap)
            suffix = joined[-carry_chars:].strip() if carry_chars else ""
            current = [(current[-1][0], suffix)] if suffix else []
            current_length = len(suffix)
        current.append((page, text))
        current_length += len(text) + (1 if len(current) > 1 else 0)
    if current:
        joined = "\n".join(item[1] for item in current)
        result.append((joined, current[0][0], current[-1][0]))
    return result


def _printed_page(section: TextbookSection, pdf_page: int) -> int:
    mapped = section.printed_page_start + (pdf_page - section.pdf_page_start)
    return max(section.printed_page_start, min(section.printed_page_end, mapped))
