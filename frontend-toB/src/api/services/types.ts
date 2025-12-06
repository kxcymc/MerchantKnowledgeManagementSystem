/**
 * 基础知识库条目类型
 * 对应数据库 Knowledge 表及 API 响应
 */
export interface KnowledgeItem {
  knowledge_id: number;
  type?: 'pdf' | 'json';
  file_size?: number;
  file_url?: string;
  title: string;
  status: string; // 如: '生效中', '已失效'
  business: string;
  scene: string;
  content?: any; // 文件类型为 null，JSON 类型为对象
  created_at?: string;
  updated_at?: string;
  refer_num?: number;
}

/**
 * 通用响应消息
 */
export interface BaseResponse {
  message: string;
}

// ==========================================
// 1. 查询接口参数
// ==========================================

/**
 * GET /api/mul-query 多条件查询参数
 */
export interface MulQueryParams {
  title?: string;
  business?: string;
  scene?: string;
  status?: string;
  start_date?: string; // YYYY-MM-DD
  end_date?: string;   // YYYY-MM-DD
}

/**
 * GET /api/query 单条查询参数
 */
export interface QueryOneParams {
  knowledge_id: number;
}

// ==========================================
// 2. 新增/上传接口参数
// ==========================================

/**
 * POST /api/add JSON模式上传参数
 */
export interface AddJsonParams {
  title: string;
  content: Record<string, any> | string; // JSON对象或字符串
  business?: string;
  scene?: string;
}

/**
 * POST /api/add 文件模式上传参数
 * 注意：实际请求时需转换为 FormData
 */
export interface AddFileParams {
  document: File;
  business?: string;
  scene?: string;
}

/**
 * POST /api/add/batch 批量上传参数
 */
export interface AddBatchParams {
  documents: File[];
  business?: string;
  scene?: string;
}

/**
 * 新增接口响应
 */
export interface AddResponse {
  knowledge_id: number;
}

/**
 * 批量新增接口响应
 */
export interface AddBatchResponse {
  knowledge_ids: number[];
}

// ==========================================
// 3. 更新接口参数
// ==========================================

/**
 * POST /api/update 更新参数
 * 至少需要提供除 knowledge_id 外的一个参数
 */
export interface UpdateKnowledgeParams {
  knowledge_id: number;
  title?: string;
  content?: Record<string, any> | string;
  status?: string;
  business?: string;
  scene?: string;
  document?: File; // 如果上传新文件，会替换旧文件
}

// ==========================================
// 4. 删除接口参数
// ==========================================

/**
 * DELETE /api/delete 删除参数
 */
export interface DeleteKnowledgeParams {
  knowledge_id: number;
}