from __future__ import annotations

from collections.abc import AsyncIterable, Sequence
from typing import Any

import httpx
from pydantic import ValidationError

from .contracts import (
    MineruBatchRef,
    MineruBatchResult,
    MineruFileSpec,
    MineruParseOptions,
    MineruTaskRef,
    MineruTaskResult,
    MineruUploadBatch,
    MineruUrlFile,
)
from .errors import MineruError, envelope_error, json_object


class MineruClient:
    """Async client for the MinerU V4 API, fixed to the ``vlm`` model."""

    MAX_BATCH_FILES = 50

    def __init__(
        self,
        *,
        token: str,
        base_url: str = "https://mineru.net",
        connect_timeout: float = 10,
        read_timeout: float = 60,
        write_timeout: float = 120,
        pool_timeout: float = 10,
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> None:
        if not token.strip():
            raise ValueError("MinerU token must not be empty")
        timeout = httpx.Timeout(
            read_timeout,
            connect=connect_timeout,
            write=write_timeout,
            pool=pool_timeout,
        )
        self._api = httpx.AsyncClient(
            base_url=base_url.rstrip("/"),
            timeout=timeout,
            headers={"Accept": "application/json", "Authorization": f"Bearer {token}"},
            transport=transport,
            trust_env=False,
        )
        # Signed OSS uploads and CDN downloads must never receive the MinerU token.
        self._public = httpx.AsyncClient(
            timeout=timeout,
            headers={"Accept": "*/*"},
            transport=transport,
            trust_env=False,
        )

    async def close(self) -> None:
        await self._api.aclose()
        await self._public.aclose()

    async def submit_url(
        self,
        url: str,
        *,
        options: MineruParseOptions | None = None,
    ) -> MineruTaskRef:
        if not url.strip():
            raise ValueError("url must not be empty")
        opts = options or MineruParseOptions()
        payload = opts.to_payload()
        payload["url"] = url
        payload["model_version"] = "vlm"
        return await self._post_model("/api/v4/extract/task", payload, MineruTaskRef)

    async def submit_url_batch(
        self,
        files: Sequence[MineruUrlFile],
        *,
        options: MineruParseOptions | None = None,
    ) -> MineruBatchRef:
        self._validate_batch(files)
        opts = options or MineruParseOptions()
        payload: dict[str, Any] = {
            "files": [item.to_payload(opts) for item in files],
            "model_version": "vlm",
        }
        payload.update(opts.to_payload(include_data_id=False))
        payload.pop("is_ocr", None)
        payload.pop("page_ranges", None)
        # The endpoint returns a batch_id, represented separately from its results.
        return await self._post_model("/api/v4/extract/task/batch", payload, MineruBatchRef)

    async def request_upload_urls(
        self,
        files: Sequence[MineruFileSpec],
        *,
        options: MineruParseOptions | None = None,
    ) -> MineruUploadBatch:
        self._validate_batch(files)
        opts = options or MineruParseOptions()
        payload: dict[str, Any] = {
            "files": [item.to_payload() for item in files],
            "model_version": "vlm",
        }
        payload.update(opts.to_payload(include_data_id=False))
        payload.pop("is_ocr", None)
        payload.pop("page_ranges", None)
        return await self._post_model("/api/v4/file-urls/batch", payload, MineruUploadBatch)

    async def upload_file(self, upload_url: str, content: bytes | AsyncIterable[bytes]) -> None:
        if not upload_url.strip():
            raise ValueError("upload_url must not be empty")
        try:
            response = await self._public.put(upload_url, content=content, headers={})
        except (httpx.TimeoutException, httpx.TransportError) as exc:
            raise MineruError("UPLOAD_UNAVAILABLE", "MinerU upload endpoint unavailable") from exc
        if response.status_code not in {200, 201, 204}:
            raise envelope_error(None, response.status_code)

    async def get_task(self, task_id: str) -> MineruTaskResult:
        if not task_id.strip():
            raise ValueError("task_id must not be empty")
        return await self._get_model(f"/api/v4/extract/task/{task_id}", MineruTaskResult)

    async def get_batch(self, batch_id: str) -> MineruBatchResult:
        if not batch_id.strip():
            raise ValueError("batch_id must not be empty")
        return await self._get_model(f"/api/v4/extract-results/batch/{batch_id}", MineruBatchResult)

    async def download_result(
        self, result_url: str, *, max_bytes: int = 512 * 1024 * 1024
    ) -> bytes:
        if not result_url.strip():
            raise ValueError("result_url must not be empty")
        if max_bytes <= 0:
            raise ValueError("max_bytes must be positive")
        try:
            async with self._public.stream("GET", result_url) as response:
                if response.status_code >= 400:
                    raise envelope_error(None, response.status_code)
                content_length = response.headers.get("content-length")
                if content_length is not None and int(content_length) > max_bytes:
                    raise MineruError("RESULT_TOO_LARGE", "MinerU result exceeds configured limit")
                chunks: list[bytes] = []
                total = 0
                async for chunk in response.aiter_bytes():
                    total += len(chunk)
                    if total > max_bytes:
                        raise MineruError(
                            "RESULT_TOO_LARGE", "MinerU result exceeds configured limit"
                        )
                    chunks.append(chunk)
                return b"".join(chunks)
        except MineruError:
            raise
        except (httpx.TimeoutException, httpx.TransportError) as exc:
            raise MineruError("DOWNLOAD_UNAVAILABLE", "MinerU result endpoint unavailable") from exc

    async def _post_model(self, path: str, payload: dict[str, Any], model: type[Any]) -> Any:
        response = await self._request_api("POST", path, json=payload)
        return self._parse_envelope(response, model)

    async def _get_model(self, path: str, model: type[Any]) -> Any:
        response = await self._request_api("GET", path)
        return self._parse_envelope(response, model)

    async def _request_api(self, method: str, path: str, **kwargs: Any) -> httpx.Response:
        try:
            response = await self._api.request(method, path, **kwargs)
        except (httpx.TimeoutException, httpx.TransportError) as exc:
            raise MineruError("UPSTREAM_UNAVAILABLE", "MinerU API unavailable") from exc
        if response.status_code >= 400:
            payload: object
            try:
                payload = response.json()
            except ValueError:
                payload = None
            raise envelope_error(payload, response.status_code)
        return response

    def _parse_envelope(self, response: httpx.Response, model: type[Any]) -> Any:
        try:
            payload = response.json()
        except ValueError as exc:
            raise MineruError.invalid_response("response is not valid JSON") from exc
        obj = json_object(payload)
        if obj is None or obj.get("code") != 0 or not isinstance(obj.get("data"), dict):
            raise envelope_error(obj, response.status_code)
        try:
            return model.model_validate(obj["data"])
        except ValidationError as exc:
            raise MineruError.invalid_response(
                "response data does not match MinerU contract"
            ) from exc

    @classmethod
    def _validate_batch(cls, files: Sequence[object]) -> None:
        if not files:
            raise ValueError("files must not be empty")
        if len(files) > cls.MAX_BATCH_FILES:
            raise ValueError(f"MinerU accepts at most {cls.MAX_BATCH_FILES} files per batch")
