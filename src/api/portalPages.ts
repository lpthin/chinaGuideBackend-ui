import http from './http'

/**
 * 门户「页面即数据」管理端接口（需登录）。
 *
 * 这里刻意没有万能 PUT：改结构与改元信息是两个接口，发布/下线/回滚是动作而不是字段。
 * 原因和文章状态机一样——把 status 塞进保存接口就等于允许绕过状态机（后端 PortalPageController:24-27 同口径）。
 * layout 保存必带 baseVersion，冲突时后端回 409，http.ts 已映射成「数据已被他人修改，请刷新后重试」。
 */

/** 一行 portal_page。layoutJson/themeJson 是 JSON 字符串，字段名与后端实体逐字对齐 */
export interface PortalPage {
  id: number
  tenantId?: number | null
  siteId?: number | null
  slug: string | null
  title: string | null
  pageKind: string | null
  layoutJson: string | null
  themeJson: string | null
  navVisible: boolean | null
  navSort: number | null
  status: string
  seoTitle: string | null
  seoDescription: string | null
  seoKeywords: string | null
  isDemo?: boolean | null
  version: number | null
  publishedAt: string | null
  createdBy: string | null
  createdAt: string | null
  updatedAt: string | null
}

/** 页面版本快照：谁改的、改了什么、由哪张工单或哪个参考站任务引起 */
export interface PortalPageVersion {
  id: number
  pageId: number
  versionNo: number
  title: string | null
  layoutJson: string | null
  themeJson: string | null
  changeSource: string | null
  ticketId: number | null
  referenceId: number | null
  note: string | null
  createdBy: string | null
  createdAt: string | null
}

export interface LayoutForm {
  /** 乐观锁基线；不传则后端不做冲突检查，构建器必须始终传 */
  baseVersion?: number | null
  layoutJson?: string | null
  themeJson?: string | null
  changeSource?: string | null
  ticketId?: number | null
  referenceId?: number | null
  note?: string | null
}

export interface ValidateResult {
  errors: string[]
  knownBlocks: string[]
}

/** 区块元数据：面板列表与 props 表单的唯一数据源，和后端 LayoutValidator 同源 */
export interface PortalBlockMeta {
  blockKey: string
  name: string
  category: string
  maxInstances: number
  rendererKey: string
  /** props 的 JSON Schema，additionalProperties=false */
  dataSchema: Record<string, unknown> | null
  /** $data 绑定的允许来源清单 */
  bindingSchema: { allowedSources?: string[]; note?: string } | null
  themeSlots: string[] | null
}

export const portalPagesApi = {
  /**
   * 页面状态词表：唯一真相在后端 PageStatuses.labels()。
   * 这里曾经抄过一份 draft/published/offline 的中文映射，抄出来的那份不会跟着后端变，
   * 于是筛选下拉能选到一个后端不认的状态——所有状态词表都只从接口取。
   */
  statusLabels: () => http.get<Record<string, string>>('/portal/pages/statuses'),

  changeSourceLabels: () => http.get<Record<string, string>>('/portal/pages/change-sources'),

  list: (params: { siteId?: number | null; status?: string; pageKind?: string } = {}) =>
    http.get<PortalPage[]>('/portal/pages', {
      params: {
        siteId: params.siteId ?? undefined,
        status: params.status || undefined,
        pageKind: params.pageKind || undefined,
      },
    }),

  get: (id: number) => http.get<PortalPage>(`/portal/pages/${id}`),

  versions: (id: number) => http.get<PortalPageVersion[]>(`/portal/pages/${id}/versions`),

  versionsDiff: (id: number, fromVersion: number, toVersion: number) =>
    http.get<Record<string, unknown>>(`/portal/pages/${id}/versions/${fromVersion}/diff/${toVersion}`),

  blocks: () => http.get<PortalBlockMeta[]>('/portal/blocks'),

  create: (data: Partial<PortalPage>, siteId?: number | null) =>
    http.post<PortalPage>('/portal/pages', data, { params: { siteId: siteId ?? undefined } }),

  /** 只改标题/slug/栏目/SEO/导航等元信息，结构不在这里动 */
  updateMeta: (id: number, data: Partial<PortalPage>) =>
    http.put<PortalPage>(`/portal/pages/${id}`, data),

  updateLayout: (id: number, data: LayoutForm) =>
    http.put<PortalPage>(`/portal/pages/${id}/layout`, data),

  validate: (data: LayoutForm) => http.post<ValidateResult>('/portal/pages/validate', data),

  publish: (id: number) => http.post<PortalPage>(`/portal/pages/${id}/publish`),

  offline: (id: number) => http.post<PortalPage>(`/portal/pages/${id}/offline`),

  rollback: (id: number, versionNo: number) =>
    http.post<PortalPage>(`/portal/pages/${id}/rollback/${versionNo}`),

  remove: (id: number) => http.delete<void>(`/portal/pages/${id}`),

  /** 后台预览：按当前（可能是草稿）版本渲染，数据槽位已解析 */
  preview: (id: number) => http.get<PreviewPage>(`/portal/pages/${id}/preview`),
}

export interface PreviewBlock {
  instanceId: string
  blockKey: string
  rendererKey: string
  props: Record<string, unknown>
}

export interface PreviewPage {
  id: number
  slug: string | null
  path: string | null
  title: string | null
  pageKind: string | null
  theme: Record<string, string | number> | null
  seo: { title: string | null; description: string | null; keywords: string | null } | null
  blocks: PreviewBlock[] | null
  skippedBlocks: string[] | null
  reviewLabel?: string | null
}
