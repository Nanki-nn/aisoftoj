from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from pydantic import BaseModel, Field

KgContentType = Literal["text", "table", "formula", "image", "caption", "footnote"]
HeadingNodeType = Literal["document", "chapter", "section", "subsection"]
ContextDependency = Literal["explicit", "heading_context", "cross_chunk_context", "structural"]
RelationCategory = Literal["structure", "business", "entity_resolution"]


class KgSourceBlock(BaseModel):
    content: str
    content_type: KgContentType = "text"
    page: int | None = None
    bbox: list[float] | None = None
    asset_url: str | None = None
    heading_level: int | None = None
    heading_title: str | None = None


class KgHeadingNode(BaseModel):
    node_id: str
    type: HeadingNodeType
    title: str
    page_start: int | None = None
    page_end: int | None = None
    parent_id: str | None = None
    children: list[KgHeadingNode] = Field(default_factory=list)


class KgDocumentStructure(BaseModel):
    document_id: str
    title: str
    nodes: list[KgHeadingNode] = Field(default_factory=list)


KgHeadingNode.model_rebuild()


@dataclass(frozen=True)
class KgBlockBinding:
    block: KgSourceBlock
    parent_heading_id: str
    heading_path: list[str]


class KgExtractionChunk(BaseModel):
    document_id: str
    kg_chunk_id: str
    source_page_range: str
    page_start: int | None = None
    page_end: int | None = None
    heading_path: list[str] = Field(default_factory=list)
    parent_heading_id: str
    previous_context_summary: str = ""
    text: str
    next_context_summary: str = ""


class KgEntityNode(BaseModel):
    entity_id: str
    name: str
    canonical_name: str
    aliases: list[str] = Field(default_factory=list)
    heading_path: list[str] = Field(default_factory=list)
    disambiguation_key: str
    source_kg_chunk_ids: list[str] = Field(default_factory=list)


class KgEvidenceRelation(BaseModel):
    subject: str
    predicate: str
    object: str
    evidence_text: str = ""
    source_kg_chunk_id: str = ""
    source_page_range: str = ""
    heading_path: list[str] = Field(default_factory=list)
    context_dependency: ContextDependency = "explicit"
    confidence: float = 0.0
    relation_category: RelationCategory = "business"


class KgExtractionResult(BaseModel):
    status: str = "completed"
    document_id: str
    document_structure: KgDocumentStructure
    kg_extraction_chunks: list[KgExtractionChunk]
    entity_nodes: list[KgEntityNode] = Field(default_factory=list)
    relations: list[KgEvidenceRelation] = Field(default_factory=list)
    stats: dict[str, int] = Field(default_factory=dict)
