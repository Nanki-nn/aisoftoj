# 微信小程序学生端实施计划

## 交付目标

按 `docs/superpowers/specs/2026-08-05-wechat-mini-program-design.md` 实现微信小程序学生端，覆盖微信登录与邮箱账号绑定、综合知识和案例分析、练题/考试、恢复、交卷、结果、历史、错题和个人中心。管理员与 AI 论文不进入首版。

实施遵循“先修后端合同，再做小程序纵切”的顺序。现有 Web 与小程序共同依赖的会话、答案可见性和判分合同必须先稳定，不能靠小程序 UI 绕过后端缺口。

## 工作区约束

- 开工前运行 `git status --short`，记录并保留现有未提交的后端配置、Flyway、pnpm 和部署文件。
- 不覆盖 `aisoftoj-front/pnpm-lock.yaml`、`aisoftoj-front/pnpm-workspace.yaml` 或 `aisoftoj-backend/src/main/resources/db/migration/` 中用户已有改动。
- 每个逻辑阶段独立提交，只暂存本阶段文件。
- `.loopx/` 与 `.codex/goals/` 保持忽略，不进入 Git。
- 数据库结构同时更新 Flyway 和 `db_schema.sql`，但生产只以 Flyway 为准。

## 阶段 0：基线与数据预检

### Task 0.1：建立后端合同基线测试

涉及文件：

- `aisoftoj-backend/src/test/java/com/nan/aisoftoj/service/impl/PracticeSessionServiceImplTest.java`
- 新增 session controller/service 集成测试类
- 现有测试夹具和测试配置

步骤：

1. 为当前行为补回归测试：并发开始可能重复、完成会话仍可被 PATCH、考试详情包含答案、案例被判错。
2. 将预期安全行为写为失败测试，证明后续修改修复的是真实缺口。
3. 记录当前 MySQL/H2 测试差异；生成列和 Flyway 必须另用真实 MySQL 5.7 验证。

验证：

```bash
mvn -pl aisoftoj-backend -Dtest=PracticeSessionServiceImplTest test
```

完成条件：每个 P0 合同至少有一个先失败的自动测试。

### Task 0.2：实现迁移 dry-run 预检工具

涉及文件：

- `aisoftoj-backend/src/main/resources/db/preflight/` 下新增只读 SQL
- `aisoftoj-backend/src/main/resources/db/repair/` 下新增显式 dry-run/apply SQL
- `docs/` 中的迁移运行说明

步骤：

1. 检测重复活动会话、重复 session-question、重复错题业务键。
2. 检测题目类型/判分策略、关系数量、`paper.question_total` 和关系顺序问题。
3. dry-run 输出 ID、计数和冲突分类，不输出邮箱、OpenID、答案或题目正文。
4. 自动修复只处理无歧义记录；双方都有不同非空答案时停止并要求人工选择。

验证：在脱敏的 MySQL 5.7 快照上执行 dry-run，确认零写入。

提交：`test(session): capture mini-program contract gaps`

## 阶段 1：数据库与稳定会话快照

### Task 1.1：新增 V5 Flyway 迁移

涉及文件：

- `aisoftoj-backend/src/main/resources/db/migration/V5__wechat_mini_program_session_foundation.sql`
- `db_schema.sql`
- `aisoftoj-backend/src/main/java/com/nan/aisoftoj/entity/PracticeSession.java`
- `aisoftoj-backend/src/main/java/com/nan/aisoftoj/entity/PracticeSessionQuestionRecord.java`
- `aisoftoj-backend/src/main/java/com/nan/aisoftoj/entity/Question.java`
- 试卷关系实体/Mapper
- `aisoftoj-backend/src/main/java/com/nan/aisoftoj/entity/UserWrongQuestionStat.java`

迁移内容：

1. `paper_question_relation.order_num`，按 relation ID 回填。
2. `question.grading_strategy`，按 question_type 回填。
3. `practice_session.active_marker` 生成列、活动唯一索引、`submission_id`、`merged_into_session_id` 和 `MERGED` 状态合同。
4. session-question 的 relationId、questionOrder、scoreSnapshot、gradingStrategySnapshot、answerRevision、lastMutationId、confirmedAt。
5. `user_answer` 改为可空 TEXT，无默认值。
6. `(session_id, question_id)` 唯一键。
7. wrong-question 的 activeMarker、`last_session_id` 和 `(user_id, question_id, active_marker)` 唯一键。

实现注意：如果合入时 V5 已占用，先重编号；不得修改已发布的 Flyway 文件。

### Task 1.2：稳定题目枚举和发布合同

涉及文件：

- `QuestionMapper.java`
- `PaperServiceImpl.java`
- `PracticeSessionServiceImpl.java`
- 管理端题目/试卷服务

步骤：

1. 题目查询显式 `ORDER BY pqr.order_num, pqr.id`。
2. 会话初始化写 relation、顺序、分值和判分策略快照。
3. 详情和提交只读取会话题目记录，不重新枚举当前 paper relation。
4. 管理端禁止修改已发布或已有会话引用的题目合同，返回 `409`；后续内容更新使用复制版本。
5. 发布时重算并验证 `question_total`。

验证：题库关系顺序改变或后台尝试编辑后，既有会话题序和分值保持不变。

提交：`feat(session): persist stable question snapshots`

## 阶段 2：统一判分、答案版本和不可变交卷

### Task 2.1：抽取统一判分服务

新增/修改：

- 新增 `GradingStrategy` 枚举
- 新增 `GradingService`
- `PracticeSessionServiceImpl.java`
- `PracticeSessionQuestionRecordServiceImpl.java`
- 判分单元测试

步骤：

1. 实现 EXACT_CHOICE、SET_CHOICE、ORDERED_BLANKS 和 MANUAL。
2. 填空按 `||` 顺序、trim 和 NFKC 比较。
3. 使用 scoreSnapshot 计分。
4. MANUAL 始终 `isCorrect = null`，不写错题。
5. PATCH 和 submit 共用同一服务。
6. 两个入口都按 code point 限制答案 10,000 字，超限返回 `422`。

### Task 2.2：版本化 PATCH 与练题确认

涉及文件：

- `UpdateQuestionRecordDTO.java`
- `PracticeSessionQuestionRecordController.java`
- `PracticeSessionQuestionRecordServiceImpl.java`
- Mapper 条件更新/锁定查询
- Web `src/lib/api.ts` 和 `ExamSession.tsx`

步骤：

1. 请求增加 expectedRevision、mutationId 和 confirm。
2. 事务锁定用户、会话和记录；完成/合并会话拒绝写入。
3. 相同 mutationId 幂等返回；revision 不匹配返回 `409` 当前状态。
4. 普通保存只写草稿；练题确认后判分、设置 confirmedAt 并禁止继续修改。
5. Web 改为使用新合同，防止小程序上线前破坏现有刷题。

### Task 2.3：并发安全的开始与交卷

涉及文件：

- `PracticeSessionServiceImpl.java`
- `PracticeSessionMapper.java`
- `PaperSubmitRequest.java`
- `PaperSubmitResponse.java` 或新 `SessionResultDTO`
- `PracticeSessionController.java`

步骤：

1. start 依赖活动唯一索引；重复键重新读取活动会话。
2. submit 接收 submissionId 和完整答案。
3. submit 锁定用户、会话和全部记录；第一份提交完成后结果不可修改。
4. 已完成重复提交返回持久化结果，不重复错题。
5. 新增 `GET /session/{id}/result` 和 `GET /session/active`。
6. wrong-question 使用唯一业务键原子 upsert 并维护 lastSessionId。

验证：并发 start、并发 submit、响应丢失重试、submit 后迟到 PATCH、乱序多设备 PATCH。

提交：`feat(session): make answer writes and submission idempotent`

## 阶段 3：服务端答案可见性

### Task 3.1：按会话状态裁剪题目 DTO

涉及文件：

- `QuestionDTO.java`
- session start/detail/result DTO 与映射器
- `PracticeSessionController.java`
- `QuestionController.java`
- `PaperController.java`

步骤：

1. 进行中考试省略 answer、analysis 和 isCorrect。
2. 进行中练题只对 confirmedAt 非空记录返回答案和解析。
3. 完成会话只通过 result endpoint 返回完整复盘。
4. `/question?withAnswer=true` 改为管理员权限。
5. 普通 `/paper/detail` 永不返回答案与解析。
6. 为全部旁路增加控制器测试。

### Task 3.2：升级 Web 合同

涉及文件：

- `aisoftoj-front/src/lib/api.ts`
- `ExamSession.tsx`
- `ExamResult.tsx`
- `useExamSession.ts`
- Vitest 测试

验证：练题确认、考试交卷、冷启动结果恢复和题目加密均通过。

提交：`feat(exam): enforce server-side answer visibility`

## 阶段 4：微信身份和账号合并

### Task 4.1：微信登录

新增/修改：

- WeChat properties、HTTP client、DTO 和异常
- `AuthController.java`
- `AuthService` / `AuthServiceImpl`
- `UserMapper.java`
- 配置示例与测试

步骤：

1. 后端用 code 换 OpenID，AppSecret 只读环境变量。
2. IP 前置限流，OpenID 后置限流。
3. 只为启用普通 USER 签发 JWT；管理员/删除/禁用账号拒绝。
4. 新 OpenID 创建 wx-only USER，不请求昵称头像权限。

### Task 4.2：BIND_EMAIL 场景

涉及文件：

- `EmailCodeScene.java`
- `EmailCodeServiceImpl.java`
- 绑定 DTO/接口/测试

步骤：

1. 新邮箱和正常普通账号发送可消费验证码。
2. 管理员、禁用、删除、未验证账号统一 SUPPRESSED。
3. 复用现有限流与发件箱，不泄露账号状态。

### Task 4.3：事务化账号合并

步骤：

1. 固定顺序锁定两用户并校验 wx-only USER -> verified USER。
2. 处理活动会话冲突和错题 canonical upsert。
3. 临时用户先清空 OpenID，再写主账号，最后失效并软删除临时用户。
4. 响应丢失后通过重新微信登录恢复主账号。
5. 覆盖并发练习写入、唯一约束、管理员目标和事务回滚测试。

提交：`feat(auth): add WeChat login and safe email account merge`

## 阶段 5：JavaScript workspace 与小程序纵切

### Task 5.1：建立根 workspace 与共享 core

涉及文件：

- 根 `package.json`、`pnpm-workspace.yaml`、锁文件
- `packages/core/`
- 调整 Web package workspace 引用
- CI 构建命令

先合并用户现有 pnpm 配置意图，禁止机械覆盖。

### Task 5.2：创建 `aisoftoj-mini`

包含 Taro + React + TypeScript、页面配置、4 个 Tab、主题变量、请求和 storage adapter。首版不引入 Radix、Shadcn、React Router 或大型全局状态库。

### Task 5.3：加密与富文本技术验证

1. 实现 MiniProgramContentCrypto adapter。
2. 与真实 Java 协议做 RSA-OAEP/AES-GCM 互操作。
3. 测试篡改、成功明文失败关闭、包体和真机随机数。
4. 实现安全富文本节点转换和 HTTPS 图片域名检查。

### Task 5.4：完成登录到结果纵切

页面顺序：登录 -> 试卷 -> 配置 -> 会话 -> 结果。覆盖客观题和至少一道案例题、版本冲突和恢复。

提交：`feat(miniapp): deliver encrypted practice vertical slice`

## 阶段 6：完整学生端与发布

### Task 6.1：剩余页面

- 首页继续练习和统计。
- 错题列表与 lastSessionId 原题定位。
- 刷题历史与冷启动结果。
- 我的、邮箱绑定、退出和隐私入口。

### Task 6.2：恢复与真机回归

- 切后台、杀进程、弱网、断网和同步重试。
- iOS、Android 与微信开发者工具。
- Web 全回归、MySQL 5.7 迁移、后端测试、Web/小程序构建。

### Task 6.3：提审准备

- HTTPS 合法域名、隐私说明、AppID/AppSecret 环境配置。
- 版本号、体验版、审核说明和故障回退开关。

提交：`feat(miniapp): complete student workflows and release readiness`

## 全量验证命令

最终命令以实际 workspace 脚本为准，至少包括：

```bash
mvn -pl aisoftoj-backend test
cd aisoftoj-front && pnpm test && pnpm build
pnpm --filter @aisoftoj/core test
pnpm --filter aisoftoj-mini test
pnpm --filter aisoftoj-mini build:weapp
```

另行执行 MySQL 5.7 Flyway 升级/恢复测试和微信真机冒烟，二者不能由 H2 或 Web 构建替代。

## 阶段验收与停线规则

- 任一阶段发现会破坏已有 Web 数据或需要生产凭据，停止并记录明确 blocker，不扩大权限。
- 迁移预检存在非空答案冲突时不得自动选择。
- 加密协议无法在小程序真机安全运行时停止纵切，不降级成功明文。
- 微信平台凭据、真实邮箱和生产发布由用户提供或明确授权；本计划不自行操作生产。
- 每个完成的 LoopX Todo 必须附带验证证据、状态 writeback 和下一 Todo 或无后续理由。
