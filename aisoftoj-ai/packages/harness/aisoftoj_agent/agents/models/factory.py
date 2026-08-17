from __future__ import annotations

from langchain_openai import ChatOpenAI

from config import Settings


def build_chat_model(settings: Settings) -> ChatOpenAI:
    return ChatOpenAI(
        model=settings.llm_default_model,
        base_url=str(settings.llm_base_url).rstrip("/"),
        api_key=settings.llm_api_key.get_secret_value(),
        streaming=True,
        timeout=settings.llm_request_timeout_seconds,
        max_retries=settings.llm_max_retries,
    )
