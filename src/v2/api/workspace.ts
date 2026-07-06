// Workspace 模块 API - V2 统一工作台接口
import http from './http'
import type {
  DashboardStats,
  KeywordCluster,
  KeywordContentSuggestion,
  GeneratedContent,
  ReviewItem,
  PublishTask,
  Media,
  MediaStats,
  MediaQuery,
  ReviewQuery,
  PublishQuery,
  GenerateContentParams,
  ReviewActionParams,
  PageResult,
  Tenant,
  AuditLog,
  AuditLogQuery,
  AuditLogStats,
  SystemSettings,
} from '../types/workspace'

// ==================== 仪表盘 API ====================
export const dashboardApi = {
  // 获取统计数据
  getStats: () =>
    http.get<DashboardStats>('/workspace/dashboard/stats'),

  // 获取图表数据
  getCharts: () =>
    http.get<any>('/workspace/dashboard/charts'),

  // 获取最近文章
  getRecentArticles: () =>
    http.get<any[]>('/workspace/articles?page=1&size=10'),
}

// ==================== 关键词采集 API ====================
export const keywordApi = {
  // 获取关键词列表
  list: (params: { page?: number; size?: number; status?: string; keyword?: string }) =>
    http.get<PageResult<{ id: number; rawKeyword: string; normalizedKeyword: string; searchVolume: number; competition: number; status: string; createdAt: string }>>('/workspace/keywords', { params }),

  // 导入关键词
  importKeywords: (data: { keywords: string[] }) =>
    http.post<{ imported: number; total: number }>('/workspace/keywords/import', data),

  // 采集关键词
  collect: (data: { sourceCodes: string[] }) =>
    http.post<{ collected: number; sourcesUsed: number; message: string }>('/workspace/keywords/collect', data),

  // 删除关键词
  delete: (id: number) =>
    http.delete<void>(`/api/v2/workspace/keywords/${id}`),

  // 批量删除
  batchDelete: (ids: number[]) =>
    http.delete<{ deleted: number }>('/workspace/keywords/batch-delete', { data: ids }),

  // 获取关键词统计
  getStats: () =>
    http.get<{ total: number; pending: number; distilled: number }>('/workspace/keywords/stats'),

  // 获取关键词图表数据（趋势图和来源分布）
  getKeywordStats: () =>
    http.get<{
      trendData: { dates: string[]; counts: number[] }
      sourceDistribution: { name: string; value: number }[]
    }>('/workspace/keywords/stats'),
}

// ==================== 聚类蒸馏 API ====================
export const clusterApi = {
  // 获取聚类列表
  list: (params: { page?: number; size?: number }) =>
    http.get<PageResult<KeywordCluster>>('/workspace/clusters', { params }),

  // 获取聚类详情
  get: (id: number) =>
    http.get<KeywordCluster>(`/api/v2/workspace/clusters/${id}`),

  // 执行聚类蒸馏
  distill: (params?: { tenantId?: number }) =>
    http.post<{ clusterCount: number; clusters: KeywordCluster[] }>('/workspace/clusters/distill', null, { params }),

  // 生成聚类内容建议
  generateSuggestions: (clusterId: number, params?: { tenantId?: number }) =>
    http.post<KeywordContentSuggestion[]>('/workspace/clusters/' + clusterId + '/generate-suggestions', null, { params }),
}

// ==================== 内容建议 API ====================
export const suggestionApi = {
  // 获取内容建议列表
  list: (params: { page?: number; size?: number; status?: string }) =>
    http.get<PageResult<KeywordContentSuggestion>>('/workspace/suggestions', { params }),

  // 获取单个建议
  get: (id: number) =>
    http.get<KeywordContentSuggestion>(`/api/v2/workspace/suggestions/${id}`),

  // 更新内容建议
  update: (id: number, data: { title: string; contentPrompt: string; score: number; reason: string; status: string }) =>
    http.put<KeywordContentSuggestion>(`/api/v2/workspace/suggestions/${id}`, data),
}

// ==================== 文章生成 API ====================
export const articleApi = {
  // 从建议生成文章
  generateFromSuggestion: (suggestionId: number, templateType?: string) =>
    http.post<{ articleId: number; title: string; status: string }>('/workspace/articles/generate', {
      suggestionId,
      templateType: templateType || 'default'
    }),

  // 获取文章列表
  list: (params: { page?: number; size?: number; status?: string; category?: string }) =>
    http.get<PageResult<GeneratedContent>>('/workspace/articles', { params }),

  // 获取文章详情
  get: (id: number) =>
    http.get<GeneratedContent>(`/api/v2/workspace/articles/${id}`),

  // 更新文章
  update: (id: number, data: any) =>
    http.put<GeneratedContent>(`/api/v2/workspace/articles/${id}`, data),

  // 删除文章
  delete: (id: number) =>
    http.delete<void>(`/api/v2/workspace/articles/${id}`),
}

// ==================== 内容审核 API ====================
export const reviewApi = {
  // 获取待审核列表
  pendingList: (params: { page?: number; size?: number }) =>
    http.get<PageResult<ReviewItem>>('/workspace/reviews/pending', { params }),

  // 获取审核详情
  get: (id: number) =>
    http.get<ReviewItem>(`/api/v2/workspace/reviews/${id}`),

  // 提交审核
  submitForReview: (articleId: number) =>
    http.post<{ articleId: number; status: string; submittedAt: string }>(`/api/v2/workspace/articles/${articleId}/submit-review`),

  // 通过审核
  approve: (articleId: number, comment?: string) =>
    http.post<{ articleId: number; status: string; approvedAt: string; comment: string }>(`/api/v2/workspace/reviews/${articleId}/approve`, {
      comment: comment || ''
    }),

  // 拒绝审核
  reject: (articleId: number, reason?: string) =>
    http.post<{ articleId: number; status: string; rejectedAt: string; reason: string }>(`/api/v2/workspace/reviews/${articleId}/reject`, {
      reason: reason || ''
    }),

  // 获取审核统计
  getReviewStats: (tenantId?: number) =>
    http.get<{
      rejectDistribution: { name: string; value: number }[]
      pendingCount: number
      rejectedCount: number
      approvedCount: number
    }>('/workspace/reviews/stats', tenantId ? { params: { tenantId } } : {}),
}

// ==================== 发布管理 API ====================
export const publishApi = {
  // 获取发布任务列表
  list: (params: { page?: number; size?: number; status?: string }) =>
    http.get<PageResult<PublishTask>>('/workspace/publish/jobs', { params }),

  // 创建发布任务
  create: (params: { articleId: number; platform: string; scheduledTime?: string }) =>
    http.post<{ jobId: number; articleId: number; status: string; scheduledAt: string }>('/workspace/publish/' + params.articleId, params),

  // 取消发布
  cancel: (jobId: number) =>
    http.post<{ jobId: number; status: string }>(`/api/v2/workspace/publish/jobs/${jobId}/cancel`),

  // 获取发布统计
  getStats: () =>
    http.get<{ pending: number; completed: number; failed: number }>('/workspace/publish/stats'),

  // 获取发布统计详情
  getStatsDetail: (tenantId?: number) =>
    http.get<any>('/workspace/publish/stats/detail' + (tenantId ? '?tenantId=' + tenantId : '')),
}

// ==================== 发布配置 API ====================
export const publishConfigApi = {
  // 获取发布配置
  get: () =>
    http.get<any>('/publish-config'),

  // 保存发布配置
  update: (data: any) =>
    http.put<any>('/publish-config', data),

  // 获取平台配置列表
  listPlatforms: () =>
    http.get<any[]>('/publish-config/platforms'),

  // 获取平台配置详情
  getPlatform: (id: number) =>
    http.get<any>(`/publish-config/platforms/${id}`),

  // 创建平台配置
  createPlatform: (data: any) =>
    http.post<any>('/publish-config/platforms', data),

  // 更新平台配置
  updatePlatform: (id: number, data: any) =>
    http.put<any>(`/publish-config/platforms/${id}`, data),

  // 删除平台配置
  deletePlatform: (id: number) =>
    http.delete<void>(`/publish-config/platforms/${id}`),

  // 测试平台连接
  testPlatform: (id: number) =>
    http.post<{ success: boolean; message: string }>(`/publish-config/platforms/${id}/test`),
}

// ==================== 发布队列 API ====================
export const publishQueueApi = {
  // 获取队列列表
  list: (params: { page?: number; size?: number; status?: string }) =>
    http.get<PageResult<any>>('/publish-queue', { params }),

  // 立即发布
  publishNow: (id: number) =>
    http.post<any>(`/api/v2/publish-queue/${id}/publish-now`),

  // 调整优先级
  adjustPriority: (id: number, priority: number) =>
    http.put<void>(`/api/v2/publish-queue/${id}/priority`, { priority }),

  // 取消发布
  cancel: (id: number) =>
    http.put<void>(`/api/v2/publish-queue/${id}/cancel`),

  // 获取队列统计
  getStats: () =>
    http.get<{ pending: number; publishing: number; todayPublished: number; failed: number }>('/publish-queue/stats'),
}

// ==================== 媒体库 API ====================
export const mediaApi = {
  // 获取项目列表
  projects: () =>
    http.get<any[]>('/workspace/media/projects'),

  // 获取媒体列表（可按项目筛选）
  list: (params?: { page?: number; size?: number; type?: string; category?: string }) =>
    http.get<PageResult<Media>>('/workspace/media', { params }),

  // 获取媒体详情
  get: (id: number) =>
    http.get<Media>(`/api/v2/workspace/media/${id}`),

  // 上传单个媒体文件
  upload: (file: File, category?: string, onProgress?: (progress: number) => void) => {
    const formData = new FormData()
    formData.append('file', file)
    if (category) formData.append('category', category)
    return http.post<Media>('/workspace/media/upload', formData, {
      onUploadProgress: (progressEvent: any) => {
        if (onProgress && progressEvent.total) {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total)
          onProgress(percentCompleted)
        }
      },
    })
  },

  // 批量上传
  uploadBatch: (files: File[], category?: string) => {
    const formData = new FormData()
    files.forEach(f => formData.append('files', f))
    if (category) formData.append('category', category)
    return http.post<Media[]>('/workspace/media/upload-batch', formData)
  },

  // 获取图片分析状态
  getAnalysisStatus: (id: number) => http.get<{ ocrStatus: string; ocrText: string; aiDescription: string }>(`/workspace/media/${id}/analysis-status`),

  // 删除媒体
  delete: (id: number) =>
    http.delete<void>(`/workspace/media/${id}`),

  // 批量删除
  deleteBatch: (ids: number[]) =>
    http.post<{ deleted: number }>('/workspace/media/batch-delete', { ids }),

  // 获取媒体统计
  getStats: () =>
    http.get<{ total: number; images: number; videos: number; audios: number; documents: number }>('/workspace/media/stats'),
}

// ==================== 租户管理 API ====================
export const tenantApi = {
  list: () =>
    http.get<Tenant[]>('/admin/tenants'),
}

// ==================== 系统管理 API ====================
export const adminApi = {
  // 用户管理
  users: {
    list: (params: { page?: number; size?: number; keyword?: string; status?: string; tenantId?: number }) =>
      http.get<PageResult<any>>('/admin/users', { params }),
    get: (id: number) =>
      http.get<any>(`/admin/users/${id}`),
    create: (data: any) =>
      http.post<any>('/admin/users', data),
    update: (id: number, data: any) =>
      http.put<any>(`/admin/users/${id}`, data),
    delete: (id: number) =>
      http.delete<void>(`/admin/users/${id}`),
    updateStatus: (id: number, status: string) =>
      http.patch<void>(`/admin/users/${id}/status`, { status }),
    getRoles: (id: number) =>
      http.get<number[]>(`/admin/users/${id}/roles`),
    assignRoles: (id: number, roleIds: number[]) =>
      http.put<void>(`/admin/users/${id}/roles`, roleIds),
    resetPassword: (id: number) =>
      http.post<{ newPassword: string }>(`/admin/users/${id}/reset-password`),
  },

  // 站点管理
  sites: {
    list: (params: { page?: number; size?: number; status?: string }) =>
      http.get<PageResult<any>>('/admin/sites', { params }),
    get: (id: number) =>
      http.get<any>(`/admin/sites/${id}`),
    create: (data: any) =>
      http.post<any>('/admin/sites', data),
    update: (id: number, data: any) =>
      http.put<any>(`/admin/sites/${id}`, data),
    delete: (id: number) =>
      http.delete<void>(`/admin/sites/${id}`),
  },

  // 角色管理
  roles: {
    list: (params: { page?: number; size?: number; keyword?: string; status?: string }) =>
      http.get<PageResult<any>>('/admin/roles', { params }),
    all: () =>
      http.get<any[]>('/admin/roles/all'),
    get: (id: number) =>
      http.get<any>(`/admin/roles/${id}`),
    create: (data: any) =>
      http.post<any>('/admin/roles', data),
    update: (id: number, data: any) =>
      http.put<any>(`/admin/roles/${id}`, data),
    delete: (id: number) =>
      http.delete<void>(`/admin/roles/${id}`),
    updateStatus: (id: number, status: string) =>
      http.patch<void>(`/admin/roles/${id}/status`, { status }),
    getPermissions: (id: number) =>
      http.get<number[]>(`/admin/roles/${id}/permissions`),
    assignPermissions: (id: number, permissionIds: number[]) =>
      http.put<void>(`/admin/roles/${id}/permissions`, permissionIds),
  },

  // 权限管理
  permissions: {
    list: (params?: { module?: string; keyword?: string }) =>
      http.get<any[]>('/admin/permissions', { params }),
    tree: (params?: { module?: string }) =>
      http.get<any[]>('/admin/permissions/tree', { params }),
    get: (id: number) =>
      http.get<any>(`/admin/permissions/${id}`),
    create: (data: any) =>
      http.post<any>('/admin/permissions', data),
    update: (id: number, data: any) =>
      http.put<any>(`/admin/permissions/${id}`, data),
    delete: (id: number) =>
      http.delete<void>(`/admin/permissions/${id}`),
  },

  // Prompt 模板管理
  prompts: {
    list: (params: { page?: number; size?: number; category?: string }) =>
      http.get<PageResult<any>>('/admin/prompts', { params }),
    get: (id: number) =>
      http.get<any>(`/admin/prompts/${id}`),
    create: (data: any) =>
      http.post<any>('/admin/prompts', data),
    update: (id: number, data: any) =>
      http.put<any>(`/admin/prompts/${id}`, data),
    delete: (id: number) =>
      http.delete<void>(`/admin/prompts/${id}`),
  },

  // AI 调用统计
  ai: {
    getStats: () =>
      http.get<{ totalCalls: number; todayCalls: number; successCalls: number; successRate: string }>('/admin/ai/stats'),
    getLogs: (params: { page?: number; size?: number; model?: string; status?: string }) =>
      http.get<PageResult<any>>('/admin/ai/logs', { params }),
  },

  // 审计日志
  auditLogs: {
    list: (params: AuditLogQuery) =>
      http.get<PageResult<AuditLog>>('/admin/audit-logs', { params }),
    getStats: (tenantId?: number) =>
      http.get<AuditLogStats>('/admin/audit-logs/stats', tenantId ? { params: { tenantId } } : {}),
    export: (params: AuditLogQuery) => {
      const queryStr = new URLSearchParams()
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          queryStr.append(key, String(value))
        }
      })
      window.open(`/api/v2/admin/audit-logs/export?${queryStr.toString()}`, '_blank')
    },
  },

  // 系统设置
  settings: {
    get: (tenantId?: number) =>
      http.get<SystemSettings>('/admin/settings', tenantId ? { params: { tenantId } } : {}),
    update: (data: Partial<SystemSettings>, tenantId?: number) =>
      http.put<SystemSettings>('/admin/settings', data, tenantId ? { params: { tenantId } } : {}),
    testAiConnection: (data: any, tenantId?: number) =>
      http.post<{ success: boolean; message: string; model?: string }>('/admin/settings/ai/test', data, tenantId ? { params: { tenantId } } : {}),
  },

  // 管理后台仪表盘
  dashboard: () =>
    http.get<any>('/admin/dashboard'),
}

// ==================== 站点管理 API ====================
export const siteApi = adminApi.sites

// ==================== 系统提示词 API ====================
export const systemPromptApi = adminApi.prompts

// ==================== 分类管理 API ====================
export const categoryApi = {
  list: (params: any) =>
    http.get<any>('/article/categories', { params: { all: true, ...params } }),
  get: (id: number) =>
    http.get<any>(`/article/categories/${id}`),
  create: (data: any) =>
    http.post<any>('/article/categories', data),
  update: (id: number, data: any) =>
    http.put<any>(`/article/categories/${id}`, data),
  delete: (id: number) =>
    http.delete<void>(`/article/categories/${id}`),
  getStats: () =>
    http.get<any>('/article/categories/stats'),
}

// 统一导出
export default {
  dashboard: dashboardApi,
  keyword: keywordApi,
  cluster: clusterApi,
  suggestion: suggestionApi,
  article: articleApi,
  review: reviewApi,
  publish: publishApi,
  publishConfig: publishConfigApi,
  publishQueue: publishQueueApi,
  media: mediaApi,
  tenant: tenantApi,
  admin: adminApi,
  site: siteApi,
  systemPrompt: systemPromptApi,
  category: categoryApi,
}
