# AI Agent 生产 Compose 灰度上线设计

日期：2026-08-28
状态：用户已确认，待规格审查

## 1. 目标与范围

本次发布将知构软考平台的应用层迁移为统一的 Docker Compose 管理，并以灰度方式上线 AI Agent。

发布范围包括：

- 基础 AI Agent 与只读平台工具；
- 每日 Token 额度，默认每位用户每天 30,000 Token；
- 后台 Token 用量查询、默认额度和单用户额度调整；
- LangSmith 生产 tracing；
- 服务端管理员与测试用户灰度控制；
- 考试场景禁用 AI；
- Java、前端和 AI 三个应用容器的健康检查、资源限制、日志轮转与统一版本。

明确不包含：

- MinerU 代码、依赖和生产配置；
- Prometheus 与 Grafana；
- MySQL 容器迁回应用服务器；
- 首版向普通用户全量开放 AI；
- 对现有产品功能的无关重构。

## 2. 当前基线

- 应用服务器：`47.111.184.231`，2 vCPU、约 1.6 GiB 可用内存、2 GiB swap。
- 数据库服务器：MySQL 8.4.11，私网地址 `10.20.0.21:3306`。
- 应用服务器与数据库服务器已通过跨账号 VPC 对等连接通信。
- 旧 MySQL 已停止但容器、数据目录和迁移备份仍保留。
- Java 当前由 `aisoftoj.service` 运行，监听 `127.0.0.1:8080`。
- 宿主机 Nginx 负责 80/443 和 TLS。
- 生产数据库的 AI Alembic 版本当前为 `0002_run_question`。
- 服务器尚无 `/etc/aisoftoj/ai-config.yaml`、`AI_INTERNAL_SERVICE_KEY` 和 LangSmith 配置。

## 3. 发布代码基线

创建独立发布分支，不直接部署当前开发分支。发布分支应包含：

- 已验证的基础 AI Agent；
- Token 额度与后台管理提交；
- LangSmith 可观测性提交；
- 服务端灰度访问控制；
- 前端灰度入口；
- 考试场景禁用 AI。

发布分支不得包含 MinerU 的业务代码和依赖。若现有提交存在交叉依赖，应通过选择性移植或小范围重构解除依赖，而不是仅依赖生产环境关闭开关。

三个生产镜像必须使用同一个不可变 release SHA：

- `aisoftoj-backend:<release-sha>`
- `aisoftoj-frontend:<release-sha>`
- `aisoftoj-ai:<release-sha>`

## 4. 生产架构

宿主机 Nginx 继续负责公网入口和证书，应用层交由 Compose 管理：

```text
Internet
  |
Host Nginx :80/:443
  |-- /api/ai/* --> aisoftoj-ai       127.0.0.1:8000
  |-- /api/*    --> aisoftoj-backend  127.0.0.1:8080
  `-- /*        --> aisoftoj-frontend 127.0.0.1:8081

aisoftoj-backend / aisoftoj-ai
  |
VPC private network
  |
MySQL 10.20.0.21:3306
```

宿主机持久化保留：

- `/etc/aisoftoj/backend.env`
- `/etc/aisoftoj/ai.env`
- `/etc/aisoftoj/ai-config.yaml`
- `/opt/aisoftoj/uploads`
- release、备份与回滚目录
- Nginx 配置和证书

## 5. 容器与资源限制

### Java 后端

- host network，监听 `127.0.0.1:8080`；
- JVM：`-Xms128m -Xmx320m -XX:+ExitOnOutOfMemoryError`；
- 内存上限 448 MiB，reservation 256 MiB；
- CPU 上限 1.5；
- readiness 健康检查；
- 上传目录持久化；
- root filesystem 只读。

### 前端

- 映射 `127.0.0.1:8081:8080`；
- 内存上限 64 MiB，reservation 32 MiB；
- CPU 上限 0.5；
- root filesystem 只读；
- `/healthz` 健康检查。

### AI Agent

- host network，监听 `127.0.0.1:8000`；
- 内存上限 448 MiB，reservation 192 MiB；
- CPU 上限 1.5；
- 灰度期全局并发 1，单用户并发 1；
- `/livez` 与 `/readyz` 健康检查；
- root filesystem 只读；
- 优雅退出窗口 30 秒。

三个容器的内存上限合计为 960 MiB，为宿主机、Docker、Nginx、页缓存和部署命令预留约 640 MiB 物理内存。2 GiB swap 只作为故障缓冲，不计入稳定容量。

灰度准入前需在备用端口完成至少 10 次真实短 Run 和 1 次长 Run，并满足：

- 宿主机 `MemAvailable` 持续高于 250 MiB；
- swap 使用低于 128 MiB，且 10 分钟内无持续增长；
- 无容器 OOM、重启或健康检查抖动；
- 磁盘 iowait 持续低于 15%；
- AI Run 期间原有 Java API P95 无明显恶化。

生产观察期若 `MemAvailable` 连续 5 分钟低于 200 MiB、swap 10 分钟增长超过 256 MiB、出现任意 OOM、容器连续重启或 iowait 连续 5 分钟超过 20%，立即关闭 AI 入口并执行回滚。

所有服务使用 `unless-stopped`、JSON 日志轮转（单文件 10 MiB，最多 3 个）和 `no-new-privileges`。

只读 root filesystem 的最小可写路径如下：

- Java：`/tmp` 使用 64 MiB tmpfs；`/app/uploads` 使用宿主持久卷；
- AI：`/tmp` 使用 64 MiB tmpfs；应用配置只读挂载；
- 前端 Nginx：`/tmp`、`/var/cache/nginx` 和 `/var/run` 使用小容量 tmpfs；
- Java 使用宿主机现有 `aisoftoj` 的固定数字 UID/GID；AI 使用专用固定 UID 与 `aisoftoj-ai` GID；前端使用镜像固定的非 root Nginx UID/GID；
- 只有非秘密的 `ai-config.yaml` 归属 `root:<aisoftoj-ai-gid>`、mode 0640，并以只读方式挂载；预检必须以 AI 目标 UID/GID 成功读取但无法修改；
- 前端 `/tmp`、`/var/cache/nginx` 和 `/var/run` tmpfs 显式设置为前端 Nginx UID/GID 可写的 mode 0770；
- 上线前验证所有挂载目录和 tmpfs 的数字 UID/GID、读取与写入权限，避免依赖容器内外同名用户。

## 6. 灰度访问控制

灰度控制必须由服务端执行，不能只隐藏前端入口。授权分为两个互不混用的策略：

- 普通 AI API：管理员或 `AI_ROLLOUT_ALLOWED_USER_IDS` 白名单用户允许；
- AI 管理 API：仅管理员允许，测试白名单用户不得查询全局用量或修改额度；
- `/livez`、`/readyz` 仅监听 loopback，不经公网 Nginx 暴露；其他 `/api/ai/*` 不设匿名豁免；
- 前端通过服务端返回的 `aiEnabled` capability 显示或隐藏入口，不在浏览器复制或解析白名单；
- 修改白名单后仅需重启 AI/前端相关服务，不需要重新构建镜像。

普通 AI API 使用同一个路由级授权依赖，覆盖创建线程、查询线程、消息、启动 Run、读取 SSE、取消 Run 和 Skill 列表，避免旁路访问。额度管理接口继续使用 Java 的管理员鉴权，不复用灰度白名单判断。

### 考试场景禁用

“考试中禁用 AI”是服务端安全控制，不只是 UI 隐藏：

- Java 根据当前用户是否存在有效的进行中考试会话计算 `aiEnabled` capability；判定来源为服务端 `practice_session` 的所有者、`exam_mode=exam`、进行中状态和有效考试时间窗口；
- AI 的共享路由级授权依赖在每次请求时通过 Java 内部接口读取 capability；考试状态下所有业务 AI API 返回稳定错误码 `AI_DISABLED_DURING_EXAM` 和 HTTP 403；
- 后台 Run 在每轮模型调用前、每次工具调用前以及持久化或发送任何用户可见事件前重新读取 capability；一旦进入考试状态，立即把 Run 标记为取消、丢弃尚未发送的模型内容，并通过 SSE 发送不含回答正文的终止错误后关闭连接；
- 已经在途的模型 HTTP 请求可以等待网络调用结束，但其结果不得入库或发送给用户；因此考试开始前建立的 Run/SSE 也不能在考试中继续获得回答；
- `/livez`、`/readyz` 继续仅供 loopback 机器检查，不参与用户考试判断；AI 管理接口仍只按管理员规则授权；
- 前端考试页隐藏入口，但只能把它视为体验优化；服务端拒绝才是权威控制；
- 验收必须覆盖考试页隐藏、直接构造创建线程/启动 Run/SSE 请求仍被拒绝、先启动 Run/SSE 再开始考试时 Run 被取消且无后续回答、交卷后 capability 恢复，以及他人 session ID 无法影响或绕过判定。

## 7. Token 额度

- 默认额度：30,000 Token/用户/自然日；
- 日期边界固定使用 IANA 时区 `Asia/Shanghai`；
- Run 开始前进行原子预留，完成后按实际用量结算；
- 失败、取消和超时不得造成重复扣费；
- 达到额度时拒绝新 Run，并返回稳定的业务错误码；
- 后台支持调整全局默认值和单用户覆盖值；
- 首版不在输入框附近展示“今日剩余 Token”。

额度 API 返回的 `reset_at` 使用 RFC 3339 格式并带 `+08:00` 偏移，值为下一次上海时区零点。测试覆盖零点前后预留/结算、UTC 日期不同但上海日期相同、跨日未完成 Run，以及夏令时无变化的预期。

## 8. 密钥与生产配置

### 模型

沿用已存在的 DeepSeek OpenAI 兼容配置。正式切换前必须完成一次真实模型请求，并确认所选模型名称、超时和重试设置有效。

### LangSmith

- `LANGSMITH_TRACING=true`
- `LANGSMITH_PROJECT=aisoftoj-agent-production`
- `LANGSMITH_ENVIRONMENT=production`
- `LANGSMITH_AGENT_VERSION=<release-sha>`
- `LANGSMITH_TRACING_SAMPLING_RATE=0.2`
- `LANGSMITH_FLUSH_TIMEOUT_SECONDS=2`

不同服务使用独立环境文件，禁止将统一环境文件无差别注入所有容器：

- `/etc/aisoftoj/backend.env`：Java 数据库、JWT、邮件和内部服务密钥；
- `/etc/aisoftoj/ai.env`：AI 数据库、模型、LangSmith 和内部服务密钥；
- 前端容器不挂载任何服务端环境文件或密钥；
- 迁移凭据单独写入临时 root-only 文件，迁移后立即撤销权限并删除凭据文件。

`backend.env` 与 `ai.env` 仅由宿主机上的 root Compose 进程通过 `env_file` 读取，不作为 bind mount 出现在容器文件系统。生产文件均为 `root:root`、mode 0600。容器只挂载不含秘密的 `ai-config.yaml`。

LangSmith Key 只允许存在于：

- 本地 `aisoftoj-ai/.env.local`，mode 0600，且必须被 Git 忽略；
- 生产 `/etc/aisoftoj/ai.env`，归属 `root:root`、mode 0600，仅宿主机 root 可读并由 Compose 注入 AI 容器。

不得把 LangSmith Key 写入 Git、`ai-config.yaml`、镜像层或日志。

### 内部服务密钥

随机生成 `AI_INTERNAL_SERVICE_KEY`，Java 环境变量与 AI 的 `platform_service_key` 必须一致。内部接口继续要求用户 Bearer JWT 与服务密钥同时存在。

上线验收需要检查 `docker inspect` 的环境变量名称和容器内环境，确保前端无秘密、Java 不含模型或 LangSmith Key、AI 不含 Java JWT/邮件秘密。检查结果不得打印秘密值。

### AI 配置

生产 `/etc/aisoftoj/ai-config.yaml` 归属 `root:<aisoftoj-ai-gid>`、mode 0640，只包含非秘密配置：Java 内部地址、模型地址、模型名、Agent 限制和 Skill 限制。数据库密码、内部服务密钥、模型 Key 和 LangSmith Key 通过 `ai.env` 注入；配置加载器需支持相应环境变量覆盖。不得从本地开发配置复制明文开发数据库密码。

### LangSmith 数据边界

- JWT、Cookie、Authorization、内部服务密钥、模型 Key、数据库 URL 和常见密码字段必须替换为 `[REDACTED]`；
- 用户 ID 使用稳定的单向散列值发送，不发送邮箱、登录名或其他直接身份信息；
- 灰度期不向 LangSmith 发送完整用户消息、模型回答或平台工具正文，只发送长度、状态、模型、耗时、Token、工具名和错误类别；
- reasoning/thinking 内容始终替换为 `[HIDDEN_REASONING]`；
- 上线前在测试 trace 中逐项搜索真实测试 JWT、内部服务密钥、模型 Key、数据库主机、测试邮箱和消息探针；任一命中即关闭 tracing 并阻止发布。

## 9. 数据库权限与迁移

- Java 运行用户 `aisoftoj` 限制为来源 host `172.23.251.161`，仅在 `aisoftoj` schema 拥有运行所需的 `SELECT/INSERT/UPDATE/DELETE`，无全局权限、DDL 或 `GRANT OPTION`；
- 新建 `aisoftoj_ai` 运行用户，MySQL host 仅允许应用服务器私网 IP `172.23.251.161`；
- Alembic 迁移前生成数据库备份；
- 迁移使用临时高权限账号执行，成功后撤销临时权限；
- `aisoftoj_ai` 无 `GRANT OPTION`、无 DDL 权限，仅对以下表授予 `SELECT/INSERT/UPDATE/DELETE`：`ai_threads`、`ai_messages`、`ai_runs`、`ai_run_events`、`ai_thread_summaries`、`ai_quota_config`、`ai_daily_token_usage`、`ai_token_reservations`、`ai_user_quota_overrides`；仅对 `alembic_version` 授予 `SELECT`；
- AI 业务工具不得直接查询 Java 业务表，必须通过 Java 内部只读 API；
- 迁移必须是向后兼容的新增或可空变更，应用回滚时不立即回滚数据库结构；
- 发布记录保存脱敏后的 `SHOW GRANTS`，并以负向测试确认 `aisoftoj_ai` 无法读取 `user`、`question` 等 Java 业务表，也无法执行 `CREATE/ALTER/DROP/GRANT`。

Java 用户也必须保存脱敏后的 `SHOW GRANTS`，并验证无法访问其他 schema、无法执行 `CREATE/ALTER/DROP/GRANT`。本次 release 不包含 Java schema 变更，因此不执行 Flyway，生产 Java 容器明确设置 `FLYWAY_ENABLED=false`；构建检查必须确认相对当前生产基线没有待执行的 Java migration。如果检测到 Java schema 变更，必须停止本次发布并单独设计 Flyway 迁移。如果无法把现有 Java 用户收敛到以上授权，发布也必须停止。

生产迁移流程只有一个执行者：发布脚本使用临时高权限账号运行 release 镜像中的 Alembic。执行顺序为备份、`alembic current`、确认目标唯一为 `0004_user_quota_overrides`、设置 30 秒连接/锁等待上限、执行一次 `upgrade head`、再次读取 current。Alembic 重复运行必须为空操作；迁移失败或目标 revision 不一致立即停止发布，不启动新 AI 镜像。迁移成功后立刻撤销临时权限并移除临时凭据。

## 10. 构建与上线前验证

发布前必须通过：

- AI：全部 pytest、Ruff、mypy；
- Java：Maven 测试与生产构建；
- Java：确认本次 release 无待执行 Flyway migration，生产配置为 `FLYWAY_ENABLED=false`；
- 前端：生产构建；
- Docker：三个镜像构建成功；
- Compose：最终配置渲染与校验；
- 数据库：Alembic dry check/upgrade 与目标版本确认；
- 备用端口启动 Java 和 AI，并验证依赖、健康检查与真实模型调用；
- LangSmith 测试 trace 可查询，且敏感字段被脱敏。
- Nginx AI 候选路由关闭代理缓冲、使用 HTTP/1.1、清空 `Connection`、设置覆盖最长 Run 的读取超时，并验证 SSE 首包、持续流、断线续传和取消 Run。

任何测试失败均阻止生产切换。

## 11. 正式切换顺序

1. 记录当前 release、`aisoftoj.service` 的 `is-enabled`/`is-active` 原始状态，并备份 JAR、前端、Nginx、环境文件和数据库。
2. 将不可变镜像和 Compose 文件传输到应用服务器。
3. 确认本次无需 Flyway；创建临时迁移账号，确认 release 的唯一 Alembic head，并按第 9 节执行一次生产迁移；确认到达 `0004_user_quota_overrides` 后撤销临时权限。
4. 启动并验证前端容器。
5. 短暂停止旧 `aisoftoj.service`。
6. 启动 Java 容器并等待 readiness。
7. 启动 AI 容器并等待 `/livez`、`/readyz`。
8. 生成 Nginx 候选配置并执行 `nginx -t`。`/api/ai/` 必须配置 `proxy_http_version 1.1`、`proxy_buffering off`、空 `Connection` 头和大于最长 Run 的 `proxy_read_timeout`。
9. 原子切换 Nginx 配置并 reload。
10. 停用旧 Java systemd 自动启动，但保留 unit、JAR 和环境备份。
11. 执行管理员真实 E2E、普通用户 403、SSE 断线续传/取消，并持续观察日志、RSS、swap 和 iowait。

## 12. 生产验收

- 管理员可以创建线程、启动 Run，并通过 SSE 收到完整回复；
- 普通用户全部 AI API 返回 403；
- Token 正确预留、结算与拒绝超额请求；
- 后台可查询用量并修改个人额度；
- LangSmith 可见脱敏后的生产 trace；
- 首页、登录、试卷列表、答题、结果、历史和错题本不受影响；
- 三个容器重启后自动恢复；
- Java 与 AI 连接 MySQL 私网地址，不依赖公网 3306；
- MySQL、内部 Java 与 AI 端口不对公网开放。

## 13. 回滚

以下任一条件触发回滚：

- Java 或 AI 健康检查失败；
- 数据库迁移失败；
- Nginx 校验或 reload 失败；
- 原有核心 API 异常；
- 真实 Agent E2E 失败且无法快速定位；
- 资源持续接近 OOM 或 swap 抖动明显。

回滚顺序：

1. 恢复旧 Nginx 配置并 reload；
2. 停止应用 Compose 项目；
3. 恢复原环境文件；
4. 按发布前记录恢复 `aisoftoj.service` 的 enable/disable 状态，再启动旧服务；
5. 同时验证 `systemctl is-enabled` 与 `systemctl is-active` 符合原始状态；
6. 验证原有公网 API；
7. 保留新增 AI 表和迁移记录，后续单独分析，不在故障窗口执行破坏性降级。

## 14. 后续全量开放条件

灰度期间至少确认：

- 无鉴权旁路；
- 无额度超扣或重复扣减；
- 模型成本和延迟可接受；
- LangSmith 无敏感信息泄漏；
- 服务器内存、swap 和磁盘稳定；
- 管理后台调整额度可靠。

满足条件后再单独审批普通用户全量开放，不包含在本次上线动作中。
