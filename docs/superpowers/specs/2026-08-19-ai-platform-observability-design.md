# AI 平台调用日志设计

## 目标

当 AI 工具调用 Java 平台失败或响应契约不匹配时，服务端日志应能定位具体 run、工具、平台路径、HTTP 状态和校验原因，同时不得泄露认证凭证或完整业务响应。

## 范围

- 仅修改 `aisoftoj-ai` 的平台客户端、工具错误中间件和日志初始化。
- 不修改 Java 后端，不引入跨服务 request ID，不记录完整响应正文。
- UI 工具事件与现有公开错误码保持不变。

## 日志分层

### 平台客户端

`PlatformClient` 在最终失败时记录一条 `WARNING`：

- `event=platform_request_failed`
- HTTP 方法与相对路径
- 最终 HTTP 状态码（网络异常时为空）
- 规范化错误码
- 请求尝试次数与总耗时
- 响应字节数和 content type
- 响应校验失败时的 Pydantic 错误位置、错误类型和截断后的安全消息

超时、连接失败、响应过大、4xx/5xx、JSON/契约校验失败及 envelope code 异常都应覆盖。重试中的第一次临时失败不单独告警，最终失败只写一次，避免噪声。

### 工具中间件

`ToolErrorMiddleware` 把可恢复 `PlatformError` 转为 `ToolMessage` 前记录一条 `WARNING`：

- `event=agent_tool_platform_error`
- `run_id`
- 工具名
- 平台错误码和映射状态码

该层用于把平台日志与 agent run 关联。既有 `ToolAuditMiddleware` 继续记录成功与耗时，但失败结果应使用 `WARNING`，不能把错误 `ToolMessage` 记为 completed。

## 日志输出

应用启动时配置 `aisoftoj_agent` 包 logger，级别沿用 `settings.log_level`，输出到标准错误流并复用 Uvicorn 的统一格式。不得重复添加 handler，避免测试或重复建 app 时输出多份日志。

## 脱敏

任何日志都不得包含：

- `Authorization`、bearer token、`X-AI-Service-Key` 或 LLM key
- 请求 headers
- 完整响应正文、题干、选项、答案、用户消息
- URL 查询参数值

Pydantic 校验只记录结构化错误摘要，例如 `data.options.0.key:string_type`；消息必须限长，并清除输入值。

## 测试

- 平台客户端测试覆盖契约校验失败、HTTP 失败、网络失败和重试后单次告警。
- `caplog` 断言日志包含路径、状态、错误码和校验位置。
- 日志测试使用哨兵 token、service key、响应正文，断言它们均未出现。
- 工具中间件测试覆盖 run/tool 关联日志和错误 `ToolMessage` 的 warning 审计。
- 运行 AI 服务全量 pytest、Ruff 和源码 mypy。
