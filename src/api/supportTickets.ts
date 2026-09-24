// 「联系平台」通用工单 API（拍板 N1：租户侧唯一的平台沟通口；建设域侧是处理队列）
import http from './http'

export interface SupportTicket {
  id: number
  tenantId: number
  siteId?: number | null
  userId?: number | null
  userName?: string | null
  topic: string
  content: string
  /** 取值与中文标签都读 statuses()，这里不抄第二份 */
  status: string
  replyContent?: string | null
  replierId?: number | null
  replierName?: string | null
  replyTime?: string | null
  createdAt?: string | null
  updatedAt?: string | null
}

export const supportTicketsApi = {
  statuses: () =>
    http.get<Record<string, string>>('/portal/support-tickets/statuses'),

  // 提交人视角：只看本租户
  listMine: (status?: string) =>
    http.get<SupportTicket[]>('/portal/support-tickets', { params: { status } }),

  submit: (data: { topic: string; content: string; siteId?: number | null }) =>
    http.post<SupportTicket>('/portal/support-tickets', data),

  close: (id: number) =>
    http.put<SupportTicket>(`/portal/support-tickets/${id}/close`),

  // 平台侧（portal:build:review）
  listForAdmin: (status?: string) =>
    http.get<SupportTicket[]>('/portal/support-tickets/admin/list', { params: { status } }),

  get: (id: number) =>
    http.get<SupportTicket>(`/portal/support-tickets/admin/${id}`),

  reply: (id: number, replyContent: string) =>
    http.put<SupportTicket>(`/portal/support-tickets/admin/${id}/reply`, { replyContent }),

  closeByAdmin: (id: number) =>
    http.put<SupportTicket>(`/portal/support-tickets/admin/${id}/close`)
}
