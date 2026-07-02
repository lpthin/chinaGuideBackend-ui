import axios, { AxiosError } from 'axios'
import type { ApiResponse } from '@/types/api'
import { ElMessage } from 'element-plus'

export const http = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 15000
})

http.interceptors.request.use((config) => {
  const token = localStorage.getItem('geocms_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  
  const tenantId = localStorage.getItem('geocms_tenant_id')
  const tenantCode = localStorage.getItem('geocms_tenant_code')
  if (tenantId) {
    config.headers['X-Tenant-Id'] = tenantId
  }
  if (tenantCode) {
    config.headers['X-Tenant-Code'] = tenantCode
  }
  
  return config
})

http.interceptors.response.use(
  (response) => {
    const body = response.data as ApiResponse<unknown>
    if (body && typeof body === 'object' && 'success' in body) {
      if (!body.success) {
        return Promise.reject(new Error(body.message || body.code || '请求失败'))
      }
      return body.data
    }
    return response.data
  },
  (error: AxiosError<{ message?: string }>) => {
    if (error.response?.status === 401) {
      // 开发模式：401 时只显示警告，不主动跳转登录或清 token
      ElMessage.warning('请先登录后访问该功能')
    }
    return Promise.reject(new Error(error.response?.data?.message || error.message || '网络请求失败'))
  }
)
