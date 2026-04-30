import { http } from './http'
import type { DashboardStats } from '@/types/api'

export function getDashboardStatsApi(siteId: number) {
  return http.get<unknown, DashboardStats>(`/admin/sites/${siteId}/dashboard/stats`)
}
