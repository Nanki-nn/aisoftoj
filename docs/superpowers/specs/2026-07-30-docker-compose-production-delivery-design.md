# Docker Compose 生产交付设计

## 目标

将知构软考刷题平台从“本机构建后以 root SSH 手工替换文件”迁移为可重复、可审计、可回滚的 Docker Compose 生产交付流程，并在本轮完成仓库实现、GitHub Actions、生产服务器准备和首次线上迁移。

## 已确认约束

- 生产服务器为 Ubuntu 24.04 x86_64，2 核、1.6 GiB 内存、2 GiB swap。
- MySQL 运行在宿主机且只监听 `127.0.0.1:3306`，生产数据本轮不迁入容器。
- HTTPS 证书和域名跳转已由宿主机 Nginx 稳定维护，本轮不迁移证书。
- 当前后端由 systemd 运行在 `127.0.0.1:8080`，前端由宿主机 Nginx 直接读取 `/var/www/aisoftoj`。
- GitHub 仓库为发布源；生产发布需要保留人工触发、测试门禁、发布记录和互斥控制。

## 生产架构

```text
Internet
   |
Host Nginx :80/:443 (TLS, redirects, request limits)
   |-- /api/**, /uploads/** -> Backend container, host network, 127.0.0.1:8080
   `-- /**                  -> Frontend container, 127.0.0.1:8081

Backend container -- host network --> Host MySQL 127.0.0.1:3306
Backend container -- bind mount --> /opt/aisoftoj/uploads
```

宿主机 Nginx 保留 TLS 和公网入口。前端容器使用非 root Nginx 并只映射到回环地址。后端容器使用 host network，这是在不扩大 MySQL 监听范围、不搬迁生产数据的前提下访问宿主机回环 MySQL 的最小风险方案。8080 和 8081 均不暴露到公网。

## 容器镜像

### 后端

- CI 先用 Maven 和 Java 8 完成测试及可执行 JAR 构建。
- 运行镜像只复制 CI 生成的 JAR，不在生产服务器执行 Maven 编译。
- 容器使用固定非 root UID/GID，根文件系统只读；仅 `/tmp` 和上传目录可写。
- 安装最小化 `curl`，使用 Actuator readiness 作为 Docker healthcheck。
- JVM 内存继续由生产环境中的 `JAVA_TOOL_OPTIONS` 控制。

### 前端

- CI 使用 Node 20、`npm ci`、Vitest 和 `VITE_API_BASE_URL=/api` 生成静态文件。
- 运行镜像只包含静态文件和非 root Nginx。
- SPA fallback、哈希资源缓存和 `index.html` 禁止缓存由容器 Nginx 配置负责。
- 宿主机仅反向代理到 `127.0.0.1:8081`。

## Compose 运行约束

- Compose 项目名固定为 `aisoftoj`，服务名固定为 `frontend`、`backend`。
- 镜像标签使用完整 Git commit SHA，禁止使用 `latest`。
- 两个服务均使用 `restart: unless-stopped`、日志大小限制、健康检查和资源约束。
- 后端读取现有 `/etc/aisoftoj/aisoftoj.env`；该文件继续由 root 管理，不进入 GitHub 或镜像。
- 上传文件使用宿主机持久目录，不写入容器层。

## 数据库迁移

- 引入 Flyway，并只在 `prod` profile 默认启用；开发和测试默认关闭。
- 现有生产数据库使用 `baseline-on-migrate` 建立基线，基线版本设为 3。
- `last_login_time` 迁移登记为 V4，SQL 必须幂等且不得输出用户邮箱等个人信息。
- 每次部署在启动新后端前执行带 `--no-tablespaces` 的一致性备份，并验证 gzip 与 dump 完成标记。
- 所有迁移遵循向后兼容的 expand/contract 规则；应用回滚不自动删除新字段。

## 健康检查

- 后端增加 Spring Boot Actuator，仅公开 `health` 和 `info`，详情不对外展示。
- Docker 使用 `/actuator/health/readiness` 判断后端是否可接流量。
- 前端容器使用 `/healthz`。
- 发布后继续验证 SPA 路由、`/api/paper/list`、未登录后台 401、未知 API 404 和 `/uploads` 308。

## 发布产物

GitHub Actions 只构建一次应用产物，发布包包含：

```text
release.tar.gz
├── backend.jar
├── frontend/
├── backend.Dockerfile
├── frontend.Dockerfile
├── frontend-nginx.conf
├── compose.production.yml
├── host-nginx.conf
├── manifest.sha256
└── release.env
```

服务器只基于这份不可变发布包组装运行镜像，不重新编译业务代码。`manifest.sha256` 在解包前后校验，发布目录使用完整 commit SHA。

## GitHub Actions

单一生产流水线覆盖 PR、main 和手工发布：

1. Checkout。
2. Java 8 + Maven 后端测试与打包。
3. Node 20 + npm 前端测试与 `/api` 生产构建。
4. 校验主包包含 `/api`。
5. 生成发布包并上传 Actions artifact。
6. 仅 `workflow_dispatch` 进入 `production` environment。
7. `concurrency: production` 防止并发发布。
8. 使用独立 SSH Key 上传到服务器的 incoming 目录。
9. 通过受限 sudo 命令执行固定发布脚本。
10. 公网冒烟测试通过后结束部署。

只使用 GitHub 官方的 checkout、setup-java、setup-node、upload-artifact 和 download-artifact Actions；SSH 与 SCP 使用 runner 自带 OpenSSH，不依赖第三方部署 Action。

## 服务器目录与权限

```text
/opt/aisoftoj/
├── incoming/              # deploy 用户可写
├── releases/<full-sha>/   # root 管理的不可变发布目录
├── current -> releases/<full-sha>
└── uploads/               # 后端持久数据

/var/backups/aisoftoj/<timestamp-sha>/
/usr/local/sbin/aisoftoj-deploy
/usr/local/sbin/aisoftoj-rollback
```

- 新建无密码、无交互登录的 `deploy` 用户，仅允许 SSH Key。
- `deploy` 不加入 docker 组，不读取生产环境文件。
- sudoers 只允许调用 root 拥有且不可修改的部署和回滚脚本；脚本严格校验 SHA 参数。
- 部署脚本使用 `flock`，同一时间只允许一个生产发布。

## 首次迁移

1. 保持当前 Nginx、systemd 后端和静态前端在线。
2. 安装 Docker Engine 与 Compose plugin并启用 Docker 服务。
3. 创建 deploy 用户、目录、SSH Key、sudoers 和固定 root 发布脚本。
4. 构建并启动前端容器，先在 `127.0.0.1:8081` 验证。
5. 备份数据库、当前 JAR、静态前端和 Nginx 配置。
6. 短暂停止 legacy systemd 后端，启动 Compose 后端并等待 readiness。
7. 新后端失败时停止容器并立即恢复 legacy systemd 服务。
8. 两个容器健康后切换宿主机 Nginx配置并 reload。
9. 公网验收通过后 disable legacy `aisoftoj.service`，但保留 unit 和备份用于紧急回滚。

## 后续发布和回滚

- 后续发布将新包放入新的 SHA 目录，构建 SHA 标签镜像并执行 `docker compose up -d`。
- 新容器健康后再更新 `current` 软链接与发布记录。
- 失败时自动使用上一发布目录中的 Compose 配置和镜像标签恢复容器。
- 手工回滚命令只接受已存在的完整 SHA；数据库不做 destructive down migration。
- 默认保留最近 5 个发布目录和最近 7 份备份，清理前确认当前与上一版本不受影响。

## 安全与可靠性

- 生产 secret 不写入 Git、Actions artifact、Docker build context 或日志。
- GitHub Secrets 至少包括主机、用户、私钥和 known_hosts；私钥只属于 deploy 用户。
- Docker socket 只由 root 使用。
- 容器不使用 privileged，不挂载 Docker socket，不开放数据库或应用端口到公网。
- 部署脚本在任何切换前完成校验和备份；失败日志不输出数据库密码、JWT、SMTP 或 OSS 凭据。

## 验收标准

- 前端测试和生产构建通过，后端全部测试和打包通过。
- `docker compose config`、Dockerfile 构建和容器健康检查通过。
- 服务器重启 Docker 后两个容器可自动恢复。
- 宿主机 Nginx 和两个容器均健康，legacy Java 进程不再运行且 legacy unit 已禁用。
- MySQL 仍只监听 `127.0.0.1:3306`。
- 公网 80/443 正常，8080、8081、3306 不对公网监听。
- GitHub Actions 能从手工触发完成测试、构建、上传、部署和验收。
- 服务器保留经过验证的数据库、JAR、前端和 Nginx 回滚材料。
- 仓库文档包含日常发布、故障排查、回滚和 secret 轮换步骤。

## 非目标

- 本轮不将 MySQL、TLS 证书或宿主机 Nginx 迁入容器。
- 本轮不引入 Kubernetes、Swarm、服务网格或多机滚动发布。
- 本轮不改变业务 API、认证行为或用户数据。
