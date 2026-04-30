import { http } from './http'
import type { AiCallLog, AiCallStats } from '@/types/api'

export function listAiCallLogsApi(siteId: number) {
  return http.get<unknown, AiCallLog[]>(`/admin/sites/${siteId}/ai-call-logs`)
}

export function getAiCallStatsApi(siteId: number) {
  return http.get<unknown, AiCallStats>(`/admin/sites/${siteId}/ai-call-logs/stats`)
}
