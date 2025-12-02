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
# 1）下载原始 PDF 文件到本地
curl "http://localhost:3001/api/file/45?raw=true" -o refund.pdf

# 2）调试查看 HTML 预览页（输出 HTML 源码）
curl "http://localhost:3001/api/file/45"
```