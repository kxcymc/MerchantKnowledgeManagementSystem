# Backend Services

本目录包含两个后端服务项目：

## 项目结构

```
backend/
├── shared/                    # 共享代码和配置
│   └── utils/                # 公共工具类
│       ├── logger.js         # 日志工具
│       └── dashscopeEmbeddings.js  # DashScope 嵌入工具
├── kb-backend/               # 知识库管理后端（端口 3001）
│   ├── src/
│   ├── package.json
│   └── env.example
└── qa-chatbot-backend/       # 问答聊天后端（端口 3002）
    ├── src/
    ├── package.json
    └── env.example
```

## 服务说明

### kb-backend (端口 3001)
- **功能**：知识库管理服务
- **主要功能**：
  - 文件上传和解析（PDF、Word、Markdown 等）
  - 文本向量化和存储
  - 知识库 CRUD 操作
  - OCR 识别
  - 批量上传支持

### qa-chatbot-backend (端口 3002)
- **功能**：问答聊天服务
- **主要功能**：
  - RAG 检索增强生成
  - 多轮对话支持
  - 上下文记忆管理
  - 问题聚类统计
  - 引用追踪

## 共享资源

### 共享代码
- `shared/utils/logger.js` - 日志工具（两个项目共用）
- `shared/utils/dashscopeEmbeddings.js` - DashScope 嵌入工具（两个项目共用）

### 共享配置
- `env.example` - 统一的环境变量示例文件（可选，两个子项目都有自己的 env.example）

### 共享数据库
- **MySQL 数据库**：`kb_database`（可共享）
- **Chroma 向量数据库**：`kb_documents` 集合（只读共享，qa-chatbot-backend 只读取）

## 环境配置

### 快速开始

1. **配置环境变量**（推荐统一配置）：
   ```bash
   # 在 backend 根目录创建 .env
   cp env.example .env
   
   # 编辑 .env，填写你的配置
   # 特别注意：
   # - DASHSCOPE_API_KEY：必填
   # - MYSQL_PASSWORD：数据库密码
   # - KB_PORT 和 QA_PORT：服务端口
   ```
   
   **配置策略**：详见 [CONFIG_STRATEGY.md](./CONFIG_STRATEGY.md)

2. **初始化数据库**（按需初始化）：
   ```bash
   # 初始化 kb-backend 相关表（首次启动前）
   npm run init-db:kb
   
   # 初始化 qa-chatbot-backend 相关表（首次启动前）
   npm run init-db:qa
   
   # 或一次性初始化所有表
   npm run init-db
   ```

3. **安装依赖**：
   ```bash
   # 方式1：分别安装（推荐）
   cd kb-backend
   npm install
   
   cd ../qa-chatbot-backend
   npm install
   
   # 方式2：一键安装所有
   npm run install:all
   ```

4. **启动服务**：
   ```bash
   # 启动 kb-backend（终端1）
   npm run kb:start
   # 或
   cd kb-backend && npm start
   
   # 启动 qa-chatbot-backend（终端2）
   npm run qa:start
   # 或
   cd qa-chatbot-backend && npm start
   ```

## 配置说明

### 公共配置
两个项目共享以下配置（通过环境变量）：

- **DashScope API Key**：用于文本嵌入和 LLM
- **Chroma 向量数据库**：连接信息
- **MySQL 数据库**：连接信息

### 项目特定配置

#### kb-backend
- `KB_PORT=3001` - 服务端口
- `UPLOAD_DIR` - 文件上传目录
- `VECTOR_STORE_MODE` - 向量存储模式
- `RABBIT_URL` - RabbitMQ 连接（可选）

#### qa-chatbot-backend
- `QA_PORT=3002` - 服务端口
- `LLM_MODEL` - LLM 模型名称
- `RAG_TOP_K` - RAG 检索数量
- `MEMORY_WINDOW_SIZE` - 记忆窗口大小

## 注意事项

1. **向量数据库只读**：`qa-chatbot-backend` 对向量数据库是只读的，不会进行任何写入、修改或删除操作。

2. **数据库初始化时机**：
   - **kb-backend** 启动前：需要初始化 `Knowledge` 和 `BusinessScene` 表
   - **qa-chatbot-backend** 启动前：需要初始化会话、消息等相关表（需要 kb-backend 已初始化）
   - 可以使用 `npm run init-db:kb` 和 `npm run init-db:qa` 分别初始化

3. **配置管理**：
   - 推荐在根目录 `backend/.env` 统一管理配置，减少冗余
   - 使用 `KB_` 和 `QA_` 前缀区分项目特定配置
   - 两个子项目都有自己的 `env.example` 文件，也可以单独配置

4. **端口冲突**：确保 `KB_PORT` 和 `QA_PORT` 不冲突，默认分别为 3001 和 3002。

5. **依赖安装**：如果遇到依赖安装问题，可以使用 `npm install --legacy-peer-deps`。

## 开发建议

- 修改共享代码时，注意检查两个项目的兼容性
- 公共配置变更需要在 `.env.example` 中同步更新
- 新增共享工具时，放在 `shared/utils/` 目录

