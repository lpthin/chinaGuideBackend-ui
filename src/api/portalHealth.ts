import http from './http'

/**
 * 门户页面巡检（Spec §8.2）的管理端接口。
 *
 * 三条与工单/参考站一致的纪律：
 * 1. 类型名、状态名、以及「这条能不能让 AI 出手」全部取自 `GET /portal/health/options`，
 *    这里不抄第二份词表——抄了就不会跟着后端变，按钮也会在被禁的类型上照样亮着；
 * 2. 烧钱的动作先 estimate 再 confirm:true，而 estimate 一次模型都不调；
 * 3. 界面绝不替后端推进状态：dismiss/reopen/ai-fix 的响应行才是真相，
 *    「页面没有被改」是这一页最重要的一条结论，所以这里连页面更新接口都不 import。
 */

/** 一行 portal_health_finding。注意没有「修复中」这类中间态：只有 open / dismissed / resolved */
export interface HealthFinding {
  id: number
  tenantId?: number | null
  siteId: number
  /** 站点级问题（比如两个页面抢同一个地址）没有对应的单页，这里是 null */
  pageId: number | null
  /** 取值见 options().types 的键；不认识的值原样显示 */
  findingType: string
  /** 判重键，同一处问题反复扫只会推进 lastSeenAt，不会长出新行 */
  dedupKey: string
  message: string
  status: string
  firstSeenAt: string | null
  lastSeenAt: string | null
  resolvedAt: string | null
  dismissReason: string | null
  /** AI_DRAFT 那一档产出的待审阅草稿 id；null 表示还没出手 */
  draftId: number | null
  /** AI_SUGGESTION 那一档产出的建议原文（JSON），由人贴回页面元信息 */
  suggestionJson: string | null
  createdAt: string | null
  updatedAt: string | null
}

/** 一种 finding 的中文说法与处置口径 */
export interface HealthType {
  key: string
  label: string
  /** none 不出手；suggestion 只给一段 SEO 建议；draft 走页面改版草稿那条流水线 */
  aiFixMode: string
  hint: string
}

export interface HealthOptions {
  types: Record<string, HealthType>
  statuses: Record<string, string>
}

export interface HealthScanResult {
  siteId: number
  siteName: string
  pagesScanned: number
  opened: number
  reconfirmed: number
  resolved: number
  dismissed: number
  scannedAt: string | null
}

export interface HealthEstimate {
  findingId: number
  findingType: string
  aiFixMode: string
  estimatedTokens: number
  remainingTokens: number
  /** 后端那个总开关。关掉时这里就是 false，界面上按钮直接灰掉而不是点了报中文错 */
  aiFixEnabled: boolean
  notice: string | null
}

/**
 * AI_SUGGESTION 的载荷形状。键名逐个对着后端 HealthFixService 写建议的那几行抄：
 * 四个可贴回页面的字段 + pageKind（读的时候认得出这是哪类页）+ warnings。
 */
export interface SeoSuggestion {
  seoTitle?: string
  seoDescription?: string
  seoKeywords?: string
  /** 模型自己说这段是从页面哪部分文字归纳来的 */
  reason?: string
  pageKind?: string
  /** 门禁 4 的提示（疑似照抄参考站文案）。warn 档不拦，但必须让人看见，不能吞掉 */
  warnings?: string[]
  [key: string]: unknown
}

/** 「让 AI 出手」那三种模式。字面量与后端 HealthFindingTypes.AI_* 同名 */
export const HEALTH_AI_NONE = 'none'
export const HEALTH_AI_SUGGESTION = 'suggestion'
export const HEALTH_AI_DRAFT = 'draft'

export const portalHealthApi = {
  /** 词表：类型（含中文名、修法说明、AI 能不能出手）+ 状态标签 */
  options: () => http.get<HealthOptions>('/portal/health/options'),

  /** 默认只看待处理：status 不传时后端按 open 查，翻历史要显式给值 */
  findings: (params?: { siteId?: number | null; status?: string | null; type?: string | null }) =>
    http.get<HealthFinding[]>('/portal/health/findings', {
      params: {
        siteId: params?.siteId ?? undefined,
        status: params?.status || undefined,
        type: params?.type || undefined
      }
    }),

  finding: (id: number) => http.get<HealthFinding>(`/portal/health/findings/${id}`),

  /** 手动扫描：只读页面与内容表，不改任何内容，也不调模型 */
  scan: (siteId?: number | null) =>
    http.post<HealthScanResult>('/portal/health/scan', null, { params: { siteId: siteId ?? undefined } }),

  /** reason 必填：不写理由的忽略等于把问题藏起来，后端同样判 */
  dismiss: (id: number, reason: string) =>
    http.post<HealthFinding>(`/portal/health/findings/${id}/dismiss`, { reason }),

  reopen: (id: number) => http.post<HealthFinding>(`/portal/health/findings/${id}/reopen`),

  estimate: (id: number) => http.post<HealthEstimate>(`/portal/health/findings/${id}/ai-fix-estimate`),

  aiFix: (id: number, confirm: boolean) =>
    http.post<HealthFinding>(`/portal/health/findings/${id}/ai-fix`, { confirm })
}

/**
 * 读出一段 SEO 建议。解析不了返回 null，界面显「建议内容读取失败」并把原文显示出来。
 * 不能返回空对象充数——那会让「模型没给描述」和「这段 JSON 坏了」看起来一样。
 */
export function seoSuggestionOf(finding: Pick<HealthFinding, 'suggestionJson'>): SeoSuggestion | null {
  if (!finding.suggestionJson) return null
  try {
    const parsed: unknown = JSON.parse(finding.suggestionJson)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as SeoSuggestion) : null
  } catch {
    return null
  }
}

/** 状态色只是可读性，语义一律用后端给的中文标签，这里不翻译第二套 */
export function healthStatusColor(status: string | null | undefined): string {
  if (status === 'open') return 'red'
  if (status === 'resolved') return 'green'
  if (status === 'dismissed') return 'default'
  return 'default'
}
