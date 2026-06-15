import asyncio
import hashlib
import hmac
import json
import logging
import time
import uuid
from pathlib import Path
from typing import Any

import httpx

from aisoftoj_ai.config import get_settings
from aisoftoj_ai.rag.models import DocumentBlock
from aisoftoj_ai.redis_compat import hset_fields

logger = logging.getLogger("aisoftoj.ingestion")


def state_key(document_id: str, version: int) -> str:
    return f"knowledge:ingest:{document_id}:{version}"


async def _set_state(ctx, document_id: str, version: int, **values: Any) -> None:
    mapping = {
        key: (
            json.dumps(value, ensure_ascii=False)
            if isinstance(value, (dict, list))
            else str(value)
        )
        for key, value in values.items()
        if value is not None
    }
    if mapping:
        await hset_fields(ctx["redis"], state_key(document_id, version), mapping)
        await ctx["redis"].expire(state_key(document_id, version), 7 * 24 * 3600)


async def _get_state(ctx, document_id: str, version: int) -> dict[str, str]:
    raw = await ctx["redis"].hgetall(state_key(document_id, version))
    return {
        (key.decode() if isinstance(key, bytes) else str(key)): (
            value.decode() if isinstance(value, bytes) else str(value)
        )
        for key, value in raw.items()
    }


async def _is_cancelled(ctx, document_id: str, version: int) -> bool:
    state = await _get_state(ctx, document_id, version)
    return state.get("cancelled", "false").lower() == "true"


async def _callback(document_id: str, version: int, payload: dict[str, Any]) -> None:
    settings = get_settings()
    if not settings.internal_callback_url:
        return
    body = json.dumps(
        {"documentId": document_id, "version": version, **payload},
        ensure_ascii=False,
        separators=(",", ":"),
    ).encode()
    signature = hmac.new(
        settings.internal_callback_secret.encode(),
        body,
        hashlib.sha256,
    ).hexdigest()
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            await client.post(
                settings.internal_callback_url,
                content=body,
                headers={
                    "Content-Type": "application/json",
                    "X-Aisoftoj-Signature": signature,
                },
            )
    except Exception:
        pass


async def _stage(ctx, document_id: str, version: int, stage: str, **extra: Any) -> None:
    extra.pop("status", None)
    state = await _get_state(ctx, document_id, version)
    now = time.time()
    stage_started_at = float(state.get("stage_started_at") or now)
    trace_id = state.get("trace_id") or str(uuid.uuid4())
    stage_duration_ms = max(0, int((now - stage_started_at) * 1000))
    telemetry = {
        "traceId": trace_id,
        "previousStage": state.get("status"),
        "stageDurationMs": stage_duration_ms,
        **extra,
    }
    await _set_state(
        ctx,
        document_id,
        version,
        status=stage,
        trace_id=trace_id,
        stage_started_at=now,
        **telemetry,
    )
    logger.info(
        json.dumps(
            {
                "event": "knowledge_ingestion_stage",
                "documentId": document_id,
                "version": version,
                "stage": stage,
                **telemetry,
            },
            ensure_ascii=False,
        )
    )
    await _callback(document_id, version, {"status": stage, **telemetry})


async def ingest_file_task(
    ctx,
    file_path: str,
    knowledge_base_id: str,
    document_id: str,
    version: int,
    options: dict[str, Any] | None = None,
) -> dict:
    options = options or {}
    source = Path(file_path)
    initial_state = await _get_state(ctx, document_id, version)
    task_started_at = float(initial_state.get("task_started_at") or time.time())
    await _set_state(
        ctx,
        document_id,
        version,
        trace_id=initial_state.get("trace_id") or str(uuid.uuid4()),
        task_started_at=task_started_at,
    )
    try:
        if await _is_cancelled(ctx, document_id, version):
            await _stage(ctx, document_id, version, "cancelled")
            return {"documentId": document_id, "status": "cancelled", "chunkCount": 0}

        extension = source.suffix.lower()
        if extension in {".txt", ".md", ".markdown"}:
            await _stage(ctx, document_id, version, "normalizing")
            text = await asyncio.to_thread(source.read_text, "utf-8", errors="replace")
            if not text.strip():
                raise RuntimeError("Text document is empty")
            blocks = [DocumentBlock(content=text)]
            markdown = text
            content_list = [{"type": "text", "text": text}]
            raw_result = {"source": "direct", "content_list": content_list}
        else:
            state = await _get_state(ctx, document_id, version)
            mineru_task_id = state.get("mineru_task_id")
            if mineru_task_id:
                restored_status = await ctx["pipeline"].mineru.get_status(mineru_task_id)
                if restored_status.get("status") == "not_found":
                    await _set_state(
                        ctx,
                        document_id,
                        version,
                        recovery_reason="MinerU task was missing or expired; source resubmitted",
                    )
                    mineru_task_id = None
            if not mineru_task_id:
                await _stage(ctx, document_id, version, "queued")
                mineru_task_id = await ctx["pipeline"].mineru.submit_file(str(source), options)
                await _set_state(
                    ctx,
                    document_id,
                    version,
                    mineru_task_id=mineru_task_id,
                )

            async def on_mineru_status(status):
                await _stage(
                    ctx,
                    document_id,
                    version,
                    "parsing",
                    mineruTaskId=mineru_task_id,
                    mineruStatus=status.get("status"),
                    queuedAhead=status.get("queued_ahead"),
                )

            result = await ctx["pipeline"].mineru.wait(
                mineru_task_id,
                on_status=on_mineru_status,
                is_cancelled=lambda: _is_cancelled(ctx, document_id, version),
                timeout_seconds=get_settings().mineru_task_timeout_seconds,
            )
            await _stage(ctx, document_id, version, "normalizing")
            blocks = result.blocks
            markdown = result.markdown
            content_list = result.content_list
            raw_result = result.raw

        artifact_prefix = f"documents/{document_id}/{version}"
        raw_path = await ctx["pipeline"].storage.write_json(
            f"{artifact_prefix}/mineru-result.json",
            raw_result,
        )
        markdown_path = await ctx["pipeline"].storage.write_text(
            f"{artifact_prefix}/document.md",
            markdown,
        )
        content_list_path = await ctx["pipeline"].storage.write_json(
            f"{artifact_prefix}/content-list.json",
            content_list,
        )
        await _set_state(
            ctx,
            document_id,
            version,
            raw_result_path=raw_path,
            markdown_path=markdown_path,
            content_list_path=content_list_path,
        )

        if await _is_cancelled(ctx, document_id, version):
            await _stage(ctx, document_id, version, "cancelled")
            return {"documentId": document_id, "status": "cancelled", "chunkCount": 0}

        await _stage(ctx, document_id, version, "chunking")

        async def on_index_stage(stage: str) -> None:
            await _stage(ctx, document_id, version, stage)

        chunks = await ctx["pipeline"].index_blocks(
            blocks,
            knowledge_base_id,
            document_id,
            version,
            chunk_size=int(options.get("chunk_size") or ctx["pipeline"].chunk_size),
            chunk_overlap=int(
                options.get("chunk_overlap")
                if options.get("chunk_overlap") is not None
                else ctx["pipeline"].chunk_overlap
            ),
            on_stage=on_index_stage,
        )
        if await _is_cancelled(ctx, document_id, version):
            await ctx["pipeline"].store.delete_document_version(document_id, version)
            await _stage(ctx, document_id, version, "cancelled")
            return {"documentId": document_id, "status": "cancelled", "chunkCount": 0}
        chunk_path = await ctx["pipeline"].storage.write_json(
            f"{artifact_prefix}/chunks.json",
            [chunk.model_dump() for chunk in chunks],
        )
        result_payload = {
            "documentId": document_id,
            "status": "ready",
            "chunkCount": len(chunks),
            "mineruTaskId": (await _get_state(ctx, document_id, version)).get("mineru_task_id"),
            "markdownPath": markdown_path,
            "contentListPath": content_list_path,
            "rawResultPath": raw_path,
            "chunksPath": chunk_path,
            "totalDurationMs": int((time.time() - task_started_at) * 1000),
        }
        await _stage(ctx, document_id, version, "ready", **result_payload)
        return result_payload
    except asyncio.CancelledError:
        await _stage(ctx, document_id, version, "cancelled")
        return {"documentId": document_id, "status": "cancelled", "chunkCount": 0}
    except Exception as exc:
        failure_type = (
            "timeout"
            if isinstance(exc, TimeoutError)
            else "empty_result"
            if "no parseable content" in str(exc).lower()
            else "dependency"
            if isinstance(exc, (httpx.HTTPError, ConnectionError))
            else exc.__class__.__name__
        )
        await _stage(
            ctx,
            document_id,
            version,
            "failed",
            error=str(exc) or exc.__class__.__name__,
            failureType=failure_type,
            totalDurationMs=int((time.time() - task_started_at) * 1000),
        )
        raise
    finally:
        state = await _get_state(ctx, document_id, version)
        if state.get("status") in {"ready", "cancelled"}:
            try:
                source.unlink(missing_ok=True)
            except OSError:
                # Source cleanup must not turn a completed ingestion into a failed task.
                pass


async def ingest_url_task(
    ctx,
    url: str,
    knowledge_base_id: str,
    document_id: str,
    version: int,
    options: dict[str, Any] | None = None,
) -> dict:
    raise RuntimeError("URL ingestion is not exposed until its ownership policy is defined")
