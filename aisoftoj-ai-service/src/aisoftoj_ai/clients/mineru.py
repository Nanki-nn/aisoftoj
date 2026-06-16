import asyncio
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import httpx

from aisoftoj_ai.rag.models import DocumentBlock


@dataclass
class MineruResult:
    raw: dict[str, Any]
    markdown: str
    content_list: list[dict[str, Any]]
    blocks: list[DocumentBlock]


class Mineru:
    """MinerU 3.x asynchronous API client."""

    def __init__(self, base_url: str, poll_interval: float = 2.0):
        self.base_url = base_url.rstrip("/")
        self.poll_interval = poll_interval

    async def capabilities(self) -> dict[str, Any]:
        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.get(f"{self.base_url}/openapi.json")
            response.raise_for_status()
            return response.json()

    async def submit_file(self, file_path: str, options: dict[str, Any]) -> str:
        path = Path(file_path)
        data = self._request_data(options)
        async with httpx.AsyncClient(timeout=httpx.Timeout(60, read=120)) as client:
            with path.open("rb") as file:
                response = await client.post(
                    f"{self.base_url}/tasks",
                    data=data,
                    files=[("files", (path.name, file, "application/octet-stream"))],
                )
            response.raise_for_status()
        payload = response.json()
        task_id = payload.get("task_id")
        if not task_id:
            raise RuntimeError("MinerU did not return task_id")
        return str(task_id)

    async def get_status(self, task_id: str) -> dict[str, Any]:
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.get(f"{self.base_url}/tasks/{task_id}")
            if response.status_code == 404:
                return {"task_id": task_id, "status": "not_found"}
            response.raise_for_status()
            return response.json()

    async def get_result(self, task_id: str) -> MineruResult:
        async with httpx.AsyncClient(timeout=httpx.Timeout(60, read=600)) as client:
            response = await client.get(f"{self.base_url}/tasks/{task_id}/result")
            response.raise_for_status()
            payload = response.json()
        return self.normalize(payload)

    async def wait(
        self,
        task_id: str,
        on_status=None,
        is_cancelled=None,
        timeout_seconds: int = 3600,
    ) -> MineruResult:
        elapsed = 0.0
        while elapsed < timeout_seconds:
            if is_cancelled and await is_cancelled():
                raise asyncio.CancelledError("Ingestion was cancelled")
            status = await self.get_status(task_id)
            if on_status:
                await on_status(status)
            state = status.get("status")
            if state == "completed":
                return await self.get_result(task_id)
            if state in {"failed", "not_found"}:
                raise RuntimeError(status.get("error") or f"MinerU task {state}")
            await asyncio.sleep(self.poll_interval)
            elapsed += self.poll_interval
        raise TimeoutError(f"MinerU task timed out after {timeout_seconds} seconds")

    def normalize(self, payload: dict[str, Any]) -> MineruResult:
        result_root = payload.get("results", payload.get("data", payload))
        if not isinstance(result_root, dict):
            raise RuntimeError("MinerU result has an invalid structure")

        candidates = list(result_root.values())
        result = candidates[0] if candidates and isinstance(candidates[0], dict) else result_root
        content_list = result.get("content_list") or result.get("content") or []
        markdown = result.get("md_content") or result.get("markdown") or ""
        if isinstance(content_list, str):
            try:
                content_list = json.loads(content_list)
            except json.JSONDecodeError:
                markdown = markdown or content_list
                content_list = []
        if not isinstance(content_list, list):
            content_list = []

        images = result.get("images") if isinstance(result.get("images"), dict) else {}
        blocks = self._normalize_items(content_list, images)
        if not blocks and markdown.strip():
            blocks = [DocumentBlock(content=markdown)]
        if not blocks:
            raise RuntimeError("MinerU returned no parseable content")
        return MineruResult(
            raw=payload,
            markdown=markdown,
            content_list=content_list,
            blocks=blocks,
        )

    def _normalize_items(
        self,
        items: list[dict[str, Any]],
        images: dict[str, str] | None = None,
    ) -> list[DocumentBlock]:
        blocks: list[DocumentBlock] = []
        headings: list[str] = []
        for item in items:
            if not isinstance(item, dict):
                continue
            content_type = item.get("type", "text")
            if content_type in {"title", "heading"} or (
                content_type == "text" and item.get("text_level") is not None
            ):
                title = item.get("text") or item.get("content") or ""
                level = int(item.get("text_level") or item.get("level") or 1)
                title = str(title).strip()
                if title:
                    headings = headings[: max(0, level - 1)] + [title]
                continue
            mapped_type = {
                "table": "table",
                "equation": "formula",
                "formula": "formula",
                "image": "image",
            }.get(content_type, "text")
            content = (
                item.get("text")
                or item.get("content")
                or item.get("table_body")
                or item.get("caption")
                or "\n".join(str(value) for value in item.get("list_items", []))
                or ""
            )
            asset_url = item.get("img_path") or item.get("image_path")
            if asset_url and images:
                asset_url = images.get(Path(str(asset_url)).name, asset_url)
            blocks.append(
                DocumentBlock(
                    content=str(content),
                    content_type=mapped_type,
                    heading_path=list(headings),
                    page=item.get("page_idx", item.get("page")),
                    bbox=item.get("bbox"),
                    asset_url=asset_url,
                )
            )
        return blocks

    def _request_data(self, options: dict[str, Any]) -> dict[str, str]:
        fields = {
            "backend": options.get("backend", "hybrid-engine"),
            "effort": options.get("effort", "medium"),
            "parse_method": options.get("parse_method", "auto"),
            "formula_enable": options.get("formula_enable", True),
            "table_enable": options.get("table_enable", True),
            "image_analysis": options.get("image_analysis", False),
            "return_md": True,
            "return_content_list": True,
            "return_middle_json": options.get("return_middle_json", False),
            "return_model_output": options.get("return_model_output", False),
            "return_images": options.get("return_images", True),
            "start_page_id": options.get("start_page_id", 0),
            "end_page_id": options.get("end_page_id", 99999),
        }
        languages = options.get("lang_list") or ["ch"]
        data = {
            key: str(value).lower() if isinstance(value, bool) else str(value)
            for key, value in fields.items()
        }
        data["lang_list"] = str(languages[0])
        return data
