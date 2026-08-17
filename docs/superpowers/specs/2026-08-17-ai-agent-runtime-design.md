# 软考平台内置 AI 助手运行时设计

## 目标

在知构软考平台中新增一个可独立运行的 Python AI 服务。服务参考 `jnpm_agent_v2` 的 `APP -> Harness` 分层，提供 Bearer JWT 认证、Thread / Run / SSE API、持久化会话、OpenAI-compatible 模型调用和 5 个软考平台只读工具。

平台业务数据仍由 Java 后端拥有。Python 只通过 Java 内部接口读取当前用户可见的数据，不直接读取或修改软考平台业务表。Python 仅在独立的 `aisoftoj_ai` 数据库中写入自己的 Thread、Message、Run、Event 和摘要数据。

## 已确认决策

- 交付物是可启动的 FastAPI AI 服务，不只是工具库。
- 项目分为 APP 服务壳和 Agent Harness 两块。
- 浏览器直接访问 Python AI 服务，Java 不转发聊天请求。
- 第一版沿用现有 `Authorization: Bearer <JWT>`，不迁移 Cookie。
- Python 与 Java 运行在同一台服务器，通过宿主机回环地址通信。
- 模型使用 OpenAI 或 OpenAI-compatible 网关。
- 会话使用可恢复的 Thread / Run / SSE 分离模型。
- Agent 对软考平台严格只读，不能创建刷题会话、更新答案、交卷或提交论文。
- Python 使用同一台 MySQL 实例中的独立 `aisoftoj_ai` 数据库，由 Alembic 独立管理。
- 首版单进程、单 Uvicorn worker、单服务副本。
- 首版不启用 Subagent、Skills、文件上传、定时任务和跨 Thread 长期记忆。

## 参考实现与裁剪原则

目录和运行职责参考 `/Users/bytedance/AI/jnpm_agent_v2`：

- `app/` 只负责 FastAPI、认证、路由、SSE、生命周期和依赖注入。
- `packages/harness/aisoftoj_agent/` 负责 Agent、工具、Runtime、持久化和事件。
- 依赖方向只能从 APP 指向 Harness，Harness 不导入 FastAPI 路由。

本项目只保留首版必需能力，不复制参考项目的 Subagent、上传、文件系统、Skills、定时任务、写审批、Artifacts 和外部对象存储。

## 总体架构

```text
Browser
   |
   | Authorization: Bearer <user JWT>
   v
FastAPI APP
   |-- authentication / routing / SSE / lifespan
   |
   v
Agent Harness
   |-- Deep Agent graph
   |-- RunManager / Worker / StreamBridge
   |-- Thread / Message / Run persistence
   |-- five platform read-only tools
   |
   |                     +--> aisoftoj_ai MySQL database
   |
   +-- Authorization: Bearer <user JWT>
       X-AI-Service-Key: <service secret>
                         |
                         v
                Java /internal/ai/*
                         |
                         v
                aisoftoj business database
```

运行拓扑：

- Java 继续监听 `127.0.0.1:8080`。
- Python 后续监听 `127.0.0.1:8000`。
- 浏览器公开路径为 `/api/ai/*`。
- 生产 Nginx 和 Compose 接入不属于本期，但后续必须将 `/api/ai/*` 转发到 Python，并在通用 Java `/api/*` 规则之前对 `/api/internal/ai/*` 返回 404。

## 项目结构

```text
aisoftoj-ai/
├── .dockerignore
├── .gitignore
├── Dockerfile
├── README.md
├── alembic.ini
├── config.example.yaml
├── config.py
├── pyproject.toml
├── uv.lock
├── server.py
├── app/
│   ├── __init__.py
│   ├── dependencies.py
│   ├── lifespan.py
│   ├── main.py
│   ├── auth/
│   │   ├── __init__.py
│   │   └── dependencies.py
│   └── routers/
│       ├── __init__.py
│       ├── health.py
│       ├── runs.py
│       └── threads.py
├── packages/
│   ├── __init__.py
│   └── harness/
│       ├── __init__.py
│       └── aisoftoj_agent/
│           ├── __init__.py
│           ├── agents/
│           │   ├── __init__.py
│           │   ├── context.py
│           │   ├── factory.py
│           │   ├── prompt.py
│           │   ├── state.py
│           │   ├── models/
│           │   │   ├── __init__.py
│           │   │   └── factory.py
│           │   ├── middlewares/
│           │   │   ├── __init__.py
│           │   │   ├── builder.py
│           │   │   ├── loop_detection.py
│           │   │   ├── persistent_summary.py
│           │   │   ├── token_budget.py
│           │   │   ├── tool_audit.py
│           │   │   ├── tool_errors.py
│           │   │   └── tool_policy.py
│           │   └── tools/
│           │       ├── __init__.py
│           │       ├── papers.py
│           │       ├── practice_history.py
│           │       ├── profile.py
│           │       ├── questions.py
│           │       └── wrong_questions.py
│           ├── contracts/
│           │   ├── __init__.py
│           │   ├── api.py
│           │   ├── errors.py
│           │   └── events.py
│           ├── integrations/
│           │   └── aisoftoj/
│           │       ├── __init__.py
│           │       ├── client.py
│           │       ├── context.py
│           │       └── models.py
│           ├── observability/
│           │   ├── __init__.py
│           │   └── logging.py
│           ├── persistence/
│           │   ├── __init__.py
│           │   ├── engine.py
│           │   ├── models.py
│           │   ├── migrations/
│           │   │   ├── env.py
│           │   │   ├── script.py.mako
│           │   │   └── versions/
│           │   └── repositories/
│           │       ├── __init__.py
│           │       ├── messages.py
│           │       ├── runs.py
│           │       ├── summaries.py
│           │       └── threads.py
│           └── runtime/
│               ├── __init__.py
│               ├── run_manager.py
│               ├── stream_bridge.py
│               └── worker.py
└── tests/
    ├── app/
    ├── harness/
    └── conftest.py
```

## APP 层职责

### 启动与生命周期

`server.py` 只读取配置并启动 `app.main:app`。`app/main.py` 创建 FastAPI、挂载路由和统一错误处理。`app/lifespan.py` 按顺序初始化：

1. 配置。
2. SQLAlchemy async engine 和 session factory。
3. Alembic 版本就绪检查。
4. Platform client 基础配置。
5. OpenAI-compatible 模型。
6. Deep Agent graph。
7. StreamBridge、RunManager 和 Worker 依赖。
8. 遗留 Run 状态收敛。

关闭时停止接收新 Run，等待活动 Run 到配置的 drain 时间；剩余任务取消并标记为 `interrupted`，随后关闭 HTTP 和数据库连接池。

### 认证依赖

除 `/livez`、`/readyz` 外，所有 API 使用同一认证依赖：

1. 要求 `Authorization` scheme 精确为 `Bearer`。
2. 提取不含前缀的原始 JWT。
3. 使用 `X-AI-Service-Key` 调用 Java `GET /internal/ai/me`。
4. Java 验证签名、过期时间、`tokenVersion`、用户启用和删除状态。
5. Python 将响应转换为 `TrustedUser(user_id, username, nickname, role)`。

Python 不自行信任 JWT payload。JWT 不写数据库、日志、Message、RunEvent 或 Agent State。

### 后台 Run 的 JWT 生命周期

`POST /runs` 创建 Run 后，RunManager 立即创建进程内异步任务。原始 JWT 只被该任务闭包和 `AgentContext` 持有，用于本次 Run 的平台工具调用：

- JWT 不持久化。
- Run 只有在并发槽位预留成功后才创建，因此不存在持有 JWT 的等待队列。
- 每次工具调用由 Java 重新验证 JWT。
- JWT 在 Run 执行期间过期时，后续工具调用返回认证失败，Run 终止为 `failed/AUTH_EXPIRED`。
- 服务重启后无法恢复 JWT，因此遗留 `queued/running` Run 标记为 `interrupted`，不自动重放模型调用。

## 公开 HTTP API

### 健康检查

```text
GET /livez
GET /readyz
```

`livez` 只表示进程存活。`readyz` 只检查配置、AI 数据库连接和 Agent graph 已装配，不调用真实模型，也不探测 Java 或模型网关。它表达 Python 进程及本地持久化能力就绪，不承诺 Java 不可用时仍能通过认证并访问历史或取消 Run；Java和模型依赖失败在认证或Run中返回稳定上游错误。

### Thread API

```text
POST   /api/ai/threads
GET    /api/ai/threads
GET    /api/ai/threads/{thread_id}
PATCH  /api/ai/threads/{thread_id}
DELETE /api/ai/threads/{thread_id}
GET    /api/ai/threads/{thread_id}/messages
```

- Thread 创建时标题可为空。
- 第一条用户消息成功创建后，空标题使用该消息的安全截断，不额外调用模型。
- PATCH 第一版只允许修改标题。
- DELETE 是软删除；存在 `queued/running` Run 时返回 409，用户必须先取消并等待 Run 进入终态。删除事务先按当前用户和 `is_deleted=0` 对 Thread 执行 `SELECT ... FOR UPDATE`，再检查活动 Run。
- 软删除 Thread 后其 Message、Run、Event 和 Summary 均不可通过 API 访问。
- 列表固定使用页码分页，按 `update_time DESC, id DESC` 排序。
- 所有查询先按 `user_id + thread_id + is_deleted=0` 限定；他人资源与不存在资源统一返回 404。

Thread 请求和响应契约：

```text
ThreadCreateRequest
  title: string | null = null        # trim 后最多 120 字符

ThreadUpdateRequest
  title: string                      # trim 后 1..120 字符

ThreadResponse
  id: UUID string
  title: string | null
  created_at: UTC ISO-8601 string
  updated_at: UTC ISO-8601 string

ThreadPageResponse
  items: list[ThreadResponse]
  total: non-negative integer
  page: positive integer
  page_size: integer 1..100
```

- `POST /threads` 返回 201 和 `ThreadResponse`。
- `GET /threads?page=1&page_size=20` 返回 `ThreadPageResponse`。
- `GET /threads/{id}` 和 `PATCH` 返回 `ThreadResponse`。
- `DELETE` 成功返回 204，无响应体；重复删除与他人资源同为 404。

Message 历史使用 sequence 游标而不是页码：

```text
GET /messages?before_sequence=<optional positive integer>&limit=50

MessageResponse
  id: UUID string
  thread_id: UUID string
  run_id: UUID string
  role: "user" | "assistant"
  content: string
  sequence: positive integer
  created_at: UTC ISO-8601 string

MessagePageResponse
  items: list[MessageResponse]        # 始终按 sequence 升序供前端显示
  next_before_sequence: integer | null
  has_more: boolean
```

`limit` 范围 1..100，默认 50。未传 `before_sequence` 时读取最新一页；下一页读取严格小于该游标的记录。

### Run API

```text
POST /api/ai/threads/{thread_id}/runs
GET  /api/ai/threads/{thread_id}/runs
GET  /api/ai/threads/{thread_id}/runs/{run_id}
POST /api/ai/threads/{thread_id}/runs/{run_id}/cancel
GET  /api/ai/threads/{thread_id}/runs/{run_id}/stream
```

`POST /runs`：

- 请求体包含单条非空用户消息。
- 要求 `Idempotency-Key`；同一用户、Thread 和 key 重试返回原 Run。
- 服务不提供持久排队。处理顺序固定为：先在数据库查询幂等重放；不是重放时向 RunManager 原子预留全局和用户容量；容量不足立即返回 429，且不创建 Message 或 Run。
- 容量预留成功后，创建事务先按当前用户和 `is_deleted=0` 对 Thread 执行与 DELETE 相同的 `SELECT ... FOR UPDATE`，然后在锁内再次查询幂等键、检查活动 Run，最后创建用户 Message 和 Run。创建与删除统一使用“Thread 行锁 -> Run 查询/写入”的锁顺序，因此不能在已软删除 Thread 下创建 Run。
- 锁内发现幂等重放时释放刚预留的容量并返回原 Run；用户 Message 和 Run 在同一数据库事务中创建，事务失败也必须释放容量。
- 事务提交后立即绑定并启动后台 Task；极端情况下提交后进程退出而未启动的 `queued` Run 由下次启动收敛为 `interrupted`。
- 同一 Thread 同时只允许一个 `queued/running` Run，否则返回 409。
- 创建成功返回 202 和 Run DTO，执行由 RunManager 后台任务完成。

Run 状态：

```text
queued -> running -> completed
                  -> failed
                  -> cancelled
queued/running --service restart--> interrupted
```

- 取消是幂等操作。
- 已进入终态的 Run 不可再次执行。
- 失败、取消和中断均保留用户 Message 与已产生事件。
- 成功 Run 只持久化一条最终 Assistant Message。

Run 请求和响应契约：

```text
RunCreateRequest
  message: string                    # trim 后非空，不超过配置上限

RunResponse
  id: UUID string
  thread_id: UUID string
  status: "queued" | "running" | "completed" | "failed" | "cancelled" | "interrupted"
  input_message_id: UUID string
  output_message_id: UUID string | null
  error_code: string | null
  model_name: string
  prompt_tokens: non-negative integer | null
  completion_tokens: non-negative integer | null
  started_at: UTC ISO-8601 string | null
  finished_at: UTC ISO-8601 string | null
  created_at: UTC ISO-8601 string
  updated_at: UTC ISO-8601 string

RunPageResponse
  items: list[RunResponse]            # create_time DESC, id DESC
  total: non-negative integer
  page: positive integer
  page_size: integer 1..100
```

- `GET /runs?page=1&page_size=20` 返回 `RunPageResponse`。
- `GET /runs/{run_id}` 返回 `RunResponse`。
- `POST /cancel` 对活动 Run 发出停止请求并返回 202 + 当前 `RunResponse`；对终态 Run 返回 200 + 未改变的 `RunResponse`。
- 相同 `Idempotency-Key` 重放 `POST /runs` 时不创建任何新记录，统一返回 200 + 原 `RunResponse`；首次创建返回 202。
- `Idempotency-Key` 是 trim 后 1..128 个可打印 ASCII 字符。并发相同 key 由锁内二次查询和数据库唯一约束共同兜底；若唯一约束竞争失败，事务回滚后重新按用户和 Thread 读取原 Run并返回200，绝不暴露数据库冲突。

### SSE

浏览器使用支持自定义请求头的 `fetch()` 流读取 SSE，不使用原生 `EventSource`，因为后者不能设置 Bearer JWT。

- JWT 不进入 URL。
- 断线续读使用整数 `Last-Event-ID` 或 `after_seq`；两者同时存在且值不同返回 400，游标表示已收到的最大持久事件 sequence。
- SSE 建连采用 subscribe-before-snapshot：先在 StreamBridge 注册有界订阅队列，再查询数据库中 `sequence > cursor` 的已提交事件和当时最大 sequence，然后发送历史事件并排空订阅队列中 sequence 更大的实时事件。
- Worker 必须先提交数据库事件事务，再发布到 StreamBridge。这样订阅前提交的事件由快照覆盖，订阅后提交的事件由队列覆盖；按 sequence 去重只用于交界处重复，不承担防丢职责。
- 终态 Run 重连时返回剩余历史事件和 `stream.end` 后关闭。
- 心跳事件不写数据库，也不推进业务事件 sequence。
- 单订阅者队列容量固定为 256 个事件。慢消费者溢出时发送不持久化的 `stream.reset`，包含最后成功发送的 sequence，然后关闭连接；客户端使用该 sequence 重连并从数据库补齐。

持久事件 SSE envelope：

```text
id: <sequence>
event: <event_type>
data: {
  "run_id": "uuid",
  "sequence": 12,
  "type": "message.delta",
  "created_at": "UTC ISO-8601",
  "data": { ... event-specific payload ... }
}
```

持久事件 payload 固定为：

```text
run.created        {input_message_id}
run.started        {}
message.started    {role: "assistant"}
message.delta      {delta}
tool.started       {tool_call_id, name}
tool.completed     {tool_call_id, name, duration_ms}
tool.failed        {tool_call_id, name, duration_ms, error_code}
message.completed  {message_id}
run.completed      {status: "completed", error_code: null}
run.failed         {status: "failed", error_code}
run.cancelled      {status: "cancelled", error_code: null}
run.interrupted    {status: "interrupted", error_code}
```

非持久控制事件不含 `id:` 行，不能推进 `Last-Event-ID`：

```text
event: stream.end
data: {"run_id":"uuid","status":"terminal status","last_sequence":12}

event: stream.reset
data: {"run_id":"uuid","reason":"slow_consumer","last_sequence":12}
```

心跳固定使用 SSE comment `: ping <unix_epoch_millis>`，不含 `id/event/data`，默认每 15 秒发送一次。所有 `data:` 都是单行紧凑 JSON，随后以空行结束事件。任何 payload 都不包含工具参数值或原始结果。

## AI 数据库

Python 使用 MySQL 同实例独立数据库 `aisoftoj_ai`。`database_url` 指向该数据库。Alembic 只管理以下 AI 表，不管理 Java 平台 schema。

### `ai_threads`

- `id`: CHAR(36) UUID，主键。
- `user_id`: Java 用户正整数，无跨库外键。
- `title`: 可空字符串，长度受限。
- `is_deleted`: boolean。
- `create_time`、`update_time`、`delete_time`: UTC 时间。
- 索引：`user_id + is_deleted + update_time + id`。

### `ai_messages`

- `id`: CHAR(36) UUID，主键。
- `thread_id`: 外键到 `ai_threads`。
- `run_id`: 可空 Run ID。创建 Run 的同一事务内先插入用户 Message，再插入引用该 Message 的 Run，随后回填用户 Message 的 `run_id`；事务提交后所有 Run 消息的 `run_id` 必须非空。
- `role`: `user` 或 `assistant`。
- `content`: LONGTEXT。
- `sequence`: Thread 内单调递增正整数。
- `create_time`: UTC 时间。
- 唯一约束：`thread_id + sequence`。
- 唯一约束：`run_id + role`。`run_id` 为 `null` 的事务中间态不参与唯一性冲突；事务提交后一个 Run 最多一条 user Message 和一条 assistant Message。

### `ai_runs`

- `id`: CHAR(36) UUID，主键。
- `thread_id`: 外键到 `ai_threads`。
- `idempotency_key`: 非空受限字符串。
- `status`: `queued/running/completed/failed/cancelled/interrupted`。
- `input_message_id`、`output_message_id`。
- `error_code`: 可空稳定错误码，不保存内部异常正文。
- `model_name`: 实际配置模型名。
- `prompt_tokens`、`completion_tokens`: 可空非负整数。
- `started_at`、`finished_at`、`create_time`、`update_time`。
- `active_marker`: MySQL 5.7 STORED generated column，`CASE WHEN status IN ('queued','running') THEN 1 ELSE NULL END`。
- 唯一约束：`thread_id + idempotency_key`。
- 唯一约束：`thread_id + active_marker`。MySQL允许多个NULL，因此每个Thread最多一条活动Run，同时允许多个终态Run；实现不再保留其他候选方案。

### `ai_run_events`

- `id`: BIGINT 自增主键。
- `run_id`: 外键到 `ai_runs`。
- `sequence`: Run 内单调递增正整数。
- `event_type`: 受限字符串枚举。
- `payload`: JSON，必须通过事件 Pydantic 模型验证。
- `create_time`: UTC 时间。
- 唯一约束：`run_id + sequence`。

### `ai_thread_summaries`

- `thread_id`: 主键和外键到 `ai_threads`。
- `content`: LONGTEXT。
- `summarized_through_sequence`: 非负整数。
- `create_time`、`update_time`。

原始 Message 不因摘要删除。每次 Run 只加载“摘要 + 摘要游标后的 Message”。摘要更新和游标推进在同一事务中完成，且游标只能前进。

## Agent Harness

### 模型工厂

模型工厂显式创建 `langchain_openai.ChatOpenAI`：

- `base_url=llm_base_url`
- `api_key=llm_api_key`
- `model=llm_default_model`
- 启用流式输出。
- 设置请求超时和有限重试。

兼容网关必须支持 OpenAI Chat Completions 风格的流式输出、工具调用和 usage；缺少 usage 时 Run token 字段保存 `null`，不伪造数据。

### Deep Agent Graph

启动时创建一个全局 graph。每次 Run 使用不可变的 `AgentContext`：

```text
AgentContext
  user_id
  username
  nickname
  thread_id
  run_id
  bearer_token
```

- `context_schema=AgentContext`。
- JWT 只存在 Context，不进入 Agent State 或 Message。
- LangGraph `InMemorySaver` 使用 `run_id` 作为 checkpoint thread ID，隔离单次 Run。
- 每个 Run 进入终态后，Worker 在 `finally` 中调用所固定版本 Saver 的 thread 删除 API 清理该 `run_id` 的 checkpoint；清理失败记录安全错误并上报监控，但不得改变已经提交的 Run 终态。
- AI 数据库 Message 是跨 Run 和跨重启的持久事实。
- Worker 从数据库加载摘要和消息，再执行一次 `astream`；不进行第二次模型调用补最终回答。

### Deep Agents 能力裁剪

项目在 `pyproject.toml` 中精确固定 `deepagents==0.7.6`，并提交 `uv.lock`。Harness Profile、内置工具裁剪和 Middleware 替换都只针对该版本验收；升级依赖必须作为独立兼容性变更。启动前注册自定义 `openai` Harness Profile：

- `general_purpose_subagent.enabled=false`。
- `subagents=[]`。
- `skills=None`、`memory=None`。
- 默认 backend 为 StateBackend，但从模型可见工具中排除所有内置文件和执行工具。
- 排除集合至少包含 `ls`、`read_file`、`write_file`、`edit_file`、`glob`、`grep`、`execute`；实现以所固定版本的真实工具清单为准。

Agent 对模型可见的最终业务工具集合必须精确等于：

```text
get_my_profile
list_papers
get_question
review_wrong_question
list_practice_history
```

启动断言和契约测试发现额外可见工具时必须失败，不允许静默上线。Tool Policy Middleware 在每次调用时再次按同一白名单校验，并拒绝模型注入 `user_id`、JWT、服务密钥或内部 URL。

### Middleware 顺序

1. 可信上下文注入：只注入非敏感用户显示信息、当前日期和 Thread/Run 标识；不注入 JWT。
2. 持久 Thread 摘要与消息装配。
3. 持久摘要：达到阈值时压缩早期历史并原子推进游标。
4. Token 预算：接近预算时提示收口，到达硬上限时禁止继续工具调用。
5. Tool Audit：只记录工具名、参数键、状态和耗时。
6. Tool Policy：只允许 5 个工具。
7. Tool Error Handling：把可恢复平台错误转换为安全 ToolMessage，认证和越权终止 Run。
8. Loop Detection：重复相同工具调用达到阈值后停止循环。

持久摘要 Middleware 替换 Deep Agents 默认 summarization 插槽，避免两套摘要同时修改消息。实现必须针对 `deepagents==0.7.6` 编写兼容性测试；若无法安全替换，启动失败而不是重复启用。

## 软考平台集成

### Java 内部认证

Python 每次调用同时发送：

```text
Authorization: Bearer <user JWT>
X-AI-Service-Key: <service secret>
```

Java 校验服务密钥、JWT、用户状态以及公开资源可见性或私有资源归属。服务密钥从环境变量读取，使用常量时间比较。生产配置缺失时 Java 启动失败。

内部接口只使用 GET、返回专用 DTO、设置 `Cache-Control: private, no-store`，且不使用浏览器 RSA/AES 内容加密注解。Python 不复制浏览器解密协议。

### 5 个平台工具

#### `get_my_profile()`

`GET /internal/ai/me`。返回可靠字段：`user_id`、`username`、`nickname`、`role`、`join_date`、`last_login_date`、`practice_session_count`、`wrong_question_count`。不返回邮箱、手机号、JWT、OpenID或现有占位统计。

#### `list_papers()`

`GET /internal/ai/papers`。返回已发布试卷和当前用户练习状态，不返回题目答案。多会话规则：

1. 只统计当前用户未删除且状态为进行中或完成的会话。
2. 有进行中会话时状态为 `in_progress`，否则有已完成会话时为 `completed`，否则为 `not_started`。
3. 多个进行中会话按活动时间降序、ID 降序确定唯一 `ongoing_session_id`。
4. `last_practice_time` 是所有纳入会话活动时间的最大值。

#### `get_question(question_id)`

`GET /internal/ai/questions/{questionId}`。参数为正整数。题目必须未删除且至少属于一份已发布、未删除试卷。返回题干、选项、题型和难度；永不返回标准答案、解析、选项正确性，即使用户是管理员也不扩大范围。

#### `review_wrong_question(wrong_question_id)`

`GET /internal/ai/wrong-questions/{wrongQuestionId}/review`。Java 必须按当前用户 ID 和未删除状态查询错题，再验证 `last_session_id` 会话属于当前用户、已完成且题目一致。返回题目、用户答案、标准答案、解析、错误次数、重要度和耗时。关联缺失或状态不一致返回 409，不从题库绕过会话状态补答案。

#### `list_practice_history(page=1, page_size=10)`

`GET /internal/ai/practice-history`。`page>=1`，`1<=page_size<=20`。记录和 summary 只纳入当前用户、未删除且状态为进行中或已完成的会话。Summary 覆盖全部符合条件的会话，不受当前页影响。

### Java 内部 DTO 与 Python 工具输出契约

Java 内部接口统一返回现有 `ResultDTO<T>` 外壳：

```json
{"code": 200, "message": "操作成功", "data": {}, "timestamp": 1786896000000}
```

`code` 是 HTTP 语义状态码，`message` 是人类可读中文消息，`timestamp` 沿用现有 `ResultDTO` 的 Unix epoch 毫秒整数。Java JSON 业务字段使用 `camelCase`；Python `PlatformClient` 验证后转换为下列 `snake_case` 工具输出。未列出的字段一律不得透传给模型。

#### Profile

Java `data`：

```text
userId: integer > 0
username: non-empty string
nickname: non-empty string | null
role: non-empty string
joinDate: UTC datetime
lastLoginDate: UTC datetime | null
practiceSessionCount: integer >= 0
wrongQuestionCount: integer >= 0
```

Python 输出字段与上述字段逐一对应为 `user_id`、`username`、`nickname`、`role`、`join_date`、`last_login_date`、`practice_session_count`、`wrong_question_count`。`nickname` 不存在时保持 `null`，不回退为用户名。

#### Paper list

Java `data` 是数组，每项为：

```text
paperId: integer > 0
name: non-empty string
subjectName: non-empty string | null
category: non-empty string
year: integer | null
month: integer 1..12 | null
questionCount: integer >= 0
practiceStatus: not_started | in_progress | completed
completedQuestionCount: integer >= 0
ongoingSessionId: integer > 0 | null
lastPracticeTime: UTC datetime | null
```

Python 工具输出包装为 `{total, records}`：`total` 是 `records` 的准确长度，`records` 中每项使用上述字段的同名 `snake_case` 形式，避免模型自行统计长数组。试卷按 `year DESC NULLS LAST、month DESC NULLS LAST、paperId DESC` 稳定排序。会话活动时间定义为 `updateTime`，缺失时依次回退 `endTime`、`createTime`；多个进行中会话按该时间降序、`sessionId` 降序选取。`completed_question_count` 在进行中时取所选会话的非负 `answeredCount`，只有已完成会话时取试卷 `questionCount`，未开始时为 0，且不得超过 `questionCount`。

#### Question

Java `data`：

```text
questionId: integer > 0
name: non-empty string
content: non-empty string
options: array<{key: non-empty string, content: non-empty string}>
questionType: single_choice | multiple_choice | judgement | fill_blank | case_analysis | essay | unknown
difficulty: easy | medium | hard | unknown
```

Python 输出使用 `question_id`、`name`、`content`、`options`、`question_type`、`difficulty`。无选项题返回空数组，不返回 `null`。选项按题库展示顺序返回，`key` 在同一题中唯一。

#### Wrong-question review

Java `data`：

```text
wrongQuestionId: integer > 0
questionId: integer > 0
paperId: integer > 0
paperName: non-empty string
questionName: non-empty string
questionContent: non-empty string
options: array<{key: non-empty string, content: non-empty string}>
questionType: question type enum
difficulty: difficulty enum
userAnswer: string
correctAnswer: non-empty string
analysis: string | null
errorCount: integer >= 1
importance: non-empty string
lastWrongTime: UTC datetime
spendTime: integer >= 0 | null
```

Python 输出使用逐一对应的 `snake_case` 字段。`user_answer` 允许空字符串以表达用户未作答；`analysis` 不存在时为 `null`；无选项题返回空数组。答案只允许由该用户已完成且与错题记录一致的 `last_session_id` 链路产生。

#### Practice history

Java `data`：

```text
records: array<{
  sessionId: integer > 0,
  paperName: non-empty string,
  examMode: practice | exam,
  examType: 综合知识 | 案例分析 | 论文,
  createdAt: UTC datetime,
  answeredCount: integer >= 0,
  questionCount: integer >= 0,
  status: in_progress | completed
}>
total: integer >= 0
page: integer >= 1
pageSize: integer 1..20
summary: {
  totalCount: integer >= 0,
  inProgressCount: integer >= 0,
  completedCount: integer >= 0,
  answeredCount: integer >= 0
}
```

Python 输出使用 `records`、`total`、`page`、`page_size`、`summary`，嵌套字段也转换为 `snake_case`。记录按 `createdAt DESC、sessionId DESC` 稳定分页。`summary` 对全部授权记录聚合，满足 `total_count = in_progress_count + completed_count = total`；`answered_count` 是全部记录非负回答数之和，不受分页影响。

### 平台数据格式

- ID 和计数为 JSON 整数；ID 正数，计数非负。
- 时间统一为 UTC ISO 8601 `Z` 字符串；缺失为 `null`。
- `practice_status`: `not_started/in_progress/completed`。
- `exam_mode`: `practice/exam`。
- `exam_type`: `综合知识/案例分析/论文`。
- `question_type`: `single_choice/multiple_choice/judgement/fill_blank/case_analysis/essay/unknown`。
- `difficulty`: `easy/medium/hard/unknown`。
- 选项只含 `key/content`，不含正确性。

## Runtime

### RunManager

- 单个 Thread 同时最多一个活动 Run。
- 默认全局最多 4 个并发 Run。
- 默认单用户最多 2 个并发 Run。
- 并发限制可配置，但首版不支持多进程共享配额。
- 超出全局或用户容量时不排队、不持久化，直接返回429。
- RunManager 在创建数据库记录前通过同一把异步锁预留全局槽位和用户槽位，持有 `run_id -> asyncio.Task`，负责启动、取消、容量释放和关闭 drain。
- 幂等重放在容量预留前查询，已有Run即使当前容量已满也能正常返回。

### Worker

Worker 执行：

1. 以用户和 Thread 范围加载 Run。
2. 原子地将 `queued` 改为 `running`。
3. 加载 Thread Summary 和游标后的 Messages；该消息集合已经包含本次 Run 的用户 Message。
4. 构造 AgentContext，并把“摘要 + 包含本次用户 Message 的游标后 Messages”作为唯一 graph 输入；不得从请求体或 Run 再追加一次当前消息。
5. 调用 graph `astream(stream_mode=["messages", "values"])`。
6. 将主 Agent 文本 delta 发布为事件。
7. 收集同一规范化最终文本和 token usage。
8. 在一个事务中写 Assistant Message、Run 终态和最终事件。

只有根 Agent 模型文本可成为 `message.delta`。模型内部推理、工具原始结果和 Middleware内部消息不发布给前端。

### 事件类型

```text
run.created
run.started
message.started
message.delta
tool.started
tool.completed
tool.failed
message.completed
run.completed
run.failed
run.cancelled
run.interrupted
stream.end
```

- 持久业务事件有 Run 内单调 sequence。
- 工具事件只包含工具名、状态、耗时和安全错误码，不包含完整题干、答案、JWT或服务密钥。
- `message.delta` payload 有文本片段，不保存模型内部元数据。
- `stream.end` 可按终态响应生成，不要求重复持久化。

## 长对话管理

- 原始 Message 永久保留，除非后续明确制定数据保留策略。
- 每次 Run 加载持久摘要和摘要游标后的消息。
- 达到 `agent_summary_trigger_tokens` 时压缩较早消息，保留最近 `agent_summary_keep_messages` 条。
- 摘要失败不删除历史；本次 Run 可在上下文仍不超模型硬限制时继续，否则安全失败。
- Summary 只属于 Thread，不跨 Thread 共享。
- Thread 标题使用第一条用户消息的安全截断，不额外调用模型。

## 配置

只使用 YAML：

- `config.example.yaml`: 可提交模板，包含注释和安全默认值。
- `config.yaml`: 真实配置，必须被 Git 和 Docker build context 忽略。
- `AGENT_CONFIG_FILE`: 仅允许选择 YAML 文件路径，不能覆盖 YAML 内单项配置。

核心配置：

```yaml
database_url: mysql+asyncmy://user:password@127.0.0.1:3306/aisoftoj_ai

platform_base_url: http://127.0.0.1:8080
platform_service_key: ""
platform_connect_timeout_seconds: 2
platform_read_timeout_seconds: 5
platform_max_response_bytes: 2097152

llm_base_url: ""
llm_api_key: ""
llm_default_model: ""
llm_request_timeout_seconds: 60
llm_max_retries: 1

agent_max_run_tokens: 32000
agent_max_run_seconds: 180
agent_summary_trigger_tokens: 24000
agent_summary_keep_messages: 12
agent_max_concurrent_runs: 4
agent_max_user_concurrent_runs: 2
agent_max_user_message_chars: 20000
agent_loop_warn_repetitions: 3
agent_loop_hard_repetitions: 5
shutdown_drain_seconds: 15

host: 127.0.0.1
port: 8000
log_level: info
```

Secret 字段使用 Pydantic SecretStr，配置校验和 repr 不输出明文。缺失数据库、平台或模型必要配置时服务快速启动失败。

## 错误模型

统一错误响应：

```json
{
  "error": {
    "code": "STABLE_CODE",
    "message": "safe user-facing message",
    "request_id": "uuid"
  }
}
```

主要语义：

- 400：参数或消息不合法。
- 401：JWT 缺失、无效、过期或用户失效。
- 403：AI服务内部服务认证失败；不用于私有资源归属。
- 404：资源不存在、属于其他用户或已删除，响应不可区分。
- 409：活动 Run 冲突或错题状态不允许复盘。
- 413：用户消息超限。
- 429：用户或全局并发限制。
- 502：模型或Java平台返回无效响应。
- 503：依赖不可用或服务关闭中。
- 504：模型或平台超时。

只读 Java GET 在连接错误、超时或可重试 5xx 时等待 100ms 后重试一次；4xx 不重试。错误不得向前端或模型暴露内部 URL、响应正文、堆栈、JWT或服务密钥。

## 安全与可观测性

- 平台业务只读由实际工具集合和 Java 权限实现，不依赖 Prompt 自律。
- Python 不连接 `aisoftoj` 业务数据库，只连接 `aisoftoj_ai`。
- 所有 Repository 方法显式要求 `user_id` 范围，后台 Worker 使用创建 Run 时已验证的 user ID。
- 日志允许记录 request ID、user ID、thread ID、run ID、工具名、状态和耗时。
- 日志禁止记录 JWT、API Key、服务密钥、邮箱、手机号、题干、用户答案、标准答案、Prompt和模型完整输出。
- SSE、数据库 Event 和异常都使用经过 Pydantic 验证的安全载荷。
- 工具审计只记录参数键，不记录参数值。

## 测试策略

### APP

- FastAPI 创建、路由和统一错误响应。
- 健康检查 live/readiness 语义。
- Bearer scheme、Java身份验证和 TrustedUser。
- 所有 Thread/Run API 用户隔离。
- Thread CRUD、软删除和稳定分页。
- Run 幂等键、活动Run冲突和202响应。
- Cancel幂等和终态保护。
- fetch SSE 的 Bearer认证、历史补发、sequence去重和断线续读。

### Agent Harness

- OpenAI-compatible模型构造参数和Secret脱敏。
- AgentContext中的JWT不进入State、Message、Checkpoint、工具Schema或日志。
- 启动时模型可见工具集合精确等于5个业务工具。
- 默认Subagent、task、文件和执行工具不可见。
- Tool Policy、Tool Error、Token Budget和Loop Detection。
- 持久摘要替换默认摘要且不会双重启用。

### Runtime

- Run状态机合法迁移。
- 全局、用户和Thread并发限制。
- DELETE Thread与POST Run并发时使用相同Thread行锁顺序，不能在已删除Thread下创建Run。
- 并发相同Idempotency-Key只创建一个Run，竞争方返回同一Run。
- Worker成功、模型失败、平台认证失败、取消、超时和服务中断。
- 当前Run的用户Message只向graph装配一次。
- 用户Message保留，Assistant Message只成功写一次。
- SSE文本、Assistant Message和Run输出一致。
- RunEvent sequence在并发发布下仍单调唯一。
- 启动时遗留queued/running收敛为interrupted。
- Run终态后清理对应InMemorySaver checkpoint。

### Persistence

- Alembic在空 `aisoftoj_ai` 数据库升级到head。
- MySQL 5.7 `active_marker` STORED generated column和 `thread_id + active_marker` 唯一约束。
- Repository全部按user ID隔离。
- Idempotency唯一约束、Thread/Run/Event序号和软删除。
- Summary游标只能前进，事务失败不丢原始Message。

### Platform集成

- Java 5个内部接口均要求服务密钥和有效JWT。
- 服务密钥错误、JWT过期、用户禁用和软删除。
- `get_question`绝不序列化答案、解析或选项正确性。
- 他人错题、已删除错题和不存在错题返回相同404。
- 错题复盘验证会话归属、完成状态和题目一致性。
- 多会话试卷聚合优先级。
- 练习历史summary覆盖全量，不受当前页影响。
- Python Pydantic模型与Java DTO精确契约测试。

### 集成与质量

- 使用假的OpenAI-compatible流式服务测试tool call和文本delta，不消耗真实模型费用。
- 使用Java平台Mock测试认证、错误和工具数据。
- 可选本地冒烟连接真实Java开发服务和测试用户JWT。
- 验证命令包含 `pytest`、`ruff` 和严格 `mypy`。

## 本期交付物

- 可启动FastAPI服务、`server.py`、健康检查和YAML配置。
- APP / Harness双层工程结构。
- Thread、Message、Run、RunEvent、ThreadSummary模型、Repository和Alembic迁移。
- Thread / Run / Cancel / SSE API。
- RunManager、Worker、StreamBridge和断线恢复。
- OpenAI-compatible模型工厂和Deep Agent graph。
- 5个Python平台只读工具。
- 5个Java内部只读接口、DTO、认证和测试。
- README、Dockerfile和自动化测试。

## 非目标

- React聊天面板联调或修改现有前端AI面板。
- 生产Nginx和Compose切换。
- Cookie认证迁移。
- Subagent、Skills、上传、文件系统、定时任务和Artifacts。
- 跨Thread长期记忆。
- 创建刷题会话、更新答案、暂停、交卷、论文提交或其他平台写工具。
- 多Uvicorn worker、多服务副本、Redis、外部任务队列或分布式事件总线。
- 服务重启后从模型调用中间位置继续执行。

## 验收标准

- `python server.py` 能启动服务，`livez/readyz` 语义正确。
- 已认证用户可以创建Thread、创建Run、订阅SSE、取消Run并读取历史。
- 页面断线后可按事件sequence恢复，最终Assistant Message与流式文本一致。
- 用户不能读取或操作其他用户的Thread、Message或Run。
- 模型可见工具精确等于5个平台只读工具，且任何工具都不能修改平台业务数据。
- Java在每次工具调用重新验证服务身份、JWT、用户状态和资源权限。
- Python只写独立 `aisoftoj_ai` 数据库，不读取Java业务表。
- 服务重启后遗留Run安全收敛为interrupted，已完成消息和事件可继续读取。
- APP、Harness、Runtime、Persistence和Java平台测试通过，且 `ruff`、严格 `mypy` 通过。
