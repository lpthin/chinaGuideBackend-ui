import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios'
import type { ApiResponse } from '../types'
import { message } from 'ant-design-vue'
import { router } from '../router'
import { useAuthStore } from '../stores/auth'

let isRedirecting = false

function handleUnauthorized() {
  if (isRedirecting) return
  isRedirecting = true
  try {
    const auth = useAuthStore()
    auth.accessToken = ''
    auth.refreshToken = ''
    auth.user = null
  } catch (e) {}
  localStorage.removeItem('access_token')
  localStorage.removeItem('refresh_token')
  localStorage.removeItem('user_info')
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

/** 给用户看的错误文案：axios/网关的英文原文（如 Request failed with status code 502）不能直接抛到界面上 */
export function describeHttpError(error: unknown): string {
  const axiosError = error as AxiosError<{ message?: string }>
  const bizMessage = axiosError?.response?.data?.message
  if (bizMessage) return bizMessage
  if (axiosError?.code === 'ECONNABORTED') return '请求超时，服务处理时间较长，请稍后重试'
  const status = axiosError?.response?.status
  if (!status) return '无法连接服务器，请确认后端已启动'
  switch (status) {
    case 400: return '请求参数有误，请检查后重试'
    case 401: return '登录状态已失效，请重新登录'
    case 403: return '没有权限执行该操作'
    case 404: return '请求的内容不存在或已被删除'
    case 409: return '数据已被他人修改，请刷新后重试'
    case 429: return '操作过于频繁，请稍后再试'
    case 500: return '服务器处理失败，请稍后重试或联系管理员'
    case 502: return '后端服务不可用（网关 502），请确认服务已启动'
    case 503: return '服务暂时不可用，请稍后重试'
    case 504: return '后端响应超时（网关 504），请稍后重试'
    default: return `请求失败（HTTP ${status}）`
  }
}

const http = axios.create({
  baseURL: '/api',
  timeout: 30000
}) as unknown as HttpClient

/** 蒸馏、批量建议等一次 AI 调用就要一分多钟，30s 默认超时会让前端先于后端放弃 */
export const AI_REQUEST_TIMEOUT = 180000

export function currentAuthToken(): string | null {
  const auth = useAuthStore()
  return auth.accessToken
    || localStorage.getItem('access_token')
    || localStorage.getItem('geocms_token')
}

http.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const auth = useAuthStore()
    const token = currentAuthToken()
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }

    const tenantCode = localStorage.getItem('geocms_tenant_code')
    if (auth.isSuperAdmin) {
      if (auth.selectedTenantId !== null) {
        config.headers['X-Tenant-Id'] = String(auth.selectedTenantId)
        const code = auth.selectedTenantCode || tenantCode
        if (code) {
          config.headers['X-Tenant-Code'] = code
        }
      }
    } else {
      const tenantId = auth.tenantId !== null
        ? auth.tenantId
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
    // 自动接收后端刷新的 token
    const newToken = response.headers?.['x-new-token']
    if (newToken) {
      const auth = useAuthStore()
      auth.accessToken = newToken
      localStorage.setItem('access_token', newToken)
    }

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
    return Promise.reject(new Error(describeHttpError(error)))
  }
)

export default http
