import { http } from './http'
import type { PublishJob, PublishResult } from '@/types/api'

export function dryRunPublishApi(articleId: number) {
  return http.post<unknown, PublishResult>(`/admin/articles/${articleId}/publish/dry-run`)
}

export function publishArticleApi(articleId: number) {
  return http.post<unknown, PublishResult>(`/admin/articles/${articleId}/publish`)
}

export function listPublishJobsApi(siteId: number) {
  return http.get<unknown, PublishJob[]>(`/admin/sites/${siteId}/publish-jobs`)
}
