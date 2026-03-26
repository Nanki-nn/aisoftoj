# 知构 · Zhigou Prep

> 把题库、知识点和 AI 分析连成一张备考地图。

`知构（Zhigou Prep）` 是这个项目当前确定的对外产品名，定位为一个面向软考备考场景的智能刷题与学习平台。

当前命名约定：

- 产品名：`知构`
- 英文名：`Zhigou Prep`
- GitHub 仓库名建议：`zhigou-ruankao`

一个面向软考备考的刷题项目，目前仓库包含：

- `aisoftoj-backend`：Spring Boot + MyBatis-Plus 后端服务
- `aisoftoj-front`：React + Vite 前端原型
- `db_schema.sql`：数据库建表脚本

当前项目处于“前后端并行开发”状态：后端已经有试卷、题目、刷题会话相关接口，前端已经有完整的刷题流程 UI，但大部分页面仍基于本地 mock 数据和 `localStorage`，还没有全面切换到真实接口。

## ✨ 当前功能

### 🎨 前端已实现

- 首页试卷列表与筛选
- 历年真题进入练习
- 自定义刷题配置
- 答题会话与交卷结果页
- 登录/注册页原型
- 个人中心、刷题记录、错题页原型

### ⚙️ 后端已实现

- 试卷列表查询
- 试卷题目详情查询
- 单题详情查询
- 开始刷题会话
- 获取刷题会话详情
- 更新题目作答记录
- 交卷并返回结果

## 🧱 技术栈

- 后端：Java 8、Spring Boot 2.7、MyBatis-Plus、MySQL、Hutool
- 前端：React 18、Vite 6、TypeScript、Radix UI、Recharts
- 数据存储：
  - 后端使用 MySQL
  - 前端原型阶段使用本地静态数据和 `localStorage`

## 📁 项目结构

```text
.
├── aisoftoj-backend/                 # Spring Boot 后端
│   ├── src/main/java/com/nan/aisoftoj
│   │   ├── common/                   # 统一异常和响应封装
│   │   ├── config/                   # Web 配置、跨域、静态资源
│   │   ├── consts/                   # 枚举/常量
│   │   ├── controller/               # REST API
│   │   ├── dto/                      # 请求/响应 DTO
│   │   ├── entity/                   # 实体
│   │   ├── mapper/                   # MyBatis-Plus Mapper
│   │   ├── service/                  # 业务层
│   │   └── AisoftojApplication.java  # 启动类
│   └── src/main/resources/
│       ├── application.yml
│       ├── api/
│       └── mapper/
├── aisoftoj-front/                   # React 前端原型
│   ├── src/components/               # 页面和 UI 组件
│   ├── src/data/                     # mock 题库、试卷、记录
│   ├── src/hooks/                    # 前端状态逻辑
│   ├── src/types/                    # 类型定义
│   └── package.json
├── db_schema.sql                     # MySQL 建表脚本
├── pom.xml                           # 根 Maven 聚合工程
└── README.md
```

## 🛠️ 环境要求

- JDK 8
- Maven 3.6+
- MySQL 5.7+ 或 8.x
- Node.js 18+ 和 npm

## 🚀 快速启动

### 1. 🗄️ 初始化数据库

创建数据库：

```sql
CREATE DATABASE aisoftoj DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
```

执行根目录脚本：

```bash
mysql -uroot -p aisoftoj < db_schema.sql
```

### 2. ▶️ 启动后端

默认配置在 [application.yml](/Users/bytedance/aisoftoj/aisoftoj-backend/src/main/resources/application.yml)，当前示例配置为：

- 端口：`8080`
- 数据库：`aisoftoj`
- 用户名：`root`
- 密码：`abc123456`

按实际环境修改数据库连接后启动：

```bash
mvn -pl aisoftoj-backend spring-boot:run
```

也可以进入后端目录启动：

```bash
cd aisoftoj-backend
mvn spring-boot:run
```

启动类： [AisoftojApplication.java](/Users/bytedance/aisoftoj/aisoftoj-backend/src/main/java/com/nan/aisoftoj/AisoftojApplication.java)

### 3. 💻 启动前端

```bash
cd aisoftoj-front
npm install
npm run dev
```

Vite 默认开发地址一般为 `http://localhost:5173`。

## 🔌 接口概览

当前后端主要提供以下接口：

- `GET /paper/list`：获取试卷列表
- `GET /paper/detail/{paperId}`：获取试卷下的题目
- `GET /question/{questionId}`：获取题目详情，可通过 `withAnswer` 控制是否返回答案
- `POST /session/start`：开始刷题会话
- `GET /session/{sessionId}`：获取刷题会话详情
- `PATCH /practice/session/question/record/{questionRecordId}`：更新题目作答记录
- `POST /session/submit/{sessionId}`：提交试卷

相关代码入口：

- [PaperController.java](/Users/bytedance/aisoftoj/aisoftoj-backend/src/main/java/com/nan/aisoftoj/controller/PaperController.java)
- [QuestionController.java](/Users/bytedance/aisoftoj/aisoftoj-backend/src/main/java/com/nan/aisoftoj/controller/QuestionController.java)
- [PracticeSessionController.java](/Users/bytedance/aisoftoj/aisoftoj-backend/src/main/java/com/nan/aisoftoj/controller/PracticeSessionController.java)
- [PracticeSessionQuestionRecordController.java](/Users/bytedance/aisoftoj/aisoftoj-backend/src/main/java/com/nan/aisoftoj/controller/PracticeSessionQuestionRecordController.java)

## 🧪 前端现状说明

这个仓库里的前端目前更接近“高保真原型 + 本地业务流程验证”，有几点需要提前说明：

- 登录注册逻辑在 [useAuth.ts](/Users/bytedance/aisoftoj/aisoftoj-front/src/hooks/useAuth.ts) 中，当前基于 mock 用户和 `localStorage`
- 刷题流程在 [useExamSession.ts](/Users/bytedance/aisoftoj/aisoftoj-front/src/hooks/useExamSession.ts) 中，当前基于本地题库数据
- 试卷、题目、练习记录数据主要位于 `src/data/`
- 前端已经具备后续对接后端 API 的页面基础，但目前不是全链路联调状态

如果接下来继续开发，优先建议先做两件事：

1. 将前端 `src/data/` 中的试卷和题目查询替换为真实接口调用
2. 将登录、刷题记录、错题本统一迁移到后端存储

## 🗃️ 数据库表

`db_schema.sql` 当前主要包含以下核心表：

- `user`
- `paper`
- `question`
- `paper_question_relation`
- `practice_session`
- `practice_session_question_record`

适合支撑试卷管理、题目查询、刷题会话和答题记录。

## ⚠️ 已知情况

- 根目录 Maven 聚合工程当前只纳入了 `aisoftoj-backend`
- 前端目录中包含 `node_modules`，通常不建议提交到仓库
- `application.yml` 里目前是本地开发配置，提交前建议改成环境变量或多环境配置
- 仓库里有一份早期接口文档草稿：`aisoftoj-backend/src/main/resources/api/paper-controller-api.yaml`，内容和当前代码不完全一致，使用时应以控制器代码为准

## 📌 后续可优化方向

- 增加数据库初始化样例数据脚本
- 补充后端单元测试和接口测试
- 补齐前端与后端联调
- 增加鉴权、权限控制和用户体系
- 接入 AI 题目解析与错题推荐能力
