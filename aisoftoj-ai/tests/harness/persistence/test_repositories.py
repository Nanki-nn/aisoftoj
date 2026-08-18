from __future__ import annotations

from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from packages.harness.aisoftoj_agent.persistence.models import Base
from packages.harness.aisoftoj_agent.persistence.repositories.messages import MessageRepository
from packages.harness.aisoftoj_agent.persistence.repositories.runs import RunRepository
from packages.harness.aisoftoj_agent.persistence.repositories.threads import ThreadRepository


async def test_threads_are_scoped_by_owner_and_soft_delete() -> None:
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    async with factory.begin() as session:
        repository = ThreadRepository(session)
        thread = await repository.create(7, "thread")
        assert await repository.get_owned(8, thread.id) is None
        assert await repository.get_owned(7, thread.id) is thread
        await repository.soft_delete(thread)
        assert await repository.get_owned(7, thread.id) is None
    await engine.dispose()


async def test_message_sequences_are_monotonic() -> None:
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    async with factory.begin() as session:
        thread = await ThreadRepository(session).create(7, None)
        repository = MessageRepository(session)
        first = await repository.create(thread.id, "user", "one")
        second = await repository.create(thread.id, "assistant", "two")
        assert (first.sequence, second.sequence) == (1, 2)
    await engine.dispose()


async def test_startup_interruption_appends_terminal_events() -> None:
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    async with factory.begin() as session:
        thread = await ThreadRepository(session).create(7, None)
        message = await MessageRepository(session).create(thread.id, "user", "question")
        run = await RunRepository(session).create(thread.id, "key", message.id, "model")
        await RunRepository(session).transition(run, "running")
        run_id = run.id
    async with factory.begin() as session:
        assert await RunRepository(session).interrupt_unfinished() == 1
    async with factory() as session:
        repository = RunRepository(session)
        run = await repository.get(run_id)
        events = await repository.list_events_after(run_id, 0)
        assert run is not None
        assert run.status == "interrupted"
        assert run.error_code == "SERVICE_RESTARTED"
        assert events[-1].event_type == "run.interrupted"
    await engine.dispose()


async def test_event_page_uses_a_strict_sequence_cursor() -> None:
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    async with factory.begin() as session:
        thread = await ThreadRepository(session).create(7, None)
        message = await MessageRepository(session).create(thread.id, "user", "question")
        repository = RunRepository(session)
        run = await repository.create(thread.id, "key", message.id, "model")
        for index in range(3):
            await repository.append_event(run.id, "message.delta", {"delta": str(index)})
        run_id = run.id
    async with factory() as session:
        repository = RunRepository(session)
        first, has_more = await repository.list_event_page(run_id, 0, 2)
        second, second_has_more = await repository.list_event_page(run_id, first[-1].sequence, 2)
        assert [item.sequence for item in first] == [1, 2]
        assert has_more is True
        assert [item.sequence for item in second] == [3]
        assert second_has_more is False
    await engine.dispose()
