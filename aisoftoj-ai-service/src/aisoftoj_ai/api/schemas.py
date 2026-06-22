from typing import Any, Literal

from pydantic import BaseModel, Field, HttpUrl, model_validator

from aisoftoj_ai.rag.models import SearchResult


class UrlIngestRequest(BaseModel):
    """通过 URL 触发入库的请求体。"""
    url: HttpUrl
    knowledge_base_id: str = Field(min_length=1)
    document_id: str = Field(min_length=1)
    version: int = 1


class JobResponse(BaseModel):
    """异步任务返回体。"""
    job_id: str
    status: str


class ParseOptions(BaseModel):
    backend: str = "hybrid-engine"
    effort: str = "medium"
    parse_method: str = "auto"
    lang_list: list[str] = Field(default_factory=lambda: ["ch"])
    formula_enable: bool = True
    table_enable: bool = True
    image_analysis: bool = False
    return_md: bool = True
    return_content_list: bool = True
    return_middle_json: bool = False
    return_model_output: bool = False
    return_images: bool = True
    start_page_id: int = Field(default=0, ge=0)
    end_page_id: int = Field(default=99999, ge=0)
    chunk_size: int = Field(default=600, ge=100, le=4000)
    chunk_overlap: int = Field(default=100, ge=0, le=1000)

    @model_validator(mode="after")
    def validate_ranges(self):
        if self.end_page_id < self.start_page_id:
            raise ValueError("end_page_id must be greater than or equal to start_page_id")
        if self.chunk_overlap >= self.chunk_size:
            raise ValueError("chunk_overlap must be smaller than chunk_size")
        return self


class SearchRequest(BaseModel):
    """知识库检索请求体。"""
    query: str = Field(min_length=1)
    knowledge_base_ids: list[str] = Field(default_factory=list)
    limit: int = Field(default=8, ge=1, le=20)


class SearchResponse(BaseModel):
    """检索响应体。"""
    results: list[SearchResult]


class ChatMessage(BaseModel):
    """对话历史消息。"""
    role: Literal["user", "assistant"]
    content: str


class ChatRequest(BaseModel):
    """AI 对话请求体，支持知识库、联网搜索和思考流。"""
    question: str = Field(min_length=1)
    user_id: str | None = None
    session_id: str | None = None
    knowledge_base_ids: list[str] = Field(default_factory=list)
    history: list[ChatMessage] = Field(default_factory=list)
    page_context: dict[str, Any] = Field(default_factory=dict)
    web_enabled: bool = False
    thinking_enabled: bool = False
    rewrite_count: int = Field(default=3, ge=1, le=5)


class StudyRoadmapAgentRequest(BaseModel):
    """学习路线 Deepagent 请求体。"""
    days: int = Field(default=7, ge=1, le=30)
    daily_minutes: int = Field(default=60, ge=20, le=180)
    recommendations: list[dict] = Field(default_factory=list)


class KnowledgeGraphAgentRequest(BaseModel):
    """Request body for generating weak-knowledge graph relations."""
    recommendations: list[dict[str, Any]] = Field(default_factory=list)
    evidences: list[dict[str, Any]] = Field(default_factory=list)
    knowledge_base_ids: list[str] = Field(default_factory=list)
    max_nodes: int = Field(default=48, ge=8, le=120)
    max_edges: int = Field(default=80, ge=8, le=160)


class DocumentGraphExtractionRequest(BaseModel):
    """Build a structure-aware knowledge graph from one parsed document."""
    knowledge_base_id: str = Field(min_length=1)
    document_id: str = Field(min_length=1)
    version: int = Field(default=1, ge=1)
    document_title: str | None = None
    max_chunks: int = Field(default=72, ge=1, le=200)


class WrongQuestionAlignmentRequest(BaseModel):
    """Map wrong questions to extracted document KG entities with LLM judgement."""
    user_id: str | None = None
    document_id: str = Field(min_length=1)
    wrong_questions: list[dict[str, Any]] = Field(default_factory=list)
    entity_nodes: list[dict[str, Any]] = Field(default_factory=list)
    kg_extraction_chunks: list[dict[str, Any]] = Field(default_factory=list)
    max_alignments: int = Field(default=120, ge=1, le=240)
