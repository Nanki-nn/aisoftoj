# AI 助手事件流水线与过程可视化设计

## 目标

将 AI 助手从“页面 Hook 直接拼接 SSE 文本”改造成稳定的五层事件流水线：

```text
SSE 原始事件
  -> normalizeEvent()
  -> applyEvent()
  -> getMessageGroups()
  -> 语义化 React 组件
```

实时流与历史回放必须消费相同的持久事件、经过相同的归一化和 reducer，得到一致界面。过程区只展示由确定性工具事件生成的可审计步骤，不展示模型内部 reasoning 或模型生成的自由文本进度。首期不启用计划生成或子任务调度，但前端状态模型为其预留空字段。

## 当前缺口

- FastAPI 已持久化 RunEvent，并在 SSE 中支持断线续传，但 Worker 实际只写回答事件。
- 事件契约声明了 `tool.started`、`tool.completed`、`tool.failed`，工具执行链路尚未发布这些事件。
- 前端 `useAIConversation` 直接识别 `message.delta` 并拼接消息，没有独立归一化和 reducer。
- 历史消息只读取最终 Message，无法重建运行过程。
- `AIAgentPanel` 直接遍历消息，思考、工具和最终回答没有分组边界。

## 后端事件契约

`ai_run_events` 与 `ai_runs` 终态共同构成运行过程的服务端事实来源：事件提供有序过程，Run 行用于历史损坏或旧数据缺少终态事件时兜底。工具执行时按提交顺序持久化并发布：

```text
tool.started
  call_id: string
  tool_name: string
  input: safe object

tool.completed
  call_id: string
  tool_name: string
  summary: safe object
  duration_ms: non-negative integer

tool.failed
  call_id: string
  tool_name: string
  message: stable user-safe string
  duration_ms: non-negative integer
```

优先使用模型工具调用自带的 ID；缺失时由后端为该次调用生成 UUID。开始和终态事件必须使用同一 `call_id`，前端不按工具名猜测配对。

后端为五个现有只读工具维护精确白名单和摘要器：

| 工具 | 展示动作 | `input` 精确结构 | `summary` 精确结构 |
|---|---|---|---|
| `get_my_profile` | 读取个人学习概况 | `{}` | `{ practice_session_count: int >= 0, wrong_question_count: int >= 0 }` |
| `list_papers` | 查询可用试卷 | `{}` | `{ total: int >= 0 }` |
| `get_question` | 读取题目信息 | `{ question_id: int > 0 }` | `{ question_type: enum, difficulty: enum }` |
| `review_wrong_question` | 复盘错题 | `{ wrong_question_id: int > 0 }` | `{ question_type: enum, difficulty: enum, error_count: int >= 1, importance: string <= 32 }` |
| `list_practice_history` | 查询练习历史 | `{ page: int >= 1, page_size: int 1..20 }` | `{ record_count: int >= 0, total: int >= 0, total_count: int >= 0, in_progress_count: int >= 0, completed_count: int >= 0, answered_count: int >= 0 }` |

`question_type` 和 `difficulty` 只接受集成模型已声明的有限枚举，非法或缺失结果统一降级成 `unknown`。已知工具结果只从通过 Pydantic 校验的对象提取上述标量，任何嵌套对象、列表和额外字段均丢弃。`importance` 只保留前 32 个 Unicode code point。

未知工具名只允许 ASCII `[A-Za-z0-9_.-]` 且最长 64 字符，否则写为 `unknown_tool`；其 `input` 固定为 `{}`，完成 `summary` 固定为 `{ status: "completed" }`。失败事件的 `message` 只能是 `tool_unavailable`、`authentication_expired`、`access_denied` 或 `tool_execution_failed` 四个稳定代码之一。

事件不得包含 JWT、服务密钥、模型 reasoning、完整 ToolMessage、答案/解析正文、堆栈、任意异常文本或未经白名单处理的业务响应。安全测试使用嵌套 secret、答案正文、超长集合、恶意工具名和任意异常文本，并断言完整持久 JSON 不包含这些值。

## 工具事件采集

工具事件由位于 `ToolErrorMiddleware` 外层的 `ToolEventMiddleware` 采集。应用单例 Middleware 从 `request.runtime.context.event_sink` 取得本 Run 的 Sink；Worker 使用 `dataclasses.replace` 把 Sink 加入不可变 `AgentContext` 后再调用 Graph，工具本身仍不依赖数据库或 FastAPI。

`RunEventSink.emit(type, payload)` 是异步 Protocol，由 Worker 创建的实现负责“事务内 append -> commit -> StreamBridge publish”。中间件在调用前写入 `tool.started`。handler 返回后按结果分类：`ToolMessage(status="error")` 写 `tool.failed`；成功 `ToolMessage` 写 `tool.completed`；`Command` 从其更新中的 ToolMessage 使用同一规则，无法提取时写经过白名单的通用完成摘要；异常写 `tool.failed` 后继续抛出。这样被 `ToolErrorMiddleware` 转换的平台错误不会误报完成。

审计日志和用户可见事件职责分开：现有日志继续记录工具名、参数键和耗时；EventSink 只接收已经安全化的数据。事件持久化成功后才发布到 StreamBridge，保持数据库回放和实时订阅顺序一致。

`ToolEventPersistenceError` 不得被 `ToolErrorMiddleware` 转换。写 `tool.started` 失败时不执行工具；写终态失败时停止本 Run。Worker 捕获该异常后使用独立于 Sink 的直接 Repository 路径尝试写 `run.failed(error_code=EVENT_PERSISTENCE_FAILED)` 并转换 Run 行；若数据库整体不可用则保留日志并由启动恢复流程收敛。现有工具均为只读，因此终态事件失败后用户重试不会造成业务写入副作用。

启动恢复不再只批量更新 Run 行：事务中锁定每个 `queued/running` Run，转换为 `interrupted/SERVICE_RESTARTED` 并为每个 Run 追加 `run.interrupted`。测试保证重启后的历史回放具有终态事件。

## 历史事件 API

新增只读接口：

```text
GET /api/ai/threads/{thread_id}/runs/{run_id}/events?after_sequence=0&limit=200
```

接口复用 Thread 所有权检查，按 `sequence ASC` 返回严格大于游标的事件。`after_sequence` 必须大于等于 0；`limit` 默认 200、范围 1..500。响应为 `{ items, next_after_sequence, has_more }`，前端循环取完当前消息页涉及的 Run，不会让长 Run 永久无法回放。

响应项与 SSE 持久事件数据结构一致：`run_id`、`sequence`、`type`、`created_at`、`data`。控制事件 `stream.end`、`stream.reset` 不落库，也不由历史接口返回。现有回答 delta 暂不改名或迁移历史行；分页消除了回答 chunk 数量不确定的问题。

## 前端五层架构

### 1. 传输层

`aiApi.ts` 只负责 HTTP、SSE 分帧和原始 DTO。新增历史事件读取函数，不在此层解释工具含义或修改 UI 状态。

### 2. 归一化层

`normalizeEvent(rawEvent)` 将 SSE 和历史 DTO 转为 `{ sequence, event }`，其中 `event` 是带判别字段的 `NormalizedRunEvent` 或 `null`。持久事件名不迁移，映射固定为：

| 持久事件 | 归一化事件 |
|---|---|
| `run.started` | `run.started` |
| `message.delta` | `answer.delta` |
| `tool.started/completed/failed` | 同名 |
| `run.completed/failed/cancelled/interrupted` | 同名 |
| `run.created`、`message.started`、`message.completed` | `null` |

旧数据库行继续按此表解释，并通过兼容测试覆盖。核心归一化类型包括：

- `run.started`
- `tool.started` / `tool.completed` / `tool.failed`
- `answer.delta`
- `run.completed` / `run.failed` / `run.cancelled` / `run.interrupted`

未知或数据畸形的事件令 `event=null`，但只要外层持久事件 envelope 的 `run_id` 和正整数 `sequence` 有效，传输游标仍推进。模型适配器中的 `reasoning_content`、模型 scratch 文本和自由文本摘要永远不进入此映射。首期只在 `RunViewState` 中预留空的 `planTasks`、`subtasks` 字段，不声明持久生产者，不显示空 UI。

### 3. 运行状态层

纯函数 `applyEvent(previous, event)` 维护 `RunViewState`：

```text
phase: idle | running | streaming | completed | failed | cancelled | interrupted
runId
lastAppliedSequence
tools[]
answer
planTasks[]
subtasks[]
startedAt / finishedAt
error
```

sequence 小于等于 `lastAppliedSequence` 的已识别事件直接忽略。工具按 `callId` 更新，允许多个同名工具并行或重复执行。收到回答增量后进入 `streaming`；终态事件只改变 phase，不清空已经生成的回答或工具步骤。

实时 SSE 从空状态逐个 reduce；历史页面读取 Run 事件后按 sequence 使用同一函数回放。`RunSessionController` 单独维护 `transportSequence`：每个有效 envelope 都推进，不受事件是否被识别影响；历史转实时、SSE 重连和 `stream.reset` 全部使用该游标。RunState 的 `lastAppliedSequence` 只用于 reducer 幂等。

纯函数 `applyRunSnapshot(state, run)` 负责把 `AIRun` 快照合入同一 RunState：`queued/running` 只在事件尚未推进阶段时初始化 phase；`completed/failed/cancelled/interrupted` 在历史缺少对应终态事件时补齐 phase、finishedAt 和稳定错误代码，但绝不覆盖已经回放出的工具步骤或回答。实时和历史路径都调用该函数，不在组件中另写状态判断。

### 4. 消息分组层

`getMessageGroups(messages, runStates)` 是纯投影函数，输出：

- `human`
- `assistant:processing`
- `assistant:answer`
- `assistant:error`

消息先按 `sequence` 排序，再按 Run 建立 `{ userMessage, assistantMessage?, runState? }`。每个 Run 精确投影一次，顺序固定为 human -> 非空 processing -> 非空 answer -> error。已持久化 Assistant Message 是成功 Run 的唯一答案源；不存在 Assistant Message 的活跃/失败 Run 才使用 `runState.answer` 作为流式或部分答案。原消息数组中的 Assistant Message 不再单独二次投影。key 固定使用 `${runId}:human|processing|answer|error`。

乐观用户消息创建时使用临时 key；Run 创建成功后立即把 `run.id` 回填到该消息，再初始化 RunState。旧 Run 没有工具事件时不渲染空的过程面板。失败、取消或中断保留已有工具和部分回答，并追加独立状态组。最终消息校正发生在纯投影规则中，而不是仅实时路径执行的额外状态修改。

### 5. 语义组件层

- `MessageList`：只遍历分组。
- `ProcessingPanel`：只展示非空工具步骤；计划和子任务首期没有可见区域。
- `ToolStep`：负责通用状态、耗时和图标。
- 五个工具 renderer：把安全摘要转换为用户可读文案。
- `AnswerBubble`：继续使用 Markdown 渲染最终答案。
- `RunErrorNotice`：展示失败、取消和中断。

运行中过程面板默认展开并跟随最新步骤；完成后默认收起，标题显示“完成 N 个步骤”和可用耗时。最终回答始终独立展示，不与工具 JSON 混排。未知工具使用通用 renderer，不直接展开 JSON。

## 会话状态与历史加载

`useAIConversation` 负责请求编排并委托 `RunSessionController` 处理传输协议，组件 Hook 不直接判断持久事件名。它维护 `runStates: Map<runId, RunViewState>`：

1. 加载 Thread 的 Messages 和 Runs。
2. Run 列表以 `page_size=100` 读取，并为当前消息页中仍缺失的每个 `run_id` 调用单 Run 接口，保证所有可见消息都有快照；不能假设默认 20 条 Run 覆盖消息页。
3. 对消息页涉及的 Run 批量请求历史事件并回放，然后调用 `applyRunSnapshot` 为旧数据补终态。
4. 如发现活跃 Run，从历史分页得到的 `transportSequence` 接入 SSE。
5. 新 Run 创建后初始化 RunState，SSE 每个原始事件先归一化再 dispatch。
6. Run 成功后刷新消息，以服务端最终文本校正 answer。

历史请求只针对当前消息页涉及的 Run，避免加载不可见的全部会话。切换 Thread 使用 generation 标记丢弃迟到响应；卸载、切换或新对话继续通过 AbortController 终止旧请求。

## 错误与恢复

- `RunSessionController` 处理 `stream.end`、`stream.reset`、HTTP 重连和 Run 轮询；控制事件不进入 reducer。
- 收到任一归一化 `run.completed/failed/cancelled/interrupted` 持久事件时，Controller 先 reduce，再标记 terminal 并 abort 当前 reader；由此产生的 AbortError 在 terminal=true 时视为正常结束，不等待 `stream.end`。
- `stream.reset` 使用 `max(transportSequence, last_sequence)` 立即重新补流，不清空 RunState；连续三次 reset 或重连均未推进游标时停止循环、读取 Run 状态并显示连接错误。
- 历史事件加载局部失败时保留最终消息并显示统一提示，不让整个 Thread 空白。
- 工具失败显示“该步骤未完成”，不展示原始异常；Run 是否继续由 Agent 现有错误策略决定。
- 未配对的工具终态创建一个降级步骤，避免丢失审计信息；同时在开发环境发出诊断日志。
- 旧历史数据没有工具事件时保持现有最终回答体验。

## 测试策略

后端测试覆盖：

- 工具开始/完成/失败使用相同 `call_id` 且顺序持久化。
- 五个工具的精确输入和结果摘要白名单，不泄露嵌套 secret、答案正文、reasoning、令牌、超长集合或任意异常。
- 被 `ToolErrorMiddleware` 转换成 error ToolMessage 的平台错误写为 `tool.failed`。
- 历史事件接口的所有权、游标分页、排序和不存在资源行为。
- EventSink 开始/终态写入失败时 Run 以 `EVENT_PERSISTENCE_FAILED` 收敛。
- 启动恢复同时转换 Run 行并写 `run.interrupted`。
- SSE 回放期间完成、且完成发生在所有权读取与订阅之间时，终态持久事件仍使客户端立即结束；服务端在回放后重新读取 Run 状态，避免使用路由入口处的陈旧 Run 快照等待永远不会到达的 close 信号。

前端测试覆盖：

- SSE 跨 chunk 解析与历史 DTO 使用相同归一化结果。
- 传输游标在已知、未知和畸形 payload 上推进；reducer sequence 去重、回答拼接、工具配对及所有终态。
- 实时逐事件 reduce 与历史批量回放得到相同 RunViewState。
- `applyRunSnapshot` 为缺失终态事件的旧 failed/interrupted Run 补齐状态，并覆盖消息页多于默认 20 个 Run 的场景。
- 未知/畸形事件安全降级。
- 消息分组顺序、旧历史兼容和失败 Run 展示。
- 五个工具 renderer 的自然语言摘要。
- 首期不生产、不归一化也不显示 progress、plan 或 subtask 内容。
- 终态事件会中止 reader；覆盖终态发生在服务端 ownership lookup 与 subscribe/replay 之间的竞态回归。

最终运行 Python 测试、前端单元测试和生产构建，并在桌面与移动视口检查：运行中展开、完成后收起、长摘要换行、工具失败、历史切换以及侧栏缩放场景均无重叠。

## 非目标

- 不展示模型内部 reasoning 或 chain-of-thought。
- 不启用 Subagent、写工具、确认卡片或计划调度。
- 不修改现有业务工具的只读权限。
- 不把 UI ViewModel 持久化到后端。
- 不改 Shadcn `ui/` 组件。
