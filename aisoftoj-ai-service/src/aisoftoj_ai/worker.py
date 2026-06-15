from arq.connections import RedisSettings

from aisoftoj_ai.config import get_settings
from aisoftoj_ai.rag.tasks import ingest_file_task, ingest_url_task
from aisoftoj_ai.services import get_services


async def startup(ctx) -> None:
    """在 ARQ worker 启动时注入共享 pipeline。"""
    ctx["pipeline"] = get_services().pipeline
    ctx["redis"] = ctx["redis"]


class WorkerSettings:
    """ARQ worker 配置。"""
    functions = [ingest_file_task, ingest_url_task]
    on_startup = startup
    redis_settings = RedisSettings.from_dsn(get_settings().redis_url)
    max_tries = 3
    job_timeout = 3900
    keep_result = 7 * 24 * 3600
