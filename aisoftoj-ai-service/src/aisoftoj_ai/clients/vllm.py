import json
from collections.abc import AsyncIterator

import httpx


def _get_reasoning(delta: dict) -> str | None:
    """提取模型输出中的思考内容。"""
    return delta.get("reasoning") or delta.get("reasoning_content")


class _ThinkingContentParser:
    """解析 Qwen <think> 流式内容并拆分 token 与 reasoning。"""
    def __init__(self):
        """初始化思考内容解析器。"""
        self.buffer = ""
        self.in_reasoning = False
        self.detected_tags = False

    def feed(self, content: str) -> list[tuple[str, str]]:
        """解析流式文本并拆分为 token 和 reasoning 事件。"""
        self.buffer += content
        events = []
        while self.buffer:
            if self.in_reasoning:
                end = self.buffer.find("</think>")
                if end >= 0:
                    if end:
                        events.append(("reasoning", self.buffer[:end]))
                    self.buffer = self.buffer[end + len("</think>") :]
                    self.in_reasoning = False
                    continue
                if len(self.buffer) > len("</think>"):
                    safe_length = len(self.buffer) - len("</think>")
                    events.append(("reasoning", self.buffer[:safe_length]))
                    self.buffer = self.buffer[safe_length:]
                break

            start = self.buffer.find("<think>")
            if start >= 0:
                if start:
                    events.append(("token", self.buffer[:start]))
                self.buffer = self.buffer[start + len("<think>") :]
                self.in_reasoning = True
                self.detected_tags = True
                continue

            if not self.detected_tags and len(self.buffer) <= len("<think>"):
                break
            safe_length = (
                len(self.buffer)
                if self.detected_tags
                else len(self.buffer) - len("<think>")
            )
            if safe_length > 0:
                events.append(("token", self.buffer[:safe_length]))
                self.buffer = self.buffer[safe_length:]
            break
        return events

    def finish(self) -> list[tuple[str, str]]:
        """输出缓冲区中的最后一段内容。"""
        if not self.buffer:
            return []
        event_type = "reasoning" if self.in_reasoning else "token"
        content = self.buffer
        self.buffer = ""
        return [(event_type, content)]


class VllmChat:
    """封装 vLLM/OpenAI 兼容的聊天接口。"""
    def __init__(self, base_url: str, api_key: str, model: str):
        """初始化聊天客户端配置。"""
        self.url = f"{base_url.rstrip('/')}/chat/completions"
        self.headers = {"Authorization": f"Bearer {api_key}"}
        self.model = model

    async def complete(
        self,
        messages: list[dict[str, str]],
        temperature: float = 0.1,
    ) -> str:
        """一次性获取完整回答。"""
        async with httpx.AsyncClient(timeout=120) as client:
            response = await client.post(
                self.url,
                headers=self.headers,
                json={
                    "model": self.model,
                    "messages": messages,
                    "temperature": temperature,
                    "chat_template_kwargs": {"enable_thinking": False},
                },
            )
            response.raise_for_status()
            return response.json()["choices"][0]["message"]["content"].strip()

    async def stream(
        self,
        messages: list[dict[str, str]],
        temperature: float = 0.2,
    ) -> AsyncIterator[str]:
        """仅输出普通 token，不包含思考内容。"""
        async for event_type, token in self.stream_with_reasoning(
            messages,
            temperature=temperature,
            thinking_enabled=False,
        ):
            if event_type == "token":
                yield token

    async def stream_with_reasoning(
        self,
        messages: list[dict[str, str]],
        temperature: float = 0.2,
        thinking_enabled: bool = False,
    ) -> AsyncIterator[tuple[str, str]]:
        """按 SSE 事件流输出 token 和 reasoning。"""
        payload = {
            "model": self.model,
            "messages": messages,
            "temperature": temperature,
            "stream": True,
            "chat_template_kwargs": {"enable_thinking": thinking_enabled},
        }
        parser = _ThinkingContentParser() if thinking_enabled else None
        async with httpx.AsyncClient(timeout=120) as client:
            async with client.stream(
                "POST",
                self.url,
                headers=self.headers,
                json=payload,
            ) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if not line.startswith("data: "):
                        continue
                    data = line[6:]
                    if data == "[DONE]":
                        break
                    delta = json.loads(data)["choices"][0]["delta"]
                    reasoning = _get_reasoning(delta)
                    content = delta.get("content")
                    if reasoning:
                        yield "reasoning", reasoning
                    if content:
                        if parser is None or reasoning:
                            yield "token", content
                        else:
                            for event in parser.feed(content):
                                yield event
                if parser is not None:
                    for event in parser.finish():
                        yield event


class VllmEmbedding:
    """封装 vLLM/OpenAI 兼容的 embedding 接口。"""
    def __init__(self, base_url: str, api_key: str, model: str):
        """初始化 embedding 客户端配置。"""
        self.url = f"{base_url.rstrip('/')}/embeddings"
        self.headers = {"Authorization": f"Bearer {api_key}"}
        self.model = model

    async def embed_texts(self, texts: list[str]) -> list[list[float]]:
        """批量生成文本向量。"""
        async with httpx.AsyncClient(timeout=120) as client:
            response = await client.post(
                self.url,
                headers=self.headers,
                json={"model": self.model, "input": texts},
            )
            response.raise_for_status()
            data = sorted(response.json()["data"], key=lambda item: item["index"])
            return [item["embedding"] for item in data]

    async def embed_image(self, image_url: str, text: str = "") -> list[float]:
        """生成图片向量，必要时附带文本提示。"""
        content = [
            {"type": "text", "text": text or "请表示这张图片的语义内容"},
            {"type": "image_url", "image_url": {"url": image_url}},
        ]
        async with httpx.AsyncClient(timeout=120) as client:
            response = await client.post(
                self.url,
                headers=self.headers,
                json={
                    "model": self.model,
                    "messages": [{"role": "user", "content": content}],
                },
            )
            response.raise_for_status()
            return response.json()["data"][0]["embedding"]
