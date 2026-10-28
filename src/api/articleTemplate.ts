import http from './http'
import type { PageResult, PageParams } from '../types'

/**
 * 模板类型的词表唯一出处在后端 `GET /article-templates/types`（分类同理在 `/categories`）。
 * 这一支 TS 联合类型只是给表单字段用，界面上的选项与中文名一律从那两个口读，不在这儿抄第二份。
 */
export type TemplateType = 'hotword' | 'case' | 'system' | 'custom'

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
  name: string
  version: string
  description: string
  content: string
  versionNote: string
  status: 'active' | 'inactive'
  useCount: number
  createdAt: string
  updatedAt: string
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
  /**
   * 参数名与后端 `SoftArticleTemplateController#list` 的 `@RequestParam` 逐字一致。
   * 这里从前写的是 `type`：后端没有这一支参数，于是「模板类型」那一格点了不取数（M-P86 实测）。
   */
  templateType?: TemplateType
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

function toTemplatePayload(form: ArticleTemplateForm) {
  return {
    name: form.name,
    description: form.description,
    templateType: form.type,
    category: form.category,
    content: form.content,
    variables: JSON.stringify(form.variables || []),
    status: form.status,
  }
}

export const articleTemplateApi = {
  list: (params: ArticleTemplateQuery) =>
    http.get<PageResult<ArticleTemplate>>('/article-templates', { params }),

  get: (id: number) =>
    http.get<ArticleTemplate>(`/article-templates/${id}`),

  create: (data: ArticleTemplateForm) =>
    http.post<ArticleTemplate>('/article-templates', toTemplatePayload(data)),

  update: (id: number, data: ArticleTemplateForm) =>
    http.put<ArticleTemplate>(`/article-templates/${id}`, toTemplatePayload(data)),

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
}

export default articleTemplateApi
