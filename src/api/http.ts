import axios, { AxiosError } from 'axios'
import type { ApiResponse } from '@/types/api'
import { ElMessage } from 'element-plus'
import { router } from '@/router'

let isRedirecting = false

function handleUnauthorized() {
  if (isRedirecting) return
  isRedirecting = true
  localStorage.removeItem('geocms_token')
  localStorage.removeItem('geocms_user')
  ElMessage.warning('登录状态已失效，请重新登录')
  const redirect = window.location.pathname + window.location.search
  const loginPath = '/login'
  if (!redirect.startsWith(loginPath)) {
    router.push({
      path: loginPath,
      query: { redirect }
    })
  } else {
    router.push(loginPath)
  }
  setTimeout(() => {
    isRedirecting = false
  }, 1000)
}

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
    const body = response.data as any
    if (body && typeof body === 'object') {
      const code = body.code !== undefined && body.code !== null ? String(body.code) : null
      if (code === 'UNAUTHORIZED' || code === '401') {
        handleUnauthorized()
        return Promise.reject(new Error(body.message || '登录状态已失效，请重新登录'))
      }
      if ('success' in body) {
        if (!body.success) {
          return Promise.reject(new Error(body.message || body.code || '请求失败'))
        }
        return body.data
      }
    }
    return response.data
  },
  (error: AxiosError<{ message?: string }>) => {
    if (error.response?.status === 401) {
      handleUnauthorized()
    }
    return Promise.reject(new Error(error.response?.data?.message || error.message || '网络请求失败'))
  }
)
