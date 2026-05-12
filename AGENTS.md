# 知构软考刷题平台 · 项目规范

## 产品定位

**产品名**：知构软考刷题平台
**定位**：面向软考备考的智能刷题与学习平台（历年真题 + 错题沉淀 + AI 分析）
**GitHub**：https://github.com/Nanki-nn/aisoftoj
**当前状态**：积极开发中，前后端并行推进，大部分页面仍使用 mock 数据，尚未全面联调

---

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 18 + TypeScript + Vite 6，Tailwind CSS，Shadcn UI（Radix UI），Recharts，React Router v7，React Hook Form，lucide-react |
| 后端 | Java 8，Spring Boot 2.7.18，MyBatis-Plus 3.5.5，MySQL，Lombok，Hutool |
| 数据库 | MySQL 5.7+，7 张核心表 |

---

## 项目结构

```
/
├── aisoftoj-front/          # React 前端
│   ├── src/
│   │   ├── components/      # 页面组件 + ui/ (Shadcn)
│   │   ├── data/            # mock 静态数据（examPapers.ts, questions.ts）
│   │   ├── hooks/           # useAuth.tsx, useExamSession.ts
│   │   ├── lib/api.ts       # 所有 API 请求封装，base: http://localhost:8080
│   │   ├── types/           # exam.ts, user.ts, record.ts
│   │   └── App.tsx          # 路由配置
│   └── index.html           # <title>知构软考刷题平台</title>
├── aisoftoj-backend/        # Spring Boot 后端
│   └── src/main/java/com/nan/aisoftoj/
│       ├── controller/      # 6 个 REST 控制器
│       ├── service/impl/    # 业务逻辑
│       ├── mapper/          # MyBatis-Plus Mapper
│       ├── entity/          # 6 个实体类
│       ├── dto/             # 18 个 DTO
│       └── common/          # 全局异常处理、统一响应
├── db_schema.sql            # 建表 + 初始数据脚本
├── pom.xml                  # Maven 聚合工程
└── README.md
```

---

## 前端路由

| 路径 | 组件 | 说明 |
|------|------|------|
| `/` | `ExamHome` | 首页，试卷列表、科目筛选、导航栏 |
| `/login` | `AuthPage` | 登录 / 注册 |
| `/profile` | `ProfilePage` | 个人中心 |
| `/practice-history` | `PracticeHistory` | 刷题历史 |
| `/wrong-questions` | `WrongQuestions` | 错题本 |
| `/exam/config` | `ExamConfig` | 自定义刷题配置 |
| `/exam/session/:id` | `ExamSession` | 答题页面 |
| `/exam/result/:id` | `ExamResult` | 交卷结果页 |

---

## 关键文件速查

| 文件 | 作用 |
|------|------|
| `aisoftoj-front/src/components/ExamHome.tsx` | 主页，含导航栏（倒计时、GitHub Star 按钮）、试卷列表 |
| `aisoftoj-front/src/components/AuthPage.tsx` | 登录/注册，含品牌名展示 |
| `aisoftoj-front/src/hooks/useAuth.tsx` | AuthContext + useAuth hook，认证状态全局管理 |
| `aisoftoj-front/src/hooks/useExamSession.ts` | 考试会话状态管理 |
| `aisoftoj-front/src/lib/api.ts` | 统一 API 调用，含 token 注入 |
| `aisoftoj-front/src/data/examPapers.ts` | 前端 mock 试卷数据，`supportedSubjects`、`supportedCategories` 从此导出 |
| `aisoftoj-backend/.../controller/AuthController.java` | 认证接口（/auth/login, /auth/register, /auth/me） |
| `aisoftoj-backend/.../common/GlobalExceptionHandler.java` | 统一异常处理 |
| `aisoftoj-backend/src/main/resources/application.yml` | 后端配置（port 8080，db: aisoftoj，user: root/abc123456） |

---

## 后端 API 端点

```
POST   /auth/login                                        登录
POST   /auth/register                                     注册
GET    /auth/me                                           获取当前用户
POST   /auth/logout                                       登出

GET    /paper/list                                        试卷列表
GET    /paper/detail/{paperId}                            试卷题目列表

GET    /question/{questionId}?withAnswer=false            题目详情

POST   /session/start                                     开始刷题会话
GET    /session/{sessionId}                               获取会话详情
POST   /session/submit/{sessionId}                        交卷
GET    /session/history                                   刷题历史

PATCH  /practice/session/question/record/{recordId}       更新答题记录

GET    /wrong-questions                                    错题列表
```

**统一响应格式**：
```json
{ "code": 200, "message": "操作成功", "data": {}, "timestamp": 1234567890 }
```

---

## 数据库核心表

| 表名 | 说明 |
|------|------|
| `user` | 用户（email/login_name 唯一，password BCrypt） |
| `paper` | 试卷（year, month, subject_name, paper_cate_id: 1综合/2案例/3论文） |
| `question` | 题目（intro longtext, options JSON, question_type: 1单选/2多选/3判断/4填空/5案例/6论文） |
| `paper_question_relation` | 试卷-题目 多对多 |
| `practice_session` | 练习会话（status: 0进行中/1已完成, exam_mode: practice/exam） |
| `practice_session_question_record` | 答题记录（user_answer, is_correct, spend_time） |
| `user_wrong_question_stat` | 错题统计（error_count, importance_level: low/medium/high/must） |

所有表通用字段：`is_deleted`（软删除）、`create_time`、`update_time`

---

## 开发命令

```bash
# 前端（端口 3000）
cd aisoftoj-front && npm install && npm run dev

# 后端（端口 8080）
mvn -pl aisoftoj-backend spring-boot:run

# 数据库初始化
mysql -uroot -p -e "CREATE DATABASE aisoftoj DEFAULT CHARSET utf8mb4;"
mysql -uroot -p aisoftoj < db_schema.sql
```

---

## 当前开发状态与优先级

**已完成**：
- 前端：完整 UI 流程（首页→配置→答题→结果），登录/注册原型，个人中心/错题/历史原型
- 后端：试卷、题目、会话、答题记录、用户认证全套接口
- 数据库：完整建表 + 初始样例数据

**待联调（优先级排序）**：
1. 前端 `src/data/` mock 数据 → 替换为真实 API 调用
2. 登录/注册打通（`useAuth` 对接 `/auth/login`）
3. 刷题记录、错题本迁移到后端存储
4. 接入 AI 题目解析与错题推荐

**已知问题**：
- 前端 `node_modules` 误提交入仓库（建议加入 `.gitignore`）
- `application.yml` 为本地开发配置，生产需改为环境变量
- Tailwind 任意值（如 `bg-[#xxx]`）可能不被 JIT 识别，改用 inline style 或标准类

---

## UI / 样式约定

- 整体风格：白色/浅蓝渐变背景 + 玻璃态（`bg-white/70 backdrop-blur-sm`）
- 主色：蓝色 (`blue-600`)，辅助：琥珀色 (`amber-*`)，文字：`slate-*`
- 图标库：`lucide-react`（已用到：GraduationCap、Calendar、Star、Github 等）
- UI 组件：Shadcn UI（位于 `src/components/ui/`），**不直接修改 ui/ 内的文件**
- Tailwind 任意值不稳定，颜色优先用标准 Tailwind 类或 inline `style`
