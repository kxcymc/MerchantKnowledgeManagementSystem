import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';

/**
 * 创建 Axios 实例
 * 配置了基础URL、超时时间、请求/响应拦截器
 */
const request: AxiosInstance = axios.create({
    baseURL: 'http://localhost:3001/api',
    timeout: 30000,
});

/**
 * 请求拦截器
 * 添加认证token到请求头
 */
request.interceptors.request.use(
    (config) => {
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
        return response;
    },
    (error) => {
        // 处理401未授权错误
        if (error.response?.status === 401) {
            window.location.href = '/login';
        }
        return Promise.reject(error.response?.data || error.message);
    }
);

export default request;
