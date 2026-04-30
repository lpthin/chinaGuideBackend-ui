import { http } from './http'
import type { Media } from '@/types/api'

export function listMediaApi(siteId: number) {
  return http.get<unknown, Media[]>(`/admin/sites/${siteId}/media`)
}

export function uploadMediaApi(siteId: number, file: File) {
  const formData = new FormData()
  formData.append('file', file)
  return http.post<unknown, Media>(`/admin/sites/${siteId}/media/upload`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
}
