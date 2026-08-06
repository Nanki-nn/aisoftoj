# 微信小程序发布检查清单

本清单用于生成体验版或正式提审包。真实 AppID、AppSecret、域名校验文件和平台账号信息不得提交到仓库。

## 构建前

- 从 `project.release.config.example.json` 复制一份不入库的正式项目配置，填写 AppID，并保持 `setting.urlCheck=true`。
- 在微信公众平台配置 HTTPS request 合法域名；域名证书有效，且后端生产环境启用题目响应加密。
- 按实际收集的数据和申请的微信能力更新公众平台《用户隐私保护指引》，逐项核对小程序内“隐私说明”。
- 设置 `TARO_APP_API_BASE_URL`、`TARO_APP_PROJECT_CONFIG` 和 `TARO_APP_VERSION`；AppSecret 只配置在后端运行环境。

## 验证与构建

```bash
pnpm test
pnpm exec tsc --noEmit
pnpm release:check
pnpm build:weapp:release
```

- 在微信开发者工具确认包体、RSA-OAEP/AES-GCM 解密、随机数、登录和完整答题纵切。
- 分别在 iOS 与 Android 验证登录、前后台切换、杀进程恢复、断网草稿、联网重试、冲突恢复和交卷。
- 使用一套综合知识和一套案例分析已发布试卷完成回归；确认历史、错题、个人统计和隐私入口。

## 提审与回退

- 记录版本号、构建提交、后端版本、数据库迁移版本、体验版二维码验证人和验证时间。
- 审核说明明确登录用途、刷题流程、案例题人工自评和所需隐私权限。
- 发布失败时回退或下架小程序版本；后端兼容新增接口可保留，不回滚已经完成的账号合并。
