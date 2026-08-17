# 软考平台内置 AI 助手实施计划

> 对应设计：`docs/superpowers/specs/2026-08-17-ai-agent-runtime-design.md`

## 目标

交付一个可运行的 `aisoftoj-ai` Python 服务，并在 Java 后端增加 5 个仅供该服务调用的内部只读接口。浏览器继续使用现有 Bearer JWT 直连 Python；Python 每次调用平台工具时把 JWT 与服务密钥转发给 Java 重新鉴权。

## 实施原则

- 严格按测试先行执行：先写失败测试，再写最小实现，再跑局部和全量验证。
- 每个任务形成一个聚焦提交；不得把当前工作区已有的前端、后端、部署改动混入提交。
- 平台只读边界由 Java GET 接口、Python 工具白名单和 Agent 启动断言共同保证。
- `deepagents` 精确固定为 `0.7.6`，提交 `uv.lock`；升级不在本期内顺带进行。
- Python 只连接 `aisoftoj_ai`，Java 继续独占 `aisoftoj` 业务库。
- 首版只支持单进程、单 Uvicorn worker、单服务副本。

## 验证基线

在实施前记录但不修改现有脏工作区：

```bash
cd /Users/bytedance/aisoftoj
git status --short
git diff -- aisoftoj-backend/pom.xml \
  aisoftoj-backend/src/main/resources/application.yml \
  aisoftoj-backend/src/main/resources/application-prod.yml
```

后续若必须编辑这些已有改动的文件，保留原内容，只暂存本任务对应的精确 hunk。所有提交前运行：

```bash
git diff --check
git diff --cached --check
git status --short
```

## 任务 1：Java 内部服务认证与 Profile 接口

**创建：**

- `aisoftoj-backend/src/main/java/com/nan/aisoftoj/ai/AiInternalProperties.java`
- `aisoftoj-backend/src/main/java/com/nan/aisoftoj/ai/AiInternalAuthenticator.java`
- `aisoftoj-backend/src/main/java/com/nan/aisoftoj/controller/AiInternalController.java`
- `aisoftoj-backend/src/main/java/com/nan/aisoftoj/dto/ai/AiProfileDTO.java`
- `aisoftoj-backend/src/main/java/com/nan/aisoftoj/service/AiPlatformReadService.java`
- `aisoftoj-backend/src/main/java/com/nan/aisoftoj/service/impl/AiPlatformReadServiceImpl.java`
- `aisoftoj-backend/src/test/java/com/nan/aisoftoj/ai/AiInternalAuthenticatorTest.java`
- `aisoftoj-backend/src/test/java/com/nan/aisoftoj/controller/AiInternalControllerTest.java`

**修改：**

- `aisoftoj-backend/src/main/resources/application.yml`
- `aisoftoj-backend/src/main/resources/application-prod.yml`

**步骤：**

1. 先写认证测试：缺失/错误 `X-AI-Service-Key` 拒绝，正确服务密钥但缺失/过期 Bearer JWT 拒绝，用户禁用或删除拒绝，合法请求得到当前用户。
2. 运行失败测试：

   ```bash
   cd /Users/bytedance/aisoftoj/aisoftoj-backend
   mvn -Dtest=AiInternalAuthenticatorTest,AiInternalControllerTest test
   ```

3. 实现 `AiInternalProperties`，生产环境缺失密钥时启动失败；使用 `MessageDigest.isEqual` 比较 UTF-8 字节。
4. `AiInternalAuthenticator` 先校验服务密钥，再复用 `AuthService.getCurrentUser(...)` 验证 JWT、`tokenVersion` 和用户状态，不自行解析或弱化认证。
5. 实现 `GET /internal/ai/me`，返回设计中的专用 DTO，并设置 `Cache-Control: private, no-store`；不得添加内容加密注解。
6. 统计值通过现有 Mapper 的只读 count/summary 查询获得，不返回邮箱、手机号、OpenID 或 JWT。
7. 跑局部测试和相关认证回归：

   ```bash
   mvn -Dtest=AiInternalAuthenticatorTest,AiInternalControllerTest,AuthControllerTest test
   ```

8. 提交：`feat(ai): add internal authentication and profile endpoint`。

## 任务 2：Java 试卷目录与安全题目接口

**创建：**

- `aisoftoj-backend/src/main/java/com/nan/aisoftoj/dto/ai/AiPaperDTO.java`
- `aisoftoj-backend/src/main/java/com/nan/aisoftoj/dto/ai/AiQuestionDTO.java`
- `aisoftoj-backend/src/main/java/com/nan/aisoftoj/dto/ai/AiQuestionOptionDTO.java`
- `aisoftoj-backend/src/test/java/com/nan/aisoftoj/service/impl/AiPlatformPaperReadServiceTest.java`
- `aisoftoj-backend/src/test/java/com/nan/aisoftoj/service/impl/AiPlatformQuestionReadServiceTest.java`

**修改：**

- `aisoftoj-backend/src/main/java/com/nan/aisoftoj/controller/AiInternalController.java`
- `aisoftoj-backend/src/main/java/com/nan/aisoftoj/service/AiPlatformReadService.java`
- `aisoftoj-backend/src/main/java/com/nan/aisoftoj/service/impl/AiPlatformReadServiceImpl.java`
- `aisoftoj-backend/src/main/java/com/nan/aisoftoj/mapper/PaperMapper.java`
- `aisoftoj-backend/src/main/java/com/nan/aisoftoj/mapper/QuestionMapper.java`
- `aisoftoj-backend/src/main/java/com/nan/aisoftoj/mapper/PracticeSessionMapper.java`
- `aisoftoj-backend/src/test/java/com/nan/aisoftoj/controller/AiInternalControllerTest.java`

**步骤：**

1. 先写试卷多会话聚合测试：`in_progress` 优先、活动时间和 ID 稳定选取、完成题数封顶、未开始状态以及稳定排序。
2. 先写题目安全测试：仅已发布试卷内未删除题目可见；DTO JSON 不含答案、解析、`isCorrect` 或其他正确性字段，管理员也不例外。
3. 运行失败测试：

   ```bash
   mvn -Dtest=AiPlatformPaperReadServiceTest,AiPlatformQuestionReadServiceTest,AiInternalControllerTest test
   ```

4. 实现 `GET /internal/ai/papers` 与 `GET /internal/ai/questions/{questionId}`，只映射设计文档列出的 DTO 字段。
5. 对 `questionId <= 0` 返回 400；不存在、已删除或不在已发布试卷中的题目返回 404。
6. 用 Jackson 序列化断言再次验证安全字段不可能出现在响应中。
7. 跑局部测试及原有试卷/题目回归：

   ```bash
   mvn -Dtest=AiPlatformPaperReadServiceTest,AiPlatformQuestionReadServiceTest,AiInternalControllerTest,PaperServiceImplTest,QuestionServiceImplTest test
   ```

8. 提交：`feat(ai): expose read-only papers and questions`。

## 任务 3：Java 错题复盘与练习历史接口

**创建：**

- `aisoftoj-backend/src/main/java/com/nan/aisoftoj/dto/ai/AiWrongQuestionReviewDTO.java`
- `aisoftoj-backend/src/main/java/com/nan/aisoftoj/dto/ai/AiPracticeHistoryItemDTO.java`
- `aisoftoj-backend/src/main/java/com/nan/aisoftoj/dto/ai/AiPracticeHistoryPageDTO.java`
- `aisoftoj-backend/src/main/java/com/nan/aisoftoj/dto/ai/AiPracticeHistorySummaryDTO.java`
- `aisoftoj-backend/src/test/java/com/nan/aisoftoj/service/impl/AiWrongQuestionReviewServiceTest.java`
- `aisoftoj-backend/src/test/java/com/nan/aisoftoj/service/impl/AiPracticeHistoryReadServiceTest.java`

**修改：**

- `aisoftoj-backend/src/main/java/com/nan/aisoftoj/controller/AiInternalController.java`
- `aisoftoj-backend/src/main/java/com/nan/aisoftoj/service/AiPlatformReadService.java`
- `aisoftoj-backend/src/main/java/com/nan/aisoftoj/service/impl/AiPlatformReadServiceImpl.java`
- `aisoftoj-backend/src/main/java/com/nan/aisoftoj/mapper/UserWrongQuestionStatMapper.java`
- `aisoftoj-backend/src/main/java/com/nan/aisoftoj/mapper/PracticeSessionMapper.java`
- `aisoftoj-backend/src/main/java/com/nan/aisoftoj/mapper/PracticeSessionQuestionRecordMapper.java`
- `aisoftoj-backend/src/test/java/com/nan/aisoftoj/controller/AiInternalControllerTest.java`

**步骤：**

1. 先写错题链路测试：错题属于当前用户且未删除；`last_session_id` 属于同一用户、已完成且题目一致；否则分别按设计返回 404 或 409。
2. 验证答案来自已完成会话快照/记录，而不是绕过会话状态直接读取题库答案。
3. 先写练习历史分页与全量 summary 测试，包括 `page_size <= 20`、稳定排序和聚合不受分页影响。
4. 运行失败测试：

   ```bash
   mvn -Dtest=AiWrongQuestionReviewServiceTest,AiPracticeHistoryReadServiceTest,AiInternalControllerTest test
   ```

5. 实现 `GET /internal/ai/wrong-questions/{wrongQuestionId}/review` 与 `GET /internal/ai/practice-history`。
6. 复用或新增参数化只读 Mapper 查询；不引入任何 INSERT、UPDATE、DELETE。
7. 跑 AI 内部接口全套和既有 Mapper/Controller 回归：

   ```bash
   mvn -Dtest='Ai*Test,UserStatsControllerTest,UserWrongQuestionStatMapperContractTest,PracticeSessionMapperContractTest' test
   ```

8. 提交：`feat(ai): expose wrong review and practice history`。

## 任务 4：Python 工程骨架、配置与健康检查

**创建：**

- 设计文档“项目结构”中的 `aisoftoj-ai/` 基础目录和 `__init__.py`
- `aisoftoj-ai/pyproject.toml`
- `aisoftoj-ai/uv.lock`
- `aisoftoj-ai/config.py`
- `aisoftoj-ai/config.example.yaml`
- `aisoftoj-ai/server.py`
- `aisoftoj-ai/app/main.py`
- `aisoftoj-ai/app/lifespan.py`
- `aisoftoj-ai/app/routers/health.py`
- `aisoftoj-ai/tests/app/test_health.py`
- `aisoftoj-ai/tests/harness/test_config.py`

**步骤：**

1. 使用 Python `>=3.12,<3.13`，通过 `uv` 添加 FastAPI、Uvicorn、Pydantic、PyYAML、SQLAlchemy、asyncmy、Alembic、httpx、`langchain-openai` 和 `deepagents==0.7.6`；添加 pytest、pytest-asyncio、respx、ruff、mypy 等开发依赖。
2. 先写配置测试：只允许 YAML；缺少数据库/平台/模型配置失败；SecretStr 的 repr 和验证错误不泄漏密钥。
3. 先写 `/livez` 与 `/readyz` 语义测试；此阶段 `readyz` 使用可替换依赖状态，不调用 Java 或模型。
4. 运行失败测试：

   ```bash
   cd /Users/bytedance/aisoftoj/aisoftoj-ai
   uv run pytest tests/harness/test_config.py tests/app/test_health.py -q
   ```

5. 实现最小应用工厂、生命周期容器和统一错误外壳，保证 import 不读取真实密钥或联网。
6. 运行：

   ```bash
   uv run pytest tests/harness/test_config.py tests/app/test_health.py -q
   uv run ruff check .
   uv run mypy app packages config.py server.py
   ```

7. 提交：`feat(ai): scaffold Python agent service`。

## 任务 5：AI 数据库模型、迁移与 Repository

**创建：**

- `aisoftoj-ai/packages/harness/aisoftoj_agent/persistence/engine.py`
- `aisoftoj-ai/packages/harness/aisoftoj_agent/persistence/models.py`
- `aisoftoj-ai/packages/harness/aisoftoj_agent/persistence/migrations/**`
- `aisoftoj-ai/packages/harness/aisoftoj_agent/persistence/repositories/{threads,messages,runs,summaries}.py`
- `aisoftoj-ai/tests/harness/persistence/test_models.py`
- `aisoftoj-ai/tests/harness/persistence/test_repositories.py`
- `aisoftoj-ai/tests/harness/persistence/test_migrations.py`

**步骤：**

1. 先写模型/迁移测试，精确覆盖 5 张表、FK、序号唯一约束、幂等唯一约束和 MySQL 5.7 `active_marker` STORED generated column。
2. 先写 Repository 测试：所有读取都要求 `user_id`；软删除隔离；Thread 行锁；同一事务创建 Message/Run；摘要游标只能前进。
3. 在临时 `aisoftoj_ai` 测试库运行失败测试：

   ```bash
   AISOFTJOJ_AI_TEST_DATABASE_URL='mysql+asyncmy://.../aisoftoj_ai_test' \
     uv run pytest tests/harness/persistence -q
   ```

4. 实现 SQLAlchemy 2 async 模型和 Alembic 初始迁移；不得创建跨数据库 FK 或映射平台业务表。
5. 实现 Repository 事务 API，包括统一的 Thread `SELECT ... FOR UPDATE` 锁顺序和事件 sequence 分配。
6. 验证从空库 `upgrade head`、`downgrade base`、再次 `upgrade head`，然后跑并发 Repository 测试。
7. 提交：`feat(ai): add agent persistence layer`。

## 任务 6：PlatformClient、认证依赖与 5 个只读工具

**创建：**

- `aisoftoj-ai/packages/harness/aisoftoj_agent/integrations/aisoftoj/{client,context,models}.py`
- `aisoftoj-ai/packages/harness/aisoftoj_agent/agents/context.py`
- `aisoftoj-ai/packages/harness/aisoftoj_agent/agents/tools/{profile,papers,questions,wrong_questions,practice_history}.py`
- `aisoftoj-ai/app/auth/dependencies.py`
- `aisoftoj-ai/tests/harness/integrations/test_platform_client.py`
- `aisoftoj-ai/tests/harness/tools/test_platform_tools.py`
- `aisoftoj-ai/tests/app/test_auth.py`

**步骤：**

1. 先写 Pydantic 契约测试，覆盖 Java `camelCase` 外壳、Unix 毫秒 timestamp、业务 UTC 时间、枚举、nullability、额外字段丢弃和无效响应拒绝。
2. 先写 httpx/respx 测试，验证每次请求都发送 Bearer JWT 与服务密钥，只允许固定 loopback base URL 下的 5 个 GET 路径，超时/重试/大小限制符合设计。
3. 先写 FastAPI 认证依赖测试，验证 Python 不信任 JWT payload，而是调用 `/internal/ai/me` 得到 `TrustedUser`。
4. 实现 `AgentContext`，JWT 只放不可变 runtime context；工具签名不得暴露 JWT、user ID、服务密钥或 URL。
5. 实现 5 个工具及其参数边界，输出只保留设计列出的 snake_case 字段。
6. 运行：

   ```bash
   uv run pytest tests/harness/integrations tests/harness/tools tests/app/test_auth.py -q
   uv run ruff check .
   uv run mypy app packages config.py server.py
   ```

7. 提交：`feat(ai): add authenticated read-only platform tools`。

## 任务 7：Deep Agent Graph 与安全 Middleware

**创建：**

- `aisoftoj-ai/packages/harness/aisoftoj_agent/agents/{factory,prompt,state}.py`
- `aisoftoj-ai/packages/harness/aisoftoj_agent/agents/models/factory.py`
- `aisoftoj-ai/packages/harness/aisoftoj_agent/agents/middlewares/{builder,loop_detection,persistent_summary,token_budget,tool_audit,tool_errors,tool_policy}.py`
- `aisoftoj-ai/tests/harness/agents/test_factory.py`
- `aisoftoj-ai/tests/harness/agents/test_middlewares.py`
- `aisoftoj-ai/tests/harness/agents/test_context_security.py`

**步骤：**

1. 先写模型工厂测试：OpenAI-compatible `base_url/api_key/model` 正确，启用 streaming、有限重试和 timeout，usage 缺失保持 `null`。
2. 先写 graph 工具清单测试：模型可见集合精确等于 5 个业务工具；无 `task`、Subagent、Skills、文件或执行工具。
3. 先写安全测试：JWT 不进入 State、Message、Checkpoint、工具 schema、异常或日志。
4. 先写 Middleware 单测：顺序固定；工具二次白名单；循环阈值；token 硬限制；安全 ToolMessage；持久摘要替换默认摘要且不会双启。
5. 实现 `deepagents==0.7.6` Harness Profile 和启动断言；库 API 与预期不一致时启动失败，不降级放开能力。
6. 使用假的 ChatModel 验证单次 tool call 和最终回答，不调用真实模型。
7. 运行 Harness 测试、ruff、mypy后提交：`feat(ai): build restricted deep agent graph`。

## 任务 8：StreamBridge 与持久事件协议

**创建：**

- `aisoftoj-ai/packages/harness/aisoftoj_agent/contracts/events.py`
- `aisoftoj-ai/packages/harness/aisoftoj_agent/runtime/stream_bridge.py`
- `aisoftoj-ai/tests/harness/runtime/test_stream_bridge.py`
- `aisoftoj-ai/tests/harness/runtime/test_event_contracts.py`

**步骤：**

1. 先为每种持久事件和 `stream.end/reset` 写精确 payload 验证测试。
2. 先写 subscribe-before-snapshot 竞态测试：订阅前已提交、订阅后提交和边界重复都不丢不重。
3. 写容量 256、慢消费者 reset、终态关闭、心跳不推进 sequence 的测试。
4. 实现有界订阅队列和按 sequence 去重；发布 API 只接受已提交事件。
5. 运行 runtime 局部测试并提交：`feat(ai): add resumable run event stream`。

## 任务 9：RunManager、Worker、取消与恢复

**创建：**

- `aisoftoj-ai/packages/harness/aisoftoj_agent/runtime/{run_manager,worker}.py`
- `aisoftoj-ai/tests/harness/runtime/test_run_manager.py`
- `aisoftoj-ai/tests/harness/runtime/test_worker.py`

**步骤：**

1. 先写全局、单用户和单 Thread 并发测试，验证超限返回容量错误且不写 Message/Run。
2. 先写同 key 并发幂等测试，以及 DELETE Thread / POST Run 竞争测试；验证统一 Thread 行锁顺序。
3. 先写 Worker 状态机测试：成功、模型失败、平台认证失败、超时、取消、关闭 drain 和启动遗留 Run 收敛。
4. 验证当前用户 Message 只装配一次；Assistant Message、终态 Run 和最终事件在一个事务中只提交一次。
5. 实现后台 Task 管理、槽位预留/释放和 JWT 仅存 task/context 的生命周期。
6. 实现 graph `astream` 消费、根 Agent delta 过滤、usage 收集和 `InMemorySaver` checkpoint `finally` 清理。
7. 跑取消竞态、数据库失败和 checkpoint 清理测试后提交：`feat(ai): implement agent run lifecycle`。

## 任务 10：Thread / Run / SSE 公共 API

**创建：**

- `aisoftoj-ai/packages/harness/aisoftoj_agent/contracts/{api,errors}.py`
- `aisoftoj-ai/app/dependencies.py`
- `aisoftoj-ai/app/routers/{threads,runs}.py`
- `aisoftoj-ai/tests/app/test_threads.py`
- `aisoftoj-ai/tests/app/test_runs.py`
- `aisoftoj-ai/tests/app/test_sse.py`

**步骤：**

1. 先按设计文档为全部 Request/Response/Error DTO 写 OpenAPI 和序列化测试。
2. 写 Thread CRUD、标题生成、软删除、页码分页和 Message sequence 游标测试。
3. 写 Run 202/200 幂等、409 活动冲突、429 容量、取消幂等及用户隔离测试。
4. 写 fetch SSE Bearer、`Last-Event-ID/after_seq` 一致性、历史补发、心跳、reset、终态 end 和断线续读测试。
5. 实现路由；所有资源查询通过 `TrustedUser.user_id` 限定，他人资源与不存在资源统一 404。
6. 把真实 graph、Repository、PlatformClient、StreamBridge、RunManager 接入 lifespan；启动顺序和关闭 drain 与设计一致。
7. 运行全部 Python 测试、ruff、严格 mypy后提交：`feat(ai): expose thread run and SSE APIs`。

## 任务 11：跨服务契约、启动文档与最终验收

**创建：**

- `aisoftoj-ai/tests/integration/test_java_contract.py`
- `aisoftoj-ai/Dockerfile`
- `aisoftoj-ai/.dockerignore`
- `aisoftoj-ai/.gitignore`
- `aisoftoj-ai/README.md`

**不修改：**

- 根项目 README、React 聊天面板、Nginx 和生产 Compose。本任务 README 只放在 `aisoftoj-ai/README.md`。

**步骤：**

1. 用 Java Mock 或本地测试实例跑 5 个端点的双向契约：字段命名、nullability、枚举、时间、分页、错误映射和安全字段。
2. 用假的 OpenAI-compatible 流式服务跑端到端流程：认证 -> 创建 Thread -> 创建 Run -> 工具调用 -> SSE -> 历史消息。
3. 增加 README：Python 3.12/uv、创建 `aisoftoj_ai`、Alembic、YAML 配置、Java 服务密钥、启动命令、curl 示例和单 worker 限制。
4. 验证 Docker 镜像只包含 `config.example.yaml`，真实 `config.yaml` 和密钥不进入 build context。
5. 最终验证：

   ```bash
   cd /Users/bytedance/aisoftoj/aisoftoj-backend
   mvn test

   cd /Users/bytedance/aisoftoj/aisoftoj-ai
   uv run pytest -q
   uv run ruff check .
   uv run mypy app packages config.py server.py
   uv run alembic upgrade head
   ```

6. 启动本地服务并验证：

   ```bash
   uv run python server.py
   curl -fsS http://127.0.0.1:8000/livez
   curl -fsS http://127.0.0.1:8000/readyz
   ```

7. 检查最终模型工具清单精确等于 5 个、所有 Java 内部接口均为 GET、Python 无 `aisoftoj` 业务库连接串、日志无敏感内容。
8. 提交：`docs(ai): add runtime setup and verification`。

## 完成定义

- Java 5 个内部 GET 接口通过服务密钥和现有 Bearer JWT 双重认证。
- Python Agent 只能看到 `get_my_profile`、`list_papers`、`get_question`、`review_wrong_question`、`list_practice_history`。
- Thread / Run / SSE 可运行、可取消、可断线恢复，服务重启后遗留 Run 收敛为 `interrupted`。
- Python 只写 `aisoftoj_ai`；所有平台业务访问经 Java 只读接口完成。
- Java 全量测试、Python pytest、ruff、严格 mypy、Alembic 空库迁移和端到端假模型测试全部通过。
- 每个提交只包含本任务文件或精确 hunk，用户现有未提交改动保持不变。
