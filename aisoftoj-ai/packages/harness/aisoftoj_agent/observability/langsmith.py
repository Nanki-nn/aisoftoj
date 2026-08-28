from __future__ import annotations

import asyncio
import hashlib
import logging
from collections.abc import Callable, Iterator, Mapping
from contextlib import contextmanager

from langchain_core.runnables import RunnableConfig
from langsmith import Client, tracing_context

from config import Settings

from .config import LangSmithConfig
from .redaction import SecretRedactor

logger = logging.getLogger(__name__)


class LangSmithTracing:
    __slots__ = ("config", "_client")

    def __init__(
        self, config: LangSmithConfig, client: Client | None
    ) -> None:
        self.config = config
        self._client = client

    @classmethod
    def disabled(cls) -> LangSmithTracing:
        return cls(LangSmithConfig.from_env({}), None)

    @property
    def enabled(self) -> bool:
        return self._client is not None

    @contextmanager
    def trace_run(
        self,
        *,
        run_id: str,
        thread_id: str,
        user_id: int,
        question_id: int | None,
        model: str,
    ) -> Iterator[RunnableConfig]:
        metadata = {
            "run_id": run_id,
            "thread_id": thread_id,
            "user_id_hash": hashlib.sha256(str(user_id).encode()).hexdigest()[:16],
            "question_id": question_id,
            "agent_name": "aisoftoj-assistant",
            "agent_version": self.config.agent_version,
            "model": model,
            "environment": self.config.environment,
        }
        tags = [
            f"environment:{self.config.environment}",
            "agent:aisoftoj-assistant",
            f"agent-version:{self.config.agent_version}",
        ]
        runnable_config: RunnableConfig = {
            "run_name": "aisoftoj-agent-run",
            "tags": tags,
            "metadata": metadata,
        }
        if self._client is None:
            with tracing_context(parent=False, enabled=False, client=None):
                yield runnable_config
            return
        with tracing_context(
            project_name=self.config.project,
            tags=tags,
            metadata=metadata,
            parent=False,
            enabled=True,
            client=self._client,
        ):
            yield runnable_config

    async def aclose(self) -> None:
        if self._client is None:
            return
        try:
            await asyncio.to_thread(
                self._client.close,
                timeout=self.config.flush_timeout_seconds,
            )
        except Exception as exc:
            logger.warning(
                "event=langsmith_trace_close_failed error_type=%s",
                type(exc).__name__,
            )


def build_langsmith_tracing(
    settings: Settings,
    *,
    environ: Mapping[str, str] | None = None,
    client_factory: Callable[..., Client] = Client,
) -> LangSmithTracing:
    config = LangSmithConfig.from_env(environ)
    if not config.enabled or config.api_key is None:
        return LangSmithTracing(config, None)
    api_key = config.api_key.get_secret_value()
    redactor = SecretRedactor(
        [
            settings.database_url.get_secret_value(),
            settings.llm_api_key.get_secret_value(),
            settings.platform_service_key.get_secret_value(),
            api_key,
        ],
        hide_content=True,
    )
    client = client_factory(
        api_url=config.endpoint,
        api_key=api_key,
        auto_batch_tracing=True,
        anonymizer=redactor,
        tracing_sampling_rate=config.sampling_rate,
        tracing_error_callback=_trace_error,
    )
    return LangSmithTracing(config, client)


def _trace_error(exc: Exception) -> None:
    logger.warning(
        "event=langsmith_trace_export_failed error_type=%s",
        type(exc).__name__,
    )
