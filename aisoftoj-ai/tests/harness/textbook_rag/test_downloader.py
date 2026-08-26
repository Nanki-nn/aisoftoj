from __future__ import annotations

import asyncio
import socket

import httpx
import pytest

from packages.harness.aisoftoj_agent.textbook_rag.downloader import (
    SecureTextbookDownloader,
    TextbookDownloadError,
)


def public_dns(*_args: object, **_kwargs: object) -> list[tuple[object, ...]]:
    return [(socket.AF_INET, socket.SOCK_STREAM, 6, "", ("93.184.216.34", 443))]


async def test_downloader_requires_https_allowlist_and_pdf_magic(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(socket, "getaddrinfo", public_dns)
    downloader = SecureTextbookDownloader(
        allowed_hosts=["books.example.com"],
        timeout_seconds=2,
        max_bytes=1024,
        max_redirects=1,
        transport=httpx.MockTransport(
            lambda _request: httpx.Response(
                200,
                headers={"content-type": "application/pdf"},
                content=b"%PDF-1.7\nminimal",
            )
        ),
    )
    downloaded = await downloader.download("https://books.example.com/book.pdf")
    try:
        content = await asyncio.to_thread(downloaded.path.read_bytes)
        assert content.startswith(b"%PDF-")
        assert len(downloaded.sha256) == 64
    finally:
        await asyncio.to_thread(downloaded.path.unlink, missing_ok=True)
        await downloader.close()


async def test_downloader_rejects_non_https_or_non_allowlisted_sources(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(socket, "getaddrinfo", public_dns)
    downloader = SecureTextbookDownloader(
        allowed_hosts=["books.example.com"],
        timeout_seconds=2,
        max_bytes=1024,
        max_redirects=1,
        transport=httpx.MockTransport(lambda _request: httpx.Response(500)),
    )
    try:
        with pytest.raises(TextbookDownloadError, match="TEXTBOOK_SOURCE_REJECTED"):
            await downloader.download("http://books.example.com/book.pdf")
        with pytest.raises(TextbookDownloadError, match="TEXTBOOK_SOURCE_REJECTED"):
            await downloader.download("https://untrusted.example/book.pdf")
    finally:
        await downloader.close()
