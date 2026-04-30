import { http } from './http'
import type { Category } from '@/types/api'

export function listCategoriesApi(siteId: number) {
  return http.get<unknown, Category[]>(`/admin/sites/${siteId}/categories`)
}

export function createCategoryApi(siteId: number, category: Category) {
  return http.post<unknown, Category>(`/admin/sites/${siteId}/categories`, category)
}

export function updateCategoryApi(id: number, category: Category) {
  return http.put<unknown, Category>(`/admin/categories/${id}`, category)
}
