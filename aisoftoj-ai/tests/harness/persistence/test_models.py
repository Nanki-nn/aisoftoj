from __future__ import annotations

from packages.harness.aisoftoj_agent.persistence.models import Base


def test_metadata_contains_only_ai_runtime_tables() -> None:
    assert set(Base.metadata.tables) == {
        "ai_threads",
        "ai_messages",
        "ai_runs",
        "ai_run_events",
        "ai_thread_summaries",
        "ai_quota_config",
        "ai_user_quota_overrides",
        "ai_daily_token_usage",
        "ai_token_reservations",
    }


def test_active_run_uses_generated_marker_unique_constraint() -> None:
    table = Base.metadata.tables["ai_runs"]
    assert table.c.active_marker.computed is not None
    assert "queued" in str(table.c.active_marker.computed.sqltext)
    constraint_names = {constraint.name for constraint in table.constraints}
    assert "uq_ai_runs_active" in constraint_names


def test_run_has_nullable_question_snapshot() -> None:
    column = Base.metadata.tables["ai_runs"].c.question_id
    assert column.nullable is True
    assert column.type.python_type is int
