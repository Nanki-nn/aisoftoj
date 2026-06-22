import re
from pathlib import Path
from typing import Any

from aisoftoj_ai.kg_pdf.models import KgSourceBlock


def parse_content_list(content_list: list[dict[str, Any]]) -> list[KgSourceBlock]:
    """Convert MinerU content_list items into KG source blocks.

    This is a raw-parse adapter only. It does not consume or mimic RAG chunk
    boundaries.
    """
    blocks: list[KgSourceBlock] = []
    for item in content_list:
        if not isinstance(item, dict):
            continue
        content_type = str(item.get("type") or "text").lower()
        text = _item_text(item)
        page = _page_number(item)
        bbox = item.get("bbox") if isinstance(item.get("bbox"), list) else None
        asset_url = _asset_url(item)

        if _is_heading(item, content_type):
            title = text.strip()
            if not title:
                continue
            blocks.append(
                KgSourceBlock(
                    content=title,
                    content_type="text",
                    page=page,
                    bbox=bbox,
                    asset_url=asset_url,
                    heading_level=_heading_level(item),
                    heading_title=title,
                )
            )
            continue

        mapped_type = {
            "table": "table",
            "equation": "formula",
            "formula": "formula",
            "image": "image",
            "figure": "image",
            "caption": "caption",
            "footnote": "footnote",
        }.get(content_type, "text")
        if text.strip() or asset_url:
            blocks.append(
                KgSourceBlock(
                    content=text.strip(),
                    content_type=mapped_type,
                    page=page,
                    bbox=bbox,
                    asset_url=asset_url,
                )
            )
    return blocks


def parse_markdown(markdown: str) -> list[KgSourceBlock]:
    """Fallback parser for text/Markdown artifacts when content_list is absent."""
    blocks: list[KgSourceBlock] = []
    buffer: list[str] = []

    def flush() -> None:
        text = "\n".join(buffer).strip()
        buffer.clear()
        if text:
            blocks.append(KgSourceBlock(content=text))

    for line in markdown.splitlines():
        match = re.match(r"^(#{1,6})\s+(.+?)\s*$", line)
        if match:
            flush()
            blocks.append(
                KgSourceBlock(
                    content=match.group(2).strip(),
                    heading_level=len(match.group(1)),
                    heading_title=match.group(2).strip(),
                )
            )
            continue
        buffer.append(line)
    flush()
    return blocks


def infer_document_title(
    document_id: str,
    blocks: list[KgSourceBlock],
    fallback: str | None = None,
) -> str:
    if fallback and fallback.strip():
        return fallback.strip()
    for block in blocks:
        if block.heading_title and (block.heading_level or 1) <= 1:
            return block.heading_title
    return Path(document_id).stem or document_id


def _is_heading(item: dict[str, Any], content_type: str) -> bool:
    return content_type in {"title", "heading"} or item.get("text_level") is not None


def _heading_level(item: dict[str, Any]) -> int:
    raw = item.get("text_level", item.get("level", 1))
    try:
        level = int(raw)
    except (TypeError, ValueError):
        level = 1
    return max(1, min(level, 6))


def _page_number(item: dict[str, Any]) -> int | None:
    if item.get("page") is not None:
        try:
            return int(item["page"])
        except (TypeError, ValueError):
            return None
    if item.get("page_idx") is not None:
        try:
            return int(item["page_idx"]) + 1
        except (TypeError, ValueError):
            return None
    return None


def _asset_url(item: dict[str, Any]) -> str | None:
    value = item.get("img_path") or item.get("image_path") or item.get("asset_url")
    return str(value) if value else None


def _item_text(item: dict[str, Any]) -> str:
    values = [
        item.get("text"),
        item.get("content"),
        item.get("table_body"),
        item.get("caption"),
    ]
    for value in values:
        if value:
            return str(value)
    list_items = item.get("list_items")
    if isinstance(list_items, list):
        return "\n".join(str(value) for value in list_items if value is not None)
    return ""
