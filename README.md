# 知构软考刷题平台

面向软考备考场景的智能刷题与学习平台，覆盖历年真题练习、错题沉淀、知识库管理和 AI Agent 问答。项目采用前后端分离架构，并将耗时的文档解析、向量检索和 RAG 问答拆分为独立 AI 服务。

## 项目模块

```text
.
├── aisoftoj-front/          # React + TypeScript 前端
├── aisoftoj-backend/        # Spring Boot 业务后端
├── aisoftoj-ai-service/     # FastAPI AI Agent / RAG 服务
├── db_schema.sql            # 核心建表脚本
├── db_init_data.sql         # 初始化样例数据
├── db_migration_ai_chat.sql # AI 对话相关表迁移
└── db_migration_knowledge.sql # 知识库相关表迁移
```

## 核心能力

- 软考真题练习：试卷列表、科目筛选、答题会话、交卷结果、错题本和刷题历史。
- 用户与业务后端：基于 Spring Boot + MyBatis-Plus + MySQL 实现登录注册、试卷题目、练习记录、知识库和 AI 对话 API。
- 知识库入库：支持 PDF、图片、Office、TXT、Markdown 等文档上传，解析后生成 Markdown、content list、chunks 和向量索引。
- RAG Agent 问答：基于 LangGraph 编排查询改写、并行召回、证据判断、联网搜索和答案生成流程。
- 流式交互：FastAPI 生成 SSE 事件流，Java 后端通过 SseEmitter 代理转发给前端，同时完成鉴权、会话持久化和引用落库。

## 技术栈

| 模块 | 技术 |
| --- | --- |
| 前端 | React 18、TypeScript、Vite 6、Tailwind CSS、Shadcn UI、React Router、Recharts、lucide-react |
| 业务后端 | Java 8、Spring Boot 2.7.18、MyBatis-Plus 3.5.5、MySQL、Lombok、Hutool |
| AI 服务 | FastAPI、LangGraph、ARQ、Redis、MinerU 3.3、Qdrant、SearxNG、vLLM/OpenAI 兼容接口 |
| 数据库 | MySQL 5.7+，包含刷题、用户、知识库、文档版本和 AI 对话相关表 |

## AI 服务设计

### 可恢复异步入库

大文件解析和向量化耗时较长，100MB 文档解析约 350s。项目使用 ARQ + Redis 设计可恢复的异步文档入库链路：

```text
Java 保存文档记录和版本
→ FastAPI 接收文件并写入 ARQ 队列
→ ARQ Worker 调用 MinerU 异步解析
→ Redis 持久化 mineru_task_id 和阶段状态
→ 解析结果落盘、切块、向量化并写入 Qdrant
→ AI 服务回调 Java 更新状态
```

任务状态保存在 `knowledge:ingest:{document_id}:{version}`。Worker 或 Java 重启后会优先恢复已有 MinerU task，避免重复提交解析任务；MinerU task 过期或丢失时，再使用 Java 保存的原文件副本重试。

### 切分与索引策略

- 先使用 Markdown 标题层级提取章节路径。
- 再按文档顺序合并同一标题路径下的连续文本块，遇到标题变化或图片、表格等非文本块时截断。
- 合并后的文本使用 `RecursiveCharacterTextSplitter` 做递归滑窗切分，默认 `chunk_size=600`、`chunk_overlap=100`。这里按字符计数，不是 token。
- 切分时优先按段落、换行和中文标点拆分，尽量保留语义边界。
- 图片块会单独落盘并写入 `asset_url`，可用于多模态 embedding 和回答引用。

### 混合检索与 Agent 流程

- Dense 检索：使用 embedding 模型生成 2048 维向量，在 Qdrant 中按 cosine 相似度召回语义相关 chunk。
- Sparse 检索：基于 jieba 分词、`1 + log(count)` 词频权重和 `crc32(token)` 哈希索引构造稀疏向量，补充关键词、编号和专业术语匹配。
- 默认将用户问题改写为 3 路查询；每路在 Qdrant 中进行 dense Top20 + sparse Top20 混合召回，经 RRF 融合后返回 Top20。
- 每路召回结果经过 reranker 重排保留 Top8，多路结果再做 RRF 融合去重，最终取 Top12 作为回答上下文。
- Agent 优先使用知识库证据；证据不足且启用联网时，通过 SearxNG 搜索公开资料补充上下文。

## 快速开始

### 环境要求

- JDK 8+
- Maven 3.6+
- MySQL 5.7+
- Node.js 18+
- Python 3.12+
- Docker / Docker Compose（推荐用于启动 Redis、Qdrant 和 AI 服务）

### 初始化数据库

```bash
mysql -uroot -p -e "CREATE DATABASE aisoftoj DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;"
mysql -uroot -p aisoftoj < db_schema.sql
mysql -uroot -p aisoftoj < db_migration_knowledge.sql
mysql -uroot -p aisoftoj < db_migration_ai_chat.sql
mysql -uroot -p aisoftoj < db_init_data.sql
```

### 启动业务后端

根据本地环境修改 `aisoftoj-backend/src/main/resources/application.yml` 中的数据库、JWT、AI 服务地址和密钥配置，然后运行：

```bash
mvn -pl aisoftoj-backend spring-boot:run
```

默认服务地址：

```text
http://localhost:8080
```

### 启动前端

```bash
cd aisoftoj-front
npm install
npm run dev
```

默认访问地址：

```text
http://localhost:3000
```

### 启动 AI 服务

进入 `aisoftoj-ai-service`，复制环境变量示例并补充 MinerU、Embedding、Reranker、Chat、SearxNG 等服务配置：

```bash
cd aisoftoj-ai-service
copy .env.example .env
docker compose up -d --build
```

也可以本地分别启动 API 和 Worker：

```bash
uv sync
uv run uvicorn aisoftoj_ai.main:app --reload --host 0.0.0.0 --port 8090
uv run arq aisoftoj_ai.worker.WorkerSettings
```

注意保持以下密钥在 Java 后端和 AI 服务中一致：

```text
INTERNAL_API_SECRET = Java ai-service.secret
INTERNAL_CALLBACK_SECRET = Java knowledge callback secret
```

## 主要接口

### 刷题与用户

```text
POST   /auth/login
POST   /auth/register
GET    /auth/me
GET    /paper/list
GET    /paper/detail/{paperId}
POST   /session/start
GET    /session/{sessionId}
POST   /session/submit/{sessionId}
GET    /wrong-questions
```

### 知识库与 AI 对话

```text
GET    /knowledge-bases
POST   /knowledge-bases
POST   /knowledge-documents
POST   /ai/chat/sessions
GET    /ai/chat/sessions
POST   /ai/chat/sessions/{sessionId}/messages/stream
```

### AI 服务内部接口

```text
POST   /api/v1/index/jobs/upload
GET    /api/v1/index/jobs/{job_id}
POST   /api/v1/index/jobs/{job_id}/cancel
POST   /api/v1/retrieval/search
POST   /api/v1/chat/stream
```

浏览器只访问 Java 后端接口；FastAPI、MinerU、Redis、Qdrant、Embedding 和 Reranker 服务不直接暴露给前端。

## 开发与验证

前端构建：

```bash
cd aisoftoj-front
npm run build
```

后端编译：

```bash
mvn -pl aisoftoj-backend -DskipTests compile
```

AI 服务验证：

```bash
cd aisoftoj-ai-service
uv run ruff check . --no-cache
uv run pytest -p no:cacheprovider
docker compose config
```

## 部署注意事项

- 不要提交 `uploads/`、`data/`、`.env`、`node_modules/`、`target/` 等运行产物。
- 生产环境请使用环境变量注入数据库密码、JWT 密钥、AI 服务内部密钥和模型服务地址。
- `uploads/` 和 AI 服务 `data/` 目录需要规划磁盘容量、备份策略和访问控制。
- Java 后端应作为浏览器访问入口，统一处理鉴权、用户权限和内部服务代理。

## License

本项目采用 MIT License，详见 [LICENSE](LICENSE)。
