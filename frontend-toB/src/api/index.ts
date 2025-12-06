import request from './services/request';
import type {
  KnowledgeItem,
  MulQueryParams,
  QueryOneParams,
  AddJsonParams,
  AddFileParams,
  AddBatchParams,
  AddResponse,
  AddBatchResponse,
  UpdateKnowledgeParams,
  BaseResponse,
  DeleteKnowledgeParams,
} from './services/types';

/**
 * 1.1 多条件查询知识库列表
 * GET /api/mul-query
 */
export const getKnowledgeList = (params?: MulQueryParams) => {
  return request.get<KnowledgeItem[]>('/mul-query', { params });
};

/**
 * 1.2 查询单条知识详情
 * GET /api/query
 */
export const getKnowledgeDetail = (params: QueryOneParams) => {
  return request.get<KnowledgeItem>('/query', { params });
};

/**
 * 2.1 新增 JSON 富文本
 * POST /api/add (application/json)
 */
export const addKnowledgeJson = (data: AddJsonParams) => {
  return request.post<AddResponse>('/add', data);
};

/**
 * 2.1 新增/上传文件
 * POST /api/add (multipart/form-data)
 */
export const addKnowledgeFile = (params: AddFileParams) => {
  const formData = new FormData();
  formData.append('document', params.document);
  if (params.business) formData.append('business', params.business);
  if (params.scene) formData.append('scene', params.scene);

  return request.post<AddResponse>('/add', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};

/**
 * 2.2 批量上传文件
 * POST /api/add/batch
 */
export const batchAddKnowledge = (params: AddBatchParams) => {
  const formData = new FormData();
  params.documents.forEach((file) => {
    formData.append('documents', file);
  });
  if (params.business) formData.append('business', params.business);
  if (params.scene) formData.append('scene', params.scene);

  return request.post<AddBatchResponse>('/add/batch', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};

/**
 * 3. 更新知识 (自动判断是文件流还是JSON)
 * POST /api/update
 */
export const updateKnowledge = (params: UpdateKnowledgeParams) => {
  // 如果包含文件，必须使用 FormData
  if (params.document) {
    const formData = new FormData();
    formData.append('knowledge_id', String(params.knowledge_id));
    formData.append('document', params.document);
    
    // 追加其他可选参数
    if (params.title) formData.append('title', params.title);
    if (params.status) formData.append('status', params.status);
    if (params.business) formData.append('business', params.business);
    if (params.scene) formData.append('scene', params.scene);
    
    // 注意：如果是文件更新模式，content 字段通常无效，但如果后端支持混合更新也可追加
    
    return request.post<BaseResponse>('/update', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  } else {
    // 纯 JSON 更新
    return request.post<BaseResponse>('/update', params, {
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

/**
 * 4. 删除知识
 * DELETE /api/delete
 */
export const deleteKnowledge = (data: DeleteKnowledgeParams) => {
  // Axios DELETE 请求体需要放在 config.data 中
  return request.delete<BaseResponse>('/delete', { data });
};

/**
 * 3.1 获取文件下载/预览 URL
 * 辅助函数，不直接发起请求，而是返回拼接好的URL
 */
export const getFileUrl = (knowledgeId: number, raw: boolean = false) => {
  const baseUrl = request.defaults.baseURL || 'http://localhost:3001/api';
  return `${baseUrl}/file/${knowledgeId}${raw ? '?raw=true' : ''}`;
};