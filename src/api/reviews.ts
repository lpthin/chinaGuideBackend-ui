import { http } from './http'
import type { Article } from '@/types/api'

export function humanReviewApi(articleId: number, approved: boolean, opinion: string, reviewerId = 1) {
  return http.post<unknown, Article>(`/admin/articles/${articleId}/human-review`, { approved, opinion, reviewerId })
}

export function aiReviewApi(articleId: number) {
  return http.post<unknown, Article>(`/admin/articles/${articleId}/ai-review`)
}

export function reviewPendingBeforeNineApi(siteId: number) {
  return http.post<unknown, Article[]>(`/admin/sites/${siteId}/articles/review-pending-before-nine`)
}
