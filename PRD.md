# 知构软考刷题平台 · 产品需求文档

**版本**：v1.0
**状态**：积极开发中
**目标用户**：在职备考软考（系统架构设计师等高级科目）的工程师，每天碎片时间学习

---

## 一、产品概述

### 定位

面向在职备考软考的智能刷题与学习平台。核心价值主张：**不靠玄学，靠路径**——把 2 个月备考拆成三条清晰路线（打基础 → 刷真题 → 论文冲刺），每条路线有对应工具支撑。

### 核心差异点

- 作者本人备考经验直接内置为产品路径
- 历年真题 + 错题沉淀 + AI 论文批改三位一体
- 专为碎片时间设计，不需要整块学习时间

---

## 二、用户角色

| 角色 | 描述 |
|------|------|
| 游客 | 可浏览首页、备考路径介绍，不可刷题 |
| 注册用户 | 可刷题、查看历史、管理错题、写论文 |
| 管理员 | 可管理用户、题目、上传 OSS 资源 |

---

## 三、页面清单与功能规格

### 3.1 首页 `/`

**目的**：品牌落地 + 引导用户进入三条备考路线

**核心内容**

- 主标题：「软考备考，从路径开始。」
- 副标题：备考方法论简介
- 两个 CTA 按钮：「直接刷真题」→ `/papers`，「先看备考路径」→ `/foundation`
- 三条路线卡片（可点击跳转）：
  - 01 打基础 / 第 1–4 周 → `/foundation`
  - 02 刷真题 / 第 5–6 周 → `/papers`
  - 03 论文冲刺 / 第 7–8 周 → `/essay-sprint`
- 方法论说明区：「为什么这样排」+ 三步骤卡片
- 标签组：「2 个月冲刺节奏」「真题优先」「错题复盘」「AI 论文批改」

---

### 3.2 打基础页 `/foundation`

**目的**：作者整理的备考笔记资料库，用户点击跳转 GitHub 查看

**核心内容**

- 简短说明文字：这些是作者备考时整理的笔记，按模块分类
- 资料卡片列表（静态数据，内容待填充）：
  - 每张卡片：标题、简短描述、分类标签
  - 点击整张卡片 → 新标签页打开对应 GitHub 文件链接
- CTA：「去刷真题」→ `/papers`

**数据来源**：静态硬编码在前端，GitHub 链接待作者整理后填入

**待确认**：笔记的分类维度（如按科目 / 按题型 / 按备考周次）和 GitHub 仓库链接

---

### 3.3 试卷列表页 `/papers`

**目的**：浏览、筛选历年真题，进入刷题

**筛选区**

- 科目筛选（单选）：系统架构设计师、软件设计师、网络工程师等
- 题型分类筛选（单选）：综合知识、案例分析、论文

**试卷卡片**（网格布局）

| 字段 | 说明 |
|------|------|
| 年份 + 月份 | 如「2024年5月真题」 |
| 科目名称 | |
| 题型分类 | Badge 展示 |
| 题目数量 | |
| 做题次数 | |
| 练习进度条 | 仅 in_progress 状态显示 |
| 状态按钮 | 见下表 |

**状态按钮逻辑**

| 状态 | 按钮文案 | 行为 |
|------|----------|------|
| 未开始 | 开始刷题 | 触发模式选择弹窗 |
| 进行中 | 继续刷题 | 直接进入会话 |
| 已完成 | 重新刷题 | 触发模式选择弹窗 |

**模式选择弹窗**

- 练习模式：答题后即时显示解析
- 考试模式：交卷后统一查看

---

### 3.4 答题页 `/exam/session/:id`

**目的**：核心答题体验

**布局**：左侧题目区 + 右侧答题卡/进度区（移动端折叠为底部抽屉）

**题目区**

- 题目序号 + 题干（支持富文本 / 图片）
- 题目类型标识（单选 / 多选 / 判断 / 填空 / 案例 / 论文）
- 选项列表：单选 Radio，多选 Checkbox，判断 Radio
- 练习模式：答题后即时显示解析、正确答案、答案说明

**答题卡区**

- 所有题目序号格子，三种状态：已答 / 未答 / 答错
- 当前进度：已答 X / 共 Y 题
- 考试模式：倒计时显示
- 「交卷」按钮（需二次确认）
- 「返回」按钮

**其他**

- 题目加载中显示 Skeleton
- 刷新后可恢复会话（答案实时缓存到 localStorage + 后端）

---

### 3.5 结果页 `/exam/result/:id`

**目的**：交卷后展示成绩与答题详情

**核心内容**

- 得分 / 总分、正确率、用时
- 各题答情况列表：题干摘要 + 我的答案 + 正确答案 + 是否正确
- 操作按钮：「重新刷题」「继续练习」「返回首页」「查看原题」

---

### 3.6 登录 / 注册页 `/login`

**目的**：用户认证

**登录表单**

- 邮箱 / 用户名
- 密码
- 「登录」按钮
- 切换到注册

**注册表单**

- 邮箱、用户名（login_name）、昵称、密码
- 「注册」按钮
- 切换到登录

**品牌展示**：左侧或顶部展示产品名称与价值主张

---

### 3.7 个人中心 `/profile`

**目的**：查看个人信息与学习统计

**核心内容**

- 用户头像、昵称、邮箱
- 学习统计：累计答题数、错题数、刷题会话数、正确率、学习天数
- 快捷入口：刷题历史、错题本
- 退出登录

---

### 3.8 刷题历史 `/practice-history`

**目的**：查看所有刷题记录

**列表字段**（分页）

| 字段 | 说明 |
|------|------|
| 试卷名称 | |
| 科目 + 题型 | |
| 答题模式 | 练习 / 考试 |
| 答题数 / 总题数 | |
| 正确率 | |
| 用时 | |
| 状态 | 进行中 / 已完成 |
| 操作 | 继续（进行中）/ 查看结果（已完成） |

---

### 3.9 错题本 `/wrong-questions`

**目的**：管理错题，支持复盘

**列表字段**（分页，支持每页条数切换）

| 字段 | 说明 |
|------|------|
| 题目名称摘要 | |
| 所属试卷 | |
| 题目类型 | |
| 错误次数 | |
| 重要程度 | low / medium / high / must，颜色区分 |
| 最近答错时间 | |
| 操作 | 查看原题、移除 |

---

### 3.10 论文冲刺入口 `/essay-sprint`

**目的**：展示作者自己的论文案例 + 引导进入 AI 批改

**核心内容**

- 简短说明文字：这些是作者备考时写的论文案例，可作为参考
- 论文案例卡片列表（静态数据，内容待填充）：
  - 每张卡片：论文标题、主题标签（如架构设计 / 质量属性 / 项目管理）、简短摘要
  - 点击整张卡片 → 新标签页打开对应 GitHub 文件链接
- CTA：「用 AI 批改我的论文」→ `/essay`

**数据来源**：静态硬编码在前端，GitHub 链接待作者整理后填入

**待确认**：论文案例的主题分类和 GitHub 仓库链接

---

### 3.11 论文列表 `/essay`

**目的**：选择论文题目，进入写作

**核心内容**

- 论文题目列表（按主题分类：架构设计、质量属性、项目管理等）
- 每题：题目标题、主标签、难度
- 操作：「开始写作」→ `/essay/write/:questionId`
- 历史记录入口 → `/essay/history`

---

### 3.12 论文写作页 `/essay/write/:questionId`

**目的**：写论文 + 提交 AI 批改

**核心功能**

- 题目展示（题干 + 要求）
- 摘要文本区（目标字数：280–320 字）
- 正文文本区（目标字数：2000–3000 字）
- 字数统计实时显示，颜色反馈：绿色（达标）/ 黄色（偏少）/ 红色（超限）
- 已用时显示
- 每 30 秒自动保存草稿到 localStorage，刷新后可恢复
- 「提交批改」按钮 → 跳转 `/essay/result/:submissionId`

---

### 3.13 论文批改结果 `/essay/result/:submissionId`

**目的**：展示 AI 批改结果

**核心内容**

- 综合评分
- 六维评分：摘要质量、结构完整性、题目贴合度、技术深度、论据充分性、语言流畅度
- 逐条改进建议
- 操作：「重新写作」「查看历史」

---

### 3.14 论文历史 `/essay/history`

**目的**：查看所有论文提交记录

**列表字段**

| 字段 | 说明 |
|------|------|
| 题目标题 | |
| 字数 | |
| 综合评分 | |
| 状态 | 处理中 / 已完成 / 失败 |
| 提交时间 | |
| 操作 | 查看批改结果、删除 |

---

### 3.15 管理后台 `/admin`

**目的**：内容管理（仅管理员可见）

| 子路由 | 页面 | 功能 |
|--------|------|------|
| `/admin` | 仪表盘 | 用户总数、启用用户数、题目总数、活跃题目数 |
| `/admin/users` | 用户管理 | 列表、搜索、启用/禁用、编辑、删除 |
| `/admin/questions` | 题目管理 | 列表、多维筛选、新增/编辑/删除 |
| `/admin/oss` | 资源上传 | 图片上传（JPG/PNG/GIF/WebP/SVG，≤10MB） |

---

## 四、全局组件

### AppHeader（顶部导航栏）

| 区域 | 内容 |
|------|------|
| 左侧 | 品牌 Logo（知构软考）+ 导航链接：打基础 / 刷真题 / 论文冲刺 |
| 右侧 | 深色/浅色模式切换、软考倒计时（距 2026-05-23）、GitHub Star 链接 |
| 未登录 | 「登录」按钮 |
| 已登录 | 用户头像 + 下拉菜单（个人中心 / 后台管理 / 设置 / 退出登录） |

---

## 五、数据模型

### 用户（user）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | int | 主键 |
| email | varchar | 唯一 |
| login_name | varchar | 唯一 |
| nickname | varchar | 显示名 |
| password | varchar | BCrypt 加密 |
| avatar | varchar | 头像 URL |
| role | varchar | user / admin |
| is_enabled | boolean | 是否启用 |
| create_time | datetime | |

### 试卷（paper）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | int | 主键 |
| year | int | 年份 |
| month | int | 月份 |
| subject_name | varchar | 科目名 |
| paper_cate_id | int | 1综合 / 2案例 / 3论文 |
| question_count | int | 题目数 |

### 题目（question）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | int | 主键 |
| intro | longtext | 题干（HTML） |
| options | JSON | 选项列表 |
| answer | varchar | 正确答案 |
| analysis | text | 解析 |
| question_type | int | 1单选 / 2多选 / 3判断 / 4填空 / 5案例 / 6论文 |
| difficulty | int | 1简单 / 2中等 / 3困难 |

### 练习会话（practice_session）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | int | 主键 |
| user_id | int | 用户 |
| paper_id | int | 试卷 |
| status | int | 0进行中 / 1已完成 |
| exam_mode | varchar | practice / exam |
| answered_count | int | 已答题数 |
| correct_count | int | 答对题数 |
| spend_time | int | 总用时（秒） |

### 答题记录（practice_session_question_record）

| 字段 | 类型 | 说明 |
|------|------|------|
| session_id | int | 会话 |
| question_id | int | 题目 |
| user_answer | varchar | 用户答案 |
| is_correct | boolean | 是否正确 |
| is_submitted | boolean | 是否已提交 |
| spend_time | int | 本题用时（秒） |

### 错题统计（user_wrong_question_stat）

| 字段 | 类型 | 说明 |
|------|------|------|
| user_id | int | 用户 |
| question_id | int | 题目 |
| paper_id | int | 试卷 |
| error_count | int | 错误次数 |
| importance_level | varchar | low / medium / high / must |
| last_wrong_time | datetime | 最近答错时间 |

### 论文提交（essay_submission）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | long | 主键 |
| user_id | long | 用户 |
| question_id | long | 题目 |
| abstract_text | text | 摘要 |
| content | text | 正文 |
| word_count | int | 字数 |
| status | int | 0待处理 / 1处理中 / 2已完成 / 3失败 |
| total_score | decimal | 综合评分 |

### 论文批改（essay_review）

| 字段 | 类型 | 说明 |
|------|------|------|
| submission_id | long | 关联提交 |
| score_abstract | decimal | 摘要质量 |
| score_structure | decimal | 结构完整性 |
| score_relevance | decimal | 题目贴合度 |
| score_depth | decimal | 技术深度 |
| score_evidence | decimal | 论据充分性 |
| score_language | decimal | 语言流畅度 |
| total_score | decimal | 综合评分 |
| suggestions | JSON | 改进建议列表 |

---

## 六、API 端点汇总

### 认证

```
POST   /auth/login              登录（返回 token）
POST   /auth/register           注册
GET    /auth/me                 获取当前用户信息
POST   /auth/logout             登出
```

### 试卷

```
GET    /paper/list              试卷列表（含用户进度）
GET    /paper/detail/{paperId}  试卷题目列表
```

### 题目

```
GET    /question/{questionId}?withAnswer=false  题目详情
```

### 练习会话

```
POST   /session/start                   开始新会话
GET    /session/{sessionId}             获取会话详情（含题目和答题记录）
POST   /session/submit/{sessionId}      交卷
GET    /session/history                 刷题历史（分页）
```

### 答题记录

```
PATCH  /practice/session/question/record/{recordId}  更新单题答案
```

### 错题

```
GET    /wrong-questions         错题列表（分页）
```

### 论文

```
POST   /essay/submit                    提交论文
GET    /essay/result/{submissionId}     获取批改结果
GET    /essay/history                   论文提交历史
GET    /essay/questions                 可用论文题目列表
```

### 管理后台

```
GET    /admin/dashboard                 仪表盘统计
GET    /admin/users                     用户列表（分页 + 搜索）
PUT    /admin/users/{userId}            编辑用户
DELETE /admin/users/{userId}            删除用户
GET    /admin/questions                 题目列表（多维筛选）
POST   /admin/questions                 新增题目
PUT    /admin/questions/{questionId}    编辑题目
DELETE /admin/questions/{questionId}    删除题目
GET    /admin/questions/subjects        科目列表
GET    /admin/questions/years           年份列表
GET    /admin/questions/months          月份列表
```

### OSS

```
POST   /oss/upload              上传图片（需登录，≤10MB，支持 JPG/PNG/GIF/WebP/SVG）
```

**统一响应格式**

```json
{
  "code": 200,
  "message": "操作成功",
  "data": {},
  "timestamp": 1234567890
}
```

---

## 七、交互状态规范

### 按钮层级

| 层级 | 样式 | 用途 |
|------|------|------|
| 主操作 | 实心深色 | 每个页面最重要的一个操作 |
| 次要操作 | 描边 | 辅助操作 |
| 危险操作 | 红色 | 退出、删除 |
| 禁用 | 降低透明度 | 不可点击状态 |

### 加载状态

- 列表加载：Skeleton 占位（优于纯文字提示）
- 提交中：按钮 loading 状态，防重复点击

### 空状态

- 错题本为空：引导去刷题
- 历史记录为空：引导开始第一次刷题
- 空状态要教用户下一步做什么，不只是「暂无数据」

### 错误状态

- API 失败：红色提示区域，显示错误信息
- 网络异常：Toast 提示

---

## 八、设计优先级

| 优先级 | 页面 | 原因 |
|--------|------|------|
| P0 | 试卷列表 `/papers` | 用户最高频使用，直接影响留存 |
| P0 | 答题页 `/exam/session` | 核心体验，用户停留时间最长 |
| P1 | 首页 `/` | 已有基础，继续打磨 |
| P1 | 结果页 `/exam/result` | 成就感来源，影响复刷意愿 |
| P2 | 登录/注册 `/login` | 转化关键节点 |
| P2 | 错题本 `/wrong-questions` | 差异化功能 |
| P3 | 论文相关页面 | 功能完整但样式粗糙 |

---

## 九、待确认问题（设计师需与产品对齐）

1. **论文写作页编辑器**：是否需要格式工具栏（加粗、段落模板）？还是纯文本输入？
2. **答题页移动端**：答题卡是底部抽屉还是侧滑面板？
3. **错题重要程度**：`low / medium / high / must` 是用户手动标记还是系统自动计算？
4. **个人中心头像**：是从预设图库选择还是支持自定义上传？
5. **论文批改等待**：AI 批改需要时间，等待页面如何设计（轮询 / WebSocket / 跳转后刷新）？
6. **打基础页笔记分类**：笔记按什么维度分类（科目 / 题型 / 备考周次）？GitHub 仓库链接是？
7. **论文案例分类**：论文案例的主题标签有哪些？GitHub 仓库链接是？
