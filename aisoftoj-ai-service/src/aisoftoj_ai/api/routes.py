import json
import logging
import uuid
from pathlib import Path

from arq.jobs import DeserializationError, Job
from fastapi import APIRouter, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse, StreamingResponse

from aisoftoj_ai.api.schemas import (
    ChatRequest,
    JobResponse,
    ParseOptions,
    SearchRequest,
    SearchResponse,
    UrlIngestRequest,
)
from aisoftoj_ai.rag.agent.graph import build_rag_graph
from aisoftoj_ai.rag.agent.prompts import ANSWER_SYSTEM, CHAT_SYSTEM
from aisoftoj_ai.rag.citations import build_citations
from aisoftoj_ai.rag.tasks import state_key
from aisoftoj_ai.redis_compat import hset_fields
from aisoftoj_ai.services import get_services

router = APIRouter(prefix="/api/v1")
logger = logging.getLogger("aisoftoj.api")


@router.post("/index/jobs/upload", response_model=JobResponse, status_code=202)
async def upload_document(
    request: Request,
    file: UploadFile = File(...),
    knowledge_base_id: str = Form(...),
    document_id: str = Form(...),
    version: int = Form(1),
    options_json: str = Form("{}"),
) -> JobResponse:
    """接收上传文件并创建入库任务。"""
    upload_dir = Path("./data/uploads")
    upload_dir.mkdir(parents=True, exist_ok=True)
    suffix = Path(file.filename or "").suffix
    target = upload_dir / f"{uuid.uuid4()}{suffix}"
    with target.open("wb") as output:
        while chunk := await file.read(1024 * 1024):
            output.write(chunk)

    try:
        options = ParseOptions.model_validate_json(options_json)
    except Exception as exc:
        target.unlink(missing_ok=True)
        raise HTTPException(status_code=422, detail=f"Invalid parse options: {exc}") from exc
    job = await request.app.state.redis.enqueue_job(
        "ingest_file_task",
        str(target),
        knowledge_base_id,
        document_id,
        version,
        options.model_dump(),
        _job_id=f"ingest-{document_id}-{version}",
    )
    if job is None:
        target.unlink(missing_ok=True)
        existing = Job(f"ingest-{document_id}-{version}", request.app.state.redis)
        return JobResponse(job_id=existing.job_id, status=(await existing.status()).value)
    return JobResponse(job_id=job.job_id, status="queued")


@router.post("/index/jobs/url", response_model=JobResponse, status_code=202)
async def ingest_url(request: Request, body: UrlIngestRequest) -> JobResponse:
    """接收 URL 并创建入库任务。"""
    job = await request.app.state.redis.enqueue_job(
        "ingest_url_task",
        str(body.url),
        body.knowledge_base_id,
        body.document_id,
        body.version,
    )
    return JobResponse(job_id=job.job_id, status="queued")


@router.get("/index/jobs/{job_id}")
async def get_job(request: Request, job_id: str) -> dict:
    """查询 ARQ 任务状态和结果。"""
    job = Job(job_id, request.app.state.redis)
    status = await job.status()
    state = await request.app.state.redis.hgetall(
        state_key_from_job(job_id)
    ) if job_id.startswith("ingest-") else {}
    progress = {
        (key.decode() if isinstance(key, bytes) else str(key)): (
            value.decode() if isinstance(value, bytes) else str(value)
        )
        for key, value in state.items()
    }
    if status.value != "complete":
        return {
            "jobId": job_id,
            "status": status.value,
            "result": None,
            "error": progress.get("error") or ("job failed" if status.value == "failed" else None),
            "progress": progress,
        }
    try:
        info = await job.result_info()
    except DeserializationError:
        logger.warning("Unable to deserialize stale ARQ result for job %s", job_id)
        persisted_status = progress.get("status")
        if persisted_status == "failed":
            return {
                "jobId": job_id,
                "status": "failed",
                "result": None,
                "error": progress.get("error") or "job failed",
                "progress": progress,
            }
        return {
            "jobId": job_id,
            "status": persisted_status or status.value,
            "result": progress if persisted_status in {"ready", "cancelled"} else None,
            "error": progress.get("error"),
            "progress": progress,
        }
    if info is not None and not info.success:
        return {
            "jobId": job_id,
            "status": "failed",
            "result": None,
            "error": progress.get("error") or str(info.result) or "job failed",
            "progress": progress,
        }
    return {
        "jobId": job_id,
        "status": status.value,
        "result": info.result if info else None,
        "progress": progress,
    }


@router.post("/index/jobs/{job_id}/cancel")
async def cancel_job(request: Request, job_id: str) -> dict:
    key = state_key_from_job(job_id)
    await hset_fields(
        request.app.state.redis,
        key,
        {"cancelled": "true", "status": "cancelled"},
    )
    return {"jobId": job_id, "status": "cancelled"}


@router.get("/index/capabilities")
async def index_capabilities() -> dict:
    openapi = await get_services().pipeline.mineru.capabilities()
    schemas = openapi.get("components", {}).get("schemas", {})
    upload_schema = next(
        (
            schema
            for schema in schemas.values()
            if isinstance(schema, dict)
            and "backend" in schema.get("properties", {})
            and "files" in schema.get("properties", {})
        ),
        {},
    )
    return {
        "mineru": openapi.get("info", {}),
        "parseOptionsSchema": upload_schema,
        "presets": {
            "fast": {
                "backend": "pipeline",
                "parse_method": "auto",
                "image_analysis": False,
            },
            "balanced": {
                "backend": "hybrid-engine",
                "effort": "medium",
                "image_analysis": False,
            },
            "accurate": {
                "backend": "hybrid-engine",
                "effort": "high",
                "image_analysis": True,
            },
        },
    }


@router.get("/index/documents/{document_id}/versions/{version}/artifacts/{kind}")
async def get_artifact(document_id: str, version: int, kind: str):
    names = {
        "markdown": ("document.md", "text/markdown"),
        "content-list": ("content-list.json", "application/json"),
        "raw": ("mineru-result.json", "application/json"),
        "chunks": ("chunks.json", "application/json"),
    }
    if kind not in names:
        raise HTTPException(status_code=404, detail="Unknown artifact")
    filename, media_type = names[kind]
    path = get_services().pipeline.storage.path(f"documents/{document_id}/{version}/{filename}")
    if not path.exists():
        raise HTTPException(status_code=404, detail="Artifact not found")
    return FileResponse(path, media_type=media_type, filename=filename)


@router.get("/index/documents/{document_id}/versions/{version}/assets/{filename}")
async def get_document_asset(document_id: str, version: int, filename: str):
    safe_name = Path(filename).name
    if safe_name != filename:
        raise HTTPException(status_code=400, detail="Invalid asset name")
    path = get_services().pipeline.storage.path(
        f"documents/{document_id}/{version}/images/{safe_name}"
    )
    if not path.exists() or not path.is_file():
        raise HTTPException(status_code=404, detail="Asset not found")
    return FileResponse(path)


@router.delete("/index/documents/{document_id}")
async def delete_document(document_id: str) -> dict:
    """删除指定文档的索引数据。"""
    await get_services().store.delete_document(document_id)
    await get_services().pipeline.storage.delete_prefix(f"documents/{document_id}")
    return {"message": "文档索引已删除"}


@router.patch("/index/documents/{document_id}/knowledge-base")
async def move_document(document_id: str, body: dict) -> dict:
    knowledge_base_id = str(body.get("knowledgeBaseId") or "").strip()
    if not knowledge_base_id:
        raise HTTPException(status_code=422, detail="knowledgeBaseId is required")
    await get_services().store.move_document(document_id, knowledge_base_id)
    return {"documentId": document_id, "knowledgeBaseId": knowledge_base_id}


@router.get("/index/documents/{document_id}/chunks")
async def list_chunks(document_id: str, limit: int = 100) -> dict:
    """列出指定文档的切块数据。"""
    chunks = await get_services().store.list_chunks(document_id, min(limit, 200))
    return {"items": chunks}


@router.post("/retrieval/search", response_model=SearchResponse)
async def search(body: SearchRequest) -> SearchResponse:
    """执行知识库混合检索。"""
    results = await get_services().search.search(
        body.query,
        body.knowledge_base_ids,
        body.limit,
    )
    return SearchResponse(results=results)


@router.post("/chat/stream")
async def chat_stream(body: ChatRequest) -> StreamingResponse:
    """SSE 流式对话接口，支持普通聊天和 RAG 问答。"""
    services = get_services()
    trace_id = str(uuid.uuid4())

    async def events():
        """生成对话过程中的 SSE 事件流。"""
        yield _sse("status", {"message": "正在理解问题", "traceId": trace_id})
        try:
            if not body.knowledge_base_ids:
                async for event in _stream_conversation(body, services, trace_id):
                    yield event
                yield _sse("done", {"traceId": trace_id})
                return

            graph = build_rag_graph(
                services.chat,
                services.search,
                services.searxng,
                services.pipeline.storage,
            )
            async for part in graph.astream(
                {
                    "question": body.question,
                    "knowledge_base_ids": body.knowledge_base_ids,
                    "history": [item.model_dump() for item in body.history],
                    "web_enabled": body.web_enabled,
                    "thinking_enabled": body.thinking_enabled,
                    "rewrite_count": body.rewrite_count,
                },
                stream_mode="custom",
                version="v2",
            ):
                data = part["data"]
                yield _sse(data["type"], data)
            yield _sse("done", {"traceId": trace_id})
        except Exception:
            yield _sse("error", {"message": "问答服务暂时不可用", "traceId": trace_id})

    return StreamingResponse(events(), media_type="text/event-stream")


async def _stream_conversation(body: ChatRequest, services, trace_id: str):
    """在没有知识库时，使用聊天模型或联网搜索直接回答。"""
    results = []
    if body.web_enabled:
        yield _sse("status", {"message": "正在联网检索公开资料", "traceId": trace_id})
        try:
            results = await services.searxng.search(body.question)
        except Exception:
            yield _sse(
                "warning",
                {"message": "联网检索暂时不可用，已切换为模型直接回答", "traceId": trace_id},
            )

    messages = [{"role": "system", "content": ANSWER_SYSTEM if results else CHAT_SYSTEM}]
    messages.extend(item.model_dump() for item in body.history[-12:])
    if results:
        context = "\n\n".join(
            f"[{index}] {item.title or '网页资料'}\n{item.content}"
            for index, item in enumerate(results, start=1)
        )
        messages.append(
            {
                "role": "user",
                "content": f"问题：{body.question}\n\n可用网页资料：\n{context}",
            }
        )
    else:
        messages.append({"role": "user", "content": body.question})

    yield _sse("status", {"message": "正在组织回答", "traceId": trace_id})
    async for event_type, token in services.chat.stream_with_reasoning(
        messages,
        thinking_enabled=body.thinking_enabled,
    ):
        yield _sse(event_type, {"type": event_type, "content": token})
    citations = build_citations(results)
    yield _sse(
        "citation",
        {"type": "citation", "citations": [item.model_dump() for item in citations]},
    )


def _sse(event: str, data: dict) -> str:
    """将事件包装为 SSE 格式。"""
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


def state_key_from_job(job_id: str) -> str:
    parts = job_id.split("-")
    if len(parts) < 3:
        raise HTTPException(status_code=400, detail="Invalid ingestion job id")
    version = int(parts[-1])
    document_id = "-".join(parts[1:-1])
    return state_key(document_id, version)
