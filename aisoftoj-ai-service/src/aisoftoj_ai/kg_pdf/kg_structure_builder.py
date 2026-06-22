import re
from collections.abc import Iterable

from aisoftoj_ai.kg_pdf.models import (
    KgBlockBinding,
    KgDocumentStructure,
    KgHeadingNode,
    KgSourceBlock,
)


def build_document_structure(
    document_id: str,
    title: str,
    blocks: list[KgSourceBlock],
) -> tuple[KgDocumentStructure, list[KgBlockBinding]]:
    """Build a heading tree and bind every content block to a structure node."""
    roots: list[KgHeadingNode] = []
    stack: list[tuple[int, KgHeadingNode]] = []
    node_ids: set[str] = set()
    bindings: list[KgBlockBinding] = []
    synthetic_document_node: KgHeadingNode | None = None

    for block in blocks:
        if block.heading_title:
            level = block.heading_level or 1
            while stack and stack[-1][0] >= level:
                stack.pop()

            parent = stack[-1][1] if stack else None
            node = KgHeadingNode(
                node_id=_node_id(block.page, block.heading_title, node_ids),
                type=_node_type(level),
                title=block.heading_title,
                page_start=block.page,
                page_end=block.page,
                parent_id=parent.node_id if parent else None,
            )
            if parent:
                parent.children.append(node)
            else:
                roots.append(node)
            stack.append((level, node))
            continue

        parent = stack[-1][1] if stack else None
        if parent is None:
            synthetic_document_node = synthetic_document_node or _document_node(
                title,
                block.page,
                roots,
                node_ids,
            )
            parent = synthetic_document_node
            stack = [(0, parent)]

        heading_path = [node.title for _, node in stack if node.type != "document"]
        bindings.append(
            KgBlockBinding(
                block=block,
                parent_heading_id=parent.node_id,
                heading_path=heading_path,
            )
        )
        _extend_pages(parent, block.page)
        for _, ancestor in stack[:-1]:
            _extend_pages(ancestor, block.page)

    _inherit_parent_page_ranges(roots)
    return KgDocumentStructure(document_id=document_id, title=title, nodes=roots), bindings


def flatten_heading_nodes(nodes: Iterable[KgHeadingNode]) -> list[KgHeadingNode]:
    output: list[KgHeadingNode] = []
    for node in nodes:
        output.append(node)
        output.extend(flatten_heading_nodes(node.children))
    return output


def heading_lookup(structure: KgDocumentStructure) -> dict[str, KgHeadingNode]:
    return {node.node_id: node for node in flatten_heading_nodes(structure.nodes)}


def _document_node(
    title: str,
    page: int | None,
    roots: list[KgHeadingNode],
    node_ids: set[str],
) -> KgHeadingNode:
    node = KgHeadingNode(
        node_id=_node_id(page, title or "document", node_ids, prefix="heading_document"),
        type="document",
        title=title or "Document",
        page_start=page,
        page_end=page,
        parent_id=None,
    )
    roots.append(node)
    return node


def _node_type(level: int) -> str:
    if level <= 1:
        return "chapter"
    if level == 2:
        return "section"
    return "subsection"


def _node_id(
    page: int | None,
    title: str,
    used: set[str],
    prefix: str = "heading",
) -> str:
    slug = "_".join(re.findall(r"[\u4e00-\u9fffA-Za-z0-9]+", title))[:40] or "untitled"
    page_part = str(page) if page is not None else "unknown"
    base = f"{prefix}_{page_part}_{slug}"
    candidate = base
    index = 2
    while candidate in used:
        candidate = f"{base}_{index}"
        index += 1
    used.add(candidate)
    return candidate


def _extend_pages(node: KgHeadingNode, page: int | None) -> None:
    if page is None:
        return
    node.page_start = page if node.page_start is None else min(node.page_start, page)
    node.page_end = page if node.page_end is None else max(node.page_end, page)


def _inherit_parent_page_ranges(nodes: list[KgHeadingNode]) -> None:
    for node in nodes:
        _inherit_parent_page_ranges(node.children)
        for child in node.children:
            _extend_pages(node, child.page_start)
            _extend_pages(node, child.page_end)
