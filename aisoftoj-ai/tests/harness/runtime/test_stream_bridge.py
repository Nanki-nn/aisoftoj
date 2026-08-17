from __future__ import annotations

from datetime import UTC, datetime

from packages.harness.aisoftoj_agent.contracts.events import PersistedEvent
from packages.harness.aisoftoj_agent.runtime.stream_bridge import StreamBridge


def event(sequence: int) -> PersistedEvent:
    return PersistedEvent(
        run_id="run",
        sequence=sequence,
        type="message.delta",
        created_at=datetime.now(UTC),
        data={"delta": str(sequence)},
    )


async def test_subscriber_receives_committed_events_in_order() -> None:
    bridge = StreamBridge(queue_capacity=2)
    subscription = await bridge.subscribe("run")
    await bridge.publish(event(1))
    await bridge.publish(event(2))

    assert (await subscription.receive()).sequence == 1
    assert (await subscription.receive()).sequence == 2
    await bridge.unsubscribe(subscription)


async def test_slow_consumer_is_marked_for_stream_reset() -> None:
    bridge = StreamBridge(queue_capacity=1)
    subscription = await bridge.subscribe("run")
    await bridge.publish(event(1))
    await bridge.publish(event(2))

    assert subscription.overflowed is True
    assert await subscription.receive() is None
