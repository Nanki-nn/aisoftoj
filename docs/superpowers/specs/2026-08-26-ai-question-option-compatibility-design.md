# AI 题目选项兼容解析设计

## 背景

AI 服务读取题目 `1027` 时，Java 内部接口返回 HTTP 200，但 Python 客户端报
`PLATFORM_INVALID_RESPONSE`。题目数据中的选项使用 `key`、`text` 字段，Java
当前只按旧格式 `keyStr`、`valueStr` 解析，导致内部接口输出空字段，无法通过
Python 的严格响应校验。

## 目标

- Java AI 只读接口兼容 `key`/`text` 与 `keyStr`/`valueStr` 两种选项格式。
- 不修改数据库现有数据，不执行迁移。
- 不改变 AI 内部接口的响应结构；仍输出 `key` 和 `content`。
- 不影响现有前端答题接口。

## 方案

仅修改 `AiPlatformReadServiceImpl` 的私有选项解析逻辑。该逻辑直接读取选项 JSON
对象并生成 `AiQuestionOptionDTO`，不再借用公开答题接口使用的 `Option` DTO。这样
兼容行为被限制在 AI 只读投影层，不会改变公共 DTO 的序列化结果或其他答题流程。

优先级如下：

- 选项标识：优先 `key`，其值为 `null`、空字符串或纯空白时回退到 `keyStr`。
- 选项内容：优先 `text`，其值为 `null`、空字符串或纯空白时回退到 `valueStr`。

新旧字段同时存在且新字段非空时，以新字段为准。保留当前按 `orderNum` 排序、缺少
排序号的选项排在最后的行为。缺少选项数据的非选择题仍返回空列表。

## 错误处理

本次修复不放宽 Python 端校验，也不用空字符串掩盖完全损坏的数据。如果新旧字段
都缺失，Java 仍会输出无效字段，Python 会继续以 `PLATFORM_INVALID_RESPONSE`
拒绝该响应，从而保留现有的失败关闭行为。

## 测试

为 `AiPlatformReadServiceImpl` 增加单元测试，通过公开的 `getQuestion` 方法分别构造：

1. 使用 `key`、`text` 的当前数据库格式，验证 AI DTO 输出正确。
2. 使用 `keyStr`、`valueStr` 的旧格式，验证兼容回退不回归。
3. 新旧字段同时存在，并让部分新字段为空白，验证优先级和回退规则。

测试同时验证题目基本字段、选项顺序与选项内容。由于公共 `Option` DTO 不变，公开
接口响应契约不会受到本次修改；现有后端测试用于覆盖该回归边界。最后运行后端相关
单元测试，并在本地服务重启后重新请求题目 `1027` 验证实际链路。

## 非目标

- 不迁移或重写 `question.options` 历史数据。
- 不改变公开题目 API、Python 模型或前端类型。
- 不进行与选项兼容无关的重构。
