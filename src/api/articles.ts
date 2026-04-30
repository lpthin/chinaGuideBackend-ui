import { http } from './http'
import type { Article, ArticleVersion } from '@/types/api'

export function generateArticleApi(siteId: number, keywordClusterId: number) {
  return http.post<unknown, Article>(`/admin/sites/${siteId}/content-drafts/generate`, { keywordClusterId })
}

export function generateDailyArticlesApi(siteId: number) {
  return http.post<unknown, Article[]>(`/admin/sites/${siteId}/content-drafts/generate-daily`)
}

export function listArticlesApi(siteId: number) {
  return http.get<unknown, Article[]>(`/admin/sites/${siteId}/articles`)
}

export function listArticleVersionsApi(articleId: number) {
  return http.get<unknown, ArticleVersion[]>(`/admin/articles/${articleId}/versions`)
}
