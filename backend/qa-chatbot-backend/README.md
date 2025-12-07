# QA Chatbot Backend

基于 LangChain.js 的 RAG 问答机器人后端服务，支持知识库检索、上下文记忆和智能问答。

## 功能特性

- ✅ **RAG 检索增强生成**：基于向量数据库的知识检索和 LLM 回答
- ✅ **只读向量数据库**：仅从 kb-backend 构建的向量数据库中读取检索，不进行任何写入、修改或删除操作
- ✅ **上下文记忆管理**：支持多轮对话，自动摘要长对话
- ✅ **会话管理**：支持多会话，每个会话独立管理
- ✅ **引用追踪**：记录 AI 回复引用的知识库文档
- ✅ **统计分析**：支持零命中问题、TopN 问题、引用热力图等统计
- ✅ **MySQL 持久化**：所有业务数据存储在 MySQL 数据库

## 技术栈

- **Node.js** + **Express**
- **LangChain.js**：RAG、Chain、Memory
- **Chroma**：向量数据库
- **DashScope**：文本嵌入和 LLM
- **MySQL**：业务数据存储

## 快速开始

### 1. 安装依赖

```bash
cd qa-chatbot-backend
npm install --legacy-peer-deps
```

**注意**：由于某些依赖包的版本冲突，需要使用 `--legacy-peer-deps` 标志。如果遇到安装问题，请参考 [INSTALL.md](./INSTALL.md)。

### 2. 配置环境变量

复制 `env.example` 并重命名为 `.env`，填写配置：

```bash
# 必填配置
DASHSCOPE_API_KEY=your_dashscope_api_key
MYSQL_USER=your_user
MYSQL_PASSWORD=your_password

# 数据库配置（可以和 kb-backend 共用同一个数据库）
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_DATABASE=kb_database

# 如果知识库数据库配置不同，可单独配置
KBASE_DATABASE_USER=KBase
KBASE_DATABASE_PASSWORD=your_kbase_password
KBASE_DATABASE_NAME=kb_database

# Chroma 向量数据库配置
CHROMA_HOST=localhost
CHROMA_PORT=8000
```

详细配置说明请参考：[DATABASE_CONFIG.md](./DATABASE_CONFIG.md)

### 3. 初始化数据库

**重要**：QA Chatbot 的业务表可以和 kb-backend 的 Knowledge 表放在同一个数据库中。

#### 方案一：共用同一个数据库（推荐）

如果使用同一个 `kb_database` 数据库：

```sql
USE kb_database;
SOURCE /path/to/qa-chatbot-backend/database/schema.sql;
```

#### 方案二：使用独立数据库

```sql
CREATE DATABASE IF NOT EXISTS qa_chatbot_db DEFAULT CHARSET=utf8mb4;
USE qa_chatbot_db;
SOURCE /path/to/qa-chatbot-backend/database/schema.sql;
```

**注意**：
- QA Chatbot 的业务数据库（MySQL）需要执行建表脚本
- 向量数据库（Chroma）由 kb-backend 构建和维护，QA Chatbot 只负责读取

### 4. 确保向量数据库已构建

**重要说明**：QA Chatbot **仅从已构建的向量数据库中读取数据**，不会创建或修改向量数据。

确保：
1. Chroma 服务正在运行（与 kb-backend 共用）
2. 向量数据库已通过 **kb-backend** 构建完成（包含知识库文档）
3. 集合名称与配置中的 `CHROMA_COLLECTION_NAME` 一致（默认：`kb_documents`）

如果向量数据库集合不存在，启动时会抛出明确的错误提示。

### 5. 启动服务

```bash
npm run dev  # 开发模式
npm start    # 生产模式
```

## API 接口

详细接口文档请参考代码中的注释和路由实现。

1. **GET /api/next-ids** - 获取全局唯一ID
2. **GET /api/get-chat-history** - 获取所有会话历史
3. **POST /api/chat** - 发送消息并获取AI回复
4. **DELETE /api/del-chat-session/:session_id** - 删除会话

## 许可证

MIT
