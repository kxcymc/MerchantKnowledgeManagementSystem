import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';

/**
 * 创建 Axios 实例
 * 配置了基础URL、超时时间、请求/响应拦截器
 */
// API 基础 URL
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

const request: AxiosInstance = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * 请求拦截器
 * 添加认证token到请求头
 */
request.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

/**
 * 响应拦截器
 * 处理响应数据和错误
 */
request.interceptors.response.use(
  (response) => {
    return response.data;
  },
  (error) => {
    // 处理401未授权错误
    if (error.response?.status === 401) {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('doubao_user');
      window.location.href = '/login';
    }
    return Promise.reject(error.response?.data || error.message);
  }
);

export default request;

// 同步导出一个封装的 apiClient，提供通用的 get/post/put/delete/patch 方法
export const apiClient = {
  get: <T = any>(url: string, config?: AxiosRequestConfig) => request.get<any, T>(url, config),

  post: <T = any>(url: string, data?: any, config?: AxiosRequestConfig) =>
    request.post<any, T>(url, data, config),

  put: <T = any>(url: string, data?: any, config?: AxiosRequestConfig) =>
    request.put<any, T>(url, data, config),

  delete: <T = any>(url: string, config?: AxiosRequestConfig) =>
    request.delete<any, T>(url, config),

  patch: <T = any>(url: string, data?: any, config?: AxiosRequestConfig) =>
    request.patch<any, T>(url, data, config),

  // 流式响应（如果后端支持流）
  stream: (url: string, data?: any, onProgress?: (event: any) => void) =>
    request.post(url, data, {
      responseType: 'stream' as any,
      onDownloadProgress: onProgress,
    }),
};

// ============== RAG Chat API (SSE) ==============

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatReference {
  filename: string;
  knowledge_id?: number;
  page?: number;
  score?: number;
}

export interface ChatSSECallbacks {
  onStart?: (sessionId?: string) => void;
  onToken?: (token: string) => void;
  onDone?: (content: string, references: ChatReference[]) => void;
  onError?: (error: string) => void;
}

/**
 * RAG Chat API - 流式对话
 * @param message 用户消息
 * @param history 对话历史
 * @param sessionId 会话ID
 * @param callbacks SSE 回调函数
 */
export async function chatWithRAG(
  message: string,
  history: ChatMessage[] = [],
  sessionId?: string,
  callbacks?: ChatSSECallbacks
): Promise<void> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message,
        history,
        session_id: sessionId,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('无法获取响应流');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            
            switch (data.type) {
              case 'start':
                callbacks?.onStart?.(data.session_id);
                break;
              case 'token':
                callbacks?.onToken?.(data.content);
                break;
              case 'done':
                callbacks?.onDone?.(data.content, data.references || []);
                break;
              case 'error':
                callbacks?.onError?.(data.message);
                break;
            }
          } catch {
            // 忽略解析错误
          }
        }
      }
    }
  } catch (error) {
    callbacks?.onError?.(error instanceof Error ? error.message : '请求失败');
  }
}
