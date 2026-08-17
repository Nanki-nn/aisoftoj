from __future__ import annotations

from packages.harness.aisoftoj_agent.persistence.models import Base


def test_metadata_contains_only_ai_runtime_tables() -> None:
    assert set(Base.metadata.tables) == {
        "ai_threads",
        "ai_messages",
        "ai_runs",
        "ai_run_events",
        "ai_thread_summaries",
    }


def test_active_run_uses_generated_marker_unique_constraint() -> None:
    table = Base.metadata.tables["ai_runs"]
    assert table.c.active_marker.computed is not None
    assert "queued" in str(table.c.active_marker.computed.sqltext)
    constraint_names = {constraint.name for constraint in table.constraints}
    assert "uq_ai_runs_active" in constraint_names
