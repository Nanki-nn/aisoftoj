from __future__ import annotations

from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import AiQuestionTraceCache


class QuestionTraceCacheRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get(
        self,
        *,
        question_id: int,
        question_content_hash: str,
        textbook_id: int,
        index_version: str,
        retrieval_profile_version: str,
    ) -> AiQuestionTraceCache | None:
        now = datetime.now(UTC).replace(tzinfo=None)
        result = await self.session.execute(
            select(AiQuestionTraceCache).where(
                AiQuestionTraceCache.question_id == question_id,
                AiQuestionTraceCache.question_content_hash == question_content_hash,
                AiQuestionTraceCache.textbook_id == textbook_id,
                AiQuestionTraceCache.index_version == index_version,
                AiQuestionTraceCache.retrieval_profile_version == retrieval_profile_version,
                (
                    AiQuestionTraceCache.expires_at.is_(None)
                    | (AiQuestionTraceCache.expires_at > now)
                ),
            )
        )
        return result.scalar_one_or_none()

    async def put(
        self,
        *,
        question_id: int,
        question_content_hash: str,
        textbook_id: int,
        index_version: str,
        retrieval_profile_version: str,
        status: str,
        primary_knowledge_point_id: int | None,
        secondary_knowledge_point_ids: list[int],
        source_chunk_ids: list[str],
        confidence: float,
        result: dict[str, Any],
        expires_at: datetime | None = None,
    ) -> AiQuestionTraceCache:
        item = AiQuestionTraceCache(
            id=str(uuid4()),
            question_id=question_id,
            question_content_hash=question_content_hash,
            textbook_id=textbook_id,
            index_version=index_version,
            retrieval_profile_version=retrieval_profile_version,
            status=status,
            primary_knowledge_point_id=primary_knowledge_point_id,
            secondary_knowledge_point_ids_json=secondary_knowledge_point_ids,
            source_chunk_ids_json=source_chunk_ids,
            confidence=confidence,
            result_json=result,
            expires_at=expires_at,
        )
        self.session.add(item)
        await self.session.flush()
        return item
