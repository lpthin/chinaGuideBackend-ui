// 门户上线（onboarding）相关接口
//
// demo 内容包的两个端点是超管功能（后端 AdminTenantController 里 checkSuperAdmin），
// 租户账号调用会拿到权限错误，所以界面上也只给超管看。
import http from './http'

export type DemoMode = 'skip' | 'overwrite'

export interface DemoBootstrapResult {
  tenantId: number
  siteId: number
  pack: string
  mode: DemoMode
  created: number
  updated: number
  skipped: number
  /** 与租户已有内容标识冲突、被跳过的条目说明（真实内容优先，不会被演示包覆盖） */
  conflicts: string[]
  nextSteps: string[]
  notice: string
}

export interface DemoPublishResult {
  tenantId: number
  siteId: number
  converted: number
  nextSteps: string[]
  notice: string
}

export const demoSiteApi = {
  bootstrap: (tenantId: number, mode: DemoMode = 'skip') =>
    http.post<DemoBootstrapResult>(`/admin/tenants/${tenantId}/bootstrap-demo`, null, { params: { mode } }),
  publish: (tenantId: number) =>
    http.post<DemoPublishResult>(`/admin/tenants/${tenantId}/publish-demo`),
  status: (tenantId: number) =>
    http.get<DemoStatusResult>(`/admin/tenants/${tenantId}/demo-status`),
}

export interface DemoStatusResult {
  tenantId: number
  siteCount: number
  siteId: number | null
  siteCode: string | null
  siteName: string | null
  domain: string | null
  demo: { categories: number, articles: number, cases: number, banners: number, jobs: number }
  /** 门户上访客真正能看到的数量（已发布且非演示） */
  published: { articles: number, cases: number }
  notice: string
}

/**
 * 「访客能看到几篇」直接问门户自己的公开接口。
 *
 * <p>不用后台文章列表来数：后台列表带 is_demo 与状态口径差异，用它统计会出现
 * 「后台说有 5 篇、门户上打开是空」的两套真相。这里传站点编码走 ?site=，
 * 与真实访客拿到的结果同一条代码路径。</p>
 */
export const portalVisibilityApi = {
  publishedArticles: (siteCode: string) =>
    http.get<{ total: number }>('/portal/public/articles', { params: { site: siteCode, page: 1, size: 1 } }),
  publishedCases: (siteCode: string) =>
    http.get<{ total: number }>('/portal/public/cases', { params: { site: siteCode, page: 1, size: 1 } }),
}

/**
 * 后端直接返回的文件（robots.txt / sitemap.xml / llms.txt）的可访问地址。
 *
 * <p>本地开发时前端在 Vite（5190）、这些文件在后端（8080），Vite 只代理了 /api 与 /uploads，
 * 所以拿当前页面域名去点这些链接只会拿到 SPA 的 index.html——那是个假链接。
 * 未配置 VITE_BACKEND_ORIGIN 时返回 null，由界面退化成只显示路径。</p>
 */
export function backendFileUrl(path: string, siteCode?: string | null): string | null {
  const configured = (import.meta.env.VITE_BACKEND_ORIGIN as string | undefined) || ''
  const origin = configured.replace(/\/$/, '')
  if (!origin) {
    return null
  }
  return `${origin}${path}${siteCode ? `?site=${encodeURIComponent(siteCode)}` : ''}`
}
