# 综合知识题 Markdown 图片渲染设计

## 1. 背景

题库图片重绘迁移已经完成：28 个 OSS 对象通过公开访问与 SHA-256 校验，数据库中的 32 道题、33 个图片节点已切换为新 URL。

提交后页面抽查发现，案例分析题中的 Markdown 图片能够正常渲染，但综合知识题 `q2728` 会把 `![](https://...)` 作为普通文本显示。原因是前端 `mapQuestion` 仅根据试卷分类判断 `isMarkdown`：案例分析和论文为 `true`，综合知识固定为 `false`。题干实际内容格式与分类并不完全一致。

## 2. 目标与非目标

### 2.1 目标

- 综合知识题中出现受支持的 Markdown 行内图片时，答题页和结果页渲染真实 `<img>`。
- 图片检测只能改变题干渲染方式，不能改变单选/多选/判断/填空题型、选项或评分逻辑。
- 保持案例分析、论文和普通综合知识题的现有渲染行为。
- 不修改后端接口、数据库字段、OSS URL 或题目内容。
- 不扩大对任意 Markdown、任意协议或原始 HTML 的自动识别范围。

### 2.2 非目标

- 不把全部综合知识题切换为 Markdown 渲染。
- 不重构现有题目内容渲染组件。
- 不处理数据库当前不存在的引用式 Markdown 图片或动态脚本图片。

## 3. 方案比较

### 3.1 采用：在题目映射层用 Markdown AST 识别 HTTPS 行内图片

新增独立纯函数，通过 `unified@11` 与 `remark-parse@11` 将题干解析为 Markdown AST，只把 `image` 节点且 URL 为有效 HTTPS 绝对地址的内容识别为 Markdown 图片。上述依赖是 `react-markdown` 已使用的同一解析栈，但需作为前端直接依赖固定版本，避免依赖未声明的传递包。

`mapQuestion` 的 `isMarkdown` 改为：

1. 案例分析或论文；或
2. 题干包含上述 HTTPS Markdown 图片。

优点是代码块、转义字符、普通链接和损坏语法均由 Markdown 解析器正确区分，不依赖脆弱正则。改动集中在数据映射边界，且不会改变普通综合知识题。

### 3.2 不采用：所有题干统一使用 Markdown + 原始 HTML 渲染

覆盖范围更广，但会改变大量历史 HTML 题目的解析方式，并扩大 `rehypeRaw` 的使用面，不适合作为本次迁移的收尾修复。

### 3.3 不采用：正则检测或将 Markdown 图片替换为 HTML 字符串

虽然改动表面较小，但容易误判行内代码、围栏代码、转义标记、标题、括号和 URL 边界，也会把内容转换与 HTML 安全处理耦合在一起。

## 4. 详细设计

### 4.1 检测规则

检测函数只接受字符串并返回布尔值，规则如下：

- 必须被 `remark-parse` 解析为 `image` 节点，不接受 `imageReference`；
- `node.url` 必须能被标准 `URL` 构造器解析，协议为 `https:` 且 hostname 非空；
- 支持普通 destination、尖括号 destination 和合法可选 title；
- 不匹配普通链接、相对路径、`http`、`data:`、`javascript:`、空 host、不完整语法、转义图片标记、行内代码或围栏代码中的图片字面量；
- 不修改原题干字符串。

当前批准 manifest 中 33 个 occurrence 全部为 Markdown 行内图片，新 OSS URL 全部为 HTTPS，因此该范围足以覆盖本次迁移。

### 4.2 题型与渲染标记解耦

当前代码使用 `isMarkdown` 同时决定 `type='essay'`，因此不能直接扩展该变量。修改后分别计算：

- `isEssayPaper`：仅由 `paperCateId === 2 || paperCateId === 3` 决定；
- `type`：`isEssayPaper` 时为 `essay`，否则继续调用 `mapQuestionType(question.questionType)`；
- `isMarkdown`：`isEssayPaper || hasHttpsInlineMarkdownImage(questionContent)`；
- `allowRawHtml`：仅 `isEssayPaper` 为 `true`。

`Question` 类型增加可选的 `allowRawHtml` 字段。`mapQuestion` 先确定实际题干 `intro || name`，映射后的 `question` 内容保持字节不变。综合知识图片题仍保留原始题型、选项、正确答案和记录字段。

### 4.3 渲染器安全边界

已有渲染链路保持不变：

- `ExamSession` 在 `isMarkdown=true` 时使用 `ReactMarkdown + remark-gfm`；
- `ExamResult` 在 `isMarkdown=true` 时使用 Markdown 渲染，但只在 `allowRawHtml=true` 时传入 `rehypeRaw`；
- 其他综合知识题仍走已有的 HTML 清理与渲染分支。

因此，检测出的综合知识 Markdown 图片不会获得原始 HTML 执行能力；案例分析和论文结果页保持当前行为。

## 5. 安全与兼容性

- 只识别 AST 中的 HTTPS 绝对图片，不允许检测逻辑把危险协议送入图片渲染分支。
- `allowRawHtml` 与 `isMarkdown` 分离，检测出的综合知识题不启用 `rehypeRaw`。
- 不改变 `sanitizeQuestionHtml` 或已有 HTML 题目的行为。
- OSS bucket 保持 `private`，只有批准的 28 个对象为 `public-read`。
- 若未来需要支持引用式图片或更复杂 Markdown，应另行设计 AST 级内容格式识别，不扩展本次正则。

## 6. 验证

1. 增加 Vitest 测试脚本与表驱动测试。
2. 检测函数测试至少覆盖：
   - 普通 HTTPS destination、尖括号 HTTPS destination、带合法 title；
   - 空 host、损坏语法、未闭合分隔符；
   - 转义图片标记、行内代码、围栏代码中的图片字面量；
   - 普通链接、引用式图片、相对 URL、`http`、`data:` 和 `javascript:`。
3. 映射测试至少证明：
   - category 1 图片题保持原始 `type`、`options`、`correctAnswer`，同时 `isMarkdown=true`、`allowRawHtml=false`；
   - category 2/3 仍为 `essay`、`isMarkdown=true`、`allowRawHtml=true`；
   - 普通 category 1 仍保持 `isMarkdown=false` 和原有类型。
4. 运行前端测试和生产构建，确保 TypeScript、Vitest 与 Vite 构建通过。
5. 在 2021 年 11 月系统架构设计师综合知识练习中打开 `q2728`：
   - 页面存在一个指向批准 OSS URL 的 `<img>`；
   - 图片 `complete=true` 且 `naturalWidth/naturalHeight > 0`；
   - 页面不再显示原始 `![](URL)` 文本。
6. 回归 2024 年 11 月案例分析 `q2822`，确认现有 Markdown 图片和结果页原始 HTML 行为不变。
7. 抽查一条不含 Markdown 图片的综合知识题，确认仍走现有非 Markdown 渲染路径。
8. 检查浏览器控制台无新增错误或警告。

## 7. 回滚

该修复只涉及前端内容检测、映射标记、结果页 `rehypeRaw` 守卫和测试配置。若出现兼容性问题，恢复 `mapQuestion` 原有分类判断、删除 `allowRawHtml` 守卫与检测依赖即可；OSS 与数据库迁移无需回滚。
