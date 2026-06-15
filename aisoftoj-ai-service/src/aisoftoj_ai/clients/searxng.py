import httpx

from aisoftoj_ai.rag.models import SearchResult


class Searxng:
    """封装 SearXNG 公开搜索接口。"""
    def __init__(self, base_url: str):
        """初始化搜索地址。"""
        self.url = f"{base_url.rstrip('/')}/search"

    async def search(self, query: str, limit: int = 5) -> list[SearchResult]:
        """检索公开网页并转换为 SearchResult 列表。"""
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.get(
                self.url,
                params={"q": query, "format": "json", "language": "zh-CN"},
            )
            response.raise_for_status()

        return [
            SearchResult(
                id=f"web-{index}",
                content=item.get("content") or item.get("title", ""),
                source="web",
                title=item.get("title"),
                url=item.get("url"),
                score=float(item.get("score", 0)),
            )
            for index, item in enumerate(response.json().get("results", [])[:limit])
        ]
