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

/**
 * 一行 portal_reference_page：它同时就是「路由清单」里的那一行。
 *
 * <p>一条路由从被发现到抓完都写在这同一行上（后端 V140 的那几列），所以界面不该长成两张表：
 * 「清单里有条目、页表里没这行」和反过来都是同一份数据的两个说法，两套口径迟早对不上。</p>
 *
 * <p>{@code rawHtmlKey} 只是后端自己的取证材料，前端拿不到也不该拿。</p>
 */
export interface ReferencePage {
  id: number
  referenceId: number
  tenantId?: number | null
  url: string | null
  depth: number | null
  /** 站内路径（如 /services）。一行 = 一条路由，同一页换个写法不会再长一行 */
  routePath: string | null
  /** 人工补录时给这一页起的名字，只在校对清单时用得上 */
  pageName: string | null
  /** static / hydrated，取值见 vocabularies().renderMode；空 = 这一页还没判过 */
  renderMode: string | null
  /** discovered / ok / not_found / blocked / offsite，见 vocabularies().crawlState；空 = T2 之前的老行 */
  crawlState: string | null
  /** 这一页是靠什么被发现的（原文链接 / 渲染后版面 / 人工补录），见 vocabularies().linkSource */
  linkSource: string | null
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
  /** null 表示映射不上，出现在「暂未对上现有区块」的积压清单里，而不是塞进 generic 容器 */
  mappedBlockKey: string | null
  confidence: number | null
  propsSuggestionJson: string | null
  humanVerified: boolean | null
  verifiedBy: string | null
  verifiedAt: string | null
  note: string | null
  createdAt: string | null
}

/**
 * 「暂未对上现有区块」积压清单的归并视图一行（后端 `/unmatched-groups`）：同一个观察区块只有一条。
 *
 * <p>为什么要有它而不是直接用 `ReferenceMapping[]`：按行显示时「47 条对不上」听着像缺 47 类能力，
 * 实际 18 行是页头页脚这类站级公共格子——模型只在第一页映射一次，其余每页各回一句「重复」。
 * 归并之后是 5 类，其中还分得出「白名单真没有」与「我们有、这一趟没再映射」。</p>
 */
export interface UnmatchedGroup {
  observedBlock: string
  /** true = 这个区块在本任务里映射成功过，积压只是重复声明；false = 白名单里真没有 */
  capabilityKnown: boolean
  rowCount: number
  paths: string[]
  note: string | null
}

export interface ReferenceCreateForm {
  sourceUrl?: string | null
  mode: string
  maxPages?: number | null
  obeyRobots?: boolean | null
}

/**
 * 人工补录一条路由。只收站内路径，不接受完整 URL：
 * 后端按本站 origin 拼地址，贴绝对地址就要在那里再判一次 SSRF 与跨站，而那一判已经有一份了。
 */
export interface ReferenceRouteForm {
  path: string
  pageName?: string | null
}

/**
 * 路由清单与取证证据那几套词的显示名，来自 `GET /portal/reference-sites/vocabularies`。
 *
 * <p>与 `/statuses` 同一条纪律：TS 里不抄第二份。这些取值会跟着家族判据与取证口径变，
 * 抄一份的结果是「后端写了一个新值、界面显示空白」——那是最难查的一种显示 bug。</p>
 *
 * <p>`requiredSignal` 尤其不能自己翻：那一格说的是「必填是从哪一路看出来的」，
 * 界面若把它写成「这个字段必填」，就把一条**取证线索**说成了一条**约束**
 * （我们的表单必填归服务端写死，区块侧没有必填开关槽）。原话照抄。</p>
 */
export interface ReferenceVocabularies {
  renderMode: Record<string, string>
  crawlState: Record<string, string>
  linkSource: Record<string, string>
  requiredSignal: Record<string, string>
  slotKind: Record<string, string>
  contentSlot: Record<string, string>
  interaction: Record<string, string>
}

/** 一格里图位的「需求单」：只有期望尺寸与一个语义描述词，没有别人的图片地址 */
export interface TemplateImageSpec {
  count?: number
  w?: number
  h?: number
  prompt?: string
}

/** 一格装得下什么槽位。key 的口径是我们自己区块的字段名，不是从别人页面上读来的 */
export interface TemplateSlotShape {
  key: string
  kind: string
  isArray?: boolean
  requiredSignal?: string
  imageSpec?: TemplateImageSpec
}

export interface TemplateSlotSection {
  order?: number
  tag?: string
  route?: string
  slots: TemplateSlotShape[]
  /** 槽位超过上限时后端给的那句中文，原样透出，不替它圆场 */
  slotNote?: string
}

/** 一组枚举（下拉 / 单选复选 / 筛选 tabs / 栅格卡片标题）。seenOn 是它出现在哪几条路由上 */
export interface TemplateVocabulary {
  key: string
  /** select / radio / checkbox / tabs / grid，来源形状，不是我们的栏目 */
  source: string
  items: Array<{ slug?: string; label?: string }>
  seenOn: string[]
}

export interface TemplateInteractionHint {
  kind: string
  seenOn: string[]
}

/**
 * 模板包（Spec-E §4）：这一站拆出来的 L0~L5 拼成的一份 JSON。
 *
 * <p>界面拿它给人看结构，出方案拿它当模型输入，两份共用同一个形状——所以这里不另设一套字段、
 * 也不在界面上替后端多算一个数。后端刻意不导出的东西（对方的文案、图片地址、原始 HTML）
 * 在这里也不该有对应字段。</p>
 */
export interface TemplatePackage {
  referenceSiteId: number
  sourceUrl: string | null
  status: string
  /** 认不出的家族后端直接不写这一格，界面原样显示即可 */
  family?: string | null
  routeCount: number
  crawledCount: number
  routes: Array<{
    path: string | null
    renderMode: string | null
    crawlState: string | null
    linkSource: string | null
  }>
  pages: Array<{ path: string | null; roles: string[]; slotShapes: TemplateSlotSection[] }>
  vocabulary: TemplateVocabulary[]
  /** 站级 token（这九支才是品牌色/圆角/密度的出处），段级值只作提示、不在此列 */
  tokens: Record<string, unknown>
  tokenVariedKeys: string[]
  interactionHints: TemplateInteractionHint[]
  unmatched: Array<{
    path: string | null
    observedBlock: string | null
    note: string | null
    confidence: number | null
  }>
}

/** 上传一张截图的结果：url 是后端签好的短期预览地址（默认 15 分钟），可直接给 img，过期后要重新取 */
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

/**
 * 建设链路的依赖体检（Spec §6.4 末尾那句「启用引导」）。
 *
 * 后端把「哪几道开关开着、缺什么该说什么」都算好了：`guidance` 就是给人看的那几句中文原话，
 * 里面点名的配置键与界面说法是同一份东西，前端重排或改写一次就和配置文件脱钩了。
 * 三个字段单独说清，别让界面替它们多说：
 * `sidecarConfigured`（配置启没启用）与 `sidecarReachable`（这一次探不探得通）不是一回事；
 * `visionModelReady` 只是查了有没有 `model_type=vision` 的配置行，没有真调过一次模型；
 * `probedTenantId` 是后端实际探测用的租户，没传 tenantId 时它是平台那一个，界面别自己填。
 */
export interface ReferenceCapabilities {
  sidecarConfigured: boolean
  sidecarReachable: boolean
  sidecarDetail: string
  crawlEnabled: boolean
  analyzeEnabled: boolean
  reviewAiEnabled: boolean
  assemblyEnabled: boolean
  visionModelReady: boolean
  probedTenantId: number
  guidance: string[]
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

  /** 路由清单与取证证据的七套显示名。见 {@link ReferenceVocabularies} 为什么不能在 TS 里抄 */
  vocabularies: () => http.get<ReferenceVocabularies>('/portal/reference-sites/vocabularies'),

  list: (status?: string | null) =>
    http.get<ReferenceSite[]>('/portal/reference-sites', { params: { status: status || undefined } }),

  get: (id: number) => http.get<ReferenceSite>(`/portal/reference-sites/${id}`),

  create: (data: ReferenceCreateForm) => http.post<ReferenceSite>('/portal/reference-sites', data),

  /**
   * 异步受理：返回的是刚推到 crawling 的任务行，不是「抓完了」。
   *
   * `pageIds` 空 = 老行为（从首页顺着链接爬）；传了就是「只跑我勾的那几条路由」。
   * 抓取不花钱，所以这一路不像 analyze 那样先 estimate。
   */
  crawl: (id: number, pageIds?: number[] | null) =>
    http.post<ReferenceSite>(`/portal/reference-sites/${id}/crawl`,
      pageIds?.length ? { pageIds } : undefined),

  /**
   * 路由清单第一步：只列路由，不抓页面、不调模型。异步受理，
   * 结论（发现几条、为什么一条都没有）写在任务行的「最近一次结果」那一格，清单本身从 {@link pages} 读。
   *
   * <p>它不改状态，所以跑完只能靠重读 /pages 看清单变没变长，不能收到 200 就弹「发现完成」。</p>
   */
  discoverRoutes: (id: number) =>
    http.post<ReferenceSite>(`/portal/reference-sites/${id}/discover-routes`),

  /** 人工补录一条路由：SPA 里那些只能靠代码跳过去、页面上没有入口的页 */
  addRoute: (id: number, data: ReferenceRouteForm) =>
    http.post<ReferencePage>(`/portal/reference-sites/${id}/routes`, data),

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

  /**
   * 「暂未对上现有区块」的积压清单，归并后的视图：同一个观察区块只有一条，带它出现在哪几页。
   *
   * 为什么界面不用 `/unmatched` 那份逐行清单：那一份是「后端事实的原始形状」，适合导出与机检；
   * 而人要看的是「我们缺几类能力」。两者差多少，2026-09-28 那趟第二家参考站实测过——47 行对不上，归并只有 5 类。
   */
  unmatchedGroups: (id: number) => http.get<UnmatchedGroup[]>(`/portal/reference-sites/${id}/unmatched-groups`),

  /**
   * 模板包：这一站拆出来的 L0~L5 拼成的一份只读 JSON。
   *
   * <p>为什么界面上要显示它而不是自己从 /pages 拼：出方案时喂给模型的就是这一份。两边各拼一遍，
   * 就会出现「审阅页看得见、模型读不到」——那是最难发现的一种能力浪费。</p>
   */
  templatePackage: (id: number) =>
    http.get<TemplatePackage>(`/portal/reference-sites/${id}/package`),

  /**
   * 参考站截图的素材地址（id → 后端现签的短期预览地址，默认 15 分钟）。
   *
   * 为什么不直接拿 media id 拼图片链接：`GET /api/media/files/{id}` 要求带 Authorization，
   * 而 `<img>` 发不出这个头，界面只会看到一排碎图。素材的可显示地址只有 /media 列表接口会给出来。
   *
   * 为什么截图不再是 `/uploads/...`：那是公网可读、永久有效的路径，而截图是别人家网站的界面，
   * 一次任务就是十几张。后端把这类素材落到公开目录之外，只经 `/api/media/preview/{id}` 发出来。
   * 代价是抽屉长时间开着不管它，缩略图会先到期（重新打开或点刷新即可），这是有意的取舍。
   */
  shotMedia: () =>
    http.get<{ records?: Array<{ id: number; url: string }> }>('/media', {
      // Spec-J：取证截图属系统素材组，/media 默认不列它——平台侧要显式 group=system 才拿得到
      params: { category: REFERENCE_SHOT_CATEGORY, group: 'system', page: 1, size: 200 }
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

  /**
   * 整条建设链路的依赖体检：它不属于某一个任务，而是「这一路能不能走通」的一次快照。
   *
   * tenantId 可空——不传时后端按平台探（平台有视觉模型就等于任何租户最差也有），
   * 探的是哪一个租户由响应里的 `probedTenantId` 说，前端不猜。
   * 这个口只读：这些开关控制的是服务端要不要真的对外发请求、要不要真的花 token，
   * 翻它仍然是改配置重启，界面上不该长出这个入口。
   */
  capabilities: (tenantId?: number | null) =>
    http.get<ReferenceCapabilities>('/portal/reference-sites/capabilities', {
      params: { tenantId: tenantId ?? undefined }
    }),
}

/**
 * 一次任务最多几页。真相在后端的 clamp（超出会被静默改小），这里只是把输入框的上限对齐，
 * 免得填了 20 却存成 12 而没人知道发生了什么。
 */
export const REFERENCE_MAX_PAGES_LIMIT = 12

/**
 * 词表查名：认不出的取值原样显示。
 *
 * <p>后端写了一个前端没见过的新值时，界面宁可显示 `offsite` 这样的原文，也不要显示空白——
 * 空白会让人以为「这一格没值」，而它其实「有值，只是这份词表旧了」。</p>
 */
export function referenceLabel(
  vocabularies: ReferenceVocabularies | null,
  group: keyof ReferenceVocabularies,
  value: string | null | undefined
): string {
  if (!value) return '—'
  return vocabularies?.[group]?.[value] || value
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

/**
 * token 的两层：`site` 是浏览器量出来的、会搬进真的样式变量；`sectionHints` 只是「这一格里出现过
 * 哪些取值」的证据，永不上身（拍板 P-9）。
 *
 * <p>为什么界面必须把它们分开说：这两半的可信度差一个量级，而「这一站的圆角是 12px」和
 * 「这一格的 class 里出现过 12px」在旧的扁平形状里长得一模一样。T3 之前的老行没有分层，
 * 后端按站级读，这里也按站级显示，并保持 `legacy` 为真——别把老行说成「分层采样过」。</p>
 */
export interface TokenLayers {
  site: Record<string, unknown> | null
  sectionHints: Array<{ tag?: string; name?: string; tokens?: Record<string, string[]> }>
  /** 这一行是 T3 之前的扁平形状：它的取值仍按站级看，但它没有段级证据 */
  legacy: boolean
}

export function tokenLayersOf(page: Pick<ReferencePage, 'designTokensJson'>): TokenLayers | null {
  const tokens = designTokensOf(page)
  if (!tokens) return null
  const layered = 'site' in tokens || 'sectionHints' in tokens
  if (!layered) return { site: tokens, sectionHints: [], legacy: true }
  const site = tokens.site
  return {
    site: site && typeof site === 'object' && Object.keys(site as object).length
      ? (site as Record<string, unknown>)
      : null,
    sectionHints: Array.isArray(tokens.sectionHints)
      ? (tokens.sectionHints as TokenLayers['sectionHints'])
      : [],
    legacy: false
  }
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
