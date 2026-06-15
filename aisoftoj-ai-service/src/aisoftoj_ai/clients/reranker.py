import httpx

from aisoftoj_ai.rag.models import SearchResult


class Reranker:
    """使用外部重排服务对检索结果重新排序。"""
    def __init__(self, base_url: str, path: str, api_key: str, model: str):
        """初始化重排服务配置。"""
        self.url = f"{base_url.rstrip('/')}/{path.lstrip('/')}"
        self.headers = {"Authorization": f"Bearer {api_key}"}
        self.model = model

    async def rerank(
        self,
        query: str,
        results: list[SearchResult],
        limit: int,
    ) -> list[SearchResult]:
        """调用重排接口并按得分返回前 N 条结果。"""
        if not results:
            return []
        async with httpx.AsyncClient(timeout=60) as client:
            response = await client.post(
                self.url,
                headers=self.headers,
                json={
                    "model": self.model,
                    "query": query,
                    "documents": [item.content for item in results],
                    "top_n": limit,
                },
            )
            response.raise_for_status()
            ranked = response.json().get("results", response.json().get("data", []))

        output: list[SearchResult] = []
        for item in ranked[:limit]:
            source = results[item["index"]].model_copy()
            source.score = float(item.get("relevance_score", item.get("score", source.score)))
            output.append(source)
        return output
