import { http } from './http'
import type { Keyword, KeywordCluster } from '@/types/api'

export function listKeywordsApi(siteId: number) {
  return http.get<unknown, Keyword[]>(`/admin/sites/${siteId}/keywords`)
}

export function importKeywordsApi(siteId: number, keywords: string[]) {
  return http.post<unknown, Keyword[]>(`/admin/sites/${siteId}/keywords/import`, { keywords })
}

export function distillKeywordsApi(siteId: number) {
  return http.post<unknown, KeywordCluster[]>(`/admin/sites/${siteId}/keywords/distill`)
}

export function listKeywordClustersApi(siteId: number) {
  return http.get<unknown, KeywordCluster[]>(`/admin/sites/${siteId}/keywords/clusters`)
}
