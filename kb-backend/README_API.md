# 知识库管理API - 快速开始

## 🚀 快速测试

### 1. 启动后端

```powershell
cd kb-backend
npm start
```

### 2. 测试MySQL连接

后端启动时会自动测试MySQL连接，查看日志确认：
- ✅ "MySQL 数据库连接成功" - 配置正确
- ❌ "MySQL 数据库连接失败" - 请检查配置

### 3. 访问前端

```powershell
cd chatbot-frontend
npm run dev
```

访问 http://localhost:5173，登录后点击"知识库管理"按钮

## 📋 API接口测试

### 查询知识
```bash
# 查询所有
curl http://localhost:3001/api/query

# 按条件查询
curl "http://localhost:3001/api/query?title=商品&business=抖音电商"
```

### 上传文件
```bash
curl -X POST http://localhost:3001/api/add \
  -F "document=@example.pdf" \
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

## 📖 详细文档

- `src/routes/API.md` - 完整的 API 接口文档
- `SETUP_COMPLETE.md` - 配置完成说明

