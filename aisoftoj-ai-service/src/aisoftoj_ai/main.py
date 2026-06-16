from contextlib import asynccontextmanager

from arq import create_pool
from arq.connections import RedisSettings
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from aisoftoj_ai.api.routes import router
from aisoftoj_ai.config import get_settings
from aisoftoj_ai.services import get_services


# uv run uvicorn aisoftoj_ai.main:app --reload --host 0.0.0.0 --port 8090
@asynccontextmanager
async def lifespan(app: FastAPI):
    """创建并关闭 FastAPI 生命周期内复用的 Redis 连接池。"""
    app.state.redis = await create_pool(RedisSettings.from_dsn(get_settings().redis_url))
    await get_services().store.ensure_collection()
    yield
    await app.state.redis.close()


app = FastAPI(title="知构 AI 服务", version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(router)


@app.middleware("http")
async def require_internal_secret(request, call_next):
    secret = get_settings().internal_api_secret
    if (
        secret
        and request.url.path.startswith("/api/")
        and request.headers.get("X-Aisoftoj-Internal-Secret") != secret
    ):
        return JSONResponse(status_code=401, content={"detail": "Invalid internal service secret"})
    return await call_next(request)


@app.get("/health")
async def health() -> dict:
    """健康检查接口。"""
    return {"status": "ok", "message": "服务运行正常"}