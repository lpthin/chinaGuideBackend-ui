import { http } from './http'
import type { PublishResult } from '@/types/api'

export function dryRunPublishApi(articleId: number) {
  return http.post<unknown, PublishResult>(`/admin/articles/${articleId}/publish/dry-run`)
}

export function publishArticleApi(articleId: number) {
  return http.post<unknown, PublishResult>(`/admin/articles/${articleId}/publish`)
}
