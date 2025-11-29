import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';

/**
 * 创建 Axios 实例
 * 配置了基础URL、超时时间、请求/响应拦截器
 */
const request: AxiosInstance = axios.create({
  baseURL: process.env.REACT_APP_API_BASE_URL || 'http://localhost:3001/api',
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
