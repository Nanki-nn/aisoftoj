from __future__ import annotations

from typing import Any
from unittest.mock import Mock

from langchain_core.callbacks import CallbackManagerForLLMRun
from langchain_core.language_models import BaseChatModel
from langchain_core.messages import AIMessage, BaseMessage, HumanMessage
from langchain_core.outputs import ChatGeneration, ChatResult
from langchain_core.tools import BaseTool

from config import Settings
from packages.harness.aisoftoj_agent.agents.context import AgentContext
from packages.harness.aisoftoj_agent.agents.factory import build_agent_graph


def settings() -> Settings:
    return Settings.model_validate(
        {
            "database_url": "mysql+asyncmy://user:secret@127.0.0.1/aisoftoj_ai",
            "platform_service_key": "service-secret",
            "llm_base_url": "https://gateway.example/v1",
            "llm_api_key": "llm-secret",
            "llm_default_model": "test-model",
        }
    )


class CapturingModel(BaseChatModel):
    bound_tool_names: list[str] = []

    @property
    def _llm_type(self) -> str:
        return "capturing-openai"

    def _get_ls_params(self, **_kwargs: Any) -> dict[str, Any]:
        return {"ls_provider": "openai", "ls_model_name": "test-model"}

    def bind_tools(
        self,
        tools: list[BaseTool | dict[str, Any]],
        **_kwargs: Any,
    ) -> CapturingModel:
        self.bound_tool_names = [
            tool.name if isinstance(tool, BaseTool) else str(tool.get("name")) for tool in tools
        ]
        return self

    def _generate(
        self,
        messages: list[BaseMessage],
        stop: list[str] | None = None,
        run_manager: CallbackManagerForLLMRun | None = None,
        **kwargs: Any,
    ) -> ChatResult:
        return ChatResult(generations=[ChatGeneration(message=AIMessage(content="完成"))])


async def test_model_sees_exactly_five_business_tools() -> None:
    model = CapturingModel()
    agent = build_agent_graph(settings(), Mock(), model=model)
    context = AgentContext(
        user_id=7,
        username="reader",
        nickname=None,
        thread_id="thread",
        run_id="run",
        bearer_token="jwt-secret",
    )

    await agent.graph.ainvoke(
        {"messages": [HumanMessage(content="我的资料")], "todos": [], "files": {}},
        context=context,
        config={"configurable": {"thread_id": "run"}},
    )

    assert set(model.bound_tool_names) == {
        "get_my_profile",
        "list_papers",
        "get_question",
        "review_wrong_question",
        "list_practice_history",
    }
