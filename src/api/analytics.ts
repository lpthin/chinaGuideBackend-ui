import http from './http'

/**
 * 门户访问统计（后台报表）。
 *
 * 两个口径来自两套采集，接口层面就是两组字段，前端不得把它们加成一个数字：
 * - 人工浏览（pageviews / uniqueVisitors / avgDurationMs / pages）＝门户前端埋点；
 * - 抓取（bot 分组、trend.aiCrawlerHits）＝服务端按 User-Agent 识别，
 *   后端只能看到 /robots.txt、/sitemap.xml、/llms.txt 与门户公开 API，
 *   所以它表示「抓了 SEO 文件 / 抓了门户接口」，不是页面浏览量。
 */
export interface AnalyticsRangeParams {
  tenantId?: number | null
  from?: string
  to?: string
}

export interface AnalyticsOverview {
  tenantId: number
  from: string
  to: string
  pageviews: number
  uniqueVisitors: number
  durationEvents: number
  avgDurationMs: number | null
  /** true = 该区间一条埋点都没采到，界面要显示「未采集到数据」而不是 0 */
  empty: boolean
}

export interface AnalyticsPageHit {
  pageUrl: string
  pageType: string | null
  count: number
  visitors: number
}

export interface AnalyticsBotSlice {
  botCategory: string
  hits: number
  topPages: AnalyticsPageHit[]
}

export interface AnalyticsBotSummary {
  from: string
  to: string
  slices: AnalyticsBotSlice[]
  empty: boolean
}

export interface AnalyticsPagesResult {
  from: string
  to: string
  pages: AnalyticsPageHit[]
  empty: boolean
}

export interface AnalyticsTrendPoint {
  date: string
  pageviews: number
  uniqueVisitors: number
  botHits: number
  aiCrawlerHits: number
}

export interface AnalyticsTrendResult {
  from: string
  to: string
  points: AnalyticsTrendPoint[]
  empty: boolean
}

function rangeParams({ tenantId, from, to }: AnalyticsRangeParams) {
  return {
    tenantId: tenantId ?? undefined,
    from: from || undefined,
    to: to || undefined,
  }
}

export const analyticsApi = {
  overview: (params: AnalyticsRangeParams = {}) =>
    http.get<AnalyticsOverview>('/analytics/overview', { params: rangeParams(params) }),
  bot: (params: AnalyticsRangeParams & { top?: number } = {}) =>
    http.get<AnalyticsBotSummary>('/analytics/bot', {
      params: { ...rangeParams(params), top: params.top ?? 5 },
    }),
  pages: (params: AnalyticsRangeParams & { limit?: number } = {}) =>
    http.get<AnalyticsPagesResult>('/analytics/pages', {
      params: { ...rangeParams(params), limit: params.limit ?? 10 },
    }),
  trend: (params: AnalyticsRangeParams = {}) =>
    http.get<AnalyticsTrendResult>('/analytics/trend', { params: rangeParams(params) }),
}

/** bot_category 的中文显示名：报表上必须写清每类是什么，unknown 不能冒充爬虫 */
export const BOT_CATEGORY_LABELS: Record<string, string> = {
  'ai-crawler': 'AI 抓取（服务端识别）',
  'search-engine': '搜索引擎收录',
  feed: 'RSS/订阅抓取',
  monitor: '可用性监测',
  unknown: '未标识来源（空 UA）',
  human: '真人浏览（埋点）',
}

export function botCategoryLabel(category: string): string {
  return BOT_CATEGORY_LABELS[category] || category
}

/** page_view_log.page_type 的中文显示名；portal-api / seo-file 是服务端口径，必须和门户页面区分开 */
export const PAGE_TYPE_LABELS: Record<string, string> = {
  home: '首页',
  article: '文章详情',
  case: '案例详情',
  list: '列表页',
  category: '栏目页',
  about: '关于我们',
  services: '服务页',
  contact: '联系页',
  jobs: '招聘页',
  'portal-api': '门户接口（服务端）',
  'seo-file': 'SEO 文件（服务端）',
  other: '其他',
}

export function pageTypeLabel(pageType: string | null): string {
  if (!pageType) return '未标注'
  return PAGE_TYPE_LABELS[pageType] || pageType
}
