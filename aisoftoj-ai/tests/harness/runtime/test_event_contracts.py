from __future__ import annotations

from datetime import UTC, datetime

import pytest
from pydantic import ValidationError

from packages.harness.aisoftoj_agent.contracts.events import PersistedEvent


def test_event_rejects_unknown_fields_and_invalid_sequence() -> None:
    with pytest.raises(ValidationError):
        PersistedEvent(
            run_id="run",
            sequence=0,
            type="run.created",
            created_at=datetime.now(UTC),
            data={},
            secret="must-not-pass",
        )


def test_process_note_is_a_supported_persisted_event() -> None:
    event = PersistedEvent(
        run_id="run",
        sequence=1,
        type="process.note",
        created_at=datetime.now(UTC),
        data={"text": "先读取练习记录"},
    )

    assert event.type == "process.note"
