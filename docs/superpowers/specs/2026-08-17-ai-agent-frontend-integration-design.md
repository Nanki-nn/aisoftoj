# AI 助手前端接入设计

## 目标

将现有 `AIAgentPanel` 的 Mock 回复替换为真实 Python AI 服务调用，同时保留现有抽屉布局、入口位置和视觉样式。浏览器继续使用现有 `localStorage.authToken`，不引入新的登录态。

## 模块边界

- `src/lib/aiApi.ts`：定义 Thread、Message、Run、SSE 类型；封装创建 Thread、读取历史、创建 Run、取消 Run以及带 Bearer 的 SSE 流解析。
- `src/hooks/useAIConversation.ts`：管理当前 Thread、消息、发送状态、AbortController、事件 sequence 去重和错误状态。
- `AIAgentPanel.tsx`：只负责输入、展示、重试和新对话交互，不直接拼接请求。
- `vite.config.ts`：开发环境将 `/api/ai` 代理到 `127.0.0.1:8000`，将其余 `/api` 代理到 Java `127.0.0.1:8080`。生产环境继续由同源 Nginx 路由。

## 数据流

首次发送时先创建 Thread，再为该次用户意图生成一个 `Idempotency-Key` 创建 Run。该 key 保存在待发送消息状态中；网络超时和用户点击“重试”必须复用原 key，只有编辑后重新发送或发送下一条消息才生成新 key。前端立即展示用户消息；创建 Run 失败时将消息标为失败而不是删除，允许安全重试。

Run 创建成功后使用 `fetch()` 读取 SSE：`message.delta` 追加到当前 Assistant 消息；心跳注释忽略；只有带持久事件 `id` 的事件推进 sequence；`stream.reset` 使用其 `last_sequence` 立即重新建立补流连接；`run.completed`、`run.failed`、`run.cancelled`、`run.interrupted` 和对应 `stream.end` 收敛终态。网络中断最多自动重连两次，耗尽后调用 `GET Run`：若已终态则按服务端状态结束，仍活跃则显示可重试的连接错误但不重复创建 Run。

当前 Thread ID 持久化到用户级 `localStorage` 键。面板首次打开或刷新后先读取该 Thread 的历史消息；若不存在则通过 Thread 列表选择最近更新的一条。随后读取该 Thread 的 Run 列表；发现活跃 Run 时使用已有 Run ID 和最后已知 sequence 恢复 SSE。对话记录按钮展示 Thread 列表并允许切换，切换后重新读取消息。

新对话若存在活跃 Run，会先请求取消并继续等待 SSE 或轮询 `GET Run`，直到 `cancelled`/`completed` 等终态后再丢弃旧 Thread 状态；取消失败则保留当前对话并显示错误。组件卸载或用户退出时只中止本地网络读取，不隐式取消服务端 Run，以便下次恢复。只展示根 Agent 的文本事件，不展示工具参数、工具返回值或内部推理。

## 认证与错误

所有请求从 `localStorage` 读取现有 Bearer JWT。缺少 JWT 时提示先登录，不创建 Thread。401 提示登录失效；429 提示稍后重试；其他服务错误使用统一中文提示。密钥、内部 Java URL 和原始异常不会进入界面。

## 验证

- 单元测试覆盖 API 错误解析、SSE 分帧/跨 chunk、sequence 去重和终态。
- 前端构建和现有测试全部通过。
- 浏览器端真实验证：登录后打开面板、发送资料查询、观察流式回复、刷新后读取历史、切换对话；桌面和移动视口无重叠。
