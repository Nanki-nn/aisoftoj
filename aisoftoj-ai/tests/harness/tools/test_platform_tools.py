from __future__ import annotations

from unittest.mock import Mock

from packages.harness.aisoftoj_agent.agents.tools import build_platform_tools


def test_only_five_read_only_tools_are_registered() -> None:
    tools = build_platform_tools(Mock())

    assert {tool.name for tool in tools} == {
        "get_my_profile",
        "list_papers",
        "get_question",
        "review_wrong_question",
        "list_practice_history",
    }


def test_runtime_secrets_are_hidden_from_tool_schemas() -> None:
    for tool in build_platform_tools(Mock()):
        schema = tool.tool_call_schema.model_json_schema()
        rendered = str(schema)
        assert "bearer_token" not in rendered
        assert "service_key" not in rendered
        assert "user_id" not in rendered
