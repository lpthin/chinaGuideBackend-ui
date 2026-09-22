// 案例管理模块 API
import http from './http'
import type {
  Case,
  CaseCategory,
  CaseTag,
  CaseStatistics,
  CaseQuery,
  CaseCategoryQuery,
  CaseCategoryForm,
  CaseForm,
  PageResult
} from '../types/case'

// 案例分类 API
export const caseCategoryApi = {
  // 获取分类列表（后端返回分类树，不分页）
  list: (params: CaseCategoryQuery) =>
    http.get<CaseCategory[]>('/case/categories', { params }),

  // 获取分类详情
  get: (id: number) =>
    http.get<CaseCategory>(`/case/categories/${id}`),

  // 创建分类
  create: (data: CaseCategoryForm) =>
    http.post<CaseCategory>('/case/categories', data),

  // 更新分类
  update: (id: number, data: CaseCategoryForm) =>
    http.put<CaseCategory>(`/case/categories/${id}`, data),

  // 删除分类
  delete: (id: number) =>
    http.delete(`/case/categories/${id}`)
}

// 案例标签 API
export const caseTagApi = {
  // 获取热门标签（运营侧接口）
  hot: (tenantId: number, limit: number = 10) =>
    http.get<CaseTag[]>('/operation/cases/tags/hot', { params: { tenantId, limit } })
}

// 案例 API
export const caseApi = {
  // 获取案例列表（分页）
  list: (params: CaseQuery) =>
    http.get<PageResult<Case>>('/cases', { params }),

  // 获取案例详情
  get: (id: number) =>
    http.get<Case>(`/cases/${id}`),

  // 创建案例
  create: (data: CaseForm) =>
    http.post<Case>('/cases', data),

  // 更新案例
  update: (id: number, data: CaseForm) =>
    http.put<Case>(`/cases/${id}`, data),

  // 删除案例
  delete: (id: number) =>
    http.delete(`/cases/${id}`),

  // 批量删除
  batchDelete: (ids: number[]) =>
    http.delete<{ deleted: number }>('/cases/batch', { data: ids }),

  // 发布案例
  publish: (id: number) =>
    http.post<Case>(`/cases/${id}/publish`),

  // 下架案例
  unpublish: (id: number) =>
    http.post<Case>(`/cases/${id}/unpublish`),

  // 获取统计数据
  statistics: (tenantId?: number | null) =>
    http.get<CaseStatistics>('/cases/statistics', { params: tenantId ? { tenantId } : {} })
}
