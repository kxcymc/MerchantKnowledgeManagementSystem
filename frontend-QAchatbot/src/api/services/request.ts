import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';

/**
 * 创建 Axios 实例
 * 配置了基础URL、超时时间、请求/响应拦截器
 */
// 在开发环境中使用代理（相对路径），生产环境使用环境变量或绝对路径
const getBaseURL = () => {
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL;
  }
  // 开发环境：使用相对路径，通过 Vite 代理转发
  if (import.meta.env.DEV) {
    return '/api';
  }
  // 生产环境：使用默认的后端地址
  return 'http://localhost:3002/api';
};

const request: AxiosInstance = axios.create({
  baseURL: getBaseURL(),
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
    // 调试：记录请求URL
    console.log('API请求:', {
      method: config.method?.toUpperCase(),
      url: config.url,
      baseURL: config.baseURL,
      fullURL: `${config.baseURL}${config.url}`
    });
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
    console.log('API响应拦截器:', {
      url: response.config?.url,
      status: response.status,
      data: response.data
    });
    return response.data;
  },
  (error) => {
    // 处理401未授权错误
    if (error.response?.status === 401) {
      window.location.href = '/login';
    }
    // 记录详细错误信息
    console.error('API请求失败:', {
      url: error.config?.url,
      method: error.config?.method,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      message: error.message
    });
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
