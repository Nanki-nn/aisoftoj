# 智能软考刷题系统 - 后端

基于 Spring Boot + MyBatis-Plus + MySQL 的智能软考刷题系统后端服务。

## 功能特性

- 用户注册/登录
- 题库管理
- 题目搜索和筛选
- 随机刷题
- 顺序刷题
- 专项刷题
- 头像上传功能
- RESTful API

## 技术栈

- Spring Boot 2.7.18
- MyBatis-Plus 3.5.5
- MySQL 8.0+
- Maven

## 快速开始

### 环境要求

- JDK 1.8+
- Maven 3.6+
- MySQL 8.0+

### 数据库配置

1. 创建数据库 `aisoftoj`
2. 执行 `db_schema.sql` 创建表结构
3. 执行 `db_init_data.sql` 初始化数据
4. 修改 `application.yml` 中的数据库连接信息

### 启动项目

```bash
# 编译项目
mvn clean compile

# 运行项目
mvn spring-boot:run
```

或者使用 IDE 直接运行 `ExamAppApplication.java`

## 项目结构

```
aisoftoj-backend/
├── src/main/java/com/nan/aisoftoj/
│   ├── controller/      # 控制器
│   │   ├── UserController.java
│   │   ├── QuestionController.java
│   │   └── FileController.java
│   ├── entity/          # 实体类
│   │   ├── User.java
│   │   ├── Question.java
│   │   └── Category.java
│   ├── mapper/          # MyBatis-Plus接口
│   │   ├── UserMapper.java
│   │   ├── QuestionMapper.java
│   │   └── CategoryMapper.java
│   ├── service/         # 业务接口
│   │   ├── UserService.java
│   │   ├── QuestionService.java
│   │   └── CategoryService.java
│   ├── service/impl/    # 业务实现
│   │   ├── UserServiceImpl.java
│   │   ├── QuestionServiceImpl.java
│   │   └── CategoryServiceImpl.java
│   ├── config/          # 配置类
│   │   └── WebConfig.java
│   └── ExamAppApplication.java # 启动类
├── src/main/resources/
│   ├── application.yml  # 配置文件
│   └── mapper/          # MyBatis XML文件
├── uploads/             # 文件上传目录
├── pom.xml              # Maven配置
└── README.md            # 项目说明
```

## API 接口

### 用户相关

- `POST /api/user/register` - 用户注册
- `POST /api/user/login` - 用户登录
- `GET /api/user/{id}` - 获取用户信息
- `POST /api/user/profile/update` - 更新用户信息
- `POST /api/user/upload-avatar` - 上传头像

### 题目相关

- `GET /api/question/categories` - 获取题目分类
- `GET /api/question/search` - 搜索题目
- `GET /api/question/random` - 随机获取题目
- `GET /api/question/sequence` - 顺序刷题
- `GET /api/question/special` - 专项刷题

## 头像上传功能

### 功能特性
- 支持图片格式：JPG、PNG、GIF
- 文件大小限制：2MB
- 自动生成唯一文件名
- 静态资源访问支持

### 配置说明
```yaml
file:
  upload:
    path: ./uploads/          # 文件保存路径
    url-prefix: /uploads/     # 访问URL前缀
```

### 文件存储
- 上传的文件保存在 `uploads/` 目录
- 通过 `/uploads/文件名` 访问
- 支持静态资源直接访问

## 数据库表结构

- `user` - 用户表
- `question` - 题目表
- `category` - 分类表
- `user_favorite` - 用户收藏表
- `user_wrong_question` - 用户错题本表
- `user_record` - 用户刷题记录表

## 开发说明

1. 项目使用 MyBatis-Plus 简化数据库操作
2. 实体类使用 Lombok 简化代码
3. 接口返回 JSON 格式数据
4. 支持跨域请求（前端代理）
5. 文件上传支持多格式图片

## 注意事项

1. 确保 MySQL 服务已启动
2. 修改 `application.yml` 中的数据库连接信息
3. 首次运行需要执行数据库初始化脚本
4. 默认端口为 8080，可在配置文件中修改
5. 确保 `uploads/` 目录有写入权限
6. 生产环境建议使用云存储服务替代本地文件存储 