# AI 助手 Agent 每日 Token 额度实施计划

## 交付边界

在独立分支 `codex/ai-daily-token-quota` 中实现已批准的每日额度规格。Python AI 服务拥有额度账本和结算事务；React 前端提供管理员配置与用户耗尽状态；Java 服务不参与扣费。论文批改只补废弃说明。

## 任务一：持久化与额度领域

1. 在 `config.py` 增加单次模型最大输出 Token、预留安全余量配置和范围校验，并同步示例配置。
2. 新增 Alembic 迁移，创建 `ai_quota_config`、`ai_daily_token_usage`、`ai_token_reservations`，初始化全局额度 30,000。
3. 扩展 SQLAlchemy 模型，保持 MySQL 与 SQLite 测试兼容。
4. 新增额度仓储/服务，提供状态查询、Run 准入检查、逐调用预留、真实或估算结算、失败释放、启动恢复和管理员更新。
5. 使用固定锁顺序和唯一键保证并发与幂等；北京时间日期和次日重置时间由服务端统一计算。
6. 增加领域测试：默认额度、跨日、调额、并发边界、重复结算、释放与恢复。

## 任务二：模型调用计量与 Run 汇总

1. 新增 `DailyTokenQuotaMiddleware`，从 `AgentContext` 读取用户和 Run，估算输入并在每次模型调用前预留。
2. 模型返回后汇总 `usage_metadata`；缺失 usage 时估算输入/输出并标记来源；异常时释放。
3. 每次结算原子累计 `ai_runs.prompt_tokens`、`completion_tokens`。
4. 给 OpenAI 和 direct endpoint 统一传入最大输出 Token；流式接口请求 usage。
5. Worker 将额度耗尽映射为稳定终态错误 `AI_DAILY_TOKEN_QUOTA_EXCEEDED`。
6. 启动时在中断遗留 Run 后收敛遗留预留，重复启动不得重复扣费。

## 任务三：API 与错误契约

1. 新增 `GET /api/ai/quota`。
2. 新增管理员 `GET/PATCH /api/ai/admin/quota-config`，强制 `ADMIN` 角色和 1,000–10,000,000 整数范围。
3. Run 创建事务前执行额度准入检查，额度为零时不创建消息或 Run。
4. 新增结构化 API 异常，输出稳定错误码、额度字段和带 `+08:00` 的 `reset_at`。
5. 为用户、管理员权限、立即生效、fail-closed 和幂等行为补 API 测试。

## 任务四：管理后台

1. 在后台侧栏增加“AI 助手设置”。
2. 新增配置页面，加载当前额度、更新时间、修改人；校验范围并提示立即生效。
3. 保存成功后重新拉取服务端值；提供加载、失败和保存状态。
4. 增加 API 和组件测试。

## 任务五：用户额度耗尽体验

1. 前端识别 `AI_DAILY_TOKEN_QUOTA_EXCEEDED`，保存耗尽状态和恢复时间。
2. 仅耗尽时在输入区显示“今日 AI 助手额度已用完，将于明日 00:00 恢复”，禁用输入、快捷提问、技能选择和发送。
3. 不常驻显示已用或剩余 Token；重新打开面板或跨过恢复时间后允许服务端重新判断。
4. Run 在中途额度耗尽时保留已有流式内容，并以中性状态结束。
5. 增加 Hook、API 和面板交互测试。

## 任务六：文档与验证

1. README 标记论文批改已废弃且不计入 Agent 额度。
2. 更新 AI 服务配置、迁移和 API 说明。
3. 执行 AI 服务 pytest、Ruff、mypy；执行前端测试、类型检查与生产构建。
4. 检查迁移 upgrade/downgrade、工作区差异和敏感信息。
5. 仅提交本需求相关文件，创建聚焦 commit。
