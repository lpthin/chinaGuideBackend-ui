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

export function deleteKeywordApi(siteId: number, id: number) {
  return http.delete<unknown, void>(`/admin/sites/${siteId}/keywords/${id}`)
}

export function deleteKeywordClusterApi(siteId: number, id: number) {
  return http.delete<unknown, void>(`/admin/sites/${siteId}/keywords/clusters/${id}`)
}

export function deleteKeywordsBatchApi(siteId: number, ids: number[]) {
  return http.post<unknown, { deleted: number }>(`/admin/sites/${siteId}/keywords/batch-delete`, { ids })
}

export function deleteKeywordClustersBatchApi(siteId: number, ids: number[]) {
  return http.post<unknown, { deleted: number }>(`/admin/sites/${siteId}/keywords/clusters/batch-delete`, { ids })
}
