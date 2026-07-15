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

以根目录 `.env.production.example` 为模板，在服务器创建不纳入 Git 的生产环境文件。至少替换数据库密码、JWT 密钥、站点 Origin、Claude Key 和 OSS 凭据，并保持：

```env
SPRING_PROFILES_ACTIVE=prod
SERVER_PORT=8080
SERVER_ADDRESS=127.0.0.1
CORS_ALLOWED_ORIGINS=https://your-domain.example
```

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
curl -I http://your-domain.example/uploads
curl -i http://your-domain.example/api/paper/list
curl -i http://your-domain.example/api/admin/dashboard
curl -i http://your-domain.example/api/not-found
```

预期结果：

- `/` 和 `/login` 返回前端应用；
- `/uploads` 返回 308 并指向 `/uploads/`；
- `/api/paper/list` 返回后端 JSON 和 HTTP 200；
- 未登录 `/api/admin/dashboard` 返回后端 JSON 和 HTTP 401；
- `/api/not-found` 返回后端 404，不返回 `index.html`；
- 浏览器网络面板中的登录、试卷、答题、论文、后台和 OSS 请求均以 `/api/` 开头；
- 公网无法直接连接 8080 和 3306。

本地开发保持原方式：`npm run dev` 在未设置 `VITE_API_BASE_URL` 时继续请求 `http://localhost:8080`。CORS 已允许 `PATCH`，答题记录更新的预检请求应能通过。
