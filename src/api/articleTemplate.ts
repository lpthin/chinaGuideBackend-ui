import http from './http'
import type { PageResult, PageParams } from '../types'

export type TemplateType = 'hot_keyword' | 'case' | 'system' | 'custom'

export interface TemplateVariable {
  name: string
  label: string
  type: 'string' | 'number' | 'boolean' | 'select'
  required: boolean
  defaultValue: any
  options?: { label: string; value: string }[]
  description: string
}

export interface TemplateVersion {
  id: number
  version: string
  content: string
  variables: TemplateVariable[]
  changelog: string
  createdAt: string
  createdBy: string
}

export interface ArticleTemplate {
  id: number
  name: string
  type: TemplateType
  category: string
  description: string
  content: string
  variables: TemplateVariable[]
  version: string
  versions: TemplateVersion[]
  useCount: number
  isSystem: boolean
  status: 'active' | 'inactive'
  createdAt: string
  updatedAt: string
}

export interface ArticleTemplateQuery extends PageParams {
  type?: TemplateType
  category?: string
  keyword?: string
  status?: string
}

export interface ArticleTemplateForm {
  name: string
  type: TemplateType
  category: string
  description: string
  content: string
  variables: TemplateVariable[]
  status?: string
}

export interface TemplateStats {
  totalCount: number
  systemCount: number
  hotKeywordCount: number
  caseCount: number
  customCount: number
}

export const articleTemplateApi = {
  list: (params: ArticleTemplateQuery) =>
    http.get<PageResult<ArticleTemplate>>('/article-templates', { params }),

  get: (id: number) =>
    http.get<ArticleTemplate>(`/article-templates/${id}`),

  create: (data: ArticleTemplateForm) =>
    http.post<ArticleTemplate>('/article-templates', data),

  update: (id: number, data: ArticleTemplateForm) =>
    http.put<ArticleTemplate>(`/article-templates/${id}`, data),

  delete: (id: number) =>
    http.delete(`/article-templates/${id}`),

  versions: (id: number) =>
    http.get<TemplateVersion[]>('/article-templates/{id}/versions'.replace('{id}', String(id))),

  clone: (id: number) =>
    http.post<ArticleTemplate>(`/article-templates/${id}/clone`),

  use: (id: number, data?: Record<string, any>) =>
    http.post<{ content: string }>(`/article-templates/${id}/use`, data),

  system: () =>
    http.get<ArticleTemplate[]>('/article-templates/system'),

  types: () =>
    http.get<{ value: string; label: string }[]>('/article-templates/types'),

  categories: () =>
    http.get<{ value: string; label: string }[]>('/article-templates/categories'),

  stats: () =>
    http.get<TemplateStats>('/article-templates/stats'),

  batchDelete: (ids: number[]) =>
    http.delete('/article-templates/batch', { data: ids }),
}

export default articleTemplateApi
