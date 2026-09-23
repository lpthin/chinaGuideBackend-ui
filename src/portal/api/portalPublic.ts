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
  /** 站点是否走「区块白名单页面模型」；false/undefined 时门户仍用旧模板渲染（灰度开关，见 site.page_model_enabled） */
  pageModelEnabled?: boolean | null
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

/**
 * 页面模型：访客拿到的区块序列（后端 RenderedPage）。
 *
 * props 里的 {"$data":...} 已在服务端解析完，前端拿不到也不需要知道数据从哪来；
 * rendererKey 只允许命中 src/portal/blocks/registry.ts 里登记的组件，命不中就整块不渲染。
 */
export interface RenderedBlock {
  instanceId: string
  blockKey: string
  rendererKey: string
  props: Record<string, unknown>
}

export interface RenderedPageSeo {
  title: string | null
  description: string | null
  keywords: string | null
}

export interface RenderedPage {
  id: number
  slug: string | null
  path: string | null
  title: string | null
  pageKind: string | null
  theme: Record<string, string | number> | null
  seo: RenderedPageSeo | null
  blocks: RenderedBlock[] | null
  skippedBlocks: string[] | null
  /** 只有预览令牌那条路会填；访客正常访问永远是 undefined，界面据此显示「这是预览页」提示条 */
  reviewLabel?: string | null
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

async function request<T>(method: 'get' | 'post', path: string, payload: Record<string, unknown> = {}): Promise<T> {
  const site = resolveSiteCode()
  const params = { ...(site ? { site } : {}) }
  try {
    const response = method === 'get'
      ? await axios.get(path, { params: { ...params, ...payload } })
      : await axios.post(path, payload, { params })
    const body = response.data
    if (body && typeof body.success === 'boolean') {
      // 判成功的唯一依据是 success：/tickets 这类无返回值端点的 data 就是 null，
      // 拿 data!==undefined 当成功条件会把一次正常的提交报成失败。
      if (body.success) return body.data as T
      throw new PortalApiError(body.message || '门户数据获取失败', response.status, body.code || 'ERROR')
    }
    throw new PortalApiError('门户返回了无法识别的数据结构', response.status, 'BAD_PAYLOAD')
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

function get<T>(path: string, params: Record<string, unknown> = {}): Promise<T> {
  return request<T>('get', path, params)
}

/**
 * 访客侧唯一的写路径：预览令牌下的改版工单。
 *
 * 后端对「令牌无效」也返回 success:true 且什么都不落库（不给探测者区分无效/过期/内容非法的信号），
 * 所以调用方不能只看状态码判断「已提交」，必须带一句「已收到，运营会处理」这种不承诺结果的文案。
 */
function post<T>(path: string, payload: Record<string, unknown> = {}): Promise<T> {
  return request<T>('post', path, payload)
}

export function fetchSiteShell(): Promise<PortalSiteShell> {
  return get<PortalSiteShell>(`${BASE}/site`)
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

/**
 * 取一个已发布页面的区块序列。slug 用 PortalUrls.slugOfPath 从访客地址反推：
 * / → home、/about → about、/p/my-page → my-page。
 * 未发布或不存在的页面后端返回 404 + 中文消息，这里原样抛 PortalApiError，不做「返回首页」的降级
 * ——把 404 变成首页会让爬虫以为站点内容错位，也会掩盖站点没建页面这个真实问题。
 */
export function fetchPublicPage(slug: string): Promise<RenderedPage> {
  return get<RenderedPage>(`${BASE}/p/${encodeURIComponent(slug)}`)
}

/**
 * 预览链接访客侧：用令牌取这一页（草稿状态也能看到，这正是令牌存在的理由）。
 * 令牌无效/过期时后端回 404 + 中文「预览链接无效或已过期」，这里原样抛错，界面显示一句人话即可。
 */
export function fetchReviewPage(token: string): Promise<RenderedPage> {
  return get<RenderedPage>(`${BASE}/review/${encodeURIComponent(token)}/page`)
}

/**
 * 提交一条改版工单。字段严格限制在后端白名单内：
 * blockInstanceId / blockKey / path / viewport / clientText / intent。
 * path 只是给人看的定位线索，后端认的是令牌里的页面 id，所以这里不传 pageId。
 */
export interface ReviewTicketPayload {
  blockInstanceId?: string | null
  blockKey?: string | null
  path?: string | null
  viewport?: string | null
  clientText?: string | null
  intent?: string | null
}

export function submitReviewTicket(token: string, payload: ReviewTicketPayload): Promise<void> {
  return post<void>(`${BASE}/review/${encodeURIComponent(token)}/tickets`, payload as Record<string, unknown>)
}

/**
 * 采集器的动作枚举词表（值 → 中文标签），来自后端白名单。
 * 令牌无效时后端回空对象，界面就不显示下拉——不猜、不在 TS 里抄一份兜底。
 */
export function fetchReviewIntentOptions(token: string): Promise<Record<string, string>> {
  return get<Record<string, string>>(`${BASE}/review/${encodeURIComponent(token)}/options`)
}
