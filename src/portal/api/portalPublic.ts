/**
 * 门户公开接口封装（访客侧，不带任何登录态）。
 *
 * 与后台的 src/api/http.ts 严格分开：这里用裸 axios，不带 Authorization、不带租户头。
 * 站点身份只由访问域名决定，本地预览用 ?site={租户代码} 显式指定，
 * 该参数只在后端打开 app.portal.allow-site-param 时生效（生产关闭）。
 */
import axios from 'axios'
import { resolveSiteCode } from './portalData'

const BASE = '/api/portal/public'

export interface PortalSeo {
  seoTitle: string | null
  seoDescription: string | null
  seoKeywords: string | null
  canonicalUrl: string | null
  robotsMeta: string | null
  ogTitle: string | null
  ogDescription: string | null
  ogImage: string | null
  schemaJson: string | null
  faqJson: string | null
}

export interface PortalCompanyBrief {
  name: string | null
  logo: string | null
  description: string | null
  copyright: string | null
  phone: string | null
  email: string | null
  address: string | null
}

export interface PortalTemplateInfo {
  code: string | null
  name: string | null
  renderKey: string | null
}

export interface PortalNavItem {
  title: string
  url: string
  articleCount: number | null
}

export interface PortalSiteShell {
  siteId: number
  siteName: string | null
  siteCode: string | null
  baseUrl: string | null
  company: PortalCompanyBrief
  seo: PortalSeo | null
  template: PortalTemplateInfo
  nav: PortalNavItem[]
}

export interface PortalArticleItem {
  id: number
  slug: string | null
  title: string | null
  summary: string | null
  coverImage: string | null
  publishedAt: string | null
  categoryName: string | null
  categorySlug: string | null
  tags: string[]
  link: string
}

export interface PortalArticleRef {
  id: number
  slug: string | null
  title: string | null
  link: string
}

export interface PortalArticleDetail {
  id: number
  slug: string | null
  title: string | null
  summary: string | null
  contentMd: string | null
  contentHtml: string | null
  coverImage: string | null
  publishedAt: string | null
  categoryName: string | null
  categorySlug: string | null
  tags: string[]
  source: string | null
  authorName: string | null
  /** AI 引用要点（article_version.geo_citation_summary），没有则为 null，界面不占位 */
  citationSummary: string | null
  seo: PortalSeo | null
  prev: PortalArticleRef | null
  next: PortalArticleRef | null
  link: string
}

export interface PortalCaseDetail {
  id: number
  title: string | null
  summary: string | null
  content: string | null
  coverImage: string | null
  customerName: string | null
  industry: string | null
  tags: string[]
  publishedAt: string | null
  seo: PortalSeo | null
  link: string
}

export interface PortalCategoryNode {
  id: number
  name: string
  slug: string | null
  description: string | null
  parentId: number | null
  sortOrder: number | null
  articleCount: number
  link: string
  children: PortalCategoryNode[]
}

export interface PortalJobItem {
  id: number
  title: string
  department: string | null
  jobType: string | null
  location: string | null
  salaryText: string | null
  experienceReq: string | null
  educationReq: string | null
  description: string | null
  requirements: string | null
  benefits: string | null
  publishAt: string | null
}

export interface PortalPage<T> {
  records: T[]
  total: number
  page: number
  size: number
}

export class PortalApiError extends Error {
  readonly status: number
  readonly code: string

  constructor(message: string, status: number, code: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

async function get<T>(path: string, params: Record<string, unknown> = {}): Promise<T> {
  const site = resolveSiteCode()
  try {
    const response = await axios.get(path, { params: { ...(site ? { site } : {}), ...params } })
    const body = response.data
    if (body && body.success && body.data !== undefined) {
      return body.data as T
    }
    throw new PortalApiError(body?.message || '门户数据获取失败', response.status, body?.code || 'ERROR')
  } catch (error) {
    if (error instanceof PortalApiError) {
      throw error
    }
    const status = axios.isAxiosError(error) ? error.response?.status ?? 0 : 0
    const code = axios.isAxiosError(error) ? error.response?.data?.code ?? 'ERROR' : 'ERROR'
    const message = axios.isAxiosError(error) ? error.response?.data?.message : undefined
    throw new PortalApiError(message || '门户数据获取失败', status, code)
  }
}

export function fetchSiteShell(): Promise<PortalSiteShell> {
  return get<PortalSiteShell>(`${BASE}/site`)
}

export function fetchTemplate(): Promise<PortalTemplateInfo> {
  return get<PortalTemplateInfo>(`${BASE}/template`)
}

export function fetchArticles(params: { category?: string; page?: number; size?: number } = {}) {
  return get<PortalPage<PortalArticleItem>>(`${BASE}/articles`, params)
}

/** 详情 key 可能是中文 slug：这里统一编码，路由参数拿到的是已解码值 */
export function fetchArticle(idOrSlug: string | number): Promise<PortalArticleDetail> {
  return get<PortalArticleDetail>(`${BASE}/articles/${encodeURIComponent(String(idOrSlug))}`)
}

export function fetchCases(params: { page?: number; size?: number } = {}) {
  return get<PortalPage<PortalCaseItem>>(`${BASE}/cases`, params)
}

export interface PortalCaseItem {
  id: number
  title: string | null
  customerName: string | null
  industry: string | null
  summary: string | null
  coverImage: string | null
  link: string
}

export function fetchCase(id: number | string): Promise<PortalCaseDetail> {
  return get<PortalCaseDetail>(`${BASE}/cases/${id}`)
}

export function fetchCategories(): Promise<PortalCategoryNode[]> {
  return get<PortalCategoryNode[]>(`${BASE}/categories`)
}

export function fetchJobs(params: { page?: number; size?: number } = {}) {
  return get<PortalPage<PortalJobItem>>(`${BASE}/jobs`, params)
}
