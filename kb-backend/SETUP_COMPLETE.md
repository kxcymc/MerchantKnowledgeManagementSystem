# 配置完成说明

## ✅ 已完成的工作

### 1. 后端配置

#### MySQL数据库服务
- ✅ 创建了 `src/services/dbService.js` - MySQL数据库服务层
- ✅ 支持查询、插入、更新、删除操作
- ✅ 自动创建场景（business/scene）

#### 知识库服务
- ✅ 创建了 `src/services/knowledgeService.js` - 统一的知识库服务
- ✅ 支持文件上传（PDF/Word/Markdown）
- ✅ 支持JSON富文本上传
- ✅ 自动同步MySQL和向量数据库

#### 统一API接口
- ✅ `GET /api/query` - 多条件查询
- ✅ `POST /api/add` - 添加文件/JSON
- ✅ `POST /api/add/batch` - 批量上传
- ✅ `POST /api/update` - 更新知识
- ✅ `DELETE /api/delete` - 删除知识

#### 配置更新
- ✅ 更新了 `src/config.js` 添加MySQL配置
- ✅ 更新了 `src/server.js` 集成新API并测试MySQL连接
- ✅ 更新了 `src/services/ingestService.js` 支持自定义metadata

### 2. 前端配置

#### 知识库管理页面
- ✅ 创建了 `chatbot-frontend/src/pages/KnowledgeBase.tsx`
- ✅ 创建了 `chatbot-frontend/src/pages/KnowledgeBase.css`
- ✅ 支持文件上传
- ✅ 支持JSON富文本上传
- ✅ 支持多条件查询
- ✅ 支持删除操作

#### 页面路由
- ✅ 更新了 `chatbot-frontend/src/App.tsx` 支持页面切换
- ✅ 更新了 `chatbot-frontend/src/pages/Chat.tsx` 添加知识库管理按钮

### 3. 文档
- ✅ `API_DOCS.md` - 完整的API接口文档
- ✅ `MYSQL_SETUP.md` - MySQL配置说明
- ✅ `env.example.mysql` - MySQL配置示例

## 📝 下一步操作

### 1. 配置MySQL环境变量

编辑 `kb-backend/.env` 文件，添加：

```env
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=KBase
MYSQL_PASSWORD=123456
MYSQL_DATABASE=kb_database
```

### 2. 启动后端服务

```powershell
cd kb-backend
npm start
```

检查日志，确认看到 "MySQL 数据库连接成功"

### 3. 启动前端服务

```powershell
cd chatbot-frontend
npm run dev
```

访问 http://localhost:5173

### 4. 测试功能

1. **登录页面** - 直接点击登录进入
2. **聊天页面** - 点击右上角"知识库管理"按钮
3. **知识库管理页面** - 测试以下功能：
   - 查询知识（可以留空查询所有）
   - 文件上传
   - JSON上传
   - 删除知识

## 🔍 测试API

### 查询所有知识
```bash
curl http://localhost:3001/api/query
```

### 按条件查询
```bash
curl "http://localhost:3001/api/query?business=抖音电商&status=生效中"
```

### 上传文件
```bash
curl -X POST http://localhost:3001/api/add \
  -F "document=@test.pdf" \
  -F "business=抖音电商" \
  -F "scene=商品管理"
```

### 上传JSON
```bash
curl -X POST http://localhost:3001/api/add \
  -H "Content-Type: application/json" \
  -d '{
    "title": "测试文档",
    "content": {"type": "doc", "content": []},
    "business": "抖音电商",
    "scene": "商品管理"
  }'
```

### 删除知识
```bash
curl -X DELETE http://localhost:3001/api/delete \
  -H "Content-Type: application/json" \
  -d '{"knowledge_id": 1}'
```

## 📚 相关文档

- `API_DOCS.md` - 完整的API接口文档和使用示例
- `MYSQL_SETUP.md` - MySQL数据库配置详细说明

## ⚠️ 注意事项

1. **MySQL服务** - 确保MySQL服务已启动
2. **数据库** - 确保 `kb_database` 数据库已创建
3. **用户权限** - 确保 `KBase` 用户有足够权限
4. **CORS** - 前端运行在 `http://localhost:5173`，确保后端允许该来源

## 🐛 故障排除

### MySQL连接失败
1. 检查MySQL服务是否运行
2. 检查`.env`文件中的配置是否正确
3. 检查数据库和用户是否存在

### 前端无法访问后端
1. 检查后端是否在 `http://localhost:3001` 运行
2. 检查CORS配置是否正确
3. 检查浏览器控制台的错误信息

### 上传失败
1. 检查文件大小是否超过限制（25MB）
2. 检查文件类型是否支持（PDF/DOCX/TXT/MD）
3. 检查后端日志中的错误信息

