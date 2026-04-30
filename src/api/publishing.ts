import { http } from './http'
import type { PublishJob, PublishResult, PublishRollbackResult } from '@/types/api'

export function dryRunPublishApi(articleId: number) {
  return http.post<unknown, PublishResult>(`/admin/articles/${articleId}/publish/dry-run`)
}

export function publishArticleApi(articleId: number) {
  return http.post<unknown, PublishResult>(`/admin/articles/${articleId}/publish`)
}

export function listPublishJobsApi(siteId: number) {
  return http.get<unknown, PublishJob[]>(`/admin/sites/${siteId}/publish-jobs`)
}


export function rollbackPublishJobApi(publishJobId: number) {
  return http.post<unknown, PublishRollbackResult>(`/admin/publish-jobs/${publishJobId}/rollback`)
}


export function getPublishJobApi(publishJobId: number) {
  return http.get<unknown, PublishJob>(`/admin/sites/0/publish-jobs/${publishJobId}`)
}
