# API 接口文档

## 统一接口规范

### 基础信息

- **Base URL**：`http://localhost:3001`
- 所有业务接口前缀为：`/api`
- 返回格式：默认 `application/json`

### 通用字段约定

- **title**：  
  - 对于**文件型知识**，默认为文件名（例如：`退款预留金实施细则.pdf`）；  
  - 对于 **JSON 富文本**，由你在前端填写的标题决定。
- **status**：  
  - 不传时 **默认 `生效中`**；  
  - 更新时不传则保持原值不变。

---

## 1. 查询接口

### 1.1 GET `/api/mul-query` - 多条件查询文件/JSON 列表

**功能**：按多条件查询知识库文件/JSON 记录。

**请求参数（Query，全可选，不传则查询全部）**：

- `title` (string)：文档标题（模糊匹配）
- `business` (string)：业务名称
- `scene` (string)：场景名称
- `status` (string)：文档状态（如 `生效中` / `已失效`）
- `start_date` (string)：开始时间（文档创建时间，`YYYY-MM-DD`）
- `end_date` (string)：结束时间（文档创建时间，`YYYY-MM-DD`）

**响应体**（数组）：

```json
[
  {
    "knowledge_id": 1,
    "type": "pdf",
    "file_size": 1024000,
    "file_url": "/uploads/file.pdf",
    "title": "文档标题",
    "status": "生效中",
    "business": "抖音电商",
    "scene": "商品管理",
    "content": null
  }
]
```

**示例 curl**：

```bash
# 查询所有
curl "http://localhost:3001/api/mul-query"

# 按条件查询
curl "http://localhost:3001/api/mul-query?title=商品&business=抖音电商&status=生效中"
```

---

### 1.2 GET `/api/query` - 按 knowledge_id 查询单条文件/JSON

**功能**：根据 `knowledge_id` 精确查询一条记录。

**请求参数（Query）**：

- `knowledge_id` (number, 必填)：要查询的知识 ID

**响应体**（对象）：

```json
{
  "knowledge_id": 1,
  "type": "pdf",
  "file_size": 1024000,
  "file_url": "/uploads/file.pdf",
  "title": "文档标题",
  "status": "生效中",
  "business": "抖音电商",
  "scene": "商品管理",
  "content": null
}
```

**示例 curl**：

```bash
curl "http://localhost:3001/api/query?knowledge_id=1"
```

---

## 2. 新增/上传接口

### 2.1 POST `/api/add` - 增加文件或 JSON 富文本

**功能**: 添加文件或JSON富文本到知识库

**方式一: 文件上传** (multipart/form-data)

**请求参数**:
- `document` (file): 文件（PDF/Word/Markdown等）
- `business` (string): 业务名称
- `scene` (string): 场景名称

**响应参数**:
```json
{
  "knowledge_id": 1
}
```

**方式二: JSON富文本上传** (application/json)

**请求参数**:
- `title` (string, 必填): 文档标题
- `content` (object/string, 必填): JSON内容（可以是对象或JSON字符串）
- `business` (string): 业务名称
- `scene` (string): 场景名称

**响应参数**:
```json
{
  "knowledge_id": 1
}
```

**批量上传**: POST /api/add/batch

**请求参数**:
- `documents` (files[]): 多个文件
- `business` (string): 业务名称
- `scene` (string): 场景名称

**响应参数**:
```json
{
  "knowledge_ids": [1, 2, 3]
}
```

**示例**:
```bash
# 文件上传
curl -X POST http://localhost:3001/api/add \
  -F "document=@file.pdf" \
  -F "business=抖音电商" \
  -F "scene=商品管理"

# JSON上传
curl -X POST http://localhost:3001/api/add \
  -H "Content-Type: application/json" \
  -d '{
    "title": "富文本内容",
    "content": {"type": "doc", "content": [...]},
    "business": "抖音电商",
    "scene": "商品管理"
  }'
```

---

### 3. POST /api/update - 修改文件

**功能**: 根据knowledge_id更新文件或JSON内容

**请求参数**（必填）:
- `knowledge_id` (number, 必填): 知识ID

**至少需要提供以下一个参数**:
- `title` (string): 新标题
- `content` (object/string): 新内容（JSON类型）
- `status` (string): 新状态
- `business` (string): 新业务名称
- `scene` (string): 新场景名称
- `document` (file): 新文件（替换原文件）

**响应参数**:
```json
{
  "message": "更新成功"
}
```

**注意**:
- 如果是文件类型，上传新文件会替换原文件并更新向量数据库
- 如果是JSON类型，更新content会替换原JSON并更新向量数据库
- 只更新元数据（如title, status）不会重新生成向量

**示例**:
```bash
# 更新文件（上传新文件）
curl -X POST http://localhost:3001/api/update \
  -F "knowledge_id=1" \
  -F "document=@newfile.pdf"

# 更新JSON内容
curl -X POST http://localhost:3001/api/update \
  -H "Content-Type: application/json" \
  -d '{
    "knowledge_id": 1,
    "content": {"type": "doc", "content": [...]}
  }'

# 只更新标题和状态
curl -X POST http://localhost:3001/api/update \
  -H "Content-Type: application/json" \
  -d '{
    "knowledge_id": 1,
    "title": "新标题",
    "status": "已失效"
  }'
```

---

### 4. DELETE /api/delete - 删除文件

**功能**: 根据knowledge_id删除文件

**请求参数**:
- `knowledge_id` (number, 必填): 知识ID

**响应参数**:
```json
{
  "message": "删除成功"
}
```

**注意**: 删除操作会同时从MySQL数据库、向量数据库和本地文件系统中删除

**示例**:
```bash
curl -X DELETE http://localhost:3001/api/delete \
  -H "Content-Type: application/json" \
  -d '{"knowledge_id": 1}'
```

---

## 数据存储说明

### 文件类型

- 文件保存在 `uploads/` 目录
- MySQL 中存储文件路径、大小等信息
- 向量数据库存储文件内容的向量化结果
- `file_url` 字段返回文件的访问 URL（如 `/uploads/xxx.pdf`）
- `content` 字段为 `null`

#### Knowledge 表结构示意图

![Knowledge 表结构](data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAABawAAADECAIAAAD8o/H6AAAgAElEQVR4Ae...AAAABJRU5ErkJggg==)

> 其中 `scene_id` 通过外键关联到业务场景表 `BusinessScene`，实际业务/场景名称从 `BusinessScene` 中关联查询。

### JSON 类型（富文本）

- JSON 文件保存在 `uploads/json/` 目录
- MySQL 中 `content` 字段存储完整的 JSON 对象（JSON 字符串）
- 向量数据库存储 JSON 文本内容的向量化结果
- `file_url` 字段返回 JSON 文件的访问 URL
- 查询时，`content` 字段返回原始 JSON 对象

#### BusinessScene 表结构示意图

![BusinessScene 表结构](data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAABPcAAADNCAIAAABb1gJNAAAgAElEQVR4Ae...AAAABJRU5ErkJggg==)

---

## 响应说明

- **文件类型**: 响应中的 `content` 为 `null`，通过 `file_url` 访问文件
- **JSON类型**: 响应中的 `content` 为原始JSON对象，可以直接使用

---

## 错误处理

所有接口在出错时返回：
```json
{
  "message": "错误信息"
}
```

HTTP状态码：
- 200: 成功
- 400: 请求参数错误
- 404: 资源不存在
- 500: 服务器错误

---

## 注意事项

1. **业务和场景**: 如果指定的business和scene不存在，系统会自动创建
2. **向量数据库**: 文件上传和JSON上传都会自动进行向量化并存储到向量数据库
3. **文件替换**: 更新文件时，新文件会替换旧文件，旧文件会被删除
4. **数据同步**: 所有操作都会同步更新MySQL数据库和向量数据库
5. **批量上传**: 批量上传时，即使部分文件失败，其他文件仍会继续处理


---

## 3. 文件查看接口

### 3.1 GET `/api/file/:knowledgeId` - 查看/下载文件

**功能**：根据 `knowledge_id` 查看或下载文件内容，支持 PDF 在线预览、文本预览以及其他类型下载。

**请求方式**：`GET /api/file/:knowledgeId`

**路径参数**：

- `knowledgeId` (number, 必填)：知识 ID

**Query 参数**：

- `raw` (string/boolean，可选)：  
  - `raw=true` 或 `raw=1`：返回原始文件内容（`Content-Type` 根据扩展名自动设置），常用于下载或 `<iframe>/<object>` 内嵌展示；
  - 不传：返回一个简易 HTML 页面，用于浏览器预览（PDF 内嵌、文本使用 iframe，其他类型提供下载链接）。

**响应示例（raw=true，下载 PDF）**：

- 响应头：

```http
Content-Type: application/pdf
Content-Disposition: inline; filename="退款预留金实施细则.pdf"
```

- 响应体：PDF 二进制流。

**响应示例（默认 HTML 预览页）**：

- 响应头：`Content-Type: text/html; charset=utf-8`
- 响应体：一个包含 `<object>` / `<iframe>` 的 HTML 页面，内部引用 `?raw=true` 的真实文件地址。

**curl 示例**：
```bash
curl -X POST http://localhost:3001/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "什么是退款预留金？", "session_id": "session-123"}' \
  --no-buffer
```

**示例（JavaScript EventSource 替代方案）**：

```javascript
// 使用 fetch + ReadableStream 处理 SSE
async function chat(message, history = []) {
  const response = await fetch('http://localhost:3001/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, history })
  });

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const text = decoder.decode(value);
    const lines = text.split('\n');

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = JSON.parse(line.slice(6));
        
        if (data.type === 'token') {
          // 增量显示
          console.log(data.content);
        } else if (data.type === 'done') {
          // 完成，获取引用
          console.log('引用来源:', data.references);
        }
      }
    }
  }
}
```

**注意事项**：

1. 需要配置 `DASHSCOPE_API_KEY` 环境变量
2. 知识库为空时，会返回"暂未找到相关信息"
3. 多轮对话通过 `history` 参数传递上下文
4. 前端需要处理 SSE 流式数据

---

## 5. 统计分析接口

### 5.1 GET `/api/statistics/zero-hit-questions` - 查询零命中问题列表

**功能**：查询知识库无法回答的问题（零命中问题）列表，这些是用户在聊天中提问但知识库无法匹配到答案的专业问题。

**请求参数（Query，全可选）**：

- `limit` (number)：返回数量限制，默认100
- `startDate` (string)：开始日期（可选，格式：`YYYY-MM-DD` 或 `YYYY-MM-DD HH:mm:ss`）
- `endDate` (string)：结束日期（可选，格式：`YYYY-MM-DD` 或 `YYYY-MM-DD HH:mm:ss`）
- `orderBy` (string)：排序字段，可选值：`'asked_count'`（提问次数）或 `'last_asked_at'`（最近提问时间），默认 `'asked_count'`

**响应体**：

```json
{
  "success": true,
  "data": [
    {
      "question_id": 1,
      "message_id": 123,
      "session_id": 45,
      "question_text": "如何申请退款？",
      "question_hash": "abc123...",
      "asked_count": 5,
      "first_asked_at": "2024-01-01T10:00:00.000Z",
      "last_asked_at": "2024-01-15T14:30:00.000Z"
    }
  ],
  "total": 1,
  "options": {
    "limit": 100,
    "startDate": null,
    "endDate": null,
    "orderBy": "asked_count"
  }
}
```

**示例 curl**：

```bash
# 查询所有零命中问题（按提问次数排序）
curl "http://localhost:3001/api/statistics/zero-hit-questions"

# 查询最近30天的零命中问题
curl "http://localhost:3001/api/statistics/zero-hit-questions?startDate=2024-01-01&limit=50"

# 按最近提问时间排序
curl "http://localhost:3001/api/statistics/zero-hit-questions?orderBy=last_asked_at&limit=20"
```

---

### 5.2 GET `/api/statistics/hot-knowledge-distribution` - 查询热点知识分布

**功能**：查询被引用最多的知识库文档分布情况，用于分析哪些知识文档最常被用户查询和引用。

**请求参数（Query，全可选）**：

- `limit` (number)：返回数量限制，默认50
- `startDate` (string)：开始日期（可选，格式：`YYYY-MM-DD` 或 `YYYY-MM-DD HH:mm:ss`）
- `endDate` (string)：结束日期（可选，格式：`YYYY-MM-DD` 或 `YYYY-MM-DD HH:mm:ss`）

**响应体**：

```json
{
  "success": true,
  "data": [
    {
      "knowledge_id": 1,
      "citation_count": 150,
      "message_count": 120,
      "session_count": 80,
      "last_cited_at": "2024-01-15T16:00:00.000Z",
      "avg_score": 0.85,
      "min_score": 0.65,
      "max_score": 0.95,
      "knowledge": {
        "knowledge_id": 1,
        "title": "退款预留金实施细则",
        "type": "pdf",
        "business": "资金结算",
        "scene": ""
      }
    }
  ],
  "total": 1,
  "options": {
    "limit": 50,
    "startDate": null,
    "endDate": null
  }
}
```

**字段说明**：

- `citation_count`：引用次数（MessageCitation 表中的记录数）
- `message_count`：涉及的消息数量（去重）
- `session_count`：涉及的会话数量（去重）
- `last_cited_at`：最近一次引用时间
- `avg_score`：平均相似度分数
- `min_score`：最低相似度分数
- `max_score`：最高相似度分数
- `knowledge`：知识库文档信息（如果存在）

**示例 curl**：

```bash
# 查询热点知识分布
curl "http://localhost:3001/api/statistics/hot-knowledge-distribution"

# 查询最近30天的热点知识
curl "http://localhost:3001/api/statistics/hot-knowledge-distribution?startDate=2024-01-01&limit=30"
```

---

### 5.3 GET `/api/statistics/hot-professional-questions` - 查询热点专业知识问题

**功能**：查询被提问最多的专业知识问题聚类，用于分析用户最关心的专业问题类型。

**请求参数（Query，全可选）**：

- `limit` (number)：返回数量限制，默认50
- `minCount` (number)：最小问题数量，默认2（只返回至少被提问2次的问题聚类）
- `startDate` (string)：开始日期（可选，格式：`YYYY-MM-DD` 或 `YYYY-MM-DD HH:mm:ss`）
- `endDate` (string)：结束日期（可选，格式：`YYYY-MM-DD` 或 `YYYY-MM-DD HH:mm:ss`）

**响应体**：

```json
{
  "success": true,
  "data": [
    {
      "cluster_id": 1,
      "representative_question": "如何申请退款？",
      "question_count": 25,
      "session_count": 18,
      "first_asked_at": "2024-01-01T10:00:00.000Z",
      "last_asked_at": "2024-01-15T14:30:00.000Z",
      "created_at": "2024-01-01T10:00:00.000Z",
      "updated_at": "2024-01-15T14:30:00.000Z"
    }
  ],
  "total": 1,
  "options": {
    "limit": 50,
    "minCount": 2,
    "startDate": null,
    "endDate": null
  }
}
```

**字段说明**：

- `cluster_id`：问题聚类ID
- `representative_question`：代表问题（聚类中心问题）
- `question_count`：该聚类中的问题总数
- `session_count`：涉及的会话数量（去重）
- `first_asked_at`：首次提问时间
- `last_asked_at`：最近提问时间

**示例 curl**：

```bash
# 查询热点专业知识问题
curl "http://localhost:3001/api/statistics/hot-professional-questions"

# 查询至少被提问5次的问题
curl "http://localhost:3001/api/statistics/hot-professional-questions?minCount=5&limit=20"

# 查询最近30天的热点问题
curl "http://localhost:3001/api/statistics/hot-professional-questions?startDate=2024-01-01"
```

---

## 数据来源说明

以上三个统计分析接口的数据来源于 `qa-chatbot-backend` 在聊天过程中存储的数据：

1. **零命中问题**：来自 `ZeroHitQuestion` 表，记录知识库无法回答的专业问题
2. **热点知识分布**：来自 `MessageCitation` 表，统计知识库文档被引用的次数和分布
3. **热点专业知识问题**：来自 `QuestionCluster` 表，统计被提问最多的专业问题聚类

这些数据在用户使用聊天功能时会自动记录和更新，无需手动维护。