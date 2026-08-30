from __future__ import annotations

from unittest.mock import Mock

from packages.harness.aisoftoj_agent.agents.tools import build_platform_tools
from packages.harness.aisoftoj_agent.agents.tools.papers import format_paper_list
from packages.harness.aisoftoj_agent.integrations.aisoftoj.models import Paper


def test_only_platform_read_only_tools_are_registered() -> None:
    tools = build_platform_tools(Mock())

    assert {tool.name for tool in tools} == {
        "get_my_profile",
        "list_papers",
        "get_question",
        "review_wrong_question",
        "list_practice_history",
        "trace_question_to_textbook",
        "search_knowledge",
    }


def test_runtime_secrets_are_hidden_from_tool_schemas() -> None:
    for tool in build_platform_tools(Mock()):
        schema = tool.tool_call_schema.model_json_schema()
        rendered = str(schema)
        assert "bearer_token" not in rendered
        assert "service_key" not in rendered
        assert "user_id" not in rendered


def test_paper_list_exposes_deterministic_total() -> None:
    papers = [
        Paper(
            paper_id=1,
            name="试卷一",
            subject_name="系统架构设计师",
            category="综合知识",
            year=2025,
            month=11,
            question_count=75,
            practice_status="not_started",
            completed_question_count=0,
            ongoing_session_id=None,
            last_practice_time=None,
        ),
        Paper(
            paper_id=2,
            name="试卷二",
            subject_name="系统分析师",
            category="案例分析",
            year=2025,
            month=5,
            question_count=10,
            practice_status="completed",
            completed_question_count=10,
            ongoing_session_id=None,
            last_practice_time=None,
        ),
    ]

    result = format_paper_list(papers)

    assert result["total"] == 2
    assert len(result["records"]) == 2
