import asyncio
import base64
import json
import mimetypes
import shutil
from pathlib import Path
from typing import Any


class LocalStorage:
    """本地文件存储，负责上传资源并返回访问地址。"""
    def __init__(self, directory: str, base_url: str):
        """初始化本地存储目录和访问前缀。"""
        self.directory = Path(directory)
        self.base_url = base_url.rstrip("/")

    async def upload(self, source: str, key: str) -> str:
        """复制文件到本地目录并返回公开 URL。"""
        target = self.directory / key
        target.parent.mkdir(parents=True, exist_ok=True)
        await asyncio.to_thread(shutil.copyfile, source, target)
        return f"{self.base_url}/{key}"

    async def write_data_url(self, data_url: str, key: str) -> str:
        header, encoded = data_url.split(",", 1)
        if ";base64" not in header:
            raise ValueError("Unsupported image data URL")
        target = self.directory / key
        target.parent.mkdir(parents=True, exist_ok=True)
        await asyncio.to_thread(target.write_bytes, base64.b64decode(encoded))
        return f"{self.base_url}/{key}"

    async def as_data_url(self, url: str) -> str:
        prefix = f"{self.base_url}/"
        if not url.startswith(prefix):
            return url
        path = self.path(url[len(prefix) :])
        mime_type = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
        data = await asyncio.to_thread(path.read_bytes)
        return f"data:{mime_type};base64,{base64.b64encode(data).decode()}"

    async def write_json(self, key: str, value: Any) -> str:
        target = self.directory / key
        target.parent.mkdir(parents=True, exist_ok=True)
        await asyncio.to_thread(
            target.write_text,
            json.dumps(value, ensure_ascii=False, indent=2),
            "utf-8",
        )
        return str(target)

    async def write_text(self, key: str, value: str) -> str:
        target = self.directory / key
        target.parent.mkdir(parents=True, exist_ok=True)
        await asyncio.to_thread(target.write_text, value, "utf-8")
        return str(target)

    def path(self, key: str) -> Path:
        return self.directory / key

    async def delete_prefix(self, key: str) -> None:
        target = (self.directory / key).resolve()
        root = self.directory.resolve()
        if root not in target.parents:
            raise ValueError("Storage deletion escaped the configured root")
        if target.exists():
            await asyncio.to_thread(shutil.rmtree, target)
