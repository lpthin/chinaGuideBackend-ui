/**
 * 状态→{颜色, 文案} 唯一映射（Spec-F §9.2-4，StatusTag 只认这里）。
 *
 * 内容生产三张表逐字沿用 utils/contentStatus.ts（它是全仓唯一一份还算体面的出处，
 * 消费方 7 个文件的行为不许被本包改变）。其余表是从各页本地 colorMap/nameMap 原样合并来的：
 * - needs_human：引用探测用 red，参考站/修订工单/组装任务三处用 orange ⇒ 按多数合为 orange（差异记录在 P0 报告）。
 * - pending 有两种语义：队列/作业类（contentStatus，processing=蓝）与任务排队/待回复类（orange=橙），
 *   二者分属不同域表，不合并（合并就会把「发布中」变成橙色）。
 * - done/success、failed/error：绿/红两组 preset 各随其域，保持今天各页渲染的颜色不变。
 * - 引用探测、参考站、支持工单等页的中文标签今天来自后端词表（statuses 端点），
 *   本表的 label 只是前端兜底；StatusTag 的 label prop 允许调用方以词表覆盖。
 */
import { ARTICLE_STATUS, QUEUE_STATUS, JOB_STATUS } from './contentStatus'
import type { ArticleStatus, QueueStatus, JobStatus } from './contentStatus'

export type StatusMeta = { label: string; color: string }

export type StatusDomain =
  | 'article'
  | 'queue'
  | 'job'
  | 'run'
  | 'revision'
  | 'invoice'
  | 'guestbook'
  | 'supportTicket'
  | 'case'
  | 'caseReview'

export const RUN_STATUS: Record<string, StatusMeta> = {
  // 引用探测 / 参考站摄取 / 组装任务共用的一族异步状态
  pending: { label: '排队中', color: 'orange' },
  running: { label: '进行中', color: 'blue' },
  estimating: { label: '预估中', color: 'blue' },
  needs_human: { label: '需人工处理', color: 'orange' },
  done: { label: '已完成', color: 'green' },
  failed: { label: '失败', color: 'red' },
}

export const REVISION_STATUS: Record<string, StatusMeta> = {
  ai_drafted: { label: 'AI 草稿', color: 'blue' },
  needs_human: { label: '需人工处理', color: 'orange' },
  applied: { label: '已处理', color: 'green' },
  rejected: { label: '已拒绝', color: 'red' },
  expired: { label: '已过期', color: 'red' },
}

export const INVOICE_STATUS: Record<string, StatusMeta> = {
  DRAFT: { label: '草稿', color: 'default' },
  PENDING: { label: '待支付', color: 'orange' },
  PAID: { label: '已支付', color: 'green' },
  OVERDUE: { label: '已逾期', color: 'red' },
  CANCELLED: { label: '已取消', color: 'default' },
  REFUNDED: { label: '已退款', color: 'blue' },
}

export const GUESTBOOK_STATUS: Record<string, StatusMeta> = {
  pending: { label: '待回复', color: 'orange' },
  replied: { label: '已回复', color: 'green' },
  closed: { label: '已关闭', color: 'default' },
}

export const SUPPORT_TICKET_STATUS: Record<string, StatusMeta> = {
  open: { label: '待处理', color: 'orange' },
  replied: { label: '已回复', color: 'green' },
  closed: { label: '已关闭', color: 'default' },
}

export const CASE_STATUS: Record<string, StatusMeta> = {
  DRAFT: { label: '草稿', color: 'default' },
  PUBLISHED: { label: '已发布', color: 'green' },
}

export const CASE_REVIEW_STATUS: Record<string, StatusMeta> = {
  PENDING: { label: '待审核', color: 'orange' },
  APPROVED: { label: '已通过', color: 'green' },
  REJECTED: { label: '已驳回', color: 'red' },
}

const TABLES: Record<StatusDomain, Record<string, StatusMeta>> = {
  article: ARTICLE_STATUS,
  queue: QUEUE_STATUS,
  job: JOB_STATUS,
  run: RUN_STATUS,
  revision: REVISION_STATUS,
  invoice: INVOICE_STATUS,
  guestbook: GUESTBOOK_STATUS,
  supportTicket: SUPPORT_TICKET_STATUS,
  case: CASE_STATUS,
  caseReview: CASE_REVIEW_STATUS,
}

export { ARTICLE_STATUS, QUEUE_STATUS, JOB_STATUS }
export type { ArticleStatus, QueueStatus, JobStatus }

/**
 * 与 contentStatus.meta() 的既有行为逐字一致：
 * 空值 → label '-'（不是 '—'，各页今天显示的就是 ASCII 横杠）；未知状态原样显示、default 色。
 */
export function statusMeta(domain: StatusDomain, status?: string | null, labelOverride?: string | null): StatusMeta {
  if (!status) return { label: '-', color: 'default' }
  const table = TABLES[domain]
  const hit = table[status] ?? table[status.toLowerCase()] ?? table[status.toUpperCase()]
  const base = hit ?? { label: status, color: 'default' }
  return labelOverride ? { ...base, label: labelOverride } : base
}
