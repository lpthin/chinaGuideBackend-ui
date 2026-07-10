import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios'
import type { ApiResponse } from '../types'
import { message } from 'ant-design-vue'
import { router } from '../router'
import { useAuthStore as useV2AuthStore } from '../stores/auth'

let isRedirecting = false

function handleUnauthorized() {
  if (isRedirecting) return
  isRedirecting = true
  try {
    const v2Auth = useV2AuthStore()
    v2Auth.accessToken = ''
    v2Auth.refreshToken = ''
    v2Auth.user = null
  } catch (e) {}
  localStorage.removeItem('v2_access_token')
  localStorage.removeItem('v2_refresh_token')
  localStorage.removeItem('v2_user_info')
  localStorage.removeItem('geocms_token')
  localStorage.removeItem('geocms_user')
  localStorage.removeItem('geocms_tenant_id')
  localStorage.removeItem('geocms_tenant_code')
  message.warning('登录状态已失效，请重新登录')
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

interface HttpClient {
  get<T = any>(url: string, config?: any): Promise<T>
  post<T = any>(url: string, data?: any, config?: any): Promise<T>
  put<T = any>(url: string, data?: any, config?: any): Promise<T>
  patch<T = any>(url: string, data?: any, config?: any): Promise<T>
  delete<T = any>(url: string, config?: any): Promise<T>
  interceptors: AxiosInstance['interceptors']
  defaults: AxiosInstance['defaults']
}

const http = axios.create({
  baseURL: '/api/v2',
  timeout: 30000
}) as unknown as HttpClient

http.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const v2Auth = useV2AuthStore()
    let token = v2Auth.accessToken
      || localStorage.getItem('v2_access_token')
      || localStorage.getItem('geocms_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }

    const tenantCode = localStorage.getItem('geocms_tenant_code')
    if (v2Auth.isSuperAdmin) {
      if (v2Auth.selectedTenantId !== null) {
        config.headers['X-Tenant-Id'] = String(v2Auth.selectedTenantId)
        const code = v2Auth.selectedTenantCode || tenantCode
        if (code) {
          config.headers['X-Tenant-Code'] = code
        }
      }
    } else {
      const tenantId = v2Auth.tenantId !== null
        ? v2Auth.tenantId
        : localStorage.getItem('geocms_tenant_id')
      if (tenantId) {
        config.headers['X-Tenant-Id'] = String(tenantId)
      }
      if (tenantCode) {
        config.headers['X-Tenant-Code'] = tenantCode
      }
    }

    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

http.interceptors.response.use(
  (response) => {
    const body = response.data as any
    if (body && typeof body === 'object') {
      const code = body.code !== undefined && body.code !== null ? String(body.code) : null
      if (code === 'UNAUTHORIZED' || code === '401') {
        handleUnauthorized()
        return Promise.reject(new Error(body.message || '登录状态已失效，请重新登录'))
      }
      if (typeof body.success === 'boolean') {
        if (!body.success) {
          return Promise.reject(new Error(body.message || String(body.code) || '请求失败'))
        }
        return body.data
      }
      if (code !== null) {
        if (code !== '0' && code !== 'OK') {
          return Promise.reject(new Error(body.message || code || '请求失败'))
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

export default http
