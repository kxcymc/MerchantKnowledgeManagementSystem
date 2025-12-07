import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import LoadingManager from '@/utils/LoadingManager';

declare module 'axios' {
    interface AxiosRequestConfig {
        skipGlobalLoading?: boolean;
    }
}

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
        // 开启全局 Loading (除非显式跳过)
        if (!config.skipGlobalLoading) {
            LoadingManager.show('正在请求数据...');
        }
        return config;
    },
    (error) => {
        LoadingManager.fail('请求发送失败');
        return Promise.reject(error);
    }
);

/**
 * 响应拦截器
 * 处理响应数据和错误
 */
request.interceptors.response.use(
    (response) => {
        // 请求成功
        LoadingManager.success('请求成功');
        return response;
    },
    (error) => {
        // 处理401未授权错误
        if (error.response?.status === 401) {
            window.location.href = '/login';
        }
        // 请求失败
        const errorMsg = error.response?.data?.message || error.message || '请求失败';
        LoadingManager.fail(errorMsg);
        return Promise.reject(error.response?.data || error.message);
    }
);

export default request;
