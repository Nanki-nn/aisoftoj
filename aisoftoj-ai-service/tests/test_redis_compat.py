from aisoftoj_ai.redis_compat import hset_fields


class Redis3Only:
    def __init__(self):
        self.values = {}
        self.calls = []

    async def hset(self, key, field, value):
        self.calls.append((key, field, value))
        self.values.setdefault(key, {})[field] = value


async def test_hset_fields_uses_single_field_redis3_syntax():
    redis = Redis3Only()

    await hset_fields(redis, "state", {"status": "queued", "trace_id": "trace-1"})

    assert redis.calls == [
        ("state", "status", "queued"),
        ("state", "trace_id", "trace-1"),
    ]
    assert redis.values["state"]["status"] == "queued"
