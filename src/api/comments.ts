import { http } from './http'
import type { ArticleComment } from '@/types/api'

export function listCommentsApi(siteId: number) {
  return http.get<unknown, ArticleComment[]>(`/admin/sites/${siteId}/comments`)
}

export function reviewCommentApi(id: number, status: string) {
  return http.put<unknown, ArticleComment>(`/admin/comments/${id}/review`, status, {
    headers: { 'Content-Type': 'text/plain' }
  })
}
