# 题目内容接口混合加密设计

## 背景

当前用户端题目内容通过普通 JSON 返回。`/paper/detail/{paperId}`、`/question/{questionId}`、`/session/start` 和 `/session/{sessionId}` 会返回题干、选项、答案或解析；论文题目和管理端题目接口也会返回题目内容。部分接口已经要求 JWT 登录，但登录后的调用方仍可直接在网络响应中读取完整 JSON。

本设计在现有 HTTPS、JWT 和业务权限之外增加应用层响应加密，使浏览器 Network 面板、普通代理日志和直接保存的响应体不再出现题目明文。它不是访问控制，也无法阻止能够运行或修改前端代码的调用方在浏览器完成解密后读取数据。

## 目标

- 所有返回题干、选项、标准答案或解析的成功响应使用统一的混合加密协议。
- 每个响应使用独立的随机 AES-256-GCM 密钥和 IV，不在前端构建产物中放置共享密钥。
- AES 密钥使用当前页面临时生成的 RSA-OAEP 公钥包装；私钥不上传服务器，刷新页面后自动轮换。
- 保留现有业务 DTO、统一响应结构、JWT 鉴权和页面交互；解密发生在前端 API 层，对页面组件透明。
- 对缺失、过大或不合法的公钥请求快速失败，并对待加密响应设置确定的大小上限。
- 加密能力集中在可复用的注解、拦截器、加密服务和响应包装层，不在各控制器复制实现。

## 非目标

- 不把前端内置密钥、JWT 或固定字符串当作 AES 密钥。
- 不加密请求体；登录凭据和答题提交继续依赖 HTTPS 保护。
- 不替代 HTTPS、JWT、权限校验或未来的用户/IP 限流。
- 不声称能够阻止高级脚本在前端解密后截获题目。
- 不改变试卷目录、练习历史摘要和普通错误响应的现有 JSON 格式。
- 本次不重构“会话开始时一次返回整套题目、答案与解析”的业务模型。

## 协议

### 浏览器临时密钥

前端第一次发起需要加密响应的请求时，通过 Web Crypto 生成一对 2048 位 RSA-OAEP 密钥：

- 哈希算法为 SHA-256。
- 私钥为不可导出密钥，只保存在当前页面 JavaScript 内存中。
- 公钥导出为 SPKI DER，再使用无填充 Base64URL 编码。
- `generateKey` 参数固定为 `modulusLength: 2048`、`publicExponent: [1, 0, 1]`、`hash: SHA-256`，私钥只允许 `decrypt`，公钥只允许 `encrypt`。
- 密钥生成 Promise 由模块级单例复用，避免并发请求重复生成密钥。
- 页面刷新或新标签页会生成新的独立密钥对，不持久化到 `localStorage`、`sessionStorage` 或 IndexedDB。

需要加密响应的请求携带：

```http
X-Content-Crypto-Version: 1
X-Content-Public-Key: <base64url-spki-public-key>
```

普通 API 请求不携带这两个头，避免所有请求都触发额外的 CORS 预检和密钥初始化。

### 服务端混合加密

对于标记为题目内容响应的方法，服务端在进入控制器前验证请求头：

- 版本必须为 `1`。
- 公钥头不能为空且编码后长度不得超过 1024 个字符。
- 公钥必须是无填充的规范 Base64URL；解码后重新编码必须与原文完全一致。
- 解码后的 SPKI DER 不得超过 512 字节。
- SPKI 必须解析为 `RSAPublicKey`，模数必须恰好为 2048 位，公开指数必须恰好为 65537。

验证后的 `PublicKey` 存入当前请求属性，供响应加密层复用。控制器完成 JWT 和业务权限校验并返回成功结果后：

1. 使用 `SecureRandom` 生成新的 256 位 AES 密钥。
2. 使用 `SecureRandom` 生成新的 12 字节 GCM IV。
3. 将原始 `ResultDTO` 用现有 Jackson `ObjectMapper` 和有界输出流序列化为 UTF-8 JSON；默认最大明文为 8 MiB，由 `app.content-crypto.max-plaintext-bytes` 配置。
4. 使用 `AES/GCM/NoPadding`、128 位认证标签加密 JSON；Java 输出中的密文和认证标签保持组合格式。
5. 使用 `RSA/ECB/OAEPWithSHA-256AndMGF1Padding` 包装 AES 密钥，并显式传入 `OAEPParameterSpec("SHA-256", "MGF1", MGF1ParameterSpec.SHA256, PSource.PSpecified.DEFAULT)`。
6. 二进制字段使用无填充 Base64URL 编码。

服务端返回：

```json
{
  "version": 1,
  "algorithm": "RSA-OAEP-256+A256GCM",
  "encryptedKey": "...",
  "iv": "...",
  "ciphertext": "..."
}
```

并增加：

```http
X-Content-Encrypted: 1
Cache-Control: private, no-store
```

Java 端固定使用 `GCMParameterSpec(128, iv)`。部署运行时必须为 JDK 8u161 或更高版本并启用 unlimited cryptography；应用启动与 CI 都检查 `Cipher.getMaxAllowedKeyLength("AES") >= 256`，不满足时拒绝启动。GCM 认证标签用于验证密文完整性；标签校验失败时前端不得返回部分明文或继续解析。

### 前端解密

前端新增 `requestEncrypted<T>()`，复用现有 `request<T>()` 的鉴权、错误映射和统一响应校验规则：

1. 获取或生成当前页面密钥对，并把版本和公钥请求头附加到请求。
2. 对非 2xx 响应继续读取普通错误 JSON，复用 `ApiRequestError`。
3. 对 HTTP 2xx 且没有加密标记的响应，只有在普通 `ResultDTO.code !== 200` 时按现有业务错误处理；HTTP 2xx、`code === 200` 的成功明文必须失败关闭。
4. 对带 `X-Content-Encrypted: 1` 的响应校验信封版本、算法和字段完整性。
5. 使用 `subtle.decrypt({ name: 'RSA-OAEP' }, privateKey, encryptedKey)` 得到恰好 32 字节的 AES 原始密钥，再用 `subtle.importKey('raw', ..., { name: 'AES-GCM' }, false, ['decrypt'])` 导入。
6. 使用 `{ name: 'AES-GCM', iv, tagLength: 128 }` 解密 `ciphertext`；协议不使用 AAD，认证通过后解析出原始 `ApiResult<T>`。
7. 继续执行现有 `code === 200` 校验，最终只把 `data` 返回页面组件。

解密、认证或 JSON 解析失败统一抛出面向用户的“题目数据安全校验失败，请刷新后重试”，详细异常只在开发环境记录，生产环境不输出密钥或密文。

## 后端组件边界

### `@EncryptedQuestionResponse`

方法级运行时注解，只标记需要题目内容加密的控制器方法。注解是加密范围的唯一来源，不用 URI 字符串匹配，以免路由调整后静默漏加密。

### 公钥校验拦截器

新增 Spring MVC `HandlerInterceptor`：

- 只处理带 `@EncryptedQuestionResponse` 的 `HandlerMethod`。
- 在控制器执行前验证协议版本和 RSA 公钥。
- 把解析后的 `PublicKey` 存入请求属性。
- 缺失或非法输入抛出专用 `InvalidContentCryptoKeyException`，由全局异常处理返回 `400` 普通 JSON。

拦截器通过现有 `WebConfig` 注册，不改变静态资源处理。CORS 必须继续允许 `X-Content-Crypto-Version` 与 `X-Content-Public-Key` 请求头，并通过 `Access-Control-Expose-Headers` 暴露 `X-Content-Encrypted`，使跨域浏览器代码能够读取加密标记。

协议头校验先于当前控制器内的 JWT 校验，因此组合错误的优先级明确为：缺失或非法加密头先返回 `400`；加密头合法后，JWT 无效或权限不足才返回 `401/403`。公钥解析受上述长度、DER、算法、模数和指数限制，不执行 RSA 私钥运算。该顺序通过组合输入测试固定，避免实现者误以为无效 JWT 必然优先。

### 响应加密服务与 Advice

- `QuestionContentEncryptionService` 只负责对象序列化、随机密钥生成和混合加密，输入为原始响应对象与已验证公钥，输出为 `EncryptedContentResponse`。
- `EncryptedQuestionResponseAdvice` 实现 `ResponseBodyAdvice<Object>`，仅支持带注解的控制器方法。
- Advice 只加密 HTTP 2xx 且 `ResultDTO.code == 200` 的成功控制器响应。带注解的方法不得用 HTTP 200 的 `ResultDTO.error(...)` 表达业务错误，应改为抛出由全局异常处理器映射为真实非 2xx 的异常。
- 对防御性遇到的 HTTP 200 内嵌错误，Advice 不加密且不设置加密标记；前端仍按业务错误解析，不把它误报为安全校验失败。
- Advice 必须先完成有界序列化和整个加密信封构造，成功后才设置 `X-Content-Encrypted` 与 `no-store`，最后返回信封。加密异常不得返回原始对象。
- 由全局异常处理器生成的 4xx/5xx 响应没有该注解，保持普通 JSON。加密异常必须在响应尚未提交时由全局异常处理器转换为无加密标记的普通 `500`。

## 接口覆盖范围

| 接口 | 加密原因 |
|---|---|
| `GET /paper/detail/{paperId}` | 返回整套题目实体，包含题干、答案和解析 |
| `GET /question/{questionId}` | 返回单题详情，可包含答案和解析 |
| `POST /session/start` | 返回当前刷题会话的整套 `QuestionDTO` |
| `GET /session/{sessionId}` | 返回续答会话的整套 `QuestionDTO` |
| `GET /essay/questions` | 返回论文题目正文 |
| `GET /essay/history` | `questionTitle` 来自题目 `intro` 的前 100 个字符 |
| `GET /wrong-questions` | `topicName` 来自题目名称，按本设计也属于受保护题目内容 |
| `GET /admin/questions` | 返回管理端题目分页内容、答案和解析 |
| `POST /admin/questions` | 返回新建后的完整题目 |
| `PUT /admin/questions/{questionId}` | 返回更新后的完整题目 |

以下接口保持普通 JSON：

- `/paper/list`：只返回试卷目录和练习状态。
- `/session/history`：只返回试卷与练习摘要，不返回题目名称、题干、答案或解析。
- `/admin/questions/subjects`、`years`、`months`：只返回筛选元数据。
- 题目删除、答题记录更新、交卷和论文提交结果：不返回题目内容。

本设计把题目名称、标题以及从 `intro` 派生的摘要都视为题目内容。新增题目内容接口时，代码评审和测试必须要求显式添加 `@EncryptedQuestionResponse`，否则前端的 `requestEncrypted` 会因收到成功明文而失败关闭。自动测试应收集所有带注解的 Spring 路由，并与上表的精确方法/路径集合做双向相等断言，既防漏标也防误标。

## 前端调用调整

- `startPaperSession()` 和 `continuePracticeSession()` 改用 `requestEncrypted()`。
- `getEssayQuestions()` 改用 `requestEncrypted()`。
- `getEssayHistory()` 和 `fetchWrongQuestions()` 改用 `requestEncrypted()`。
- 管理端 `listAdminQuestions()`、`createAdminQuestion()` 和 `updateAdminQuestion()` 改用 `requestEncrypted()`。
- 当前没有前端调用方的 `/paper/detail` 和 `/question/{id}` 仍在后端强制加密，为将来调用保留安全契约。
- 现有组件、类型映射和业务 DTO 不修改；解密后的数据继续进入现有 `mapQuestion()` 等流程。

## 错误处理与安全边界

- 缺失协议头、公钥过长、非规范 Base64URL、DER 超限、非 RSA 公钥、非 2048 位模数或指数不是 65537：`400` 普通 JSON，并优先于控制器内鉴权。
- 加密头合法后，JWT 无效、账号禁用或权限不足继续返回现有 `401/403` 普通 JSON，不执行响应加密。
- 控制器业务异常：继续由现有全局异常处理返回普通 JSON。
- 序列化明文超过配置的 8 MiB 上限时返回 `413` 普通 JSON；边界值本身允许，超过 1 字节即拒绝。
- 随机数、序列化或加密内部异常：在未设置加密响应头且响应未提交时记录不含敏感数据的服务端错误，并返回通用 `500`；不得回退为成功明文。
- 前端收到成功明文、未知协议版本、未知算法、字段缺失、RSA 解包失败、GCM 认证失败或解密后 JSON 非法：拒绝数据并提示刷新重试。
- 公钥请求头和密文不得写入业务日志；生产日志不得记录解密后的题目响应。
- 应用层加密无法阻止合法客户端提供自己的 RSA 公钥并解密响应，也无法阻止页面运行时截获明文，因此仍需保留现有鉴权，并在后续单独设计限流。

为限制响应构建资源使用，业务层同时采用以下边界：单张试卷或会话最多 200 道题；论文题目列表最多 200 条；论文历史最多返回最近 100 条；管理端和错题分页每页最多 100 条。题目字段按 UTF-8 字节限制为：名称 1 KiB、题干 1 MiB、选项 JSON 512 KiB、答案 64 KiB、解析 1 MiB。管理端写入使用 Bean Validation 拒绝超限字段；读取已有数据时加密服务的 8 MiB 总上限仍是最终保护。超过题目数量或响应总大小时返回 `413`，不得截断题目或悄悄返回部分试卷。

## 兼容性与发布顺序

前后端必须按版本配对发布，避免一端启用加密而另一端仍按普通 JSON 处理。推荐的蓝绿发布流程为：

1. 保留旧前端和旧后端组合在现有 `/api/` 路由，另起新后端实例并暴露版本化 `/api-crypto-v1/` 路由；新后端从启用时就严格要求协议 v1。
2. 构建新前端并将 `VITE_API_BASE_URL` 固定到 `/api-crypto-v1`，完成全链路冒烟测试后再切换新的 `index.html` 流量。
3. 已经打开的旧页面继续访问旧 `/api/`，新页面只访问新后端。旧组合保留 24 小时排空期。
4. 排空期结束后，旧题目内容路由返回 `426 Upgrade Required` 普通 JSON，提示刷新页面；随后下线旧后端。新旧组合不得交叉路由。
5. 新版本故障时，在排空期内把 HTML 流量切回旧前端并保留旧后端；排空期后回滚则必须同时恢复旧前端、旧后端和 `/api/` 路由。

如果当前部署环境无法并行运行两个后端，则必须使用维护窗口：先阻断题目内容请求，再同时替换前后端，恢复后要求用户硬刷新。不得进行会让新旧前后端短暂混用的滚动发布。

部署继续要求 HTTPS。应用层混合加密只保护响应载荷，不能保护 Authorization 请求头、请求路径、提交答案或其他元数据。

## 验证方案

### 后端单元测试

- 使用测试 RSA-OAEP 密钥对调用加密服务，验证 AES 密钥可解包、AES-GCM 可解密且还原后的 JSON 与原始 `ResultDTO` 等价。
- 同一原文和公钥连续加密两次，`encryptedKey`、`iv` 和 `ciphertext` 均不同。
- 修改 IV 或密文任意字节后，GCM 解密必须失败。
- 验证 OAEP 显式使用 SHA-256 与 MGF1 SHA-256，能够与浏览器兼容的参数完成往返。
- 验证缺失版本、公钥缺失、公钥超过 1024 字符、非法 Base64URL、非 RSA 公钥、1024 位 RSA 和未知版本均返回 `400`。
- 验证非规范 Base64URL、解码 DER 超过 512 字节、2048 位但指数不是 65537 的 RSA 公钥均返回 `400`。
- 验证明文序列化大小在上限减 1、恰好等于上限和超过上限 1 字节时分别成功、成功和返回 `413`；题目数量及每个字段限制也覆盖边界值。
- 验证加密服务异常不会返回原始成功对象。

### 控制器与 Advice 测试

- 收集所有带 `@EncryptedQuestionResponse` 的 Spring 路由，与接口覆盖表做精确集合相等断言。
- 带合法公钥调用目标接口时，响应包含 `X-Content-Encrypted: 1`、`Cache-Control: private, no-store` 和完整信封，响应体不包含已知题干、答案或解析明文。
- 缺失公钥调用目标接口时，控制器服务不应执行。
- 验证缺失/非法公钥与无效 JWT 同时出现时返回 `400`；合法公钥与无效 JWT 返回 `401`，管理权限不足返回 `403`。
- 验证带注解方法不得产生 HTTP 200 的 `ResultDTO.code != 200`；防御性构造该情况时，Advice 不加密且前端仍映射为业务错误。
- 验证序列化或加密异常发生时响应仍未提交，最终为无 `X-Content-Encrypted` 的普通 `500`，响应体不包含原始题目。
- `/paper/list` 等非目标接口继续返回现有普通 `ResultDTO`。
- 使用 `Origin` 发起预检与实际请求，验证两个自定义请求头被允许，并且浏览器可读的 `Access-Control-Expose-Headers` 包含 `X-Content-Encrypted`。

### 前端与端到端验证

- 前端增加 Vitest，提供可执行的 `npm test`（`vitest run`）脚本，测试密钥单例、解密、篡改检测、业务错误映射和成功明文失败关闭。
- 增加仓库级 `scripts/test-question-content-crypto-interop.sh`：先运行 Java 测试夹具生成一次性 RSA 私钥、公钥与实际加密服务产生的信封，再在同一次脚本执行中运行 Node Web Crypto 解密该信封。该测试必须使用真实 Java 加密服务，不能由 JavaScript 自行生成密文。
- 验证并发的加密请求只生成一对页面密钥。
- 验证刷新页面后公钥发生变化，私钥未写入任何浏览器持久化存储。
- 验证成功明文、未知版本、未知算法、字段缺失、损坏密文和错误认证标签全部失败关闭。
- 运行 `mvn -pl aisoftoj-backend test` 和前端 `npm run build`。
- 在题库、续答、论文题目和管理端题目页面完成冒烟测试，并确认 Network 面板看不到题干、答案或解析明文。

## 已批准决策

- 使用浏览器临时 RSA-OAEP 密钥与逐响应 AES-256-GCM 密钥的混合加密。
- 加密所有返回题目内容的用户端和管理端成功响应。
- 前端 API 层统一解密，对业务组件保持透明。
- 错误响应保持普通 JSON，成功响应不允许明文回退。
- 本次以响应加密为范围，不同时实现用户/IP 限流或题目按需下发重构。
- 题目名称、标题和从题干派生的摘要也属于需要加密的题目内容。
- 加密协议验证错误优先于当前控制器内的 JWT 错误；合法加密头后仍执行原有鉴权。
- 采用版本化蓝绿部署；不允许新旧前后端交叉组合。
