// 案例管理模块 API
import http from './http'
import type {
  Case,
  CaseCategory,
  CaseTag,
  CaseStats,
  CaseAttachment,
  CaseComment,
  CaseVersion,
  CaseQuery,
  CaseCategoryQuery,
  CaseTagQuery,
  CaseForm,
  CaseCategoryForm,
  CaseTagForm,
  CaseReviewForm,
  PageResult
} from '../types/case'

// 案例分类 API
export const caseCategoryApi = {
  // 获取分类列表（分页）
  list: (params: CaseCategoryQuery) =>
    http.get<PageResult<CaseCategory>>('/case/categories', { params }),

  // 获取全部分类（不分页）
  all: (tenantId: number) =>
    http.get<CaseCategory[]>('/case/categories/all', { params: { tenantId } }),

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
    http.delete(`/case/categories/${id}`),

  // 批量删除
  batchDelete: (ids: number[]) =>
    http.delete('/case/categories/batch', { data: ids })
}

// 案例标签 API
export const caseTagApi = {
  // 获取标签列表
  list: (params: CaseTagQuery) =>
    http.get<PageResult<CaseTag>>('/case/tags', { params }),

  // 获取热门标签
  hot: (tenantId: number, limit: number = 10) =>
    http.get<CaseTag[]>('/case/tags/hot', { params: { tenantId, limit } }),

  // 获取标签详情
  get: (id: number) =>
    http.get<CaseTag>(`/case/tags/${id}`),

  // 创建标签
  create: (data: CaseTagForm) =>
    http.post<CaseTag>('/case/tags', data),

  // 更新标签
  update: (id: number, data: CaseTagForm) =>
    http.put<CaseTag>(`/case/tags/${id}`, data),

  // 删除标签
  delete: (id: number) =>
    http.delete(`/case/tags/${id}`),

  // 批量删除
  batchDelete: (ids: number[]) =>
    http.delete('/case/tags/batch', { data: ids })
}

// 案例 API
export const caseApi = {
  // 获取案例列表（分页）
  list: (params: CaseQuery) =>
    http.get<PageResult<Case>>('/cases', { params }),

  // 搜索案例
  search: (params: CaseQuery) =>
    http.get<PageResult<Case>>('/cases/search', { params }),

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
    http.delete('/cases/batch', { data: ids }),

  // 提交审核
  submitReview: (id: number) =>
    http.post(`/cases/${id}/submit-review`),

  // 审核案例
  review: (id: number, data: CaseReviewForm) =>
    http.post(`/cases/${id}/review`, data),

  // 发布案例
  publish: (id: number) =>
    http.post(`/cases/${id}/publish`),

  // 下架案例
  unpublish: (id: number) =>
    http.post(`/cases/${id}/unpublish`),

  // 归档案例
  archive: (id: number) =>
    http.post(`/cases/${id}/archive`),

  // 点赞案例
  like: (id: number) =>
    http.post(`/cases/${id}/like`),

  // 取消点赞
  unlike: (id: number) =>
    http.delete(`/cases/${id}/like`),

  // 分享案例
  share: (id: number) =>
    http.post(`/cases/${id}/share`),

  // 增加浏览量
  incrementView: (id: number) =>
    http.post(`/cases/${id}/view`)
}

// 案例附件 API
export const caseAttachmentApi = {
  // 获取附件列表
  list: (caseId: number) =>
    http.get<CaseAttachment[]>(`/cases/${caseId}/attachments`),

  // 上传附件
  upload: (caseId: number, formData: FormData) =>
    http.post<CaseAttachment>(`/cases/${caseId}/attachments`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    }),

  // 删除附件
  delete: (caseId: number, attachmentId: number) =>
    http.delete(`/cases/${caseId}/attachments/${attachmentId}`),

  // 下载附件
  download: (caseId: number, attachmentId: number) =>
    http.get(`/cases/${caseId}/attachments/${attachmentId}/download`, {
      responseType: 'blob'
    })
}

// 案例评论 API
export const caseCommentApi = {
  // 获取评论列表
  list: (caseId: number, page: number = 1, size: number = 20) =>
    http.get<PageResult<CaseComment>>(`/cases/${caseId}/comments`, { params: { page, size } }),

  // 创建评论
  create: (caseId: number, content: string, parentId?: number) =>
    http.post<CaseComment>(`/cases/${caseId}/comments`, { content, parentId }),

  // 删除评论
  delete: (caseId: number, commentId: number) =>
    http.delete(`/cases/${caseId}/comments/${commentId}`)
}

// 案例版本 API
export const caseVersionApi = {
  // 获取版本列表
  list: (caseId: number) =>
    http.get<CaseVersion[]>(`/cases/${caseId}/versions`),

  // 获取版本详情
  get: (caseId: number, versionId: number) =>
    http.get<CaseVersion>(`/cases/${caseId}/versions/${versionId}`),

  // 创建版本
  create: (caseId: number, changeLog: string) =>
    http.post<CaseVersion>(`/cases/${caseId}/versions`, { changeLog }),

  // 恢复版本
  restore: (caseId: number, versionId: number) =>
    http.post<Case>(`/cases/${caseId}/versions/${versionId}/restore`)
}

// 案例统计 API
export const caseStatsApi = {
  // 获取统计数据
  getStats: (tenantId: number) =>
    http.get<CaseStats>(`/cases/stats`, { params: { tenantId } }),

  // 获取趋势数据
  getTrend: (tenantId: number, days: number = 30) =>
    http.get<{ date: string; count: number; views: number }[]>(`/cases/stats/trend`, {
      params: { tenantId, days } })
}
