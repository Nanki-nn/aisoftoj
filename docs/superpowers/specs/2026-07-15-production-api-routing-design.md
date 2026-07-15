# 知构软考生产 API 同源路由设计

日期：2026-07-15

状态：已确认，待实施

范围：生产前端 API 基址、Nginx 静态资源与反向代理、生产后端监听地址、开发环境 CORS 方法、部署说明与验收

## 1. 背景与目标

当前前端在开发环境默认请求 `http://localhost:8080`，生产环境如果没有设置 `VITE_API_BASE_URL` 则使用空字符串；生产环境变量示例则建议独立 API 域名。仓库没有可直接使用的 Nginx 配置，已有上线说明中的 `/api/` 代理也没有明确处理后端实际不存在 `/api` 前缀的问题。此外，Vite 实际输出目录是 `build/`，而旧说明使用了 `dist/`。

本次改造采用单域名、同源 API：

- 浏览器访问 `https://example.com/` 获取 React 静态页面。
- 浏览器请求统一使用 `https://example.com/api/**`。
- Nginx 将 `/api/` 前缀剥离后转发到 `127.0.0.1:8080`。
- Spring Boot 的 Controller 路径保持 `/auth`、`/paper`、`/admin` 等现状，不增加后端 context path。
- 本地 Vite 开发继续请求 `http://localhost:8080`，不改变开发命令。
- 生产后端只监听回环地址，不直接暴露 8080。

本次不实施限流、验证码、Redis 或其他防滥用功能。论文现有数据库每日配额保持不变。

## 2. 方案选择

采用“Nginx 外部 `/api` 前缀 + 转发时剥离前缀”。

不采用独立 `api.example.com`，因为它会增加 DNS、证书和 CORS 配置；也不采用 Spring Boot `context-path=/api`，因为它会改变后端所有接口、本地开发和现有测试。Nginx 剥离前缀能够让公网路径清晰统一，同时保持后端和开发环境兼容。

关键映射示例：

| 浏览器请求 | 后端收到 |
|---|---|
| `/api/auth/login` | `/auth/login` |
| `/api/paper/list` | `/paper/list` |
| `/api/practice/session/question/record/1` | `/practice/session/question/record/1` |
| `/api/admin/dashboard` | `/admin/dashboard` |
| `/api/oss/upload` | `/oss/upload` |

该映射依赖 Nginx 中 `location /api/` 与带尾斜杠的 `proxy_pass http://127.0.0.1:8080/;`。实施和审查不得移除 `proxy_pass` 的尾斜杠。

## 3. 前端配置

### 3.1 API 基址

`aisoftoj-front/.env.production.example` 修改为：

```env
VITE_API_BASE_URL=/api
```

`src/lib/api.ts` 保持现有选择逻辑：

- 显式 `VITE_API_BASE_URL` 优先；
- 开发模式未配置时使用 `http://localhost:8080`；
- 生产构建必须通过生产环境文件或构建环境提供 `/api`。

不把正式域名硬编码进源码。所有已有 `request('/auth/...')`、论文请求和 multipart OSS 上传都会自然组合为 `/api/**`。

### 3.2 构建产物

继续使用 Vite 的 `outDir: 'build'`。部署时将 `aisoftoj-front/build/` 目录中的内容复制到服务器 `/var/www/aisoftoj/`，使 `/var/www/aisoftoj/index.html` 直接存在；不要复制成 `/var/www/aisoftoj/build/index.html`。

## 4. 后端配置

### 4.1 生产监听地址

`application-prod.yml` 增加：

```yaml
server:
  address: ${SERVER_ADDRESS:127.0.0.1}
```

生产环境默认只监听回环地址。根目录 `.env.production.example` 显式增加：

```env
SERVER_ADDRESS=127.0.0.1
```

开发 profile 不增加地址限制，继续允许本机 Vite 直接访问 8080。阿里云安全组和主机防火墙均不开放 8080。

### 4.2 CORS

生产请求同源，不依赖 CORS。现有 CORS 配置仍服务本地前后端分端口开发，并在允许方法中补充 `PATCH`，与答题记录更新接口一致：

```text
GET, POST, PUT, PATCH, DELETE, OPTIONS
```

生产 `CORS_ALLOWED_ORIGINS` 继续设置为站点的精确 HTTPS Origin，不使用 `*`。

## 5. Nginx 配置

新增模板：

`deploy/nginx/aisoftoj.conf.example`

模板包含一个 HTTP `server` 块，`server_name` 使用明确占位值 `your-domain.example`，由部署者替换。HTTPS 证书由后续 Certbot 或阿里云证书流程写入，本规格不提交真实域名和证书路径。

### 5.1 全局服务器规则

- `root /var/www/aisoftoj;`
- `index index.html;`
- `client_max_body_size 12m;`，为 multipart 头留出空间；Spring Boot 仍执行 10 MB 文件上限。
- 访问日志和错误日志使用系统 Nginx 默认位置，不在仓库硬编码用户目录。

### 5.2 API 代理

使用 `location ^~ /api/`，避免以 `.png` 等后缀结尾的 API 路径被静态资源正则接管。

要求：

- `proxy_pass http://127.0.0.1:8080/;`，尾斜杠负责剥离 `/api/`。
- `proxy_http_version 1.1`。
- 传递 `Host`、`X-Real-IP`、`X-Forwarded-Proto`。
- `X-Forwarded-For` 使用 `$remote_addr` 覆盖客户端传入值，避免伪造转发链。
- 连接超时 5 秒，读取和发送超时 120 秒。
- 不启用 Nginx API 响应缓存。

精确路径 `/api` 使用 308 重定向到 `/api/`，不交给 SPA 回退。

### 5.3 本地上传兼容

使用 `location ^~ /uploads/` 转发到 `http://127.0.0.1:8080/uploads/`。虽然当前管理上传使用 OSS，该规则保证后端已有 `FILE_UPLOAD_URL_PREFIX=/uploads/` 配置在生产同域名下仍可访问。

该位置同样覆盖转发头，不启用静态资源长期缓存。路径前缀和 `proxy_pass` 均保留尾斜杠。

精确路径 `/uploads` 使用 308 重定向到 `/uploads/`，不能落入 SPA 回退。

### 5.4 前端静态资源与 SPA

- `location ^~ /assets/`：只服务 Vite 哈希资源，文件不存在返回 404；设置一年过期时间和 `Cache-Control: public, immutable`。
- `location = /index.html`：设置 `Cache-Control: no-cache, no-store, must-revalidate`。
- `location /`：使用 `try_files $uri $uri/ /index.html`，确保直接访问 `/login`、`/admin`、`/papers` 等 React Router 路由时返回 SPA 入口。
- `/api/**` 和 `/uploads/**` 因为使用 `^~` 独立处理，不能落入 SPA 或静态资源规则。

## 6. 部署说明

新增 `deploy/README.md`，记录以下步骤：

1. 使用 `VITE_API_BASE_URL=/api npm run build` 生成前端。
2. 将 `build/` 内容同步至 `/var/www/aisoftoj/`。
3. 将后端 JAR 和生产环境变量部署到服务器。
4. 后端使用 `prod` profile 并监听 `127.0.0.1:8080`。
5. 复制 Nginx 模板到 `/etc/nginx/conf.d/aisoftoj.conf`，替换域名。
6. 执行 `nginx -t`，成功后 reload。
7. HTTPS 配置完成后，将 `CORS_ALLOWED_ORIGINS` 设置为最终 HTTPS Origin。
8. 安全组仅开放维护所需 SSH、80 和 443，不开放 8080 与 3306。

文档使用 `build/`，不再出现 `dist/`。文档不包含真实密码、AccessKey、域名或证书内容。

## 7. 错误与边界行为

- 后端未启动：`/api/**` 返回 Nginx 502，不回退到 React 页面。
- API 路径不存在：返回后端 404，不返回 `index.html`。
- 静态哈希文件不存在：返回 Nginx 404，不回退 SPA。
- React 客户端路由不存在于磁盘：返回 `index.html`，由 React Router 处理。
- 上传请求整体超过 12 MB：由 Nginx 返回 413；文件超过后端 10 MB 限制但请求未超过 Nginx 限制时，由后端返回现有参数错误。
- `/uploads/**` 后端不可用：返回 502，不回退 SPA。
- 本地开发仍跨端口；`PATCH` 预检必须通过。

## 8. 测试与验收

### 8.1 自动检查

- `npm run build` 成功。
- 使用 `VITE_API_BASE_URL=/api npm run build` 成功。
- 构建后检查 `build/assets/*.js`，确认生产主包包含 `/api` 基址；如果未找到则验收失败，不能仅凭构建退出码判断配置正确。
- Maven 测试和 `clean package` 成功。
- 若本机安装 Nginx，则模板替换测试域名后执行 `nginx -t`；否则在阿里云服务器部署前必须执行。

### 8.2 路由验收

在生产式 Nginx 环境验证：

1. `GET /` 返回前端 `index.html`。
2. 直接访问 `/login`、`/papers` 和 `/admin` 均返回前端应用，不是 Nginx 404。
3. `GET /assets/<真实哈希文件>` 返回 200 和长期不可变缓存头。
4. 不存在的 `/assets/missing.js` 返回 404。
5. `GET /api/paper/list` 返回后端 HTTP 200 JSON。
6. `POST /api/auth/login` 能登录并返回角色字段。
7. 未登录 `GET /api/admin/dashboard` 返回后端 HTTP 401 JSON，不返回前端 HTML。
8. 普通用户 `GET /api/admin/dashboard` 返回后端 HTTP 403 JSON。
9. `PATCH /api/practice/session/question/record/{id}` 能到达后端；本地开发的 PATCH CORS 预检也成功。
10. `/api/not-found` 返回后端 404，不返回 SPA。
11. `/uploads` 返回 308 并指向 `/uploads/`；`/uploads/not-found` 不返回 SPA。
12. 浏览器网络面板中的登录、试卷目录等生产请求以 `/api/` 开头，不直接请求根路径 `/auth` 或 `/paper`。
13. 从公网无法直接连接 8080 和 3306。

### 8.3 回归检查

- 登录、注册、试卷目录、开始会话、答题记录更新、交卷、错题、历史、论文和后台请求都使用 `/api` 前缀。
- OSS multipart 上传不被默认 JSON Content-Type 污染，仍能通过 `/api/oss/upload` 到达后端。
- 本地 `npm run dev` 无需 `.env` 即可继续请求 `http://localhost:8080`。

## 9. 回滚

- 前端回滚为上一个构建，并恢复此前的 `VITE_API_BASE_URL`。
- Nginx 配置恢复前先执行 `nginx -t`，再 reload。
- 后端 Controller 和数据库没有因本改造改变，路由层回滚不涉及数据迁移。
- `server.address` 可通过 `SERVER_ADDRESS` 临时覆盖，但生产不应以公开监听 8080 作为长期方案。

## 10. 非目标

本轮不包含：

- 登录、注册、API、OSS 或 AI 限流；
- 验证码、Redis、WAF 或防爬策略；
- 修改论文每天 3 次的现有配额；
- 修改任何后端 Controller 路径；
- 独立 API 子域名；
- Docker、负载均衡或多实例部署；
- 自动购买域名、证书或修改阿里云控制台；
- 自动化 Certbot 证书申请；
- 前端功能或视觉改版。

## 11. 完成标准

- 生产前端所有 API 请求统一使用同源 `/api`。
- Nginx 正确剥离 `/api/` 并转发至原有后端路径，API 错误不被 SPA HTML 掩盖。
- React Router 直接访问可用，Vite 哈希资源和 `index.html` 使用正确缓存策略。
- 生产后端默认只监听 `127.0.0.1`，8080 不向公网开放。
- 本地开发方式保持不变，PATCH 跨域预检可用。
- 部署模板和说明可在替换域名后直接执行，并通过构建与路由验收。
