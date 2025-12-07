## 自建知识库构建服务

基于 **Express + LangChain.js** 的知识库后端，可上传 PDF / Word / TXT / Markdown 或直接输入文本，自动完成内容解析、OCR（扫描版 PDF）、分块、向量化（阿里 `text-embedding-v3`），并保存到本地 JSON 向量库。可选集成 RabbitMQ，实现多人上传时的异步处理。

### 功能特性

- RESTful API 接口，支持文件上传和文本提交。
- 支持 PDF（含扫描件自动 OCR）、DOCX、TXT、Markdown。
- LangChain `RecursiveCharacterTextSplitter` 自适应分块。
- 使用阿里 DashScope `text-embedding-v3` 嵌入模型（只需提供 `DASHSCOPE_API_KEY`）。
- JSON 文件持久化的向量存储，可快速验证 RAG 流程。
- 可选 RabbitMQ 队列：前端只负责上传，解析/向量化由 worker 异步执行，避免多用户拥堵。

### 目录结构

```
kb-backend
├─ src/
│  ├─ server.js          # Express 入口
│  ├─ config.js          # 环境变量集中管理
│  ├─ vectorStore.js     # JSON 向量库 & 相似度检索
│  ├─ services/
│  │  ├─ ingestService.js   # 分块 + 向量化主流程
│  │  ├─ textExtractor.js   # 各类文档解析
│  │  └─ ocrService.js      # PDF OCR（阿里云 DashScope OCR + Poppler）
│  ├─ queue/
│  │  ├─ publisher.js    # RabbitMQ 生产者
│  │  └─ worker.js       # RabbitMQ worker
│  └─ utils/logger.js
├─ uploads/              # 临时文件
├─ data/vector-store.json# 分块+向量持久化
├─ env.example           # 环境变量模板
└─ README.md
```

### 环境要求

- Node.js >= 16.0.0
- MySQL >= 5.7 或 MySQL >= 8.0
- Docker 和 Docker Compose（用于 Chroma 向量数据库）
- RabbitMQ（可选，用于异步任务处理）
- Poppler（可选，用于 PDF OCR，Windows 需要添加到 PATH）

### 快速开始

#### 1. 安装依赖

```bash
cd kb-backend
npm install
```

#### 2. 配置环境变量

复制环境变量模板并配置：

```bash
cp env.example .env
```

编辑 `.env` 文件，配置以下关键参数：

**必填配置：**
- `DASHSCOPE_API_KEY`: 阿里云 DashScope API Key（用于文本嵌入和 OCR）
  - 获取方式：https://dashscope.console.aliyun.com/apiKey
- `MYSQL_HOST`: MySQL 服务器地址（默认：localhost）
- `MYSQL_PORT`: MySQL 端口（默认：3306）
- `MYSQL_USER`: MySQL 用户名（默认：KBase）
- `MYSQL_PASSWORD`: MySQL 密码（默认：123456）
- `MYSQL_DATABASE`: MySQL 数据库名（默认：kb_database）

**可选配置：**
- `RABBIT_URL`: RabbitMQ 连接地址（默认：amqp://localhost）
- `CHROMA_HOST`: Chroma 服务器地址（默认：localhost）
- `CHROMA_PORT`: Chroma 服务器端口（默认：8000）

#### 3. 启动 MySQL 服务器

确保 MySQL 服务已启动并运行：

**Windows:**
```bash
# 通过服务管理器启动 MySQL 服务
# 或使用命令行
net start MySQL80  # 根据你的 MySQL 服务名称调整
```

**Linux/Mac:**
```bash
sudo systemctl start mysql
# 或
sudo service mysql start
```

**验证 MySQL 连接：**
```bash
mysql -h localhost -u KBase -p
# 输入密码后，创建数据库（如果不存在）
CREATE DATABASE IF NOT EXISTS kb_database;
```

#### 4. 启动 Chroma 向量数据库

使用 Docker Compose 启动 Chroma 服务：

```bash
docker-compose up -d
```

**验证 Chroma 服务：**
```bash
# 检查容器状态
docker ps | grep chroma

# 检查服务健康状态
curl http://localhost:8000/api/v2/heartbeat
```

**停止 Chroma 服务：**
```bash
docker-compose down
```

#### 5. 启动 RabbitMQ 服务（可选，推荐用于生产环境）

**Windows:**
```powershell
# 使用提供的脚本启动
.\scripts\RabbitMQ_start.ps1

# 或手动启动
# 1. 设置环境变量（个人配置）
$env:ERLANG_HOME = "E:\Tools\Erlang OTP"
$env:RABBITMQ_HOME = "E:\Tools\RabbitMQ\rabbitmq_server-4.1.5"
$env:PATH = "$env:ERLANG_HOME\bin;$env:PATH"

# 2. 启动 RabbitMQ
cd $env:RABBITMQ_HOME\sbin
.\rabbitmq-server.bat
```

**Linux/Mac:**
```bash
# 使用 systemd
sudo systemctl start rabbitmq-server

# 或使用服务命令
sudo service rabbitmq-server start
```

**创建队列：**
RabbitMQ 启动后，队列会在首次使用时自动创建。如果需要手动创建：

```bash
# 访问 RabbitMQ 管理界面
# http://localhost:15672
# 默认用户名/密码：guest/guest

# 或使用命令行
rabbitmqadmin declare queue name=kb_ingest durable=true
```

**验证 RabbitMQ：**
```bash
# 检查端口是否监听
netstat -an | findstr 5672  # Windows
netstat -an | grep 5672     # Linux/Mac

# 访问管理界面
# http://localhost:15672
```

#### 6. 启动后端服务

**启动主服务：**
```bash
npm start
```

服务启动后，默认监听 `http://localhost:3001`

**启动 Worker 进程（如果启用了 RabbitMQ）：**
```bash
# 在新的终端窗口
npm run worker

# 或使用提供的脚本（Windows）
.\scripts\worker_start.ps1
```

#### 7. 验证服务状态

访问健康检查接口：
```bash
curl http://localhost:3001/health
```

预期响应：
```json
{
  "status": "ok",
  "records": 0,
  "queueEnabled": true
}
```

### 启动顺序总结

1. ✅ **配置 `.env` 文件**（必填）
2. ✅ **启动 MySQL 服务器**（必填）
3. ✅ **启动 Chroma 服务**（`docker-compose up -d`）（必填）
4. ✅ **启动 RabbitMQ 服务**（可选，推荐）
5. ✅ **启动后端服务**（`npm start`）

### 开发模式

使用 nodemon 自动重启（开发时推荐）：

```bash
npm run dev
```

### 停止服务
# 停止 Chroma 服务
docker-compose down

# 停止 RabbitMQ（Windows）
.\scripts\RabbitMQ_stop.ps1

# 停止 RabbitMQ（Linux/Mac）
sudo systemctl stop rabbitmq-server
```

> **OCR 配置**：需要配置阿里云 DashScope API Key（见 `.env` 文件），并安装 Poppler（用于 PDF 转图片）。Windows 上需要将 Poppler 的 `bin` 目录添加到 PATH 环境变量。

### API 说明

详细的 API 文档请参考：[API.md](./src/routes/API.md)

**主要接口：**

| 方法 | 路径        | 说明                          |
| ---- | ----------- | ----------------------------- |
| GET  | `/health`   | 服务状态、向量条目数、队列状态 |
| GET  | `/api/mul-query` | 多条件查询知识列表 |
| GET  | `/api/query` | 根据 knowledge_id 查询单条知识 |
| GET  | `/api/file/:knowledgeId` | 获取文件内容或 JSON 内容 |
| POST | `/api/add` | 上传文件或添加 JSON 知识 |
| POST | `/api/add/batch` | 批量上传文件 |
| POST | `/api/update` | 更新知识记录 |
| DELETE | `/api/delete` | 删除知识记录 |
| GET  | `/api/vectors?limit=20` | 最近入库的 chunk + metadata |
| POST | `/api/text`   | 提交 JSON `{ text, title, tags }` |

当配置 RabbitMQ (`RABBIT_URL`) 时，上述 POST 接口仅推送任务到队列，由 `npm run worker` 运行的消费者异步执行，提升多用户并发能力。若未配置，则直接在请求线程中完成所有工作。

### 故障排查

#### MySQL 连接失败

**问题：** 启动时提示 MySQL 连接失败

**解决方案：**
1. 确认 MySQL 服务已启动
2. 检查 `.env` 文件中的 MySQL 配置是否正确
3. 确认数据库已创建：`CREATE DATABASE IF NOT EXISTS kb_database;`
4. 检查用户权限：确保 MySQL 用户有访问数据库的权限

#### Chroma 连接失败

**问题：** 提示 Chroma 连接失败

**解决方案：**
1. 确认 Docker 服务已启动
2. 检查 Chroma 容器是否运行：`docker ps | grep chroma`
3. 检查端口 8000 是否被占用
4. 查看容器日志：`docker logs chroma-server`
5. 重启 Chroma 服务：`docker-compose restart`

#### RabbitMQ 连接失败

**问题：** 提示 RabbitMQ 连接失败

**解决方案：**
1. 确认 RabbitMQ 服务已启动
2. 检查端口 5672 是否监听：`netstat -an | findstr 5672`
3. 检查 `.env` 文件中的 `RABBIT_URL` 配置
4. 访问管理界面验证：http://localhost:15672
5. 如果不需要异步处理，可以不配置 `RABBIT_URL`，系统会使用同步模式

#### OCR 功能不可用

**问题：** PDF OCR 识别失败

**解决方案：**
1. 确认已配置 `DASHSCOPE_API_KEY`
2. 确认 API Key 有效且有足够余额
3. 安装 Poppler（Windows 需要添加到 PATH）：
   - Windows: 下载并安装 Poppler，将 `bin` 目录添加到 PATH
   - Linux: `sudo apt-get install poppler-utils`
   - Mac: `brew install poppler`

#### 文件上传失败

**问题：** 文件上传时提示错误

**解决方案：**
1. 检查文件大小是否超过限制（默认 25MB）
2. 检查文件类型是否支持（PDF、DOCX、TXT、MD、XLSX 等）
3. 检查 `uploads` 目录是否有写入权限
4. 查看后端日志获取详细错误信息

### 性能与扩展建议

1. **异步队列**：RabbitMQ / Kafka / Redis Stream 均可，将解析、OCR、向量化这些 CPU 密集型任务从 Web 线程中解耦，前端可即时返回 "已排队"。
2. **存储层**：当前使用 Chroma 向量数据库，支持 server 模式（推荐生产环境）和 persistent 模式（本地文件）。
3. **并行 OCR**：扫描件多时可在 worker 内对每页并行 OCR（如使用 `Promise.allSettled` 或开多 worker）。
4. **缓存嵌入**：对于重复文档可按 `hash(file)` 做去重，或记录 chunk checksum 避免重复嵌入。
5. **安全 & 权限**：结合登录态，在 metadata 中写入 `tenantId/userId`，retrieval 时做过滤。

### 相关文档

- [API 详细文档](./src/routes/API.md) - 完整的 API 接口说明
- [API 快速参考](./README_API.md) - API 快速参考指南
- [文件接口说明](./API_FILE_RESPONSE.md) - `/api/file/:knowledgeId` 接口详细说明

欢迎根据业务需要继续拓展（如检索接口、RAG 对话接口等）。

