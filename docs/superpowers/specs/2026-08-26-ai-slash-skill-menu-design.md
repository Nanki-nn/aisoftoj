# AI Slash Skill 菜单设计

## 背景与目标

AI 服务已经提供 `GET /api/ai/skills`，并支持在消息开头使用
`/<skill-name>` 显式激活 Skill。当前前端输入框只把 `/` 当作普通文本，没有候选菜单，
用户无法发现 `essay-writing-coach` 等已安装能力。

本次在 AI 助手输入区增加 API 驱动的 Slash Skill 菜单。输入 `/` 后展示全部启用的
Skill，选中后只填入完整命令和尾随空格，让用户继续输入具体需求，不自动发送。

## 数据与组件边界

`aiApi.ts` 新增 `AISkill` 和 `AISkillListResponse`：Skill 包含 `name`、`description`、
`category`、`enabled` 和 `license: string | null`，列表响应固定为
`{ items: AISkill[]; total: number }`。`listAISkills()` 返回完整列表响应，复用现有认证、
错误封装和 `AI_API_BASE_URL`。

新增独立 `AISkillMenu` 组件，职责仅包括：

- 接收已过滤的 Skill 列表、当前高亮索引和选择回调；
- 在输入框上方渲染紧凑浮层；
- 显示命令名和中文描述，并提供 listbox/option 语义。

`AIAgentPanel` 负责加载 Skill 列表、根据输入计算候选项、处理键盘事件和把选中的命令
写回 textarea。Skill 菜单不进入会话状态，也不修改后端 Run 协议。

## 交互规则

- 只有输入以 `/` 开头且首个空格尚未出现时才打开菜单。
- `/` 展示所有 `enabled=true` 的 Skill；继续输入时按 Skill 名称和描述进行不区分
  大小写的包含过滤。
- 候选首次出现时默认高亮第一项；过滤词或异步列表变化后，高亮重置为第一项，零结果
  时为无高亮。`ArrowUp`、`ArrowDown` 在当前候选中循环移动。
- 无修饰键的 `Enter` 选择当前高亮项；`Shift+Enter` 始终保留原有换行行为并关闭菜单，
  `Meta`/`Control`/`Alt` 组合键不触发菜单选择。输入法组合期间不处理 Enter 或方向键。
- `Escape` 关闭菜单并阻止事件冒泡，避免触发现有窗口级“关闭 AI 面板”；本次匹配文本
  未发生改变前保持手动关闭，用户继续编辑后才允许菜单重新打开。
- 选择后输入框变为 `/<skill-name> `，光标回到输入框末尾，不自动发送。
- 用户输入完整命令后的空格和正文时菜单关闭，原有 Enter 发送行为恢复。
- 没有匹配项时显示“未找到可用 Skill”；此时 Enter 保持原有发送逻辑，不拦截。
- 普通中文消息、消息中间的 `/` 和多行内容均不触发菜单。

菜单沿用现有蓝白视觉：白色浮层、细边框、轻阴影、蓝色高亮项；内容在 400px 窄侧栏
内换行，不遮挡发送按钮。菜单使用轻微透明度和位移动画，不使用旋转加载图标，并遵循
`prefers-reduced-motion`。

## 加载、错误与可访问性

AI 面板可用时加载一次 Skill 元数据。加载失败时静默降级为普通输入框，不阻断聊天；
现有全局聊天错误区不展示 Skill 列表失败，避免把辅助发现能力误报成会话失败。重新打开
页面或重新挂载面板时可再次请求。

textarea 使用 `role=combobox`、`aria-autocomplete=list` 和 `aria-expanded`。菜单存在时
才设置指向实际 listbox 的 `aria-controls`；存在高亮候选时才设置指向实际 option 的
`aria-activedescendant`。菜单使用 `role=listbox`，选项使用 `role=option` 和
`aria-selected`。鼠标按下选择时避免 textarea 提前失焦。列表最多显示有限高度并支持
纵向滚动。

## 测试与验收

- API 测试验证请求路径、认证头和响应解析；
- 纯过滤逻辑覆盖 `/`、名称片段、描述片段、正文和消息中间斜杠；
- 组件测试覆盖菜单打开、默认高亮与过滤重置、上下键循环、Enter/点击填充、Escape
  只关闭菜单、IME 防误触、Shift+Enter 换行和零结果；
- 回归测试确认完整命令加正文仍可正常发送，Skill 请求失败不影响聊天；
- 运行前端 Vitest 和生产构建，并在窄侧栏下检查浮层不溢出。

## 非目标

- 不新增或修改后端 Skill、API 和数据库结构；
- 不自动发送 Skill 命令；
- 不在前端硬编码 Skill 列表或论文 Skill 专属逻辑；
- 不增加 Skill 管理、安装、启停或正文查看功能。
