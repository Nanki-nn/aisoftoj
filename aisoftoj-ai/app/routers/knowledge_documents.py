from __future__ import annotations

from pathlib import Path
from typing import Annotated
from uuid import uuid4

import anyio
from fastapi import APIRouter, File, HTTPException, Query, Response, UploadFile, status
from pydantic import BaseModel, Field

from app.dependencies import Container, CurrentUser
from packages.harness.aisoftoj_agent.integrations.mineru import MineruError
from packages.harness.aisoftoj_agent.persistence.models import AiKnowledgeDocument
from packages.harness.aisoftoj_agent.persistence.repositories.knowledge_documents import (
    KnowledgeDocumentRepository,
)

router = APIRouter(prefix="/api/ai/admin/knowledge-documents", tags=["knowledge-documents"])
LOCAL_UPLOAD_DIR = Path("storage/knowledge")
MAX_UPLOAD_BYTES = 50 * 1024 * 1024


class UpdateKnowledgeDocumentRequest(BaseModel):
    title: str = Field(min_length=1, max_length=256)


@router.get("")
async def list_knowledge_documents(
    user: CurrentUser,
    container: Container,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    keyword: str | None = Query(default=None, max_length=256),
    document_status: str | None = Query(default=None, alias="status"),
) -> dict[str, object]:
    if user.role != "ADMIN":
        raise HTTPException(status_code=403, detail="admin role required")
    normalized_status = document_status.upper() if document_status else None
    if normalized_status not in {None, "QUEUED", "PARSING", "INDEXING", "ACTIVE", "FAILED"}:
        raise HTTPException(status_code=422, detail="知识库状态无效")
    async with container.session_factory() as session:
        items, total = await KnowledgeDocumentRepository(session).list_page(
            page=page,
            page_size=page_size,
            keyword=keyword.strip() if keyword else None,
            status=normalized_status,
        )
    return {
        "records": [_document_payload(item) for item in items],
        "total": total,
        "page": page,
        "pageSize": page_size,
    }


@router.post("/upload-local", status_code=status.HTTP_201_CREATED)
async def upload_local_knowledge_file(
    user: CurrentUser,
    container: Container,
    file: Annotated[UploadFile, File()],
    is_ocr: bool = False,
) -> dict[str, object]:
    if user.role != "ADMIN":
        raise HTTPException(status_code=403, detail="admin role required")
    if container.knowledge_task_manager is None:
        raise HTTPException(status_code=503, detail="knowledge RAG is disabled")
    filename = (file.filename or "").strip()
    if not filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="仅支持 PDF 文件")
    upload_dir = anyio.Path(LOCAL_UPLOAD_DIR)
    await upload_dir.mkdir(parents=True, exist_ok=True)
    target = upload_dir / f"{uuid4().hex}.pdf"
    total = 0
    try:
        async with await target.open("wb") as output:
            while chunk := await file.read(1024 * 1024):
                total += len(chunk)
                if total > MAX_UPLOAD_BYTES:
                    await target.unlink(missing_ok=True)
                    raise HTTPException(status_code=413, detail="文件大小不能超过 50MB")
                await output.write(chunk)
    except HTTPException:
        raise
    except OSError as exc:
        await target.unlink(missing_ok=True)
        raise HTTPException(status_code=500, detail="本地文件保存失败") from exc
    finally:
        await file.close()
    title = filename[:-4].strip() or "未命名文档"
    async with container.session_factory.begin() as session:
        item = await KnowledgeDocumentRepository(session).create(
            title=title,
            source_url=f"local://{target.name}",
            local_path=str(target),
            is_ocr=is_ocr,
            embedding_model=container.settings.knowledge_embedding_model,
            collection_name=container.settings.knowledge_qdrant_collection,
            index_version=_index_version(),
        )
        response = _document_payload(item)
    await container.knowledge_task_manager.start(item.id)
    return response


@router.get("/{document_id}/content")
async def get_knowledge_document_content(
    document_id: str,
    user: CurrentUser,
    container: Container,
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=12_000, ge=1, le=50_000),
) -> dict[str, object]:
    if user.role != "ADMIN":
        raise HTTPException(status_code=403, detail="admin role required")
    if container.knowledge_task_manager is None:
        raise HTTPException(status_code=503, detail="knowledge RAG is disabled")
    try:
        markdown = await container.knowledge_task_manager.read_markdown(document_id)
    except MineruError as exc:
        raise HTTPException(status_code=409, detail=exc.message) from exc
    if markdown is None:
        raise HTTPException(status_code=404, detail="knowledge document not found")
    if not markdown:
        raise HTTPException(status_code=409, detail="解析内容尚未生成")
    next_offset = offset + limit
    return {
        "content": markdown[offset:next_offset],
        "offset": offset,
        "nextOffset": next_offset if next_offset < len(markdown) else None,
        "totalChars": len(markdown),
    }


@router.get("/{document_id}")
async def get_knowledge_document(
    document_id: str, user: CurrentUser, container: Container
) -> dict[str, object]:
    if user.role != "ADMIN":
        raise HTTPException(status_code=403, detail="admin role required")
    async with container.session_factory() as session:
        item = await KnowledgeDocumentRepository(session).get(document_id)
    if item is None:
        raise HTTPException(status_code=404, detail="knowledge document not found")
    return _document_payload(item)


@router.patch("/{document_id}")
async def update_knowledge_document(
    document_id: str,
    payload: UpdateKnowledgeDocumentRequest,
    user: CurrentUser,
    container: Container,
) -> dict[str, object]:
    if user.role != "ADMIN":
        raise HTTPException(status_code=403, detail="admin role required")
    title = payload.title.strip()
    if not title:
        raise HTTPException(status_code=422, detail="文档标题不能为空")
    async with container.session_factory.begin() as session:
        repository = KnowledgeDocumentRepository(session)
        item = await repository.get(document_id)
        if item is None:
            raise HTTPException(status_code=404, detail="knowledge document not found")
        await repository.update_title(item, title)
        return _document_payload(item)


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_knowledge_document(
    document_id: str, user: CurrentUser, container: Container
) -> Response:
    if user.role != "ADMIN":
        raise HTTPException(status_code=403, detail="admin role required")
    if container.knowledge_task_manager is None:
        raise HTTPException(status_code=503, detail="knowledge RAG is disabled")
    async with container.session_factory() as session:
        item = await KnowledgeDocumentRepository(session).get(document_id)
        if item is None:
            raise HTTPException(status_code=404, detail="knowledge document not found")
        index_version = item.index_version
        local_path = item.local_path
        parsed_markdown_path = item.parsed_markdown_path
    await container.knowledge_task_manager.cancel(document_id)
    await container.knowledge_task_manager.cleanup_parts(document_id)
    try:
        await container.knowledge_task_manager.delete_index(document_id, index_version)
    except Exception as exc:
        raise HTTPException(status_code=503, detail="向量索引删除失败，请稍后重试") from exc
    await _delete_local_file(local_path)
    await _delete_local_file(parsed_markdown_path)
    async with container.session_factory.begin() as session:
        repository = KnowledgeDocumentRepository(session)
        item = await repository.get(document_id)
        if item is not None:
            await repository.delete(item)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


def _index_version() -> str:
    return f"v{uuid4().hex}"


async def _delete_local_file(local_path: str | None) -> None:
    if local_path is None:
        return
    root = await anyio.Path(LOCAL_UPLOAD_DIR).resolve()
    target = await anyio.Path(local_path).resolve()
    try:
        target.relative_to(root)
    except ValueError as exc:
        raise HTTPException(status_code=500, detail="知识库文件路径无效") from exc
    try:
        await target.unlink(missing_ok=True)
    except OSError as exc:
        raise HTTPException(status_code=500, detail="原始 PDF 删除失败") from exc


def _document_payload(item: AiKnowledgeDocument) -> dict[str, object]:
    return {
        "documentId": item.id,
        "title": item.title,
        "sourceUrl": item.source_url,
        "localPath": item.local_path,
        "mineruBatchId": item.mineru_batch_id,
        "markdownAvailable": item.parsed_markdown_path is not None,
        "indexVersion": item.index_version,
        "collectionName": item.collection_name,
        "embeddingModel": item.embedding_model,
        "isOcr": item.is_ocr,
        "status": item.status.lower(),
        "chunkCount": item.chunk_count,
        "errorCode": item.error_code,
        "createdAt": item.created_at.isoformat() if item.created_at else None,
        "updatedAt": item.updated_at.isoformat() if item.updated_at else None,
        "activatedAt": item.activated_at.isoformat() if item.activated_at else None,
    }
