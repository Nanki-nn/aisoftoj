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
- 上传文件继续使用 legacy systemd 已使用的宿主机目录 `/opt/aisoftoj/uploads`，挂载到容器 `/app/uploads`；Compose 使用宿主机 `aisoftoj` 用户的 UID/GID 运行后端，使新旧运行方式可读写同一批文件。
- 后端限制为 700 MiB、1.5 CPU，JVM 使用 `-Xms128m -Xmx512m`；前端限制为 128 MiB、0.5 CPU。
- 后端 healthcheck 的启动宽限期为 60 秒，发布器最多等待 90 秒；前端最多等待 20 秒。
- 发布前要求根分区至少剩余 5 GiB、可用内存至少 400 MiB、swap 至少 1 GiB，否则拒绝构建和切换。

## 数据库迁移

- 引入 Flyway，并只在 `prod` profile 默认启用；开发和测试默认关闭。
- 自动 baseline 前必须断言核心业务表、邮箱认证表和关键列存在；不符合支持状态时发布失败，不允许对任意非空数据库直接盖章。
- 支持两种首次接管状态：完整邮箱认证结构但没有 `last_login_time` 时 baseline 为 3；该列已存在时 baseline 为 4。已有 `flyway_schema_history` 时必须验证状态成功后继续。
- `last_login_time` 迁移登记为 V4，使用 MySQL 5.7 可执行的 `information_schema + PREPARE` 条件 SQL，必须幂等且不得查询或输出用户邮箱等个人信息。
- 每次部署在启动新后端前执行 `--single-transaction --quick --skip-lock-tables --no-tablespaces --hex-blob --default-character-set=utf8mb4 --set-gtid-purged=OFF` 一致性备份，并验证 gzip 与 `Dump completed` 结束标记。
- 首次启用 Flyway 前使用 root 本地 socket 将备份恢复到临时数据库，比较表数量与关键表行数后删除临时库；恢复演练失败则保持 legacy 服务在线。
- 所有迁移遵循向后兼容的 expand/contract 规则；应用回滚不自动删除新字段。

## 健康检查

- 后端增加 Spring Boot Actuator，仅公开 `health` 和 `info`，详情不对外展示。
- Docker 使用 `/actuator/health/readiness` 判断后端是否可接流量。
- 前端容器使用 `/healthz`。
- 发布后继续验证 SPA 路由、`/api/paper/list`、未登录后台 401、未知 API 404 和 `/uploads` 308。

## 发布产物

GitHub Actions 只构建一次应用产物，并创建绑定完整 main SHA 的公开 GitHub prerelease。Release 资产只包含业务产物：

```text
release-<full-sha>.tar.gz
├── backend.jar
├── frontend/
├── manifest.sha256
└── release.env

release-<full-sha>.tar.gz.sha256
```

Dockerfile、Compose、宿主机 Nginx 和发布器不接受 CI 上传版本，全部由 root 在首次 bootstrap 时从已审阅仓库版本安装到 `/usr/local/lib/aisoftoj-deploy`。服务器只基于 Release 中的 JAR 和前端静态文件组装运行镜像，不重新编译业务代码。内外两层 SHA-256 均校验，解包使用精确文件 allowlist 并拒绝绝对路径、`..`、符号链接、设备文件或额外成员。

## GitHub Actions

单一生产流水线覆盖 PR、main 和手工发布：

1. Checkout。
2. Java 8 + Maven 后端测试与打包。
3. Node 20 + npm 前端测试与 `/api` 生产构建。
4. 校验主包包含 `/api`。
5. 生成发布包并上传 Actions artifact。
6. 仅允许从 `refs/heads/main` 手工 `workflow_dispatch`，并再次验证完整 SHA 等于远端 main。
7. 进入要求审批且仅允许受保护 main 的 `production` environment。
8. `concurrency: production` 防止并发发布。
9. 创建指向该完整 SHA 的 `deploy-<full-sha>` prerelease tag，上传发布包和外层校验和；同一 tag/资产不得覆盖。
10. 使用独立 SSH Key 发送唯一允许的命令 `<full-sha>`，不通过 SSH 上传文件。
11. 服务器验证请求 SHA 等于 GitHub 当前 main、tag 指向同一 SHA，再从公开 GitHub Release 下载并校验资产。
12. 公网冒烟测试通过后结束部署。

只使用 GitHub 官方的 checkout、setup-java、setup-node、upload-artifact 和 download-artifact Actions；SSH 与 SCP 使用 runner 自带 OpenSSH，不依赖第三方部署 Action。

## 服务器目录与权限

```text
/opt/aisoftoj/
├── releases/<full-sha>/   # root 管理的不可变发布目录
├── current -> releases/<full-sha>
└── uploads/               # 后端持久数据

/var/backups/aisoftoj/<timestamp-sha>/
/usr/local/sbin/aisoftoj-deploy
/usr/local/sbin/aisoftoj-rollback
```

- 新建无密码、无交互登录的 `deploy` 用户，仅允许 SSH Key。
- `deploy` 不加入 docker 组，不读取生产环境文件，也没有可写的发布输入目录。
- `authorized_keys` 使用 `restrict` 和 root-owned forced-command wrapper；wrapper 只接受 40 位十六进制 SHA，并调用固定 sudo 命令。
- sudoers 只允许 forced-command wrapper 调用 root 拥有且不可修改的部署脚本；脚本重新验证 SHA、main、tag、Release URL 和校验和。
- 部署脚本使用 `flock`，同一时间只允许一个生产发布。

## 首次迁移

1. 保持当前 Nginx、systemd 后端和静态前端在线。
2. 安装 Docker Engine 与 Compose plugin并启用 Docker 服务。
3. 创建 deploy 用户、目录、SSH Key、sudoers 和固定 root 发布脚本。
4. 盘点 `/opt/aisoftoj/uploads` 的文件数量、字节数、UID/GID 和可读写性；保持原路径不移动，容器沿用同一目录和宿主机 `aisoftoj` UID/GID。
5. 构建并启动前端容器，先在 `127.0.0.1:8081` 验证。
6. 备份数据库、当前 JAR、静态前端、上传目录清单和 Nginx 配置，并执行数据库恢复演练。
7. 短暂停止 legacy systemd 后端，启动 Compose 后端并等待 readiness。
8. 新后端失败时停止容器并立即恢复 legacy systemd 服务；上传目录无需复制，因此 legacy 可继续读取新旧文件。
9. 两个容器健康后备份并切换宿主机 Nginx 配置；`/api/` 使用带尾斜杠的 `proxy_pass http://127.0.0.1:8080/` 剥离 `/api`，`/uploads/` 使用 `proxy_pass http://127.0.0.1:8080/uploads/` 保留上传路径，`/api` 与 `/uploads` 分别返回 308 到尾斜杠路径。
10. `nginx -t`、reload 或公网验收任一步失败时，trap 恢复旧 Nginx、停止新 Compose、恢复旧 `current`、重新启动 legacy 后端，并继续使用未移动的静态前端目录。
11. 公网验收通过后 disable legacy `aisoftoj.service`，但保留 unit、旧静态目录和备份用于紧急回滚。

## 后续发布和回滚

- 后续发布将新包放入新的 SHA 目录，构建 SHA 标签镜像并执行 `docker compose up -d`。
- 新容器健康后再更新 `current` 软链接与发布记录。
- 发布器使用显式阶段状态和 `ERR`、`INT`、`TERM` trap；失败时恢复上一 Nginx 配置、Compose 版本、`current` 链接以及首次迁移期间的 legacy 服务/静态前端。
- rerun 同一 SHA 必须幂等：健康且已是 current 时只重新验收，不重复创建 Release、基线或破坏备份。
- 手工回滚命令只接受已存在的完整 SHA；数据库不做 destructive down migration。
- 默认保留最近 3 个发布目录和最近 7 份备份，清理前确认 current 与 previous 不受影响；Docker 只清理不被 current/previous 引用的镜像。

## 安全与可靠性

- 生产 secret 不写入 Git、Actions artifact、Docker build context 或日志。
- GitHub Secrets 至少包括主机、用户、私钥和 known_hosts；私钥只属于 deploy 用户。
- GitHub production environment 必须要求仓库所有者审批并限制 main；工作流中的官方 Actions 固定到完整 commit SHA。
- Docker socket 只由 root 使用。
- 容器不使用 privileged，不挂载 Docker socket，不开放数据库或应用端口到公网。
- deploy key 即使泄露也只能请求部署当前受保护 main 上已有、tag 和校验和均匹配的 GitHub Release，不能上传或指定 Docker/Compose/Nginx 输入。
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
