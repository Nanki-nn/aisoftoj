# 智能软考刷题系统

## 项目简介

本项目是一个面向软考（计算机技术与软件专业技术资格考试）的智能刷题系统，支持用户注册、登录、题库管理、刷题、错题本、收藏、AI辅助等功能，助力考生高效备考。

## 主要功能
- 用户注册、登录（支持邮箱、手机号）
- 个人信息管理（头像、昵称、密码修改）
- 题库管理（题目分类、题目增删改查）
- 刷题模式（随机、顺序、专项）
- 错题本、收藏题目
- 搜索与筛选题目
- AI智能推荐与讲解（可扩展）
- 管理后台（可扩展）

## 技术栈
- 后端：Spring Boot、MyBatis-Plus、MySQL、JWT
- 前端：Vue3（建议）、Element Plus/Ant Design Vue
- 其他：Swagger、Lombok、Spring Security

## 快速启动
1. 克隆项目到本地
2. 配置数据库，执行 `db_schema.sql` 和 `db_init_data.sql` 初始化表结构和数据
3. 修改 `src/main/resources/application.yml` 数据库配置
4. 使用 IDEA 或命令行运行 `[AisoftojApplication.java](src/main/java/com/nan/aisoftoj/AisoftojApplication.java).java` 启动后端服务
5. （可选）开发前端页面对接接口

## 目录结构
```
├── src/main/java/com/nan/aisoftoj/
│   ├── controller/      # 控制器
│   ├── entity/          # 实体类
│   ├── mapper/          # MyBatis-Plus接口
│   ├── service/         # 业务接口
│   ├── service/impl/    # 业务实现
│   └── ExamAppApplication.java # 启动类
├── src/main/resources/
│   ├── application.yml  # 配置文件
│   └── mapper/          # MyBatis-Plus XML
├── db_schema.sql        # 数据库建表SQL
├── db_init_data.sql     # 数据库初始化数据
├── pom.xml              # Maven依赖
└── README.md            # 项目说明
```

## 交流与反馈
如有建议或问题，欢迎提issue或联系作者。 