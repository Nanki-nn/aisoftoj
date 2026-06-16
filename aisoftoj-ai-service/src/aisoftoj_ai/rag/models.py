from typing import Literal

from pydantic import BaseModel, Field

ContentType = Literal["text", "table", "formula", "image", "web"]


class DocumentBlock(BaseModel):
    """MinerU 解析后的原始块。"""
    content: str
    content_type: ContentType = "text"
    heading_path: list[str] = Field(default_factory=list)
    page: int | None = None
    bbox: list[float] | None = None
    asset_url: str | None = None


class Chunk(BaseModel):
    """用于写入 Qdrant 的切块数据。"""
    id: str
    knowledge_base_id: str
    document_id: str
    version: int = 1
    content: str
    content_type: ContentType
    heading_path: list[str] = Field(default_factory=list)
    page: int | None = None
    bbox: list[float] | None = None
    asset_url: str | None = None
    active: bool = True


class SearchResult(BaseModel):
    """检索或重排返回的结果。"""
    id: str
    content: str
    score: float = 0
    source: Literal["knowledge_base", "web"] = "knowledge_base"
    document_id: str | None = None
    version: int | None = None
    content_type: ContentType = "text"
    title: str | None = None
    heading_path: list[str] = Field(default_factory=list)
    page: int | None = None
    url: str | None = None
    asset_url: str | None = None


class Citation(BaseModel):
    """回答中引用的资料条目。"""
    index: int
    result_id: str
    title: str
    source: str
    content: str
    score: float = 0
    document_id: str | None = None
    version: int | None = None
    content_type: ContentType = "text"
    asset_name: str | None = None
    page: int | None = None
    heading_path: list[str] = Field(default_factory=list)
    url: str | None = None
    asset_url: str | None = None
