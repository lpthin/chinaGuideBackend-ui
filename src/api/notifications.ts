import { http } from './http'
import type { Notification } from '@/types/api'

export function listNotificationsApi(siteId: number) {
  return http.get<unknown, Notification[]>(`/admin/sites/${siteId}/notifications`)
}

export function markNotificationReadApi(siteId: number, id: number) {
  return http.put<unknown, Notification>(`/admin/sites/${siteId}/notifications/${id}/read`)
}
