# aisoftoj AI service

This is the Python runtime for the platform's built-in, read-only AI assistant.
It runs beside the Java service and accepts the browser's existing Bearer JWT.
The Python service validates that JWT through Java's internal profile endpoint,
then forwards the same JWT and the private `X-AI-Service-Key` to Java for every
business-tool request.

## 本地启动

### 前置条件

- MySQL 中已经创建 `aisoftoj` 数据库。
- Java 后端已经启动在 `http://127.0.0.1:8080`。
- 已安装 [uv](https://docs.astral.sh/uv/)。macOS 可执行 `brew install uv`。
- 已准备可用的 OpenAI 兼容模型 API Key。

项目要求 Python 3.12，`uv sync` 会自动创建 `.venv` 并安装锁定版本的依赖，
不需要手动创建虚拟环境。

### 首次启动

先进入本目录：从仓库根目录执行 `cd aisoftoj-ai`；如果终端提示符已经以
`aisoftoj-ai %` 开头，就说明已经在本目录中，不要再次执行 `cd aisoftoj-ai`。
然后执行：

```bash
export PATH="/opt/homebrew/bin:$PATH"
test -f config.yaml || cp config.example.yaml config.yaml
uv sync --frozen
uv run alembic upgrade head
.venv/bin/python server.py
```

`test -f ... || cp ...` 只会在 `config.yaml` 不存在时复制示例文件，不会覆盖
已经填写的数据库密码或模型 API Key。服务首次启动可能需要数十秒，请等终端出现
`Uvicorn running on http://127.0.0.1:8000` 后再执行健康检查。

执行命令前需要编辑 `config.yaml`，至少确认以下配置：

```yaml
# AI 表与 Java 业务表共用 aisoftoj 数据库；请替换用户名和密码
database_url: mysql+asyncmy://aisoftoj_ai:数据库密码@127.0.0.1:3306/aisoftoj

# Java 后端地址
platform_base_url: http://127.0.0.1:8080

# 必须与 Java 后端的 AI_INTERNAL_SERVICE_KEY 相同
platform_service_key: 本地服务密钥

# OpenAI 或兼容服务配置
llm_base_url: https://api.openai.com/v1
llm_api_key: 模型服务密钥
llm_default_model: gpt-5-mini
```

启动 Java 后端时可显式设置同一服务密钥：

```bash
AI_INTERNAL_SERVICE_KEY=本地服务密钥 mvn -pl aisoftoj-backend spring-boot:run
```

Flyway 管理 Java 业务表，Alembic 只管理 `ai_*` 表和
`alembic_version`；两者使用同一个 `aisoftoj` 数据库。建议给 AI 服务使用的
数据库账号仅授予该数据库所需权限。

### 日常启动

完成首次初始化后，通常只需：

```bash
export PATH="/opt/homebrew/bin:$PATH"
uv run alembic upgrade head && .venv/bin/python server.py
```

服务默认监听 `http://127.0.0.1:8000`。启动后可在另一个终端检查：

```bash
curl http://127.0.0.1:8000/livez
curl http://127.0.0.1:8000/readyz
```

- `/livez`：进程存活检查。
- `/readyz`：AI 服务已完成数据库初始化与 Skill 加载，可以接收请求。

如需使用其他配置文件，可通过环境变量指定：

```bash
AGENT_CONFIG_FILE=/绝对路径/ai-config.yaml uv run python server.py
```

常见问题：

- `uv: command not found`：先执行 `export PATH="/opt/homebrew/bin:$PATH"`；
  也可以临时把 `uv` 替换为 `/opt/homebrew/bin/uv`。
- `cd: no such file or directory: aisoftoj-ai`：终端提示符若已经是
  `aisoftoj-ai %`，说明当前就在目标目录，无需再次 `cd`。
- 启动时报 `config.yaml` 不存在：先复制 `config.example.yaml`。
- `/readyz` 不通过：确认 MySQL 与 Java 后端已启动，并检查数据库连接信息。
- 调用 Java 内部接口返回未授权：确认 `platform_service_key` 与
  `AI_INTERNAL_SERVICE_KEY` 完全一致。
- 模型调用失败：检查 `llm_base_url`、`llm_api_key` 和
  `llm_default_model` 是否由同一个模型服务支持。

## API

- `POST /api/ai/threads` creates a local conversation thread.
- `GET /api/ai/threads` and `GET /api/ai/threads/{thread_id}` read threads.
- `GET /api/ai/threads/{thread_id}/messages` reads persisted messages.
- `POST /api/ai/threads/{thread_id}/runs` starts a run. Send a unique
  `Idempotency-Key` header; retries return the original run.
- `GET /api/ai/threads/{thread_id}/runs/{run_id}/stream` provides resumable SSE.
  Use `Last-Event-ID` or `after_seq` to reconnect.
- `POST /api/ai/threads/{thread_id}/runs/{run_id}/cancel` requests cancellation.
- `GET /api/ai/skills` lists installed Skill metadata after the same Bearer JWT
  check. It never returns Skill bodies or host paths.

The agent has exactly seven read-only tools: five platform tools
(`get_my_profile`, `list_papers`, `get_question`, `review_wrong_question`, and
`list_practice_history`) plus `describe_skill` and `load_skill`. There are no
filesystem, shell, subagent, practice-creation, answer-update, submit, or
paper-submission tools. The Java internal API and service key are required for
startup; configure `AI_INTERNAL_SERVICE_KEY` for the Java service and use the
same value as `platform_service_key` in `config.yaml`.

## Built-in Skills

Repository-bundled Skills live at `skills/public/<skill-name>/SKILL.md`. The
directory name and frontmatter `name` must match lower-case kebab-case. Each
file also needs a one-line `description`; `license` is optional. Related UTF-8
resources can live below the same Skill directory.

At startup the service validates paths, symlinks, names, UTF-8 content and the
limits under `skills_*` in `config.yaml`, then keeps an immutable in-memory
snapshot. Invalid Skill deployment content prevents readiness. The model sees
only the compact name/description catalog by default and can page detailed
content through the two Skill tools. A user can explicitly activate a Skill
for the current run by starting the latest message with `/skill-name`.

The bundled `/question-explanation` Skill teaches the assistant to explain a
question from platform evidence. Because `get_question` does not expose the
standard answer, the Skill only discusses a correct answer when
`review_wrong_question` supplied that evidence.

## Production wiring

`deploy/docker/ai-compose.service.yml` is a host-networked service fragment.
Merge it into the production Compose project and provide
`/etc/aisoftoj/ai-config.yaml` with mode `0600`. Run the migration from the AI
image before the first start:

```bash
docker run --rm --network host \
  --env-file /etc/aisoftoj/aisoftoj.env \
  -v /etc/aisoftoj/ai-config.yaml:/etc/aisoftoj/ai-config.yaml:ro \
  -e AGENT_CONFIG_FILE=/etc/aisoftoj/ai-config.yaml \
  aisoftoj-ai:$RELEASE_SHA \
  /app/.venv/bin/alembic -c /app/alembic.ini upgrade head
```

Add `deploy/docker/ai-host-nginx-snippet.conf` before the generic Java
`/api/` location. This keeps browser traffic on the public origin while the
Python process remains bound to loopback.
