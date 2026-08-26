from __future__ import annotations

import asyncio
import hashlib
import ipaddress
import os
import socket
import tempfile
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import urljoin, urlsplit

import httpx


class TextbookDownloadError(RuntimeError):
    pass


@dataclass(frozen=True, slots=True)
class DownloadedTextbook:
    path: Path
    sha256: str


class SecureTextbookDownloader:
    def __init__(
        self,
        *,
        allowed_hosts: list[str],
        timeout_seconds: float,
        max_bytes: int,
        max_redirects: int,
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> None:
        self.allowed_hosts = frozenset(host.lower().rstrip(".") for host in allowed_hosts)
        self.max_bytes = max_bytes
        self.max_redirects = max_redirects
        self._require_peer_validation = transport is None
        self._client = httpx.AsyncClient(
            timeout=timeout_seconds,
            follow_redirects=False,
            transport=transport,
            trust_env=False,
            headers={"Accept": "application/pdf,application/octet-stream;q=0.5"},
        )

    async def close(self) -> None:
        await self._client.aclose()

    async def download(self, url: str) -> DownloadedTextbook:
        current = url
        for redirect_count in range(self.max_redirects + 1):
            await self._validate_url(current)
            async with self._client.stream("GET", current) as response:
                self._validate_connected_peer(response)
                if response.status_code in {301, 302, 303, 307, 308}:
                    location = response.headers.get("location")
                    if not location or redirect_count >= self.max_redirects:
                        raise TextbookDownloadError("TEXTBOOK_REDIRECT_REJECTED")
                    current = urljoin(current, location)
                    continue
                if response.status_code >= 400:
                    raise TextbookDownloadError("TEXTBOOK_SOURCE_UNAVAILABLE")
                content_length = response.headers.get("content-length")
                if content_length:
                    try:
                        if int(content_length) > self.max_bytes:
                            raise TextbookDownloadError("TEXTBOOK_SOURCE_TOO_LARGE")
                    except ValueError as exc:
                        raise TextbookDownloadError("TEXTBOOK_SOURCE_UNAVAILABLE") from exc
                content_type = response.headers.get("content-type", "").split(";", 1)[0].strip()
                if content_type not in {"application/pdf", "application/octet-stream", ""}:
                    raise TextbookDownloadError("TEXTBOOK_SOURCE_NOT_PDF")
                return await self._write_pdf(response)
        raise TextbookDownloadError("TEXTBOOK_REDIRECT_REJECTED")

    async def _write_pdf(self, response: httpx.Response) -> DownloadedTextbook:
        descriptor, raw_path = tempfile.mkstemp(prefix="aisoftoj-textbook-", suffix=".pdf")
        path = Path(raw_path)
        digest = hashlib.sha256()
        size = 0
        prefix = bytearray()
        try:
            with os.fdopen(descriptor, "wb") as handle:
                async for chunk in response.aiter_bytes():
                    size += len(chunk)
                    if size > self.max_bytes:
                        raise TextbookDownloadError("TEXTBOOK_SOURCE_TOO_LARGE")
                    if len(prefix) < 5:
                        prefix.extend(chunk[: 5 - len(prefix)])
                    digest.update(chunk)
                    handle.write(chunk)
            if bytes(prefix) != b"%PDF-":
                raise TextbookDownloadError("TEXTBOOK_SOURCE_NOT_PDF")
            return DownloadedTextbook(path=path, sha256=digest.hexdigest())
        except Exception:
            await asyncio.to_thread(path.unlink, missing_ok=True)
            raise

    async def _validate_url(self, url: str) -> None:
        parsed = urlsplit(url)
        host = (parsed.hostname or "").lower().rstrip(".")
        if parsed.scheme != "https" or not host or parsed.username or parsed.password:
            raise TextbookDownloadError("TEXTBOOK_SOURCE_REJECTED")
        allowed = any(
            host == candidate or host.endswith(f".{candidate}")
            for candidate in self.allowed_hosts
        )
        if not allowed:
            raise TextbookDownloadError("TEXTBOOK_SOURCE_REJECTED")
        try:
            addresses = await asyncio.to_thread(
                socket.getaddrinfo, host, parsed.port or 443, type=socket.SOCK_STREAM
            )
        except socket.gaierror as exc:
            raise TextbookDownloadError("TEXTBOOK_SOURCE_UNAVAILABLE") from exc
        if not addresses or any(_unsafe_address(str(item[4][0])) for item in addresses):
            raise TextbookDownloadError("TEXTBOOK_SOURCE_REJECTED")

    def _validate_connected_peer(self, response: httpx.Response) -> None:
        stream = response.extensions.get("network_stream")
        if stream is None:
            if self._require_peer_validation:
                raise TextbookDownloadError("TEXTBOOK_SOURCE_REJECTED")
            return
        server_address = stream.get_extra_info("server_addr")
        if (
            not isinstance(server_address, tuple)
            or not server_address
            or _unsafe_address(str(server_address[0]))
        ):
            raise TextbookDownloadError("TEXTBOOK_SOURCE_REJECTED")


def _unsafe_address(raw: str) -> bool:
    address = ipaddress.ip_address(raw)
    return bool(
        address.is_private
        or address.is_loopback
        or address.is_link_local
        or address.is_multicast
        or address.is_reserved
        or address.is_unspecified
    )
