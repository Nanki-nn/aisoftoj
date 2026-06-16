import httpx
import pytest

from aisoftoj_ai.clients.searxng import Searxng


async def test_searxng_cleans_and_deduplicates_results():
    async def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.params["format"] == "json"
        assert request.url.params["language"] == "zh-CN"
        return httpx.Response(
            200,
            json={
                "results": [
                    {
                        "title": "<b>软考</b> 介绍",
                        "content": "  国家级&nbsp;考试  ",
                        "url": "https://example.com/a#part",
                        "score": 1.5,
                    },
                    {
                        "title": "重复",
                        "content": "重复内容",
                        "url": "https://example.com/a#other",
                    },
                    {"title": "无效地址", "url": "javascript:alert(1)"},
                ]
            },
        )

    client = Searxng("http://searxng", transport=httpx.MockTransport(handler))
    results = await client.search("软考", limit=5)

    assert len(results) == 1
    assert results[0].title == "软考 介绍"
    assert results[0].content == "国家级 考试"
    assert results[0].url == "https://example.com/a"


async def test_searxng_reports_disabled_json_format():
    transport = httpx.MockTransport(
        lambda request: httpx.Response(200, text="<html>search</html>")
    )
    client = Searxng("http://searxng", transport=transport)

    with pytest.raises(RuntimeError, match="启用 json format"):
        await client.search("软考")


async def test_searxng_reports_rate_limit():
    transport = httpx.MockTransport(
        lambda request: httpx.Response(429, headers={"Retry-After": "0"})
    )
    client = Searxng(
        "http://searxng",
        max_retries=1,
        transport=transport,
    )

    with pytest.raises(RuntimeError, match="HTTP 429"):
        await client.search("软考")


async def test_searxng_reports_upstream_engine_failures():
    transport = httpx.MockTransport(
        lambda request: httpx.Response(
            200,
            json={
                "results": [],
                "unresponsive_engines": [
                    ["duckduckgo", "timeout"],
                    ["google", "Suspended: timeout"],
                ],
            },
        )
    )
    client = Searxng("http://searxng", transport=transport)

    with pytest.raises(RuntimeError, match="duckduckgo \\(timeout\\)"):
        await client.search("软考")
