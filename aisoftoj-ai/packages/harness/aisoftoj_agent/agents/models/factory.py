from __future__ import annotations

from langchain_core.language_models import BaseChatModel
from langchain_openai import ChatOpenAI

from config import Settings
from packages.harness.aisoftoj_agent.agents.models.direct_endpoint import (
    DirectEndpointChatModel,
)


def build_chat_model(settings: Settings) -> BaseChatModel:
    if settings.llm_endpoint_mode == "direct_endpoint":
        return DirectEndpointChatModel(
            endpoint=str(settings.llm_base_url),
            api_key=settings.llm_api_key,
            model_name=settings.llm_default_model,
            timeout_seconds=settings.llm_request_timeout_seconds,
            max_output_tokens=settings.agent_max_output_tokens,
        )
    return ChatOpenAI(
        model=settings.llm_default_model,
        base_url=str(settings.llm_base_url).rstrip("/"),
        api_key=settings.llm_api_key.get_secret_value(),
        streaming=True,
        timeout=settings.llm_request_timeout_seconds,
        max_retries=settings.llm_max_retries,
        max_tokens=settings.agent_max_output_tokens,
        stream_usage=True,
    )
