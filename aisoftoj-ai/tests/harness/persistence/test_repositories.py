from __future__ import annotations

from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from packages.harness.aisoftoj_agent.persistence.models import Base
from packages.harness.aisoftoj_agent.persistence.repositories.messages import MessageRepository
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
