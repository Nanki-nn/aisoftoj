# 智能软考刷题系统 - 前端

基于 Vue3 + Element Plus 的智能软考刷题系统前端项目。

## 功能特性

- 用户注册/登录
- 题库浏览和搜索
- 题目分类筛选
- 刷题练习
- 个人中心
- 头像上传功能
- 响应式设计

## 技术栈

- Vue 3
- Element Plus
- Element Plus Icons
- Vue Router
- Axios

## 快速开始

### 安装依赖

```bash
npm install
```

### 启动开发服务器

```bash
npm run dev
```

### 构建生产版本

```bash
npm run build
```

### 预览生产版本

```bash
npm run preview
```

## 项目结构

```
aisoftoj-front/
├── src/
│   ├── api/           # API接口
│   │   ├── user.js    # 用户相关接口
│   │   └── question.js # 题目相关接口
│   ├── views/         # 页面组件
│   │   ├── Login.vue      # 登录页
│   │   ├── Register.vue   # 注册页
│   │   ├── QuestionList.vue # 题库列表
│   │   ├── Practice.vue   # 刷题页
│   │   └── Profile.vue    # 个人中心
│   ├── router/        # 路由配置
│   │   └── index.js
│   ├── App.vue        # 根组件
│   └── main.js        # 入口文件
├── index.html         # HTML模板
├── vite.config.js     # Vite配置
├── package.json       # 项目配置
└── README.md          # 项目说明
```

## 开发说明

1. 确保后端服务已启动（默认端口8080）
2. 前端会自动代理 `/api` 请求到后端
3. 用户登录后信息存储在 localStorage 中
4. 支持题目分类筛选和关键词搜索
5. 刷题页面支持随机获取下一题
6. 个人中心支持头像上传功能

## 头像上传功能

### 功能特性
- 支持 JPG、PNG、GIF 格式图片
- 文件大小限制 2MB
- 实时预览
- 上传进度显示
- 支持移除头像

### 使用方法
1. 进入个人中心页面
2. 点击"上传头像"按钮
3. 选择图片文件
4. 系统自动上传并显示预览
5. 点击"保存修改"保存到数据库

## 接口说明

项目已配置代理，所有 `/api` 开头的请求会自动转发到后端服务。

主要接口：
- `/api/user/register` - 用户注册
- `/api/user/login` - 用户登录
- `/api/user/{id}` - 获取用户信息
- `/api/user/profile/update` - 更新用户信息
- `/api/user/upload-avatar` - 上传头像
- `/api/question/categories` - 获取题目分类
- `/api/question/search` - 搜索题目
- `/api/question/random` - 随机获取题目
- `/api/question/sequence` - 顺序刷题
- `/api/question/special` - 专项刷题

## 注意事项

1. 首次使用需要先注册账号
2. 确保后端数据库已初始化（执行 db_schema.sql 和 db_init_data.sql）
3. 如遇到跨域问题，检查 vite.config.js 中的代理配置
4. 头像上传需要后端支持文件上传功能
5. 上传的头像文件会保存在后端的 uploads 目录中 