# AI 助手只读平台工具设计

## 目标

为知构软考平台建立独立的 Python AI 工程，并先交付一组可供 Deep Agents 调用的平台只读工具库。工具通过 Java 后端读取当前用户、试卷、题目、错题复盘和练习历史；Java 继续负责 JWT 校验、用户状态、资源归属和答案可见性。

本期不实现聊天界面、SSE、模型调用或对话持久化。工具层必须能够独立测试，供后续内置 AI 助手直接复用。

## 已确认约束

- Python 服务使用 Python 3.11 及 `deepagents`。
- 浏览器直接访问 Python AI 服务，不经过 Java 转发 AI 请求。
- 第一版沿用现有 `Authorization: Bearer <JWT>`，不迁移到 Cookie 认证。
- 后续运行 Python AI 服务时，Python 与 Java 部署在同一台服务器，仅通过宿主机回环地址通信。
- Python 不连接 MySQL，不复制浏览器端 RSA-OAEP + AES-GCM 内容解密协议。
- Java 是用户身份、资源可见性、私有资源归属和答案可见性的唯一裁决者。
- Agent 严格只读，不能创建练习、更新答案、暂停或提交会话，也不能提交论文。
- 首批只实现 5 个工具，不增加错题列表、完整会话结果或写操作工具。

## 总体架构

```text
Browser
   |
   | Authorization: Bearer <user JWT>
   v
Host Nginx /api/ai/**
   |
   v
Python aisoftoj-ai (future HTTP entrypoint), 127.0.0.1:8000
   |
   | Authorization: Bearer <user JWT>
   | X-AI-Service-Key: <service secret>
   v
Java aisoftoj-backend, 127.0.0.1:8080
   |
   v
MySQL
```

此图描述后续聊天入口接入后的运行拓扑，不代表本期创建 HTTP 服务器。现有生产后端使用 host network 并监听 `127.0.0.1:8080`。后续 Python HTTP 服务沿用同机回环通信并监听 `127.0.0.1:8000`，避免为 AI 能力改造既有 MySQL 和 Compose 网络。

宿主机 Nginx 后续将 `/api/ai/` 转发到 Python。`/api/internal/ai/` 必须在任何通用 `/api/` 转发规则之前显式返回 404，防止 Java 内部接口通过公网入口暴露。Python 直接调用 `http://127.0.0.1:8080/internal/ai/...`。Nginx 与 Compose 变更属于后续 Agent 接入，不属于本期工具库实现。

## 服务边界

### React 前端

本期不改前端。后续聊天入口调用 Python 时，继续读取当前 `localStorage` 中的 JWT 并设置 `Authorization` 请求头。

### Python AI 服务

新增 `aisoftoj-ai/` Python 包。它负责：

- 定义 Deep Agents 工具及参数 Schema。
- 使用请求级 `PlatformApiClient` 调用 Java 内部接口。
- 将 HTTP、认证、超时和平台错误映射为稳定的工具错误。
- 保证 JWT 和服务密钥不会出现在工具参数、模型上下文、对话状态或日志中。

Python 不解析或信任 JWT 中的声明。每次工具调用都把 JWT 原样转发给 Java，由 Java 重新验证。

本期 Python 产物是可导入的工具库，不创建 FastAPI/Flask 应用、不监听端口，也不定义浏览器 HTTP 入口。它暴露 `create_platform_tools(bearer_token: str)` 工厂；`bearer_token` 参数只接受不含 `Bearer ` 前缀的原始 JWT。后续聊天请求处理器负责验证 Authorization scheme、移除前缀并把原始 JWT 传给工厂。工厂为本次请求创建 `PlatformApiClient` 并返回绑定该客户端的 5 个工具。请求处理器和 Deep Agent 实例属于后续范围。

### Java 后端

Java 新增 `/internal/ai/*` 只读接口、精简 DTO、查询服务和内部服务认证。内部 Controller 复用现有 Service/Mapper 规则，不返回数据库实体，不使用 `@EncryptedQuestionResponse`，因为响应仅通过回环地址传给受信任的 Python 服务。

每次请求必须同时通过：

1. `X-AI-Service-Key` 服务密钥校验。
2. 现有 Bearer JWT 签名、过期时间和 `tokenVersion` 校验。
3. 用户未删除且处于启用状态的校验。
4. 目标资源可见性校验：公开题库资源必须已发布且未删除；用户资料、错题和练习历史等私有资源必须属于当前用户。

## Python 工程结构

```text
aisoftoj-ai/
├── pyproject.toml
├── .env.example
├── README.md
├── src/aisoftoj_ai/
│   ├── __init__.py
│   ├── config.py
│   ├── errors.py
│   ├── platform_client.py
│   ├── models/
│   │   ├── common.py
│   │   ├── profile.py
│   │   ├── paper.py
│   │   ├── question.py
│   │   ├── wrong_question.py
│   │   └── practice.py
│   └── tools/
│       ├── __init__.py
│       ├── profile.py
│       ├── papers.py
│       ├── questions.py
│       ├── wrong_questions.py
│       └── practice_history.py
└── tests/
```

`PlatformApiClient` 按用户请求创建，构造参数包含不透明的 Bearer JWT。`create_platform_tools(bearer_token)` 使用闭包绑定客户端，Agent 可见的工具 Schema 中不出现 JWT、服务密钥或内部 URL。本期测试直接调用该工厂；后续 HTTP 请求处理器是唯一负责从 `Authorization` 请求头提取 JWT 并传入工厂的组件。

## 数据格式约定

- 所有 ID 和计数字段使用 JSON 整数；ID 必须大于 0，计数不得小于 0。
- 所有时间字段使用带时区的 ISO 8601 字符串，并统一输出 UTC `Z`，例如 `2026-08-17T03:04:05Z`；无时间时为 `null`。
- 可为空的展示字段输出 `null`，不使用空字符串代替缺失值。
- `practice_status` 只允许 `not_started`、`in_progress`、`completed`。
- 练习历史 `status` 只允许 `in_progress`、`completed`。
- 练习历史 `exam_mode` 只允许 `practice`、`exam`。
- `category` 和练习历史 `exam_type` 使用现有中文枚举：`综合知识`、`案例分析`、`论文`。
- `question_type` 使用稳定字符串枚举：`single_choice`、`multiple_choice`、`judgement`、`fill_blank`、`case_analysis`、`essay`、`unknown`。
- `difficulty` 使用 `easy`、`medium`、`hard`、`unknown`。
- `options` 是按题目顺序排列的对象数组，每项只含非空 `key` 和 `content`；不得包含正确性字段。

## 首批工具契约

### `get_my_profile()`

返回当前用户的可靠学习身份摘要：

- `user_id`
- `username`
- `nickname`
- `role`
- `join_date`
- `last_login_date`
- `practice_session_count`
- `wrong_question_count`

不返回密码、JWT、邮箱、手机号、微信 OpenID。现有 `correctAnswers`、`accuracy`、`studyDays`、`level` 和 `points` 含占位值，本工具不得返回这些字段。

对应 Java 接口：`GET /internal/ai/me`。

### `list_papers()`

返回已发布试卷和当前用户的练习状态。每项包含：

- `paper_id`
- `name`
- `subject_name`
- `category`
- `year`
- `month`
- `question_count`
- `practice_status`
- `completed_question_count`
- `ongoing_session_id`
- `last_practice_time`

不返回试卷题目、标准答案或解析。

多会话聚合遵循确定性规则：

1. 只统计当前用户、未软删除且状态为进行中或已完成的会话。
2. 同一试卷存在进行中会话时，`practice_status=in_progress`；否则只要存在已完成会话即为 `completed`，否则为 `not_started`。
3. 多个进行中会话按活动时间降序选一个；活动时间依次取 `update_time`、`end_time`、`create_time`，相同或均为空时取 ID 最大者。其 ID 作为 `ongoing_session_id`，其 `answered_count` 作为 `completed_question_count`。
4. 没有进行中会话但存在已完成会话时，`ongoing_session_id=null`，`completed_question_count=question_count`。
5. 未开始时 `ongoing_session_id=null`，`completed_question_count=0`。
6. `last_practice_time` 是所有纳入统计会话活动时间的最大值；没有会话时为 `null`。

对应 Java 接口：`GET /internal/ai/papers`。

### `get_question(question_id)`

参数 `question_id` 必须为正整数。接口仅允许读取属于已发布试卷的有效题目，返回：

- `question_id`
- `name`
- `content`
- `options`
- `question_type`
- `difficulty`

此工具在任何情况下都不返回 `answer`、`analysis`、选项正确性或管理员字段。它不能因用户角色是管理员而扩大返回范围。

题目是登录用户可读的公共题库资源，不要求与当前用户存在练习记录；Java 必须验证题目未删除且至少属于一份已发布、未删除的试卷。

对应 Java 接口：`GET /internal/ai/questions/{questionId}`。

### `review_wrong_question(wrong_question_id)`

参数是 `user_wrong_question_stat.id`，必须为正整数。Java 必须按当前用户 ID 和未删除状态查询错题，不能先按 ID 查询后只在 Controller 中比较用户。

Java 使用错题记录的 `last_session_id` 和 `question_id` 查找最近一次错误对应的答题记录，并验证：

- 错题属于当前用户。
- 关联会话属于当前用户。
- 会话已经完成。
- 会话题目记录与错题的 `question_id` 一致。
- 相关记录均未软删除。

返回：

- `wrong_question_id`
- `question_id`
- `paper_id`
- `paper_name`
- `question_name`
- `question_content`
- `options`
- `question_type`
- `difficulty`
- `user_answer`
- `correct_answer`
- `analysis`
- `error_count`
- `importance`
- `last_wrong_time`
- `spend_time`

`user_answer` 和 `correct_answer` 是非空字符串，沿用平台标准答案编码；缺失任一字段时返回 409，不返回不完整复盘。`analysis` 为字符串或 `null`。`spend_time` 为非负整数秒或 `null`。

如果关联会话不存在、尚未完成或关联记录不一致，返回稳定的冲突错误，不尝试从题库表绕过会话状态直接补出答案。

对应 Java 接口：`GET /internal/ai/wrong-questions/{wrongQuestionId}/review`。

### `list_practice_history(page, page_size)`

`page` 默认 1 且最小为 1；`page_size` 默认 10，范围为 1 到 20。返回分页元数据、可靠汇总和练习记录：

- `records`
- `total`
- `page`
- `page_size`
- `summary.total_count`
- `summary.in_progress_count`
- `summary.completed_count`
- `summary.answered_count`

每条 `records` 记录使用以下固定字段，不返回重复的通用 `id`：

- `session_id`: 正整数。
- `paper_name`: 非空字符串。
- `exam_mode`: `practice` 或 `exam`。
- `exam_type`: `综合知识`、`案例分析` 或 `论文`。
- `created_at`: UTC ISO 8601 字符串。
- `answered_count`: 非负整数。
- `question_count`: 非负整数。
- `status`: `in_progress` 或 `completed`。

记录不返回题目、用户答案、标准答案或解析。

记录和汇总都只纳入当前用户、`is_deleted=0` 且状态为进行中或已完成的会话。`summary` 始终统计满足该条件的全部会话，不受当前页影响：`total_count` 是会话总数，`in_progress_count` 和 `completed_count` 按状态计数，`answered_count` 是全部纳入会话 `answered_count` 的非空求和。`total` 必须等于 `summary.total_count`。记录按 `create_time` 降序、ID 降序分页。

对应 Java 接口：`GET /internal/ai/practice-history?page=...&pageSize=...`。

## Java 内部 API 规则

所有内部接口：

- 仅使用 `GET`。
- 统一返回现有 `ResultDTO<T>` 包装。
- 设置 `Cache-Control: private, no-store`。
- 使用专用 AI DTO，不返回 MyBatis 实体。
- 对 ID 和分页参数执行服务端校验。
- 不使用浏览器内容加密注解。
- 不接受 `userId` 请求参数；用户身份只能来自已验证 JWT。

内部服务密钥从环境变量读取。缺失配置时生产环境必须启动失败；密钥比较使用常量时间算法。密钥不得放入仓库、镜像、错误信息或日志。

## 身份与凭据生命周期

浏览器把当前 Bearer JWT 发给 Python。Python 在进入未来的聊天处理前应调用平台接口确认身份；本期工具层通过请求级客户端表达这一边界。

JWT 只能保存在当前请求对象或客户端实例的内存中：

- 不写入 Agent 消息或持久化状态。
- 不作为工具参数或工具返回值。
- 不写入日志、追踪属性或异常文本。
- 请求结束后不缓存到全局 Agent 实例。

`X-AI-Service-Key` 由 Python 配置注入，模型和浏览器均不可提供或覆盖该请求头。

## 错误处理

Java 对外提供稳定的 HTTP 语义：

- `400`：参数不合法。
- `401`：Bearer JWT 缺失、无效、过期或用户状态失效。
- `403`：内部服务认证失败；该状态不用于用户资源归属判断。
- `404`：资源在调用者可见范围内不存在。对于私有资源，这包括 ID 不存在、资源属于其他用户或资源已软删除，三种情况必须使用相同响应结构以防止 ID 枚举。对于公共题库资源，这包括题目不存在、已删除或不属于任何已发布试卷。
- `409`：错题关联会话未完成、关联缺失或状态不允许复盘。
- `429`：请求频率超过限制。
- `5xx`：平台内部错误。

Python 将错误映射为不含内部 URL、响应体、凭据或堆栈的领域错误。`401` 必须终止当前 AI 请求并提示重新登录。只读 GET 在连接失败、超时或可重试 `5xx` 时最多重试一次；`4xx` 不重试。

HTTP 客户端连接超时为 2 秒、读取超时为 5 秒，单个响应体最大为 2 MiB。超过限制视为平台响应错误。允许重试时等待 100 毫秒后仅重试一次，防止工具调用无限等待或向模型上下文注入超大内容。

## 日志与可观测性

允许记录：

- 请求关联 ID。
- 已验证用户 ID。
- 工具或内部接口名称。
- 状态码、耗时和重试次数。

禁止记录：

- JWT 和服务密钥。
- 用户邮箱、手机号等身份信息。
- 题干、用户答案、标准答案和解析正文。
- Java 原始异常堆栈返回值。

## 测试策略

### Java 测试

- 5 个内部接口均要求正确服务密钥和有效 JWT。
- 缺失或错误服务密钥被拒绝。
- JWT 无效、过期、`tokenVersion` 失效、用户禁用或删除时被拒绝。
- 内部接口不接受调用方指定用户 ID。
- `get_question` 的序列化结果不含答案、解析和选项正确性。
- `review_wrong_question` 只能读取当前用户的错题。
- 他人错题、已删除错题和不存在的错题均返回相同 404 响应，不泄露是否存在或拥有者信息。
- 错题关联会话必须属于当前用户且已完成。
- 错题、会话和题目关联不一致时返回冲突错误，且不回退到题库答案。
- 多个进行中会话按活动时间和 ID 的既定优先级确定唯一试卷状态。
- 练习历史分页默认值、下界和 `page_size=20` 上界正确。
- 练习历史汇总覆盖全部符合条件的会话，不受当前页影响。
- 响应使用精简 DTO、`Cache-Control: private, no-store`，且接口仅暴露 GET。

### Python 测试

- 5 个工具的名称、描述和参数 Schema 稳定。
- JWT 和服务密钥由客户端注入，不出现在工具 Schema。
- 客户端正确解析 `ResultDTO` 和各工具 Pydantic 模型。
- 缺失配置时快速失败。
- `400`、`401`、`403`、`404`、`409`、`429` 和 `5xx` 映射正确，越权资源与不存在资源对工具调用方不可区分。
- 只在允许的网络错误、超时和 `5xx` 上重试一次。
- 日志和工具异常不包含 JWT、服务密钥、内部 URL或原始响应。
- 分页和正整数参数在发出 HTTP 请求前完成校验。
- 练习历史契约测试断言精确字段集合及 `exam_mode`、`exam_type`、`status` 枚举。

### 契约验收

- Python 测试使用 mock HTTP 验证工具与 Java DTO 契约。
- Java Controller/Service 测试覆盖真实鉴权和数据归属规则。
- 最终运行双方测试，并用本地 Java 服务完成 5 个工具的最小冒烟调用。

## 本期交付物

- 可导入但不监听端口的 `aisoftoj-ai` Python 包、配置示例和本地测试说明。
- 5 个 Deep Agents 只读工具。
- Python 平台客户端、Pydantic 数据模型和测试。
- Java 内部认证、只读 Controller、Service、DTO 和测试。
- 必要的后端配置项说明。

## 非目标

- 聊天 UI、悬浮面板或前端路由改动。
- SSE/WebSocket 流式响应。
- FastAPI/Flask 应用、浏览器 AI HTTP 入口和任何监听端口的 Python 进程。
- 创建 Deep Agent 实例或选择具体模型供应商。
- 对话历史和长期记忆。
- Cookie 认证迁移。
- Python 直接访问数据库。
- 复用或重写浏览器题目内容加密协议。
- `list_wrong_questions`、完整会话结果、创建练习、更新答案、暂停、交卷和论文提交工具。
- 本期生产部署和 Nginx/Compose 变更；拓扑约束保留给后续 Agent 接入阶段实现。

## 验收标准

- 5 个工具可以在不暴露认证凭据的前提下调用对应 Java 内部接口。
- Java 对每次工具调用重新校验服务身份、用户 JWT、用户状态以及公开资源可见性或私有资源归属。
- `get_question` 无法返回答案；`review_wrong_question` 只能返回当前用户已完成错题记录的答案。
- Python 和 Java 自动化测试覆盖鉴权、权限、答案边界、参数校验和错误映射。
- 工具层不包含任何平台写操作，也没有到 MySQL 的直接连接。
- 本期改动不依赖聊天 UI、具体 LLM 或全站认证迁移即可独立验收。
