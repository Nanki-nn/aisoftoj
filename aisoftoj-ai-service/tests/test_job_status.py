from types import SimpleNamespace

from arq.jobs import DeserializationError

from aisoftoj_ai.api import routes


class FakeRedis:
    def __init__(self, progress):
        self.progress = progress

    async def hgetall(self, key):
        return self.progress


class CorruptResultJob:
    def __init__(self, job_id, redis):
        self.job_id = job_id

    async def status(self):
        return SimpleNamespace(value="complete")

    async def result_info(self):
        raise DeserializationError("stale result")


class FailedResultJob(CorruptResultJob):
    async def result_info(self):
        return SimpleNamespace(success=False, result=RuntimeError("index failed"))


async def test_get_job_uses_persisted_ready_state_for_corrupt_arq_result(monkeypatch):
    monkeypatch.setattr(routes, "Job", CorruptResultJob)
    request = SimpleNamespace(
        app=SimpleNamespace(
            state=SimpleNamespace(
                redis=FakeRedis(
                    {
                        b"status": b"ready",
                        b"chunkCount": b"12",
                    }
                )
            )
        )
    )

    response = await routes.get_job(request, "ingest-document-id-1")

    assert response["status"] == "ready"
    assert response["result"]["chunkCount"] == "12"
    assert response["error"] is None


async def test_get_job_reports_failed_arq_result(monkeypatch):
    monkeypatch.setattr(routes, "Job", FailedResultJob)
    request = SimpleNamespace(
        app=SimpleNamespace(
            state=SimpleNamespace(
                redis=FakeRedis(
                    {
                        b"status": b"failed",
                        b"error": b"Qdrant unavailable",
                    }
                )
            )
        )
    )

    response = await routes.get_job(request, "ingest-document-id-1")

    assert response["status"] == "failed"
    assert response["error"] == "Qdrant unavailable"
