import { http } from './http'
import type { FormDefinition, LeadSubmission } from '@/types/api'

export function listFormsApi(siteId: number) {
  return http.get<unknown, FormDefinition[]>(`/admin/sites/${siteId}/forms`)
}

export function createFormApi(siteId: number, payload: FormDefinition) {
  return http.post<unknown, FormDefinition>(`/admin/sites/${siteId}/forms`, payload)
}

export function updateFormApi(siteId: number, id: number, payload: FormDefinition) {
  return http.put<unknown, FormDefinition>(`/admin/sites/${siteId}/forms/${id}`, payload)
}

export function deleteFormApi(siteId: number, id: number) {
  return http.delete<unknown, void>(`/admin/sites/${siteId}/forms/${id}`)
}

export function listLeadsApi(siteId: number) {
  return http.get<unknown, LeadSubmission[]>(`/admin/sites/${siteId}/leads`)
}

export function updateLeadStatusApi(id: number, status: string) {
  return http.put<unknown, LeadSubmission>(`/admin/leads/${id}/status`, status, {
    headers: { 'Content-Type': 'text/plain' }
  })
}
