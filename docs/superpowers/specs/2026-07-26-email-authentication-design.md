# 邮箱验证码认证设计

## 背景

当前邮箱注册只校验格式与唯一性，随后立即创建账号并签发 JWT；邮箱密码登录没有失败频控；“忘记密码”按钮没有行为；项目也没有邮件发送、验证码存储或邮箱所有权验证。用户要求一次完成注册验证码、找回密码和邮箱验证码免密登录，并按可上线标准实现。

## 目标

- 新账号必须通过邮箱验证码后才能注册。
- 已验证邮箱可以通过验证码免密码登录。
- 用户可以通过邮箱验证码重置密码，重置后所有旧 JWT 立即失效。
- 注册、登录、重置三个场景共用一套持久化验证码能力，但验证码不能跨场景使用。
- 对验证码发送、验证码尝试和密码登录请求实施数据库原子限流，保证多进程部署行为一致。
- 使用标准 SMTP 发送邮件，敏感配置只来自环境变量。
- 保持现有邮箱密码登录和 JWT API 调用方式兼容。

## 非目标

- 不实现短信验证码、微信登录或多因素认证。
- 不引入 Redis、外部身份平台或消息队列。
- 不迁移现有 JWT 到 Cookie 会话。
- 不实现管理员手工查看或下发验证码。

## 方案选择

可选方案包括：MySQL 持久化验证码与限流、Redis 存储验证码与限流、外部认证平台托管。当前部署已经依赖 MySQL，尚无 Redis，认证流量规模较小，因此选择 MySQL 方案。它比进程内缓存更可靠，比新增 Redis 或外部平台更符合当前运维复杂度；未来扩容时可以在保持服务接口不变的前提下替换存储实现。

## 数据模型

### `user` 扩展

- `email` 从 64 扩展到 254 字符，保留为展示值。
- `email_normalized varchar(254) null`：`trim + Locale.ROOT 小写`后的登录标识，使用二进制排序规则和唯一索引。
- `email_verified_at datetime null`：邮箱验证完成时间。
- `token_version int not null default 0`：JWT 版本。密码重置时原子递增，JWT 验证时必须与用户当前版本一致。

迁移前必须运行大小写折叠冲突查询；若 `LOWER(TRIM(email))` 相同的现有账号超过一个，迁移停止并由管理员先解决，禁止自动合并学习记录。通过预检后扩容邮箱字段，回填 `email_normalized = LOWER(TRIM(email))` 并建立唯一索引。现有账号把 `email_verified_at` 设置为 `COALESCE(create_time, NOW())`，避免上线后锁死已有用户。新账号同时写入展示邮箱与规范邮箱，只在验证码消费成功的同一事务内创建并写入验证时间。所有认证查询改用 `email_normalized`。

### `auth_email_code`

- `id bigint unsigned` 主键。
- `email varchar(254)`：小写、去首尾空格后的规范邮箱。
- `scene varchar(24)`：`REGISTER`、`PASSWORD_RESET`、`LOGIN`。
- `code_hash char(64)`：使用服务端密钥、随机盐、邮箱、场景和验证码生成的 HMAC-SHA256。
- `code_salt char(32)`：每条验证码独立的随机盐。
- `status varchar(16)`：`PENDING`、`ACTIVE`、`CONSUMED`、`SUPERSEDED`、`FAILED`、`SUPPRESSED`。
- `expires_at datetime null`、`activated_at datetime null`、`consumed_at datetime null`。
- `failed_attempts tinyint unsigned default 0`。
- `request_ip varchar(64)`、`create_time datetime`。
- 建立 `(email, scene, create_time)`、`(request_ip, create_time)`、`expires_at` 索引。

数据库不得保存验证码明文。校验只读取 `ACTIVE`、`failed_attempts < 5` 且未过期记录，并按 `id DESC` 确定最新验证码。消费成功通过带 `status = ACTIVE AND failed_attempts < 5` 条件的原子更新完成。错误验证码使用带相同条件的单条更新原子递增；第 5 次失败同时把状态改为 `FAILED`，之后即使输入正确验证码也不能消费，防止并发重复使用、丢失计数或暴力尝试后恢复。

`SUPPRESSED` 记录写入独立随机的 `code_salt` 和不可匹配的随机 `code_hash`，`expires_at` 保持 `NULL`，不创建发件箱，确保实体字段约束明确且不存在可验证的抑制验证码。

### `auth_email_outbox`

- `id bigint unsigned` 主键，关联 `auth_email_code.id`。
- `email varchar(254)`、`scene varchar(24)`。
- `payload_ciphertext text null`、`payload_iv varchar(32) null`：使用从验证码主密钥派生的 AES-256-GCM 密钥加密验证码；不存明文，发送成功或最终失败后清空。
- `status varchar(16)`：`PENDING`、`SENDING`、`SENT`、`FAILED`。
- `attempt_count`、`next_attempt_at`、`locked_at`、`last_error`、创建与更新时间。

请求接口在同一事务内创建 `PENDING` 验证码和发件箱记录，然后立即返回。定时工作器用条件更新把单条记录从 `PENDING` 抢占为 `SENDING`，支持多实例竞争；创建超过 10 分钟仍未成功发送的任务直接标为 `FAILED`，禁止继续发送陈旧邮件。SMTP 成功后，在同一事务内以当前数据库时间设置 `activated_at`、`expires_at = activated_at + 10 分钟`，把发件箱标为 `SENT`、清空密文、把验证码标为 `ACTIVE`，并把同邮箱同场景其他 `ACTIVE` 记录标为 `SUPERSEDED`。因此邮件中承诺的 10 分钟从成功发送激活时开始计算。进程若在 SMTP 成功后、数据库确认前崩溃，超时的 `SENDING` 会重试发送同一个验证码，不会生成多个不同验证码。最多尝试三次，最终失败时验证码标为 `FAILED`。错误信息只保存截断后的通用分类，不保存邮件正文或凭据。

### `auth_rate_limit`

- `limit_key char(64)` 主键，是服务端 HMAC 后的作用域与身份键，不直接保存邮箱或 IP。
- `counter int unsigned`、`window_start datetime`、`expires_at datetime`、`update_time datetime`。

每次请求把需要获取的所有限流键排序，在同一事务内逐行 `SELECT ... FOR UPDATE`。不存在的行先插入，唯一键竞争后重新加锁；窗口过期则重置，否则原子递增，达到上限返回 HTTP `429`。排序锁定避免多键限流死锁。发送场景同时获取邮箱冷却、邮箱小时额度和 IP 小时额度；密码登录同时获取邮箱与 IP 的 15 分钟尝试额度。并发测试必须证明上限不会被突破。

## 安全策略

- 验证码为 `SecureRandom` 生成的 6 位数字。
- 有效期 10 分钟；同邮箱同场景 60 秒内不能重发。
- 同邮箱同场景每小时最多发送 6 次；同 IP 每小时最多发送 30 次。
- 单个验证码最多失败 5 次；只接受该邮箱与场景下最新且未消费的验证码。
- 密码登录同邮箱 15 分钟最多请求 10 次；同 IP 15 分钟最多请求 50 次，成功和失败都消耗额度，避免校验与失败记录之间的并发窗口。
- 邮箱统一使用 `trim().toLowerCase(Locale.ROOT)`。
- 登录和找回密码发送接口对“不存在、未验证、禁用”账号统一返回成功，并同样获取邮箱/IP 限流、创建 `SUPPRESSED` 验证码记录但不创建发件箱；返回路径不等待 SMTP，避免通过 SMTP 延迟、冷却或额度差异枚举账号。
- 密码登录统一返回“邮箱或密码错误”，不存在账号也执行一次 BCrypt dummy 校验，降低时序差异。
- 注册密码与重置密码统一要求 8～64 位；现有账号的旧密码继续可登录。
- 验证码日志、异常和接口响应不得包含验证码、密码、哈希、SMTP 密码或完整邮件正文。
- 请求 IP 优先使用反向代理覆盖的 `X-Real-IP`，否则使用 `remoteAddr`；生产后端仅监听回环地址。

## 后端接口

### `POST /auth/email/code`

请求：

```json
{ "email": "user@example.com", "scene": "REGISTER" }
```

返回统一成功空数据。注册场景的已注册邮箱返回明确错误；登录与重置场景无论账号是否存在都返回成功。入队前执行数据库原子冷却和小时限流；超限统一返回 HTTP `429` 和不暴露账号状态的提示。

### `POST /auth/register`

现有请求增加 `emailCode`。服务端先检查邮箱与用户名唯一，再在同一事务内消费 `REGISTER` 验证码、创建用户、设置 `email_verified_at` 并返回现有 `AuthResponse`。

### `POST /auth/email/login`

请求：

```json
{ "email": "user@example.com", "code": "123456" }
```

只允许已验证、启用且未删除用户。成功消费 `LOGIN` 验证码并复用现有 JWT 响应。

### `POST /auth/password/reset`

请求：

```json
{
  "email": "user@example.com",
  "code": "123456",
  "newPassword": "new-password",
  "confirmPassword": "new-password"
}
```

在同一事务内消费 `PASSWORD_RESET` 验证码。消费前必须通过 `SELECT ... FOR UPDATE` 锁定规范邮箱对应的用户行，并确认用户仍为已验证、启用且未删除状态，然后更新 BCrypt 密码并递增 `token_version`；用户锁持有至验证码消费和用户更新一起提交，避免管理员并发禁用或删除时穿透状态检查。接口返回成功空数据，用户回到登录页重新登录。

## 邮件发送

- 后端增加 `spring-boot-starter-mail`，通过 `JavaMailSender` 发送纯文本加 HTML 的 multipart 邮件。
- 环境变量包括 `MAIL_HOST`、`MAIL_PORT`、`MAIL_USERNAME`、`MAIL_PASSWORD`、`MAIL_FROM`、`MAIL_FROM_NAME`、`MAIL_SMTP_AUTH`、`MAIL_STARTTLS_ENABLE` 和 `AUTH_EMAIL_CODE_SECRET`。
- `AUTH_EMAIL_CODE_SECRET` 必须是至少 32 字节的高熵随机密钥；应用启动时校验，生产环境缺失或强度不足则拒绝启动。
- 注册、登录和重置使用不同标题与正文，正文显示用途、验证码、10 分钟有效期和非本人操作提示。
- 验证码主密钥通过标签派生独立的 HMAC 与 AES-GCM 密钥；每条发件箱记录使用 12 字节随机 IV 和 128 位认证标签。
- SMTP 发送由持久化发件箱异步完成；发送成功前验证码不可使用，最终发送失败后验证码不可激活。发送尝试仍计入限流，防止利用错误配置绕过频控。
- 本地环境没有邮件配置时接口返回明确的通用配置错误，不在日志输出密钥。

## JWT 兼容

新 JWT 增加 `tokenVersion`。验证时读取用户后比较版本；缺少该声明的上线前旧 JWT 按版本 `0` 兼容。密码重置把用户版本加一，因此旧令牌失效。普通注册、密码登录和验证码登录都继续返回当前 `AuthResponse`，前端存储方式不变。

## 前端体验

### 登录页

- “登录”页内增加“密码登录 / 验证码登录”分段切换。
- 验证码登录包含邮箱、验证码和“获取验证码”按钮；发送后显示 60 秒倒计时。
- 密码登录保留现有表单，“忘记密码”改为进入 `/forgot-password`，不再是无行为按钮。
- 成功登录继续走 `AuthContext` 的统一会话写入和原有返回逻辑。

### 注册页

- 邮箱下增加验证码输入与获取按钮。
- 获取按钮只在邮箱格式有效且不在倒计时时可用。
- 注册提交必须包含验证码；后端是最终校验来源。

### 找回密码页

- 独立路由 `/forgot-password`，依次填写邮箱、验证码、新密码和确认密码。
- 不显示邮箱是否存在；发送操作统一提示“如果该邮箱已注册，验证码将发送到邮箱”。
- 重置成功后返回登录页并显示成功提示。

三个场景共享 `EmailCodeField` 和 `useEmailCodeSender`，统一发送状态、倒计时、错误与可访问标签。页面沿用现有蓝色主操作、白底和紧凑表单样式，不修改 Shadcn `ui/` 文件。

## 迁移与部署

- 更新全量初始化脚本 `db_schema.sql`。
- 增加生产迁移脚本和单独的迁移前冲突检查 SQL，扩展 `user` 并创建三张认证表；已有用户标记为已验证。MySQL 5.7 不支持通用的 `ADD COLUMN IF NOT EXISTS`，脚本通过 `information_schema` 与预处理语句保证重复执行安全。
- 更新开发、生产配置示例和部署文档，所有邮件密钥使用环境变量。
- SMTP 发件地址必须与服务商允许的地址一致；生产发布前通过真实邮箱完成注册、登录和重置冒烟测试。

## 测试

### 后端

- 正确验证码可消费一次，重复消费失败。
- 验证码过期、错误场景、错误邮箱、超过 5 次均失败。
- 60 秒冷却、邮箱小时额度、IP 小时额度和密码登录额度的边界及并发测试。
- 登录与重置发送接口不暴露账号存在性。
- 发件箱成功发送后才从数据库时间开始计算 10 分钟有效期并激活验证码；超过 10 分钟未发送的任务不再发送；失败重试发送同一验证码，最终失败不可验证；同秒创建时仍按 `id DESC` 确定顺序。
- 大小写邮箱统一登录，迁移冲突检查能够阻止碰撞账号自动合并，254 字符边界一致。
- 注册必须消费验证码并设置 `email_verified_at`。
- 验证码登录只允许已验证、启用账号。
- 密码重置更新 BCrypt 密码、递增 `token_version`，旧 JWT 失效。
- 密码重置拒绝已禁用、删除或未验证账号。
- 验证码第 5 次错误原子转为失败状态，随后正确输入仍被拒绝。
- 密码重置锁定用户行，覆盖与管理员禁用/删除并发的测试。
- 密码登录邮箱/IP 原子限流、统一错误和 dummy 校验。
- SMTP 最终失败把验证码标为失败，发件箱不保留可解密载荷。
- 七天前的验证码、已完成发件箱和过期限流记录由每日清理任务删除。

### 前端与回归

- API 请求结构和认证结果写入测试。
- 倒计时卸载时清理，重复点击不重复发送。
- 构建检查所有新路由和 TypeScript 类型。
- 手工完成注册验证码、密码登录、验证码登录、重置密码、旧 JWT 失效和错误验证码状态。
- 运行 `mvn -pl aisoftoj-backend test`、`npm test`、`npm run build`。

## 提交边界

1. 设计规格。
2. 数据库、邮件验证码服务、限流与 JWT 版本。
3. 认证控制器、DTO 与后端测试。
4. 前端注册验证码、免密登录和找回密码。
5. 部署配置、迁移说明与最终回归修正。

## 已批准决策

- 三个邮箱认证流程全部实施，不分阶段等待确认。
- 使用 MySQL 持久化验证码与限流，不新增 Redis。
- 现有账号迁移为已验证，新注册必须验证邮箱。
- 找回密码后使旧 JWT 失效。
- 保留邮箱密码登录，同时增加邮箱验证码免密登录。
- 完成每个逻辑阶段后自动提交，不再请求用户确认。
