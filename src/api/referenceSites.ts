import http from './http'
import type { PortalPage } from './portalPages'

/**
 * 参考站摄取（Spec §7）的管理端接口。
 *
 * 三条与工单那条链路相同的纪律：
 * 1. 状态词表只从 `GET /portal/reference-sites/statuses` 取，TS 里不抄第二份（抄了就不会跟着后端变）；
 * 2. 烧钱的动作（analyze）必须先 estimate、再显式 confirm:true；抓取与上传截图不花钱；
 * 3. 界面绝不替后端「推进状态」：crawl / analyze 都是异步受理，响应里的 status 才是真相，
 *    in-flight 状态必须靠轮询看它变，不能收到 200 就弹「已完成」。
 */

/** 一行 portal_reference_site。没有 applied 状态：出过草稿页由 portal_page_version.reference_id 反查 */
export interface ReferenceSite {
  id: number
  tenantId?: number | null
  /** 截图任务可以没有地址 */
  sourceUrl: string | null
  /** url / screenshot_upload，取值见后端 ReferenceSite.MODE_* */
  mode: string
  /** 取值见 statusLabels()，只能由动作产生 */
  status: string
  maxPages: number | null
  obeyRobots: boolean | null
  pagesCrawled: number | null
  /** 失败或被降级的中文原因，界面上原样透出，不替后端编理由 */
  errorMessage: string | null
  createdBy: string | null
  createdAt: string | null
  finishedAt: string | null
}

/** 任务里抓到的一个页面（或一组截图）。rawHtmlKey 只是取证材料，前端拿不到也不该拿 */
export interface ReferencePage {
  id: number
  referenceId: number
  tenantId?: number | null
  url: string | null
  depth: number | null
  shotDesktopId: number | null
  shotTabletId: number | null
  shotMobileId: number | null
  domSummaryJson: string | null
  designTokensJson: string | null
  observedSectionsJson: string | null
  robotsAllowed: boolean | null
  fetchedAt: string | null
}

/** 观察区块 → 白名单区块的一条映射。confidence 只是排序依据，humanVerified 才是决定权 */
export interface ReferenceMapping {
  id: number
  referencePageId: number
  tenantId?: number | null
  observedBlock: string | null
  /** null 表示映射不上，出现在「需要新区块」的积压清单里，而不是塞进 generic 容器 */
  mappedBlockKey: string | null
  confidence: number | null
  propsSuggestionJson: string | null
  humanVerified: boolean | null
  verifiedBy: string | null
  verifiedAt: string | null
  note: string | null
  createdAt: string | null
}

export interface ReferenceCreateForm {
  sourceUrl?: string | null
  mode: string
  maxPages?: number | null
  obeyRobots?: boolean | null
}

/** 上传一张截图的结果：url 是 /uploads/... 的素材地址，可直接给 img */
export interface UploadedShot {
  referencePageId: number
  viewport: string
  mediaId: number
  url: string
}

export interface ReferenceEstimate {
  referenceId: number
  estimatedTokens: number
  remainingTokens: number
  aiEnabled: boolean
  /** 后端给的那句「当前未开启，确认也不会调用」原话，界面上不重写一遍 */
  notice: string | null
}

export interface VerifyForm {
  mappedBlockKey?: string | null
  propsSuggestionJson?: string | null
  /** false 表示「这条不认」：后端会把区块打回未映射并留原因，而不是删行 */
  humanVerified: boolean
  note?: string | null
}

export interface ApplyForm {
  /** 用哪一页的映射搭页面；不传后端自己挑（通常首页那份结构最完整） */
  referencePageId?: number | null
  siteId?: number | null
  slug?: string | null
  title?: string | null
  note?: string | null
}

/** 应用结果：界面要的就是「几块进来了、有几块没确认所以没进来」这两个数 */
export interface AppliedResult {
  page: PortalPage
  blocks: number
  skippedUnverified: number
}

/** 截图在素材库里的分类名，与后端 ReferencePage.SHOT_CATEGORY 同一个字面量（抓取与上传共用） */
export const REFERENCE_SHOT_CATEGORY = 'reference-shot'

/**
 * 任务模式。后端没有暴露 modes 端点（只有两个常量，且新模式必然伴随新行为），
 * 所以这里给的是「显示名」而不是词表：遇到不认识的值原样显示，不替后端编一个中文名。
 */
export const REFERENCE_MODE_LABELS: Record<string, string> = {
  url: '按网址抓取',
  screenshot_upload: '上传截图',
}

/** 截图三视口。字面量与后端 ReferenceScraperClient.DESKTOP/TABLET/MOBILE 及页表那三列同名 */
export const REFERENCE_VIEWPORTS = [
  { value: 'desktop', label: '桌面', mediaField: 'shotDesktopId' as const },
  { value: 'tablet', label: '平板', mediaField: 'shotTabletId' as const },
  { value: 'mobile', label: '手机', mediaField: 'shotMobileId' as const },
]

export function referenceModeLabel(mode: string | null | undefined): string {
  if (!mode) return '—'
  return REFERENCE_MODE_LABELS[mode] || mode
}

/** 还没落地的中间态：只有这几种状态值得轮，done/failed/needs_human 停下来等人看 */
export const REFERENCE_IN_FLIGHT = ['pending', 'crawling', 'analyzing', 'mapping']

export function referenceIsRunning(status: string | null | undefined): boolean {
  return !!status && REFERENCE_IN_FLIGHT.includes(status)
}

export const portalReferenceApi = {
  statusLabels: () => http.get<Record<string, string>>('/portal/reference-sites/statuses'),

  list: (status?: string | null) =>
    http.get<ReferenceSite[]>('/portal/reference-sites', { params: { status: status || undefined } }),

  get: (id: number) => http.get<ReferenceSite>(`/portal/reference-sites/${id}`),

  create: (data: ReferenceCreateForm) => http.post<ReferenceSite>('/portal/reference-sites', data),

  /** 异步受理：返回的是刚推到 crawling 的任务行，不是「抓完了」 */
  crawl: (id: number) => http.post<ReferenceSite>(`/portal/reference-sites/${id}/crawl`),

  pages: (id: number) => http.get<ReferencePage[]>(`/portal/reference-sites/${id}/pages`),

  /**
   * 人工上传一张截图（截图任务唯一的进料口，也是 sidecar 不可用时补三视口的口子）。
   * viewport 必填、后端不猜：挂错视口会让审阅者对着一张 1440 宽的图判断手机布局。
   */
  uploadShot: (id: number, viewport: string, file: File, referencePageId?: number | null) => {
    const formData = new FormData()
    formData.append('file', file)
    return http.post<UploadedShot>(`/portal/reference-sites/${id}/upload-shot`, formData, {
      params: { viewport, referencePageId: referencePageId ?? undefined },
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },

  mappings: (id: number) => http.get<ReferenceMapping[]>(`/portal/reference-sites/${id}/mappings`),

  /** 「需要新区块」的积压清单：mapped_block_key 为空的那些行 */
  unmatched: (id: number) => http.get<ReferenceMapping[]>(`/portal/reference-sites/${id}/unmatched`),

  /**
   * 参考站截图的素材地址（id → /uploads/... 公开路径）。
   *
   * 为什么不直接拿 media id 拼图片链接：`GET /api/media/files/{id}` 要求带 Authorization，
   * 而 `<img>` 发不出这个头，界面只会看到一排碎图。素材的公开路径只有 /media 列表接口会回给前端。
   */
  shotMedia: () =>
    http.get<{ records?: Array<{ id: number; url: string }> }>('/media', {
      params: { category: REFERENCE_SHOT_CATEGORY, page: 1, size: 200 }
    }),

  /** 只估算不烧钱：两步提示词都渲染，但一次模型都不调（决策 D4） */
  analyzeEstimate: (id: number) =>
    http.post<ReferenceEstimate>(`/portal/reference-sites/${id}/analyze-estimate`),

  /** 同样是异步受理；confirm 必须是用户勾过的那个值，false 时后端直接报中文错 */
  analyze: (id: number, confirm: boolean) =>
    http.post<ReferenceSite>(`/portal/reference-sites/${id}/analyze`, { confirm }),

  verify: (id: number, mappingId: number, data: VerifyForm) =>
    http.post<ReferenceMapping>(`/portal/reference-sites/${id}/mappings/${mappingId}/verify`, data),

  /** 只出 status=draft 的草稿页，发布仍然归租户自己按 */
  apply: (id: number, data: ApplyForm) =>
    http.post<AppliedResult>(`/portal/reference-sites/${id}/apply`, data),
}

/** 结构摘要的形状：{title,textLength,sections:[{tag,name,heading,textLength,links,images,listItems,buttons,forms}],headings,navLinks,signals} */
export interface DomSummary {
  title?: string
  textLength?: number
  sections?: Array<Record<string, unknown> & { name?: string; heading?: string; tag?: string }>
  signals?: Record<string, boolean>
}

/**
 * 解析结构摘要。坏了就当没有：这里返回 null，界面显「暂无结构摘要」。
 * 不能返回一个空对象充数——那会让「抓到了但没摘要」和「摘要读不懂」看起来一样。
 */
export function domSummaryOf(page: Pick<ReferencePage, 'domSummaryJson'>): DomSummary | null {
  return parseJson<DomSummary>(page.domSummaryJson, value => typeof value === 'object')
}

/** 模型归纳出的版式骨架：{sections:[{sectionIndex,role,evidence,structure}]} */
export function observedSectionsOf(
  page: Pick<ReferencePage, 'observedSectionsJson'>
): Array<Record<string, unknown> & { role?: string; evidence?: string; sectionIndex?: number }> {
  const parsed = parseJson<{ sections?: unknown }>(page.observedSectionsJson, value => typeof value === 'object')
  return Array.isArray(parsed?.sections) ? (parsed.sections as Array<Record<string, unknown>>) : []
}

/** 浏览器计算样式采样出的 design token 集，值域受 LayoutValidator 白名单约束 */
export function designTokensOf(page: Pick<ReferencePage, 'designTokensJson'>): Record<string, unknown> | null {
  return parseJson<Record<string, unknown>>(page.designTokensJson, value => typeof value === 'object')
}

/** 建议填进槽位的内容：只允许字面文本或 {"$data":键} 绑定 */
export function propsSuggestionOf(mapping: Pick<ReferenceMapping, 'propsSuggestionJson'>): Record<string, unknown> {
  const parsed = parseJson<Record<string, unknown>>(mapping.propsSuggestionJson, value => typeof value === 'object')
  return parsed && typeof parsed === 'object' ? parsed : {}
}

/** 摘要里认得出的区块格数——没有摘要就返回 null，界面据此区分「0 格」和「还没算过」 */
export function sectionCountOf(page: ReferencePage): number | null {
  const summary = domSummaryOf(page)
  if (!summary) return null
  return Array.isArray(summary.sections) ? summary.sections.length : 0
}

function parseJson<T>(raw: string | null | undefined, shape: (value: unknown) => boolean): T | null {
  if (!raw) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    return shape(parsed) ? (parsed as T) : null
  } catch (error) {
    return null
  }
}
