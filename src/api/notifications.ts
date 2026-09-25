import http from './http'

/**
 * 站内待办（`/api/notifications`）的接口层。
 *
 * 存在的理由很具体：巡检闭环（Spec §13.3-6）把「扫出来的问题」写成了一条待办，
 * 而这一份数据以前在界面上**一处都看不见**——写进库却没人能打开，等于把「主动去看」
 * 换成了「主动去查表」，那句闭环就是假的。
 *
 * 两条纪律：
 * 1. 没有中文类型名字典可抄：后端没有通知类型的词表端点，所以这一页把 `type` 原样显示，
 *    给人读的是后端写好的那两句中文（title/content）。在前端补一份 `health:patrol → 巡检闭环`
 *    就是抄第二份词表（I-1），哪天后端改名，界面会指着一条已经不存在的类型说瞎话；
 * 2. 租户与站点不填：列表按登录态过滤，超管未选租户时后端给的是全平台那一份。
 */

/** 一条待办。status 只有后端会用的那两个值，界面上不出现它们的字面量 */
export interface NotificationRecord {
  id: number
  tenantId: number | null
  siteId: number | null
  /** 后端写入时用的类型码，原样显示（这一层不抄它的中文名） */
  type: string
  title: string
  content: string | null
  targetType: string | null
  targetId: number | null
  status: string
  readAt: string | null
  createdAt: string | null
}

/** 列表是分页的：records + total，缺任何一个都会把「还有下一页」显示成「只有这些」 */
export interface NotificationPage {
  records: NotificationRecord[]
  total: number
  page: number
  size: number
}

export interface NotificationFilters {
  page?: number
  size?: number
  status?: string
  type?: string
  siteId?: number | null
}

export const notificationsApi = {
  list: (filters: NotificationFilters = {}) =>
    http.get<NotificationPage>('/notifications', {
      params: {
        page: filters.page ?? 1,
        size: filters.size ?? 20,
        status: filters.status || undefined,
        type: filters.type?.trim() || undefined,
        siteId: filters.siteId ?? undefined
      }
    }),

  /** 未读有几条：后端按四个口径给，这一页只用 total */
  unreadCount: () => http.get<{ total: number; system: number; audit: number; ai: number }>('/notifications/unread-count'),

  read: (id: number) => http.post<NotificationRecord>(`/notifications/${id}/read`),

  /** 返回的是被改动了几条，不是剩余未读数 */
  readAll: () => http.post<number>('/notifications/read-all')
}
