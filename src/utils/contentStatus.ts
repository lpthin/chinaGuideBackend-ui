// 内容生产链路状态词表：取值必须与后端 ContentStatuses 一致（全小写）。
// 历史上同一列混着 success / COMPLETED / PENDING 三种写法，统计端因此恒为 0。

export type ArticleStatus =
  | 'draft'
  | 'pending_review'
  | 'rejected'
  | 'approved'
  | 'scheduled'
  | 'published'
  | 'offline'

export type QueueStatus =
  | 'pending'
  | 'publishing'
  | 'success'
  | 'failed'
  | 'validation_failed'
  | 'cancelled'

export type JobStatus = 'pending' | 'success' | 'failed' | 'cancelled'

type StatusMeta = { label: string; color: string }

export const ARTICLE_STATUS: Record<ArticleStatus, StatusMeta> = {
  draft: { label: '草稿', color: 'default' },
  pending_review: { label: '待审核', color: 'processing' },
  rejected: { label: '已驳回', color: 'error' },
  approved: { label: '审核通过', color: 'success' },
  scheduled: { label: '已排期', color: 'warning' },
  published: { label: '已发布', color: 'success' },
  offline: { label: '已下架', color: 'warning' },
}

export const QUEUE_STATUS: Record<QueueStatus, StatusMeta> = {
  pending: { label: '待发布', color: 'processing' },
  publishing: { label: '发布中', color: 'processing' },
  success: { label: '发布成功', color: 'success' },
  failed: { label: '发布失败', color: 'error' },
  validation_failed: { label: '校验未通过', color: 'error' },
  cancelled: { label: '已取消', color: 'default' },
}

export const JOB_STATUS: Record<JobStatus, StatusMeta> = {
  pending: { label: '待执行', color: 'processing' },
  success: { label: '成功', color: 'success' },
  failed: { label: '失败', color: 'error' },
  cancelled: { label: '已取消', color: 'default' },
}

/** 未知状态原样显示，避免把脏数据静默归成某个已知状态 */
function meta(table: Record<string, StatusMeta>, status?: string | null): StatusMeta {
  if (!status) {
    return { label: '-', color: 'default' }
  }
  return table[status.toLowerCase()] ?? { label: status, color: 'default' }
}

export const articleStatusMeta = (status?: string | null) => meta(ARTICLE_STATUS, status)
export const queueStatusMeta = (status?: string | null) => meta(QUEUE_STATUS, status)
export const jobStatusMeta = (status?: string | null) => meta(JOB_STATUS, status)

/** 可发布 = 审核通过（与后端 ContentStatuses.isPublishable 一致） */
export const isPublishable = (status?: string | null) =>
  !!status && status.toLowerCase() === 'approved'

/** 可排期 = 审核通过或已在队列中 */
export const isSchedulable = (status?: string | null) =>
  isPublishable(status) || (!!status && status.toLowerCase() === 'scheduled')
