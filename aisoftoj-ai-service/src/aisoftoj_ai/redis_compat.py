from collections.abc import Mapping
from typing import Any


async def hset_fields(redis: Any, key: str, values: Mapping[str, Any]) -> None:
    """Write hash fields using the Redis 3 compatible HSET form."""
    for field, value in values.items():
        await redis.hset(key, field, value)
