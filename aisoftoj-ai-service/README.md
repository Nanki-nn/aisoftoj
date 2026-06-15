# 知构 AI 服务

FastAPI + ARQ + Redis + MinerU 3.3 + Qdrant 的可恢复知识入库与 RAG 服务。

## 处理链路

1. Java 保存原文件、文档记录、版本和解析参数快照。
2. Java 通过 `POST /api/v1/index/jobs/upload` 提交 AI 任务。
3. worker 先从 Redis 恢复 `mineru_task_id`；不存在时调用 MinerU `POST /tasks`。
4. worker 轮询 `GET /tasks/{task_id}`，完成后调用 `GET /tasks/{task_id}/result`。
5. 原始 JSON、Markdown、content list 和 chunks 先落盘，再向量化并写入 Qdrant。
6. 每个阶段通过签名回调通知 Java；Java 定时查询任务作为回调丢失补偿。
7. TXT/Markdown 跳过 MinerU，直接规范化、切块和入库。

任务状态保存在 Redis 的 `knowledge:ingest:{document_id}:{version}`。worker 或 Java
重启后会继续查询已有 MinerU task，不会重复提交。MinerU 任务已过期或丢失时，使用 Java
保留的原文件副本重新提交。

## 启动

复制 `.env.example` 为 `.env`，确保以下密钥在 Java 和 AI 服务中保持一致：

- `INTERNAL_API_SECRET` = Java 的 `AI_SERVICE_SECRET`
- `INTERNAL_CALLBACK_SECRET` = Java 的 `KNOWLEDGE_CALLBACK_SECRET`

```powershell
docker compose up -d --build
```

也可以本地分别启动：

```powershell
uv sync
uv run uvicorn aisoftoj_ai.main:app --reload --host 0.0.0.0 --port 8090
uv run arq aisoftoj_ai.worker.WorkerSettings
```

## 服务边界

- 浏览器只访问 Java API。
- MinerU、Redis、Qdrant、Embedding 和 AI 服务接口不直接提供给浏览器。
- 原文件和解析产物由 Java 校验用户所有权后代理下载。
- MinerU 没有远程取消接口；取消只停止本平台等待和索引，并回滚已经写入的该版本向量。

## 验证

```powershell
.\.venv\Scripts\ruff.exe check . --no-cache
.\.venv\Scripts\pytest.exe -p no:cacheprovider
docker compose config
```
