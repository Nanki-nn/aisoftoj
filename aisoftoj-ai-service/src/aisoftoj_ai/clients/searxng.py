import asyncio
import hashlib
import html
import re
from urllib.parse import urlsplit, urlunsplit

import httpx

from aisoftoj_ai.rag.models import SearchResult

TAG_PATTERN = re.compile(r"<[^>]+>")
SPACE_PATTERN = re.compile(r"\s+")


class Searxng:
    """SearXNG JSON API client with retry, validation and result cleanup."""

    def __init__(
        self,
        base_url: str,
        timeout: float = 20,
        max_retries: int = 2,
        transport: httpx.AsyncBaseTransport | None = None,
    ):
        self.url = f"{base_url.rstrip('/')}/search"
        self.timeout = timeout
        self.max_retries = max_retries
        self.transport = transport

    async def search(self, query: str, limit: int = 5) -> list[SearchResult]:
        query = query.strip()
        if not query:
            return []

        response = await self._request(query, max(1, min(limit, 20)))
        try:
            payload = response.json()
        except ValueError as exc:
            raise RuntimeError(
                "SearXNG 未返回 JSON，请在 settings.yml 中启用 json format"
            ) from exc

        raw_results = payload.get("results")
        if not isinstance(raw_results, list):
            raise RuntimeError("SearXNG 响应缺少 results 数组")
        unresponsive = payload.get("unresponsive_engines")
        if not raw_results and isinstance(unresponsive, list) and unresponsive:
            failures = ", ".join(
                f"{item[0]} ({item[1]})"
                for item in unresponsive[:5]
                if isinstance(item, list) and len(item) >= 2
            )
            raise RuntimeError(f"SearXNG 上游搜索引擎不可用：{failures}")

        results: list[SearchResult] = []
        seen_urls: set[str] = set()
        for item in raw_results:
            if not isinstance(item, dict):
                continue
            url = _normalize_url(str(item.get("url") or ""))
            if not url or url in seen_urls:
                continue
            title = _clean_text(item.get("title"))
            content = _clean_text(item.get("content")) or title
            if not content:
                continue
            seen_urls.add(url)
            result_id = hashlib.sha256(url.encode()).hexdigest()[:20]
            results.append(
                SearchResult(
                    id=f"web-{result_id}",
                    content=content,
                    source="web",
                    title=title or url,
                    url=url,
                    score=float(item.get("score") or 0),
                )
            )
            if len(results) >= limit:
                break
        return results

    async def _request(self, query: str, limit: int) -> httpx.Response:
        params = {
            "q": query,
            "format": "json",
            "language": "zh-CN",
            "categories": "general",
            "safesearch": 1,
            "pageno": 1,
        }
        headers = {
            "Accept": "application/json",
            "User-Agent": "aisoftoj-ai-service/1.0",
        }
        async with httpx.AsyncClient(
            timeout=self.timeout,
            follow_redirects=True,
            transport=self.transport,
            headers=headers,
        ) as client:
            for attempt in range(self.max_retries + 1):
                response = await client.get(self.url, params=params)
                if response.status_code != 429:
                    response.raise_for_status()
                    return response
                if attempt < self.max_retries:
                    retry_after = response.headers.get("Retry-After")
                    delay = float(retry_after) if retry_after else 0.5 * (2**attempt)
                    await asyncio.sleep(min(delay, 5))

        raise RuntimeError(
            "SearXNG 请求被限流（HTTP 429），请在服务器 limiter.toml 中放行 AI 服务 IP"
        )


def _clean_text(value) -> str:
    text = html.unescape(str(value or ""))
    return SPACE_PATTERN.sub(" ", TAG_PATTERN.sub("", text)).strip()


def _normalize_url(value: str) -> str:
    try:
        parts = urlsplit(value.strip())
    except ValueError:
        return ""
    if parts.scheme not in {"http", "https"} or not parts.netloc:
        return ""
    return urlunsplit((parts.scheme, parts.netloc, parts.path, parts.query, ""))
