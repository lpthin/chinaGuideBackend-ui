import { http } from './http'
import type { Site } from '@/types/api'

export function listSitesApi() {
  return http.get<unknown, Site[]>('/admin/sites')
}

export function createSiteApi(site: Site) {
  return http.post<unknown, Site>('/admin/sites', site)
}

export function updateSiteApi(id: number, site: Site) {
  return http.put<unknown, Site>(`/admin/sites/${id}`, site)
}
