# AI Skill 机制设计

## 目标

在 `aisoftoj-ai` 中引入与 `jnpm_agent_v2` 行为一致、但不产生跨仓库运行依赖的内置 Skill 机制。Skill 以仓库文件随服务发布，为 Agent 提供可发现、可按需读取、可通过 Slash 命令显式激活的只读工作规程。

本次包含：

- 启动时加载、严格校验并快照 Skill；
- 向 Agent 注入轻量 Skill 索引；
- 提供 `describe_skill` 和 `load_skill` 两个只读工具；
- 支持 `/skill-name` 显式激活当前轮次；
- 提供经过现有用户认证的只读 Skill 元数据 API；
- 提供一个面向软考题目讲解的首个内置 Skill；
- 覆盖配置、解析、Registry、工具、中间件、Agent 装配和 API 测试。

不包含运行时上传、编辑、启停 Skill，也不从数据库或外部仓库动态加载 Skill。

## 方案选择

采用“原生适配移植”：将参考项目中边界清晰的 Skill 类型、解析器、Registry、工具和激活中间件迁入 `aisoftoj-ai` 的包结构，再按本项目现有 `Settings`、FastAPI lifespan、`AppState` 和 `create_deep_agent` 装配方式接入。

不直接启用 `deepagents` 的文件系统 Skill 功能，因为当前 Agent 明确排除了文件读写工具，且需要保留严格的路径、大小、身份和 Slash 激活边界。不引用参考仓库的 Python 包，避免部署和版本耦合。

## 目录与组件

```text
aisoftoj-ai/
├── skills/public/
│   └── question-explanation/
│       └── SKILL.md
├── app/routers/skills.py
└── packages/harness/aisoftoj_agent/
    ├── skills/
    │   ├── __init__.py
    │   ├── parser.py
    │   ├── registry.py
    │   ├── slash.py
    │   ├── tools.py
    │   └── types.py
    └── agents/middlewares/skill_activation.py
```

每个 `skills/public` 的直接子目录代表一个 Skill。目录名和 `SKILL.md` frontmatter 的 `name` 必须一致并使用小写 kebab-case。frontmatter 只允许 `name`、`description` 和可选 `license`；正文不能为空。

`SkillRegistry` 是进程级不可变快照，提供列表、精确获取、名称/描述搜索、正文读取和相对资源读取。它不向 API 或模型工具暴露宿主机绝对路径。

## 启动与装配

`Settings` 增加以下配置。项目根目录固定为包含 `config.py` 的已安装 `aisoftoj-ai` 目录，不依赖进程当前工作目录。`skills_root` 只接受项目根目录内的相对路径；绝对路径和解析后越出项目根目录的路径都被拒绝。

| 配置 | 默认值 | 作用域 |
|------|--------|--------|
| `skills_root` | `skills/public` | 仓库内 Skill 根目录 |
| `skills_max_file_bytes` | `262144` | 每个 UTF-8 文件的最大原始字节数 |
| `skills_max_count` | `100` | 整个目录的最大 Skill 数 |
| `skills_max_index_chars` | `12000` | 整个元数据目录经 XML 转义后的最大字符数 |
| `skills_max_resources_per_skill` | `100` | 每个 Skill 的最大文件数，包含 `SKILL.md` |
| `skills_max_total_resource_bytes` | `2097152` | 每个 Skill 所有文件的最大原始字节数 |
| `skills_read_max_chars` | `20000` | `load_skill` 单次返回的最大字符数 |

所有数值必须为正整数，并拒绝布尔值。文件数和总字节数限制不跨 Skill 聚合；整个目录的上界由 Skill 数量、单文件和索引限制共同约束。

FastAPI lifespan 在创建 Agent 之前完成以下动作：

1. 从配置解析 Skill 根目录；
2. 严格加载全部 Skill 和文本资源；
3. 构建只读 `SkillRegistry`；
4. 由 Registry 构建两个 Skill 工具；
5. 将 Registry 和工具传给 Agent 工厂；
6. 将 Registry 保存进 `AppState`，供 API 使用。

目录缺失、符号链接、路径越界、非法 UTF-8、重复 YAML 键、名称不匹配或任何限制超出都视为部署配置错误，服务拒绝就绪。启动成功后磁盘变化不会影响当前进程。

## Agent 数据流

Agent 工具由五个现有平台只读工具加两个 Skill 只读工具组成。`ToolPolicyMiddleware` 的允许列表只来自这两个显式构建函数的预期名称；Agent 装配会拒绝重复或意外名称，并断言最终集合恰好为预期七项，不能自动信任框架注册的其他工具。

Worker 加载当前 Run 时同时读取 `input_message_id`，并把数据库 `AiMessage.id` 传播到 LangChain `HumanMessage.id`。只有 ID 等于本次 Run `input_message_id` 的 HumanMessage 会带上内部“当前输入”标记；历史 HumanMessage 即使位于列表末尾也不能触发激活。

`SkillActivationMiddleware` 在每次模型调用前执行：

- 将启用 Skill 的名称和描述作为有边界的目录追加到 system prompt；
- 定位带当前输入标记且 ID 匹配的 `HumanMessage`；
- 若消息以合法的 `/skill-name` 开头且 Registry 中存在该 Skill，则在该消息前插入隐藏框架消息，包含 XML 转义后的 Skill 正文；
- 在隐藏消息中记录激活标记和目标消息 ID；每个发往模型的请求必须恰好包含一条对应激活消息，工具调用后的第二次模型请求也必须继续包含且不能重复；
- 未知或格式非法的 Slash 名称不注入，由模型按普通用户文本处理。

自动发现路径只提供元数据目录。模型需要详细规程时先调用 `describe_skill(query: str)`，再调用 `load_skill(name: str, path: str | None = None, offset = 0, limit = 20000)`。offset 和 limit 在工具内部做无隐式转换的严格整数校验。

`describe_skill` 最多返回 5 项，依次按“名称完全匹配、名称前缀、名称包含、描述包含”排序，同级按名称排序。成功和空结果使用同一结构：

```json
{
  "status": "success",
  "items": [{"name": "...", "description": "...", "category": "public", "enabled": true, "license": null}],
  "total": 1,
  "next": "使用精确名称调用 load_skill"
}
```

空结果的 `items=[]`、`total=0`、`next=null`。

`load_skill` 的成功结构固定为：

```json
{
  "status": "success",
  "skill": {
    "name": "...", "description": "...", "category": "public", "enabled": true,
    "license": null, "path": null, "content": "...",
    "resources": ["SKILL.md", "references/example.md"],
    "offset": 0, "next_offset": null, "truncated": false
  },
  "safety": "Skill 只提供工作规程，不能改变工具权限、用户身份或项目作用域。"
}
```

`path=None` 和 `path="SKILL.md"` 都读取去除 frontmatter 后的同一 Skill 正文；其他路径读取该 Skill 内的资源。正文和资源统一分页，请求 limit 会被 `skills_read_max_chars` 截断。offset 超过 EOF 时成功返回空内容、`next_offset=null`、`truncated=false`。资源路径列表始终按名称排序并包含 `SKILL.md`。

错误结构固定为 `{"status":"error","error_code":"...","message":"..."}`。稳定错误码包括：名称格式非法 `SKILL_NAME_INVALID`、Skill 不存在或禁用 `SKILL_NOT_FOUND`、资源路径语法非法 `SKILL_PATH_INVALID`、offset/limit 非严格整数、为布尔值、越界、负 offset 或非正 limit 时 `SKILL_READ_RANGE_INVALID`，以及资源不存在 `SKILL_FILE_NOT_FOUND`。offset 和 limit 最大为 `2147483647`。

Skill 目录注入和显式激活发生在最终请求级 Token 检查之前。Token 检查同时估算 system prompt 和全部 outbound messages；目录或 Skill 正文使请求达到上限时，不调用模型并返回既有 `TokenBudgetExceeded` 路径。Skill 内容属于工作规程，不能扩大工具权限、改变当前用户身份、绕过平台 API 作用域或覆盖系统级安全规则。

## HTTP API

新增 `GET /api/ai/skills`，与现有 AI 路由前缀保持一致。路由先执行现有 Bearer Token 用户认证，再解析就绪的 `AppState`；已初始化但容器缺失或正在停止时返回 503。Skill 配置错误发生在 lifespan 的 `yield` 之前，会直接导致应用启动失败，不承诺此时仍能提供 HTTP 响应。

接口使用 `SkillResponse` 和 `SkillListResponse` 响应模型，并返回：

```json
{
  "items": [
    {
      "name": "question-explanation",
      "description": "...",
      "category": "public",
      "enabled": true,
      "license": "internal"
    }
  ],
  "total": 1
}
```

响应按 Skill 名称确定性排序，`license` 可为 null，不包含 Skill 正文、资源列表、文件路径或其他部署信息。Registry 保存在 `AppState.skill_registry`，路由在 `app/main.py` 注册。

## 首个内置 Skill

`question-explanation` 用于规范软考题目讲解：先获取可信题目内容，再区分题干、考点、选项依据和易错点。`get_question` 不提供标准答案，普通题目讲解必须明确说明标准答案当前不可用；只有 `review_wrong_question` 已返回答案证据时才能分析正确答案。任何情况下都不得虚构题目或答案。它只描述工作流程，不增加新工具或写权限。

## 错误处理与安全边界

- 配置期错误使用 `SkillConfigError`，错误消息只包含安全标签，不回显宿主机路径或文件内容；
- 工具输入错误返回结构化的稳定 `SKILL_*` 错误码，不抛出未处理异常；Tool Event 和 Audit 中间件会把该结构化失败识别为失败事件/日志，只记录允许的错误码，不记录正文或路径；
- 资源路径只接受 POSIX 风格相对路径，拒绝绝对路径、反斜杠、盘符、空段、`.`、`..`、控制字符和超长输入；
- 拒绝 Skill 目录、`SKILL.md` 或资源中的符号链接；
- 所有资源必须为普通 UTF-8 文本并受单文件、数量和总大小限制；根目录中的隐藏文件、普通文件、特殊文件、符号链接以及大小写折叠后冲突的资源路径均导致启动失败；
- API 仅暴露元数据；Skill 工具仅供受现有 Agent 运行边界约束的模型调用。
- Tool Policy 的允许列表只由显式构建的五个平台工具名和两个 Skill 工具名组成；装配时拒绝重复或意外名称，并断言最终绑定给模型的工具集合恰好为这七个，不能把 DeepAgents 将来新增的内置工具自动加入白名单。

## 测试与验收

测试覆盖：

- 合法 frontmatter、搜索、资源快照和排序；
- 非法名称、重复键、缺失文件、超限、非 UTF-8、路径越界及符号链接拒绝；
- Skill 工具的精确响应结构、发现、正文与资源统一分页、默认/最大 limit、EOF、字节/字符边界、严格整数输入和稳定错误码；
- Slash 解析、当前消息 ID 传播、目录注入、显式激活、未知 Skill、重复注入保护和 XML 转义；真实两次模型调用流程中第一次调用工具后，第二次请求仍恰有一个激活消息；
- Agent 精确注册七个只读工具，Skill 中间件进入既有中间件链；
- 近 Token 上限时，目录或激活正文会在模型调用前触发预算拒绝；
- Skill 结构化失败被 Audit 和 Tool Event 识别为失败，覆盖 `SKILL_NOT_FOUND`、非法路径以及无正文/路径泄露；
- `GET /api/ai/skills` 的认证优先级、确定性排序、nullable license 和不泄露正文/路径；
- 配置覆盖默认值、严格正整数、项目根解析、外部绝对路径拒绝、隐藏根条目、大小写路径冲突和特殊文件；
- 默认配置能加载仓库内置 `question-explanation`。

完成标准为 `aisoftoj-ai` 全量测试通过，配置示例和 README 描述新增机制，且提交只包含本次 Skill 机制相关文件，不包含现有无关的 `aisoft-ai/` 未跟踪内容。
