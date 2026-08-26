# LangSmith Agent 可观测性设计

## 目标

为 `aisoftoj-ai` 的 Python Agent 接入 LangSmith SaaS tracing，使一次业务 Run
能够在 LangSmith 中显示完整的 Agent、LLM、Tool 和 LangGraph 节点调用树，并可按
业务标识定位延迟、错误、重复工具调用和 Token 消耗。

本期只建设 tracing 基础闭环，不引入 Prompt Hub、Dataset、在线 Evaluator、
Automation Rule、告警或 LangSmith 私有化部署。

## 已确认决策

- 使用 LangSmith SaaS，不在项目侧部署观测存储和队列。
- 使用现有 Deep Agents、LangGraph 和 LangChain 的原生 tracing，不手工重复创建
  LLM、Tool 或 Retriever Span。
- tracing 默认关闭，只有显式设置 `LANGSMITH_TRACING=true` 才启用。
- 生产环境记录原始用户输入、模型输出和 Tool 输入输出，仅过滤密钥、认证信息等
  敏感内容。
- 不采集或推导模型隐藏推理过程；现有业务事件中的安全过程摘要不受影响。
- 采样率通过 `LANGSMITH_TRACING_SAMPLING_RATE` 配置，开发和测试建议 `1.0`，
  生产初始建议 `0.2`。
- LangSmith 上报失败不能改变 Agent Run 的业务状态，也不能明显增加请求延迟。
- 保留工作区中已有的 Skill activation 和事件契约改动，不借本功能重构 Worker。

## 方案选择

### 采用：原生 tracing 与集中脱敏

在 Agent Run 的执行边界建立 LangSmith tracing context，将 Client、metadata、tags
和脱敏器集中注入。LangGraph 自动生成模型和工具子节点，项目只负责业务顶层上下文。

该方案能够复用当前框架能力，改动范围小，并避免手工 Span 与框架 Span 重复。

### 不采用：仅依赖环境变量自动 tracing

环境变量可以快速开启 tracing，但无法为每条 Run 稳定注入业务 metadata，也无法
集中测试项目要求的敏感值过滤。

### 不采用：OpenTelemetry 手工埋点

OpenTelemetry 更平台中立，但需要自行维护 Agent、LLM、Tool 的父子关系，并可能与
LangChain 自带 tracing 重复。当前项目已深度使用 LangGraph，因此本期不承担这项复杂度。

## 架构与组件

新增独立 observability 模块，向 APP 生命周期和 Worker 暴露窄接口：

```text
FastAPI lifespan
  -> load LangSmith environment configuration
  -> create LangSmithTracing provider or disabled provider
  -> inject provider into Worker

Worker.execute
  -> provider.trace_run(metadata, tags)
  -> agent.graph.astream(...)
  -> LangGraph emits Agent / LLM / Tool child runs

FastAPI shutdown
  -> bounded LangSmith flush/close
```

provider 负责以下职责：

- 校验 tracing 开关、API Key、Endpoint、Project、环境和采样率。
- 创建 LangSmith Client 并安装集中脱敏器。
- 为每条业务 Run 建立 tracing context。
- 在禁用 tracing 时提供无副作用的 no-op 路径。
- 在应用关闭时执行有时间上限的 flush/close。

Worker 不直接读取 LangSmith 环境变量，也不实现脱敏算法。

## 配置契约

LangSmith 配置全部通过环境变量提供，API Key 不进入 YAML、数据库或仓库：

```env
LANGSMITH_TRACING=true
LANGSMITH_API_KEY=
LANGSMITH_ENDPOINT=https://api.smith.langchain.com
LANGSMITH_PROJECT=aisoftoj-agent-dev
LANGSMITH_TRACING_SAMPLING_RATE=1.0
LANGSMITH_ENVIRONMENT=development
LANGSMITH_AGENT_VERSION=local
```

行为约束：

- `LANGSMITH_TRACING` 未设置或为 false 时，不要求其他 LangSmith 配置。
- tracing 开启但 `LANGSMITH_API_KEY` 为空时，应用启动失败并输出不含密钥的配置错误。
- 采样率必须是 `0..1` 的有限浮点数。
- Endpoint 必须是 HTTP(S) URL，Project、Environment 和 Agent Version 必须是非空
  且有长度上限的安全字符串。
- SDK 的标准环境变量保持兼容；项目自定义的 environment 和 agent version 只用于
  metadata/tags。

## Trace 数据模型

一次 `Worker.execute` 对应一条顶层 Trace，名称为 `aisoftoj-agent-run`。顶层 Trace
附加以下 metadata：

| 字段 | 来源 |
| --- | --- |
| `run_id` | `AgentContext.run_id` |
| `thread_id` | `AgentContext.thread_id` |
| `user_id` | `AgentContext.user_id`，仅内部数值 ID |
| `question_id` | Worker 从 Run 记录加载的题目 ID |
| `agent_name` | 固定为 `aisoftoj-assistant` |
| `agent_version` | `LANGSMITH_AGENT_VERSION` |
| `model` | 当前配置的 `llm_default_model` |
| `environment` | `LANGSMITH_ENVIRONMENT` |

tags 至少包含 environment、agent name 和 agent version，便于在 LangSmith UI 中快速
过滤。业务 Run UUID 作为 metadata 保存，不强行替换 LangSmith 自身的 Trace ID。

LangGraph 继续自动记录 messages、模型调用、工具调用和节点状态。项目不额外复制
这些输入输出，也不把 SSE delta 逐条上报为独立 Span。

## 脱敏边界

脱敏只作用于发送给 LangSmith 的序列化副本，不改变 Agent 实际输入、模型输出、
工具参数、工具结果或持久化消息。

递归字段名匹配至少覆盖以下不区分大小写的名称及常见连接形式：

- `api_key`、`apikey`
- `authorization`
- `cookie`、`set_cookie`
- `token`、`access_token`、`refresh_token`、`bearer_token`
- `password`
- `secret`、`service_key`

字符串内容过滤至少覆盖：

- `Authorization: Bearer ...` 和独立的 Bearer Token。
- 常见 API Key 前缀。
- 当前进程已加载的 LLM Key、平台服务 Key 和 LangSmith Key 的精确值。

命中内容统一替换为 `[REDACTED]`。普通题干、用户问题、模型回答、Tool 业务参数和
Tool 业务结果保持完整。脱敏器必须支持嵌套字典、列表、元组和字符串，并避免在日志
或异常消息中回显原始秘密。

## 失败处理与资源约束

- tracing 禁用时不创建 Client，也不启动后台上报工作。
- SDK 使用异步或批量上报能力；不得在消息 delta 循环中同步发送网络请求。
- LangSmith 超时、限流、连接失败或后台发送失败只写安全日志，不将已成功的 Agent
  Run 改为 failed。
- 应用关闭时在既有 shutdown drain 之后执行 flush/close，并设置独立、有限的超时；
  超时后记录警告并继续退出。
- 不上传文件二进制。当前 Agent 工具均为结构化只读工具；若未来引入大文档工具，
  应另行增加大小限制，而不是在本期静默截断普通问答正文。

初始采样建议：

| 环境 | 采样率 |
| --- | ---: |
| development | `1.0` |
| test | `1.0` |
| production | `0.2` |

上线后观察每日 Trace 数量、平均子 Run 数量、数据摄入量、上报失败数及 LangSmith
月度使用量。默认使用 Base retention，不在本期启用可能自动升级保留周期的功能。

## 文件变更

- `aisoftoj-ai/pyproject.toml`：将 `langsmith` 声明为显式运行依赖。
- `aisoftoj-ai/uv.lock`：更新直接依赖关系并保持锁定版本可复现。
- `aisoftoj-ai/packages/harness/aisoftoj_agent/observability/`：新增配置、provider、
  tracing context 和脱敏实现。
- `aisoftoj-ai/app/lifespan.py`：初始化、注入和关闭 provider。
- `aisoftoj-ai/packages/harness/aisoftoj_agent/runtime/worker.py`：在 Agent graph 执行
  边界接入 provider，并注入业务 metadata。
- `aisoftoj-ai/config.example.yaml`：只增加环境变量提示，不加入真实 Key 字段。
- `aisoftoj-ai/README.md`：记录本地和生产启停、采样、验证及故障行为。
- `deploy/docker/ai-compose.service.yml`：仅在现有部署不能透传环境变量时增加声明。
- `aisoftoj-ai/tests/`：增加配置、脱敏、provider、Worker metadata 和关闭行为测试。

## 测试与验收

自动化测试覆盖：

- tracing 默认关闭且不要求 API Key。
- tracing 开启但 API Key 缺失时配置校验失败。
- 采样率拒绝 NaN、Infinity、小于 0 或大于 1 的值。
- 嵌套对象、HTTP Header 和正文中的敏感字段或敏感值被替换。
- 普通用户输入、模型回答和 Tool 业务结果保持原样。
- Worker 为 Trace 注入正确的 run、thread、user、question、model、environment 和版本。
- provider 禁用时 Agent 行为与当前一致。
- LangSmith 上报不可用时 Agent 业务执行不失败。
- flush 超时后应用仍能完成关闭。

验证命令：

```bash
cd aisoftoj-ai
uv run ruff check .
uv run mypy app packages config.py server.py
uv run pytest
```

人工验收使用开发 Project 和测试账号触发一次包含 Tool 调用的 Agent Run，确认：

- LangSmith UI 中存在一条 `aisoftoj-agent-run` 顶层 Trace。
- Agent、LLM 和 Tool 节点层级完整。
- metadata 和 tags 可用于检索该业务 Run。
- 普通输入输出完整可见。
- 注入的哨兵 API Key、Bearer Token、Cookie 和服务 Key 均不可见。
- 关闭 tracing 或让 LangSmith Endpoint 不可达时，Agent 仍可完成业务 Run。

## 非目标

- 不修改 Java 后端或前端。
- 不新增数据库表或迁移。
- 不把 LangSmith Trace ID 写回业务数据库。
- 不实现跨服务 OpenTelemetry/APM。
- 不实现 Prompt 管理、自动评测、Dataset、Dashboard 或告警。
- 不自托管 LangSmith。
