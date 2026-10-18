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
    auth.user = null
  } catch (e) {}
  localStorage.removeItem('access_token')
  localStorage.removeItem('refresh_token')
  localStorage.removeItem('user_info')
  localStorage.removeItem('geocms_token')
  localStorage.removeItem('geocms_user')
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

/**
 * 这一发回的不是本系统说的话（M-P38 拍板①，现场量过的形状见正档 §10.53）。
 *
 * <p>判据只有「回体是不是自家那一个形状」这一条：自家的每一发（含 M-P36 修好的容器 ERROR 派发）
 * 都带 {@code success} 或 {@code code}，而服务容器在请求进业务处理<em>之前</em>就拒掉的那一类
 * ——坏百分号编码的 URL、超长请求行、超长请求头——回的是它自己的 HTML 错误页。
 * 界面上把这一形念成「请求参数有误，请检查后重试」是把责任放错了地方：那一句话让人去改表单，
 * 而他改不动的东西（地址编码、请求尺寸）才是真原因。</p>
 *
 * <p>{@code X-Trace-Id} 在这里<em>不</em>做判据：读不到响应头那一层的自定义字段要靠
 * axios 的 header 白名单，量出来的差别只有回体形状这一条是稳的。</p>
 */
export function isContainerLevelRejection(error: unknown): boolean {
  const response = (error as AxiosError | undefined)?.response
  if (!response) {
    return false
  }
  const data = response.data as any
  if (data && typeof data === 'object' && ('success' in data || 'code' in data)) {
    return false
  }
  const contentType = String(response.headers?.['content-type'] ?? '')
  const body = typeof data === 'string' ? data : ''
  return /text\/html/i.test(contentType) || /<html|<h1/i.test(body)
}

/**
 * 容器级拒绝那一句。要点三件：谁回的、说了什么、下一步做什么。
 *
 * <p>不写「参数有误」：表单里没有 URL 编码与请求尺寸这两样，让人去改一个改不动的东西。
 * 也不承诺「换直连就好」：走代理还是直连要现测，这一句只说得出「业务接口没有给答复」。
 * 「400 最常见的原因」那一支只在本批现场量过的那三型上成立（坏百分号编码、超长请求行、
 * 超长单枚请求头，三只回的是同一页），别的状态码不套用同一句原因。</p>
 */
function containerRejectionMessage(status: number): string {
  const cause = status === 400
    ? '这一形最常见的原因是地址里有不完整的百分号编码，或请求行、请求头过长：请把地址写完整、把请求缩短后重试。'
    : '请把请求重试一次；连续如此要看的是本系统前面那一层的日志，不是业务数据。'
  return `这一发不是本系统回的话（HTTP ${status}）：回来的是本系统前面的服务容器或网关自己的错误页，`
    + `业务接口没有给出答复。${cause}这不是数据或权限的问题，业务侧也不会留下这一次的记录。`
}

/** 给用户看的错误文案：axios/网关的英文原文（如 Request failed with status code 502）不能直接抛到界面上 */
export function describeHttpError(error: unknown): string {
  const axiosError = error as AxiosError<{ message?: string }>
  const bizMessage = axiosError?.response?.data?.message
  if (bizMessage) return bizMessage
  if (axiosError?.code === 'ECONNABORTED') return '请求超时，服务处理时间较长，请稍后重试'
  const status = axiosError?.response?.status
  if (!status) {
    // axios 自身的技术错误（Network Error 等）不能直接抛给界面；
    // 拦截器转抛的纯 Error 里带的是后端返回的中文业务文案，原样透出。
    if (axiosError?.isAxiosError) return '无法连接服务器，请确认后端已启动'
    return (error as Error | null)?.message || '无法连接服务器，请确认后端已启动'
  }
  if (isContainerLevelRejection(axiosError)) {
    return containerRejectionMessage(status)
  }
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

/**
 * 「我在替哪家租户做事」这件事只有 auth store 一个来源（#233）。
 *
 * 超管看的是选中的那家（selectedTenantId / selectedTenantCode），普通用户看的是自己
 * 登录态里那家（tenantId）。抽成一支函数是为了让 axios 拦截器与 knowledge 那条绕过拦截器
 * 的 SSE 共用同一份算法——以前两处各读一遍 geocms_tenant_id，切了租户后那条 SSE 仍拿旧号，
 * 读回来的是别家的数据，而界面上看不出任何原因。
 *
 * 普通用户这侧的 X-Tenant-Code 仍读 geocms_tenant_code：那是登录时随账号写死的自家租户码，
 * 一个人只有一个租户，不存在「切了不刷新」的串号；要收成单一来源的是超管那侧的范围。
 */
export function tenantScopeHeaders(): Record<string, string> {
  const auth = useAuthStore()
  const headers: Record<string, string> = {}
  if (auth.isSuperAdmin) {
    if (auth.selectedTenantId !== null) {
      headers['X-Tenant-Id'] = String(auth.selectedTenantId)
      if (auth.selectedTenantCode) {
        headers['X-Tenant-Code'] = auth.selectedTenantCode
      }
    }
  } else {
    headers['X-Tenant-Id'] = String(auth.tenantId)
    const tenantCode = localStorage.getItem('geocms_tenant_code')
    if (tenantCode) {
      headers['X-Tenant-Code'] = tenantCode
    }
  }
  return headers
}

http.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = currentAuthToken()
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }

    Object.assign(config.headers, tenantScopeHeaders())

    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

/**
 * 从响应头里读出「后端认不出这个租户」那一句（Spec-F §13-13 / P6-B 拍板 A）。
 *
 * 单独成一个函数是为了能被钉住：axios 会把响应头一律转成小写，写成
 * headers['X-Tenant-Unresolved'] 就永远读不到，而那次失败在界面上是完全静默的
 * ——客户看到的还是一句「这家真的没有数据」。没带头回 null，表示这一问认出来了。
 */
export function tenantUnresolvedFromHeaders(headers: unknown): string | null {
  const bag = headers as Record<string, unknown> | undefined
  if (!bag) return null
  const raw = bag['x-tenant-unresolved'] ?? bag['X-Tenant-Unresolved']
  if (raw === undefined || raw === null) return null
  const text = String(raw)
  return text === '' ? null : text
}

http.interceptors.response.use(
  (response) => {
    // 自动接收后端刷新的 token
    const newToken = response.headers?.['x-new-token']
    if (newToken) {
      const auth = useAuthStore()
      auth.accessToken = newToken
      localStorage.setItem('access_token', newToken)
    }

    // 「这次点的租户后端认不出来」是响应头给的（Spec-F §13-13 / P6-B 拍板 A）：
    // 读接口回的是正常成功的空列表，body 里没有地方说这件事。每一问都回话——没带头就是认出来了，
    // 顺手把上一问的那句话撤下，免得一次错号挂在界面上一直念。
    useAuthStore().markTenantUnresolved(tenantUnresolvedFromHeaders(response.headers))

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
