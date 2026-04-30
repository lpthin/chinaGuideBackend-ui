import { http } from './http'
import type { PromptTemplate } from '@/types/api'

export function listPromptTemplatesApi(siteId: number) {
  return http.get<unknown, PromptTemplate[]>(`/admin/sites/${siteId}/prompt-templates`)
}

export function createPromptTemplateApi(siteId: number, payload: PromptTemplate) {
  return http.post<unknown, PromptTemplate>(`/admin/sites/${siteId}/prompt-templates`, payload)
}

export function updatePromptTemplateApi(siteId: number, id: number, payload: PromptTemplate) {
  return http.put<unknown, PromptTemplate>(`/admin/sites/${siteId}/prompt-templates/${id}`, payload)
}
