# 生产部署：同源 `/api`

生产环境由 Nginx 同时提供 React 静态文件和 API 反向代理：

- `/` 与客户端路由返回 `aisoftoj-front/build/` 的内容；
- `/api/**` 剥离 `/api/` 后转发至 `127.0.0.1:8080`；
- `/uploads/**` 转发至后端同名路径；
- Spring Boot 使用 `prod` profile，仅监听回环地址。

## 1. 构建前端

```bash
cd aisoftoj-front
npm ci
VITE_API_BASE_URL=/api npm run build
rg -l '"/api"|/api/' build/assets/*.js
```

最后一个命令必须至少输出一个主包文件，否则不要部署该构建。Vite 的产物目录是 `build/`，不是 `dist/`。

将 `build/` 中的内容同步到服务器，使入口文件最终位于：

```text
/var/www/aisoftoj/index.html
```

不要形成 `/var/www/aisoftoj/build/index.html` 这一层额外目录。

## 2. 部署后端

### 2.1 升级数据库

先完成数据库备份，再运行预检：

```bash
mysql -u"$DB_USERNAME" -p aisoftoj < db_migrations/20260726_email_auth_preflight.sql
```

两条查询都返回空结果后才能运行迁移：

```bash
mysql -u"$DB_USERNAME" -p aisoftoj < db_migrations/20260726_add_email_auth.sql
```

预检发现规范化后重复的邮箱或长度超过 254 的邮箱时，先人工修正账号数据。迁移脚本可重复执行建表和加列步骤，但仍应在维护窗口内单实例执行。新环境直接使用最新 `db_schema.sql`，不再额外执行这份增量迁移。

### 2.2 配置运行环境

以根目录 `.env.production.example` 为模板，在服务器创建不纳入 Git 的生产环境文件。至少替换数据库密码、JWT 密钥、邮箱验证码密钥、站点 Origin、SMTP、Claude Key 和 OSS 凭据，并保持：

```env
SPRING_PROFILES_ACTIVE=prod
SERVER_PORT=8080
SERVER_ADDRESS=127.0.0.1
CORS_ALLOWED_ORIGINS=https://your-domain.example
AUTH_EMAIL_CODE_SECRET=至少32字节的高熵随机值
MAIL_HOST=smtp.example.com
MAIL_PORT=587
MAIL_USERNAME=no-reply@your-domain.example
MAIL_PASSWORD=change-me
MAIL_FROM=no-reply@your-domain.example
MAIL_STARTTLS_ENABLE=true
MAIL_STARTTLS_REQUIRED=true
```

`AUTH_EMAIL_CODE_SECRET` 同时保护验证码摘要和发件箱中的加密载荷。它必须稳定保存；轮换会使尚未消费的验证码失效。SMTP 使用专用事务邮件账号，发信域名配置 SPF、DKIM 和 DMARC，并保持 STARTTLS 强制开启。连接、读取和写入超时默认分别为 5 秒、10 秒和 10 秒，可通过 `.env.production.example` 中的变量调整。

环境文件权限设置为 `600`。由 systemd 或现有进程管理器加载环境变量并启动后端 JAR。服务器本机可以访问 `127.0.0.1:8080`，公网安全组和主机防火墙不得开放 8080 或 3306。

## 3. 配置 Nginx

复制模板并替换域名：

```bash
sudo cp deploy/nginx/aisoftoj.conf.example /etc/nginx/conf.d/aisoftoj.conf
sudo sed -i 's/your-domain.example/你的实际域名/g' /etc/nginx/conf.d/aisoftoj.conf
sudo nginx -t
sudo systemctl reload nginx
```

`nginx -t` 未通过时不要 reload。模板先提供 HTTP 服务，HTTPS 证书由 Certbot 或阿里云证书流程配置；启用 HTTPS 后，`CORS_ALLOWED_ORIGINS` 必须使用最终的精确 HTTPS Origin。

`location ^~ /api/` 中的 `proxy_pass http://127.0.0.1:8080/;` 必须保留尾斜杠。否则 `/api/auth/login` 会错误地以 `/api/auth/login` 转发给后端，而后端实际路径是 `/auth/login`。

## 4. 路由验收

部署后至少执行：

```bash
curl -I http://your-domain.example/
curl -I http://your-domain.example/login
curl -I http://your-domain.example/forgot-password
curl -I http://your-domain.example/uploads
curl -i http://your-domain.example/api/paper/list
curl -i http://your-domain.example/api/admin/dashboard
curl -i http://your-domain.example/api/not-found
```

预期结果：

- `/`、`/login` 和 `/forgot-password` 返回前端应用；
- `/uploads` 返回 308 并指向 `/uploads/`；
- `/api/paper/list` 返回后端 JSON 和 HTTP 200；
- 未登录 `/api/admin/dashboard` 返回后端 JSON 和 HTTP 401；
- `/api/not-found` 返回后端 404，不返回 `index.html`；
- 浏览器网络面板中的登录、试卷、答题、论文、后台和 OSS 请求均以 `/api/` 开头；
- 公网无法直接连接 8080 和 3306。

认证功能还必须使用受控测试邮箱完成一次端到端回归：注册验证码、邮箱验证码登录、密码重置，以及重置密码后旧 JWT 无法继续访问 `/api/auth/me`。验证码接口会故意对不存在的邮箱返回相同提示，不能用响应文案判断账号是否存在。

上线后可用以下查询观察发件箱。`PENDING` 长时间增长或 `FAILED` 持续出现通常表示 SMTP 凭据、网络、发件域名或配额异常：

```sql
SELECT status, COUNT(*) AS total, MIN(create_time) AS oldest
FROM auth_email_outbox
GROUP BY status;
```

本地开发保持原方式：`npm run dev` 在未设置 `VITE_API_BASE_URL` 时继续请求 `http://localhost:8080`。CORS 已允许 `PATCH`，答题记录更新的预检请求应能通过。
