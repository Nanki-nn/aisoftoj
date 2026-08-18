# AI 助手事件流水线实施计划

> 对应设计：`docs/superpowers/specs/2026-08-18-ai-assistant-event-pipeline-design.md`

## 目标

补齐工具事件持久化与历史 API，将前端重构为传输、归一化、运行态、消息分组和语义组件五层，并保证实时流与历史回放得到相同界面。

## 任务 1：后端事件与历史契约

- 为历史事件增加分页响应 DTO 和 owner-scoped API。
- 修复 SSE 回放后的 Run 终态重读竞态。
- 将启动恢复改为 Run 状态与 `run.interrupted` 事件同事务写入。
- 补 Repository、API 和恢复测试。

## 任务 2：安全工具事件采集

- 增加 RunEventSink、工具事件异常和运行时 Context 注入。
- 增加确定性工具输入/结果摘要器，严格执行字段白名单。
- 在 ToolError 外层记录 started/completed/failed，正确识别 error ToolMessage。
- 补配对、错误分类、安全泄漏和持久化失败测试。

## 任务 3：前端事件核心

- 在独立模块定义 raw-to-normalized 映射、Run reducer、Run 快照合并和传输游标。
- 定义消息分组纯函数，确保每个 Run 只输出一次 human/processing/answer/error。
- 补旧事件兼容、未知事件、幂等、工具配对和实时/历史等价测试。

## 任务 4：会话 Hook 与历史回放

- `aiApi.ts` 增加分页历史事件 API。
- `useAIConversation` 管理 `runStates`，为可见 Run 加载完整事件页并恢复活跃 SSE。
- 终态事件立即中止 reader；Run 快照为缺终态的旧历史兜底。
- 保持现有幂等发送、取消、重试和 Thread 切换行为。

## 任务 5：语义化 UI

- 抽出 MessageList、ProcessingPanel、ToolStep、AnswerBubble 和 RunErrorNotice。
- 五个现有工具显示自然语言动作与安全摘要；未知工具使用通用展示。
- 运行中默认展开、完成后默认收起；旧历史无步骤时不显示空面板。
- 保留现有侧栏缩放、移动端布局和 Markdown 回答。

## 任务 6：验证与提交

- 运行 Python 局部与全量测试。
- 运行前端单元测试和生产构建。
- 执行 diff 检查并只提交本任务文件，不带入现有后端配置、部署或其他未跟踪文件。
