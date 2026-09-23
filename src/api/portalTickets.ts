import http from './http'
import type { PortalPage } from './portalPages'

/**
 * 「客户在预览页圈选区块提反馈 → AI 改一版 → 人工看 diff → 应用」闭环的管理端接口。
 *
 * 三条纪律在接口层就体现出来：
 * 1. 词表（状态/视口/动作枚举）全部来自后端 {@code GET /portal/tickets/options}，前端不抄第二份；
 * 2. 烧钱的动作（ai-draft / free-revise）必须显式 confirm:true，且界面要先展示 estimate 的预估 token；
 * 3. 撤销预览链接是 POST /review-sessions/{id}/revoke 而不是 DELETE——链接发出去过就要留痕。
 */

export interface TicketOptions {
  /** open/ai_drafted/... → 中文标签，顺序即界面顺序 */
  statuses: Record<string, string>
  viewports: Record<string, string>
  intents: Record<string, string>
}

/** 一条改版工单。submitterHash 是 @JsonIgnore，前端永远拿不到 */
export interface RevisionTicket {
  id: number
  tenantId?: number | null
  siteId?: number | null
  pageId: number
  blockInstanceId: string | null
  blockKey: string | null
  path: string | null
  viewport: string | null
  screenshotMediaId: number | null
  clientText: string | null
  /** 后端存的是 {"intent":"edit-text"} 这样的 JSON 字符串 */
  structuredIntent: string | null
  source: string | null
  status: string
  estimatedTokens: number | null
  actualTokens: number | null
  quotaSkipped: boolean | null
  errorMessage: string | null
  createdAt: string | null
  handledAt: string | null
}

/** AI 产出的永远是草稿：validationError 非空表示被某道门禁拦下，界面只显原因、不给应用按钮 */
export interface RevisionDraft {
  id: number
  ticketId: number | null
  tenantId?: number | null
  pageId: number
  baseVersion: number
  candidateLayoutJson: string
  candidateThemeJson: string | null
  /** LayoutDiff 的字段级结果，审阅页直接渲它 */
  changeSummaryJson: string | null
  reason: string | null
  validationError: string | null
  modelId: number | null
  promptTokens: number | null
  completionTokens: number | null
  createdAt: string | null
  appliedAt: string | null
}

export interface ReviewSession {
  id: number
  tenantId?: number | null
  siteId?: number | null
  /** "page:12,page:13,ticketWrite" */
  scopes: string | null
  expiresAt: string | null
  revokedAt: string | null
  label: string | null
  createdBy: string | null
  createdAt: string | null
}

/** 明文令牌只在这一次响应里出现，列表接口拿不到，所以生成后必须立刻复制 */
export interface CreatedSession {
  session: ReviewSession
  plainToken: string
  previewUrl: string
}

export interface TicketEstimate {
  ticketId: number | null
  pageId: number
  estimatedTokens: number
  remainingTokens: number
  aiEnabled: boolean
  notice: string | null
}

/** 采集器上报的字段，白名单与后端 TicketForm 逐字对齐，多写的键后端一律丢弃 */
export interface TicketForm {
  blockInstanceId?: string | null
  blockKey?: string | null
  path?: string | null
  viewport?: string | null
  clientText?: string | null
  intent?: string | null
}

export const portalTicketsApi = {
  options: () => http.get<TicketOptions>('/portal/tickets/options'),

  createSession: (data: { pageId: number; label?: string | null }) =>
    http.post<CreatedSession>('/portal/review-sessions', data),

  listSessions: (pageId?: number | null) =>
    http.get<ReviewSession[]>('/portal/review-sessions', { params: { pageId: pageId ?? undefined } }),

  revokeSession: (id: number) => http.post<ReviewSession>(`/portal/review-sessions/${id}/revoke`),

  list: (params: { status?: string; pageId?: number | null } = {}) =>
    http.get<RevisionTicket[]>('/portal/tickets', {
      params: { status: params.status || undefined, pageId: params.pageId ?? undefined },
    }),

  get: (id: number) => http.get<RevisionTicket>(`/portal/tickets/${id}`),

  /** 运营代录（客户打电话说）：与预览链接走同一套字段白名单，来源记成 admin */
  create: (pageId: number, data: TicketForm) =>
    http.post<RevisionTicket>('/portal/tickets', data, { params: { pageId } }),

  reject: (id: number, reason?: string | null) =>
    http.post<RevisionTicket>(`/portal/tickets/${id}/reject`, { reason: reason || null }),

  reopen: (id: number) => http.post<RevisionTicket>(`/portal/tickets/${id}/reopen`),

  /** 只估算不烧钱：这一步不会产生任何 AI 调用 */
  estimate: (id: number) => http.post<TicketEstimate>(`/portal/tickets/${id}/estimate`),

  /** confirm 必须是用户勾过的那个值；false 时后端直接报中文错，不会悄悄调用 */
  aiDraft: (id: number, confirm: boolean) =>
    http.post<RevisionDraft>(`/portal/tickets/${id}/ai-draft`, { confirm }, { timeout: AI_DRAFT_TIMEOUT }),

  draftsOfTicket: (id: number) => http.get<RevisionDraft[]>(`/portal/tickets/${id}/drafts`),

  draft: (id: number) => http.get<RevisionDraft>(`/portal/drafts/${id}`),

  apply: (id: number) => http.post<PortalPage>(`/portal/drafts/${id}/apply`),

  discard: (id: number, reason?: string | null) =>
    http.post<RevisionDraft>(`/portal/drafts/${id}/discard`, { reason: reason || null }),

  freeRevise: (data: { pageId: number; instruction: string; confirm: boolean }) =>
    http.post<RevisionDraft>('/portal/drafts/free-revise', data, { timeout: AI_DRAFT_TIMEOUT }),
}

/** 真实模型一次要跑近一分钟，30s 默认超时会让前端先于后端放弃 */
export const AI_DRAFT_TIMEOUT = 180000

/** structured_intent 存的是 JSON 字符串，解析失败就当没有——不能替客户编一个动作 */
export function ticketIntent(ticket: Pick<RevisionTicket, 'structuredIntent'>): string | null {
  const raw = ticket.structuredIntent
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as { intent?: unknown }
    return typeof parsed?.intent === 'string' ? parsed.intent : null
  } catch (e) {
    return null
  }
}

/** scopes 形如 "page:12,page:13,ticketWrite" */
export function sessionPageIds(session: Pick<ReviewSession, 'scopes'>): number[] {
  if (!session.scopes) return []
  return session.scopes
    .split(',')
    .map(item => item.trim())
    .filter(item => item.startsWith('page:'))
    .map(item => Number(item.slice('page:'.length)))
    .filter(id => Number.isFinite(id))
}

export function sessionAllowsTicketWrite(session: Pick<ReviewSession, 'scopes'>): boolean {
  return !!session.scopes && session.scopes.split(',').some(item => item.trim() === 'ticketWrite')
}
