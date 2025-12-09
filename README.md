# 商家知识管理系统与问答机器人

**技术栈**：Node.js + LLM + RAG + Typescript + React + Arco UI

## 本地运行

### 1. 依赖安装
在以下五个目录分别执行安装命令：
- `backend`
- `kb-backend`  
- `qa-chatbot-backend`
- `frontend-toB`
- `frontend-QAchatbot`

```bash
npm i
```

### 2. 后端环境配置
根据以下三个目录中的 `env.example` 模板，在同级创建对应的 `.env` 文件并完成配置：
- `backend`
- `kb-backend`
- `qa-chatbot-backend`

### 3. MySQL数据库创建
示例配置：`KBase` / `123456` / `kb_database`

操作流程：
1. 系统安装 MySQL
2. 登录 root 账号
3. 创建用户 `KBase`，密码 `123456`
4. 授予权限后创建数据库 `kb_database`
5. 启动 KBase 的 MySQL 服务

### 4. 启动Chroma服务和RabbitMQ异步队列

**前置依赖**：
- Docker Desktop
- RabbitMQ
- Poppler（用于PDF OCR解析）

**启动命令**：

```bash
# 在 kb-backend 目录下启动 Chroma
docker-compose up -d
```

**RabbitMQ启动方式**：

- **Mac**：
  ```bash
  brew service start rabbitmq
  ```

- **Linux**：
  ```bash
  sudo service rabbitmq-server start
  ```

- **Windows**：
  ```powershell
  # 进入 kb-backend/scripts 目录
  cd kb-backend\scripts
  
  # 启动 RabbitMQ（需先配置脚本中的路径）
  .\RabbitMQ_start.ps1
  ```

### 5. 数据库初始化
> **注意**：仅在首次搭建时执行，后续运行可跳过

在 `backend` 根目录执行：

```bash
# 初始化所有表（推荐）
npm run init-db
```

### 6. 启动后端服务
在 `backend` 根目录运行：

```bash
# 生产模式
npm start

# 开发模式（推荐，支持自动重启）
npm run dev
```

### 7. 运行前端页面
分别在以下目录启动：

- `frontend-toB`
- `frontend-QAchatbot`

```bash
npm start
```
