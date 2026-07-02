import axios, { AxiosError, AxiosInstance, AxiosRequestConfig } from 'axios'
import type { ApiResponse } from '../types'
import { message } from 'ant-design-vue'

// 创建axios实例
const http = axios.create({
  baseURL: '/api/v2',
  timeout: 30000
})

// 请求拦截器
http.interceptors.request.use(
  (config: AxiosRequestConfig) => {
    const token = localStorage.getItem('geocms_token')
    if (token) {
      config.headers = config.headers || {}
      config.headers.Authorization = `Bearer ${token}`
    }
    
    const tenantId = localStorage.getItem('geocms_tenant_id')
    const tenantCode = localStorage.getItem('geocms_tenant_code')
    if (tenantId) {
      config.headers = config.headers || {}
      config.headers['X-Tenant-Id'] = tenantId
    }
    if (tenantCode) {
      config.headers = config.headers || {}
      config.headers['X-Tenant-Code'] = tenantCode
    }
    
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// 响应拦截器
http.interceptors.response.use(
  (response) => {
    console.log('HTTP response:', response)
    const body = response.data as ApiResponse<unknown>
    console.log('Response body:', body)
    if (body && typeof body === 'object') {
      // 优先检查 success 字段（因为后端同时返回了 success 和 code）
      if ('success' in body) {
        console.log('Found success field:', body.success)
        if (!body.success) {
          return Promise.reject(new Error(body.message || String(body.code) || '请求失败'))
        }
        console.log('Returning body.data:', body.data)
        return body.data
      } else if ('code' in body) {
        console.log('Found code field:', body.code)
        const code = String(body.code)
        if (code !== '0' && code !== 'OK') {
          return Promise.reject(new Error(body.message || code || '请求失败'))
        }
        console.log('Returning body.data:', body.data)
        return body.data
      }
    }
    console.log('Returning raw response.data:', response.data)
    return response.data
  },
  (error: AxiosError<{ message?: string }>) => {
    if (error.response?.status === 401) {
      // 开发模式：401 时只显示警告，不主动跳转登录或清 token
      // 让页面继续渲染（虽然数据可能为空）
      message.warning('请先登录后访问该功能')
    }
    return Promise.reject(new Error(error.response?.data?.message || error.message || '网络请求失败'))
  }
)

export default http
