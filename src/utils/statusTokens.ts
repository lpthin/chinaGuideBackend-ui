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
  | 'geoRun'
  | 'geoConfirmState'
  | 'revision'
  | 'invoice'
  | 'guestbook'
  | 'supportTicket'
  | 'case'
  | 'caseReview'
  | 'keywordStage'
  | 'healthFinding'
  | 'geoBrandStatus'
  | 'geoReviewState'
  | 'geoOrigin'

/**
 * GEO 品牌档案（Spec-F §11.2 P1）：档案生命周期状态。
 * 后端 status 的确切词表到手前，未知值按 statusMeta 的既有兜底原样显示、default 色。
 */
export const GEO_BRAND_STATUS: Record<string, StatusMeta> = {
  ACTIVE: { label: '启用中', color: 'green' },
  ARCHIVED: { label: '已停用', color: 'default' },
}

/**
 * GEO 追踪题的复核状态：pending 这一档 P1 显式指定橙（§11.1 末条：不许再靠猜色）。
 * 词表逐字跟后端：`GeoBrandService` 与 V146 写的是 `ACCEPTED`（不是 APPROVED），
 * 这里错一个字母这一列就落到 statusMeta 的兜底、把已确认的题显示成原样字符串。
 */
export const GEO_REVIEW_STATE: Record<string, StatusMeta> = {
  PENDING: { label: '待复核', color: 'orange' },
  ACCEPTED: { label: '已确认', color: 'green' },
  REJECTED: { label: '已驳回', color: 'red' },
}

/** GEO 竞品来源：手填 vs 自动发现（§0.4 Q13：自动发现的默认不进 SOV 分母）；追踪题共用这一族，多一档 AI 建议 */
export const GEO_ORIGIN: Record<string, StatusMeta> = {
  MANUAL: { label: '手填', color: 'default' },
  AUTO: { label: '自动发现', color: 'blue' },
  AI_SUGGESTED: { label: 'AI 建议', color: 'orange' },
}

/**
 * GEO 诊断轮次（Spec-F §11.3 P2）：这里只钉颜色，中文名唯一出处是后端的
 * `/geo/campaign/vocabulary.runStatuses`（`GeoRunStatuses.labels()`），视图用 <StatusTag :label> 覆盖进来。
 *
 * 为什么不复用上面那一族 RUN_STATUS：那是引用探测的小写 key（done/failed），
 * 没有 SUCCEEDED 与 PARTIAL 两档——混用会把「跑完了」和「跑挂了」画成同一个灰点（§9.6 不许谎报）。
 */
export const GEO_RUN_STATUS: Record<string, StatusMeta> = {
  PENDING: { label: 'PENDING', color: 'orange' },
  RUNNING: { label: 'RUNNING', color: 'blue' },
  SUCCEEDED: { label: 'SUCCEEDED', color: 'green' },
  PARTIAL: { label: 'PARTIAL', color: 'orange' },
  FAILED: { label: 'FAILED', color: 'red' },
}

/**
 * 诊断计划的确认态（§6.2 两段式留下的账）：`PENDING_CONFIRM` 是「还没点过头」，
 * `CONFIRMED` 是「看过预估并勾过确认」。中文名同样只来自后端
 * （`GeoConfirmStates.labels()` / `confirmStateLabel`），这里只钉颜色。
 */
export const GEO_CONFIRM_STATE: Record<string, StatusMeta> = {
  PENDING_CONFIRM: { label: 'PENDING_CONFIRM', color: 'gold' },
  CONFIRMED: { label: 'CONFIRMED', color: 'green' },
}

/**
 * 门户页面巡检的问题状态：颜色逐字搬自 api/portalHealth.ts 的 healthStatusColor()（已删）。
 * label 这里刻意不放中文——巡检状态的中文名只有后端 `/portal/health/options.statuses` 一份，
 * 页面渲染时用 <StatusTag :label> 覆盖进来；这里的兜底就是原样显示状态码。
 */
export const HEALTH_FINDING_STATUS: Record<string, StatusMeta> = {
  open: { label: 'open', color: 'red' },
  resolved: { label: 'resolved', color: 'green' },
  dismissed: { label: 'dismissed', color: 'default' },
}

/**
 * 热词库（搜索联想）的「生产状态」：这一档不是后端状态机，是页面按两个计数派生的
 * （有文章 > 有建议 > 新词）。三档文案与颜色逐字搬自原 stageTag()，
 * 搬进来的目的是让颜色只有一个出处——页面不再自备第四份色表。
 */
export const KEYWORD_STAGE_STATUS: Record<string, StatusMeta> = {
  articled: { label: '已生成文章', color: 'green' },
  suggested: { label: '已有内容建议', color: 'orange' },
  new: { label: '新词库', color: 'default' },
}

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
  geoRun: GEO_RUN_STATUS,
  geoConfirmState: GEO_CONFIRM_STATE,
  revision: REVISION_STATUS,
  invoice: INVOICE_STATUS,
  guestbook: GUESTBOOK_STATUS,
  supportTicket: SUPPORT_TICKET_STATUS,
  case: CASE_STATUS,
  caseReview: CASE_REVIEW_STATUS,
  keywordStage: KEYWORD_STAGE_STATUS,
  healthFinding: HEALTH_FINDING_STATUS,
  geoBrandStatus: GEO_BRAND_STATUS,
  geoReviewState: GEO_REVIEW_STATE,
  geoOrigin: GEO_ORIGIN,
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
