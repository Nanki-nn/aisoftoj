# 论文写作教练独立仓库设计

## 目标

将 `aisoftoj-ai` 中已验证的 `essay-writing-coach` 发布到公开空仓库 `https://github.com/Nanki-nn/essay-writing-coach`，使其可以独立阅读、安装和迭代，同时保留知构平台内置副本。

独立仓库只包含 Skill、必要参考资料、安装说明、许可证和精简评估契约；不复制 `aisoftoj` 的应用代码、内部设计文档、数据库、模型配置、用户数据或前向测试长输出。

## 仓库结构

```text
essay-writing-coach/
├── README.md
├── LICENSE
├── .gitignore
├── pyproject.toml
├── scripts/
│   └── validate.py
├── skills/
│   └── essay-writing-coach/
│       ├── SKILL.md
│       └── references/
│           ├── writing-framework.md
│           ├── topic-patterns.md
│           ├── quality-checklist.md
│           ├── example-cards.md
│           └── sources.md
└── evals/
    ├── cases.yaml
    └── verdicts.yaml
```

不加入 `agents/openai.yaml`。该文件不是 Skill 执行所必需，当前知构运行时也不读取它。后续若独立仓库需要面向特定 Skill 市场发布，再单独补充界面元数据。

## Skill 内容与兼容性

以 `aisoftoj-ai/skills/public/essay-writing-coach` 的已验证版本为基线，保留分阶段教练、直接产出、事实禁造、动态篇幅、五类题型、质量检查和来源治理。

独立版不得假定存在知构平台工具。获取题干的规则调整为：

1. 优先使用用户提供的完整题干；
2. 若宿主环境提供可信的当前题或题库读取工具，可以读取；
3. 工具不存在或信息不足时请用户补充，不将 `get_question` 写成必需依赖。

参考资料采用相对路径。独立版 `SKILL.md` 明确宿主能力约定：

- 宿主能够读取 Skill 相对资源时，按任务需要读取 `references/`；
- 宿主不提供资源读取能力时，只使用 `SKILL.md` 的核心流程，并明确扩展框架或范文不可用；
- 不依赖知构专有的 `load_skill` 工具名、返回结构或 `SKILL_FILE_NOT_FOUND` 错误码，也不声称读取了实际不可访问的资源。

README 区分“兼容 Skill 资源读取的 Agent 宿主”和“仅供人工阅读或只加载单文件的宿主”，不承诺所有 Agent 产品都能自动按需加载参考文件。

Skill 不提交论文、不修改平台数据、不保证分数或通过率。独立仓库不提供后端服务、API 或运行时集成脚本；仅包含离线校验脚本 `scripts/validate.py`。

## README

README 使用中文，包含：

- Skill 定位和能力边界；
- 目录结构；
- 安装方式；
- `/essay-writing-coach` 或宿主支持的 Skill 调用示例；
- 从题干开始、直接生成提纲、评阅已有论文三个使用示例；
- 后续追加范文的方法；
- 验证命令；
- 许可证与来源说明；
- 支持的宿主能力和资源不可读时的降级行为。

安装说明至少覆盖：

1. 克隆仓库后，将 `skills/essay-writing-coach` 复制到宿主的 Skills 目录；
2. 对知构平台开发者，将该目录复制到 `aisoftoj-ai/skills/public/essay-writing-coach` 并重启服务以刷新启动快照。

不写死用户本机绝对路径，不包含模型密钥或平台服务密钥。

## 许可证与来源

独立仓库采用 MIT License。独立版 `SKILL.md` frontmatter 使用 `license: MIT`，`sources.md` 中关于本仓库内容的许可文字也改为 MIT。README、评估夹具、评估结论、验证脚本和全部参考资料均属于仓库 MIT 授权范围；外部链接指向的第三方内容明确排除在本仓库 MIT 授权之外，并继续服从其各自许可证。知构仓库现有内置副本本次不修改，仍保持其当前内部许可标记，避免把发布动作扩展为平台代码变更。

所有 Skill 规则和范文卡均为独立原创抽象表达。用户提供范文的原文不进入仓库。`sources.md` 保留稳定 source ID 与外部延伸阅读链接：

- 用户材料只标记为“用户提供、未捆绑原文、仅作抽象提炼”；
- CSDN CC BY-SA 文章只作为外部链接记录，不复制、改编或作为范文卡来源；
- 资料不完整的 SOA 页面只记录，不生成卡片。

`cases.yaml` 只使用为测试目的重新编写的合成、脱敏项目夹具。不得直接复制用户私有项目名称、内部业务事实、原始文章段落或可识别个人的信息。夹具中的虚构示例必须明显是测试数据，不作为论文项目事实来源。

README 明确说明第三方链接内容遵循其各自许可证，不属于本仓库 MIT 授权范围。

## 评估资料

`evals/cases.yaml` 从知构项目的固定夹具提取八类高风险场景：只有题干、完整项目、缺少指标的直接初稿、可用性检查、字数冲突、局部摘要、只读边界、资源降级。

`evals/verdicts.yaml` 只保存场景 ID、最终独立版验证结论和简短证据，不复制九份前向测试长输出，也不使用知构项目内的相对结果路径。

在最终待提交目录上使用新会话重新执行八类场景后才能写入通过结论。除原八类风险外，评估必须显式验证：

- 宿主没有 `get_question` 或任何题库工具时，Skill 请求用户提供完整题干且不推测缺失内容；
- 宿主没有知构 `load_skill` 和错误码协议、无法读取 `references/` 时，只按核心流程工作并说明扩展资料不可用。

未来修改 `SKILL.md` 或参考资料后必须重新执行受影响场景并更新结论。旧知构版本的评估只可作为设计输入，不可表述为独立发布版已经通过验证。

## 可复现验证

仓库自带 `scripts/validate.py`，只使用 Python 3.10+ 标准库，不依赖仓库外的 Skill Creator。`pyproject.toml` 声明 Python 版本并提供最小项目元数据，不引入运行依赖。

验证脚本执行：

```bash
python3 scripts/validate.py
```

脚本至少检查：

- `SKILL.md` frontmatter、目录名、必填字段与 `license: MIT`；
- 五个相对资源路径都存在且可读取；
- `cases.yaml` 和 `verdicts.yaml` 的受限 YAML 结构。为避免引入 PyYAML，两个文件只使用脚本支持的简单映射、列表和纯量语法，或采用 JSON 兼容 YAML；
- 范文卡 source ID 均存在于 `sources.md`，且只引用允许提炼的来源；
- 禁止来源不出现在范文卡；
- 不存在本机绝对路径、常见密钥字段的非示例值、前向测试长输出目录、知构内部包名或超长原文式段落；
- README 中的安装路径与实际目录一致。

README 同时说明可选的通用校验：若开发者本机有 OpenAI Skill Creator，可额外运行其 `quick_validate.py skills/essay-writing-coach`；该项不是仓库验证的必需条件，不绑定未声明版本。

## 发布流程

1. 在安全的临时目录克隆公开空仓库；
2. 按上述结构创建文件，不修改当前 `aisoftoj` 工作树中的 Skill；
3. 运行仓库自带 `python3 scripts/validate.py`，再可选运行本机 Skill Creator 校验；
4. 在最终独立目录上重新执行八类前向场景，更新 `evals/verdicts.yaml`；
5. 检查 git diff，确保不含密钥、用户数据、长范文原文或知构内部文件；
6. 在目标仓库 `main` 分支创建首个提交；
7. 推送到 `origin/main`；
8. 通过远端读取确认提交和文件可见。

目标仓库当前已确认是公开空仓库。发布有两个明确终态：

- `published`：本地提交已推送到 `origin/main`，并从远端确认提交 SHA 和关键文件；此时才可以宣称发布完成。
- `prepared-but-unpublished`：独立仓库本地提交和所有离线检查已通过，但 GitHub 凭据不可用或推送被拒绝。此时只报告安全降级状态、本地仓库绝对路径、提交 SHA 和所需认证步骤，不能宣称已经发布，也不尝试绕过认证。

## 测试与验收

- `python3 scripts/validate.py` 在干净克隆中通过；本机存在 Skill Creator 时，其 `quick_validate.py` 也应通过；
- 五个 `references/` 文件均存在且所有 SKILL 路由可解析；
- `cases.yaml` 和 `verdicts.yaml` 可由 YAML 解析；
- 每张范文卡都引用 `sources.md` 中存在且允许提炼的 source ID；
- `fangcai-five-part-20260825` 和 `csdn-soa-partial-20260825` 不出现在范文卡；
- 仓库不包含本机绝对路径、真实密钥、前向测试长输出或知构内部实现文件；
- README 中的安装路径与实际目录一致；
- 最终独立版已重新执行八类前向场景，包含无题库工具和无资源读取能力的降级验证；
- `published` 完成标准：初始提交已推送到 `https://github.com/Nanki-nn/essay-writing-coach` 的 `main` 分支，并能从远端读取；
- `prepared-but-unpublished` 安全降级标准：本地提交和离线验收均通过，并准确报告本地路径、SHA 与认证步骤，但任务仍未完成发布。
