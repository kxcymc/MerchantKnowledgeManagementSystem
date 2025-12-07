# 数据库初始化脚本

## 功能

`init-database.js` 脚本用于自动初始化 MySQL 数据库，包括：

1. **自动创建数据库**（如果不存在）
2. **检查并创建所有必需的表**（如果不存在）
3. **初始化 ID 生成器**

## 支持的表

### kb-backend 表
- `BusinessScene` - 业务场景表
- `Knowledge` - 知识库表

### qa-chatbot-backend 表
- `Session` - 会话表
- `Message` - 消息表
- `MessageCitation` - 消息引用表
- `QuestionCluster` - 问题聚类表
- `QuestionClusterMember` - 问题聚类成员表
- `ZeroHitQuestion` - 零命中问题表
- `IDGenerator` - ID 生成器表

## 使用方法

### 方法 1：使用 npm 脚本（推荐）

```bash
# 在 backend 目录下

# 初始化所有表
npm run init-db

# 只初始化 kb-backend 相关表（Knowledge, BusinessScene）
npm run init-db:kb

# 只初始化 qa-chatbot-backend 相关表（Session, Message 等）
npm run init-db:qa
```

### 方法 2：直接运行 Node.js 脚本

```bash
# 在 backend 目录下

# 初始化所有表
node scripts/init-database.js

# 只初始化 kb-backend 相关表
node scripts/init-database.js --kb-only

# 只初始化 qa-chatbot-backend 相关表
node scripts/init-database.js --qa-only
```

## 初始化时机

### kb-backend 初始化
**时机**：kb-backend 首次启动前

**命令**：
```bash
npm run init-db:kb
```

### qa-chatbot-backend 初始化
**时机**：qa-chatbot-backend 首次启动前（kb-backend 应该已经初始化）

**命令**：
```bash
npm run init-db:qa
```

## 环境变量配置

脚本会读取以下环境变量（从 `.env` 文件或环境变量）：

```bash
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=KBase
MYSQL_PASSWORD=your_password
MYSQL_DATABASE=kb_database
```

**注意**：确保已创建 `.env` 文件并配置了正确的数据库连接信息。



