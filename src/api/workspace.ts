// Workspace 模块 API - 统一工作台接口
import http from './http'
import type {
  DashboardStats,
  KeywordCluster,
  KeywordContentSuggestion,
  GeneratedContent,
  ReviewItem,
  PublishTask,
  PublishRecord,
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
  AlertRule,
  AlertRuleQuery,
  AlertRecord,
  AlertRecordQuery,
  AlertRecordStats,
  AlertChannelConfig,
  AlertChannelQuery,
} from '../types/workspace'

// ==================== 仪表盘 API ====================
export const dashboardApi = {
  // 获取统计数据
  getStats: (tenantId?: number) =>
    http.get<DashboardStats>('/workspace/dashboard/stats', tenantId !== undefined ? { params: { tenantId } } : {}),

  // 获取图表数据
  getCharts: (tenantId?: number) =>
    http.get<any>('/workspace/dashboard/charts', tenantId !== undefined ? { params: { tenantId } } : {}),

  // 获取最近文章
  getRecentArticles: () =>
    http.get<PageResult<any>>('/workspace/articles?page=1&size=10'),
}

// ==================== 关键词采集 API ====================
export const keywordApi = {
  // 获取关键词列表
  list: (params: { page?: number; size?: number; status?: string; keyword?: string; tenantId?: number }) =>
    http.get<PageResult<{ id: number; rawKeyword: string; normalizedKeyword: string; searchVolume: number; competition: number; status: string; createdAt: string }>>('/workspace/keywords', { params }),

  // 导入关键词
  importKeywords: (data: { keywords: string[] }, tenantId?: number) =>
    http.post<{ imported: number; total: number }>('/workspace/keywords/import', data, { params: { tenantId } }),

  // 采集关键词
  collect: (data: { sourceCodes: string[] }, tenantId?: number) =>
    http.post<{ collected: number; sourcesUsed: number; message: string }>('/workspace/keywords/collect', data, { params: { tenantId } }),

  // 删除关键词
  delete: (id: number, tenantId?: number) =>
    http.delete<void>(`/workspace/keywords/${id}`, { params: { tenantId } }),

  // 批量删除
  batchDelete: (ids: number[], tenantId?: number) =>
    http.delete<{ deleted: number }>('/workspace/keywords/batch-delete', { data: ids, params: { tenantId } }),

  // 获取关键词统计
  getStats: (tenantId?: number) =>
    http.get<{ total: number; pending: number; distilled: number }>('/workspace/keywords/stats', { params: { tenantId } }),

  // 获取关键词图表数据（趋势图和来源分布）
  getKeywordStats: (tenantId?: number) =>
    http.get<{
      trendData: { dates: string[]; counts: number[] }
      sourceDistribution: { name: string; value: number }[]
    }>('/workspace/keywords/stats', { params: { tenantId } }),

  // 批量更新优先级（priority 参与蒸馏选词排序，不是展示字段）
  batchUpdatePriority: (ids: number[], priority: number, tenantId?: number) =>
    http.post<{ updated: number }>('/workspace/keywords/batch-priority', { ids, priority }, { params: { tenantId } }),

  // 关键词库 SOT 总览：词量绝对值 / 转化漏斗分布 / 生产进度（FR-4 FR-6）
  getLibraryStats: (tenantId?: number) =>
    http.get<{
      total: number
      cat_price: number; cat_choice: number; cat_effect: number; cat_guide: number
      cat_basic: number; cat_local: number; cat_news: number
      stage_new: number; stage_suggested: number; stage_articled: number
    }>('/workspace/keywords/library-stats', { params: { tenantId } }),

  // 读取当前租户每周关键词扩展配置（FR-11）
  getExpandConfig: (tenantId?: number) =>
    http.get<{ tenantId: number; enabled: number; weekday: string; runTime: string }>(
      '/workspace/keywords/expand-config', { params: { tenantId } }),

  // 管理员修改每周扩展配置
  updateExpandConfig: (
    data: { enabled?: boolean | number; weekday?: string; runTime?: string },
    tenantId?: number
  ) =>
    http.put<{ tenantId: number; enabled: number; weekday: string; runTime: string }>(
      '/workspace/keywords/expand-config', data, { params: { tenantId } }),

  // 管理员立即触发关键词扩展（默认 3 源白名单，可传 sourceCodes 覆盖）
  expand: (data?: { sourceCodes?: string[] }, tenantId?: number) =>
    http.post<{ message: string; libraryStats?: any }>('/workspace/keywords/expand', data ?? {}, { params: { tenantId } }),
}

// ==================== 聚类蒸馏 API ====================
export const clusterApi = {
  // 获取聚类列表
  list: (params: { tenantId?: number; page?: number; size?: number }) =>
    http.get<PageResult<KeywordCluster>>('/workspace/clusters', { params }),

  // 获取聚类详情
  get: (id: number, params?: { tenantId?: number }) =>
    http.get<KeywordCluster>(`/workspace/clusters/${id}`, { params }),

  // 执行聚类蒸馏（默认 preview=false 直接入库；preview=true 返回预览，不落库）
  distill: (params?: { tenantId?: number; preview?: boolean }) =>
    http.post<{
      clusterCount: number
      clusters: KeywordCluster[]
      preview?: boolean
      distillSource?: 'ai_model' | 'rule_fallback' | 'empty'
      usedRuleFallback?: boolean
    }>('/workspace/clusters/distill', null, { params }),

  // 两阶段蒸馏：确认 preview 中选中的聚类，落库
  confirmDistill: (body: { clusters: KeywordCluster[] }, params?: { tenantId?: number }) =>
    http.post<{ clusterCount: number; clusters: KeywordCluster[] }>('/workspace/clusters/confirm', body, { params }),

  // 生成聚类内容建议
  generateSuggestions: (clusterId: number, params?: { tenantId?: number }) =>
    http.post<KeywordContentSuggestion[]>('/workspace/clusters/' + clusterId + '/generate-suggestions', null, { params }),
}

// ==================== 内容建议 API ====================
export const suggestionApi = {
  // 获取内容建议列表
  list: (params: { tenantId?: number; page?: number; size?: number; status?: string }) =>
    http.get<PageResult<KeywordContentSuggestion>>('/workspace/suggestions', { params }),

  // 更新内容建议
  update: (id: number, data: { title: string; contentPrompt: string; score: number; reason: string; status: string }) =>
    http.put<KeywordContentSuggestion>(`/workspace/suggestions/${id}`, data),
}

// ==================== 文章生成 API ====================
export const articleApi = {
  // 异步生成文章
  generateAsync: (params: any, query?: { tenantId?: number }) =>
    http.post<{ taskId: number; status: string; message: string }>('/workspace/articles/generate-async', params, { params: query }),

  // 获取生成任务状态
  getGenerationStatus: (taskId: number) =>
    http.get<{
      taskId: number
      status: string
      progress: number
      stage: string
      articleId?: number
      errorMessage?: string
      title?: string
      content?: string
      summary?: string
      wordCount?: number
      knowledgeReferences?: string[]
    }>(`/workspace/articles/generate/${taskId}/status`),

  // SSE 流式获取生成任务进度（前端用 EventSource 接收，连接失败需降级为轮询）
  streamGenerationStatus: (taskId: number) => {
    return new EventSource(`/api/workspace/articles/generate/${taskId}/stream`)
  },

  // 取消生成任务
  cancelGeneration: (taskId: number) =>
    http.post<{ taskId: number; status: string; message: string }>(`/workspace/articles/generate/${taskId}/cancel`),

  // 版本对比
  compareVersions: (articleId: number, versionId1: number, versionId2: number) =>
    http.get<{
      articleId: number
      version1: any
      version2: any
      titleChanged: boolean
      summaryChanged: boolean
      contentChanged: boolean
      seoTitleChanged: boolean
      seoDescriptionChanged: boolean
      keywordsChanged: boolean
      llmsSummaryChanged: boolean
      geoCitationSummaryChanged: boolean
    }>(`/workspace/articles/${articleId}/versions/compare`, { params: { versionId1, versionId2 } }),

  // Token 消耗统计
  getTokenStats: (days?: number, tenantId?: number) =>
    http.get<{
      totalTasks: number
      completedTasks: number
      failedTasks: number
      totalPromptTokens: number
      totalCompletionTokens: number
      totalTokens: number
      days: number
      modelStats: Array<{
        modelName: string
        taskCount: number
        promptTokens: number
        completionTokens: number
        totalTokens: number
      }>
    }>('/workspace/articles/generate/token-stats', { params: { days, tenantId } }),

  // 获取文章列表
  list: (params: { page?: number; size?: number; status?: string; category?: string; tenantId?: number }) =>
    http.get<PageResult<GeneratedContent>>('/workspace/articles', { params }),

  // 获取文章详情
  get: (id: number, tenantId?: number) =>
    http.get<GeneratedContent>(`/workspace/articles/${id}`, { params: { tenantId } }),

  // 更新文章
  update: (id: number, data: any, tenantId?: number) =>
    http.put<GeneratedContent>(`/workspace/articles/${id}`, data, { params: { tenantId } }),

  // 删除文章
  delete: (id: number, tenantId?: number) =>
    http.delete<void>(`/workspace/articles/${id}`, { params: { tenantId } }),

  // 批量删除
  batchDelete: (ids: number[], tenantId?: number) =>
    http.delete<void>('/workspace/articles/batch', { data: ids, params: { tenantId } }),

  // 提交审核
  submitReview: (id: number, tenantId?: number) =>
    http.post<{ articleId: number; status: string }>(`/workspace/articles/${id}/submit-review`, null, { params: { tenantId } }),

  // 批量发布：不传 scheduledTime 就是逐条立即发布，传未来的时间则逐条入队
  batchPublish: (ids: number[], options?: { scheduledTime?: string; priority?: number }, tenantId?: number) =>
    http.post<{ published: number; scheduled: number; failed: number; total: number; errors: { articleId: number; message: string }[] }>(
      '/workspace/articles/batch-publish',
      { ids, ...options },
      { params: { tenantId } }
    ),
}

// ==================== 内容审核 API ====================
export const reviewApi = {
  // 获取待审核列表
  pendingList: (params: { page?: number; size?: number; tenantId?: number }) =>
    http.get<PageResult<ReviewItem>>('/workspace/reviews/pending', { params }),

  // 提交审核
  submitForReview: (articleId: number, tenantId?: number) =>
    http.post<{ articleId: number; status: string; submittedAt: string }>(`/workspace/articles/${articleId}/submit-review`, null, { params: { tenantId } }),

  // 通过审核
  approve: (articleId: number, comment?: string, tenantId?: number) =>
    http.post<{ articleId: number; status: string; approvedAt: string; comment: string }>(`/workspace/reviews/${articleId}/approve`, {
      comment: comment || ''
    }, { params: { tenantId } }),

  // 拒绝审核
  reject: (articleId: number, reason?: string, tenantId?: number) =>
    http.post<{ articleId: number; status: string; rejectedAt: string; reason: string }>(`/workspace/reviews/${articleId}/reject`, {
      reason: reason || ''
    }, { params: { tenantId } }),

  // 获取审核统计
  getReviewStats: (tenantId?: number) =>
    http.get<{
      rejectDistribution: { name: string; value: number }[]
      pendingCount: number
      rejectedCount: number
      approvedCount: number
    }>('/workspace/reviews/stats', tenantId ? { params: { tenantId } } : {}),
}

// ==================== 发布 API ====================
// 三个后端入口共用 PublishExecutor：立即发布 / 排期入队都走 publish()，
// 队列的增删改查走 publishQueueApi，历史记录走 publishApi.records。
export const publishApi = {
  // 发布单篇：不传 scheduledTime 即立即发布，传未来时间即入队
  publish: (articleId: number, options?: { scheduledTime?: string; priority?: number }, tenantId?: number) =>
    http.post<{ articleId: number; jobId?: number; queueId?: number; status: string; scheduledAt: string }>(
      `/workspace/publish/${articleId}`, options ?? {}, { params: { tenantId } }),

  // 发布记录列表（publish_job）
  records: (params: { page?: number; size?: number; status?: string; siteId?: number; tenantId?: number }) =>
    http.get<PageResult<PublishRecord>>('/publish-records', { params }),

  // 发布记录统计
  recordStats: (params?: { siteId?: number; tenantId?: number }) =>
    http.get<{
      total: number
      successCount: number
      failedCount: number
      cancelledCount: number
      todayCount: number
      successRate: number
    }>('/publish-records/stats', { params }),
}

// ==================== 发布配置 API ====================
export const publishConfigApi = {
  // 获取发布配置
  get: (tenantId?: number) =>
    http.get<any>('/publish-config', { params: { tenantId } }),

  // 保存发布配置
  update: (data: any, tenantId?: number) =>
    http.put<any>('/publish-config', data, { params: { tenantId } }),

  // 可选发布模式
  modes: () =>
    http.get<{ value: string; label: string }[]>('/publish-config/modes'),

  // 获取平台配置列表
  listPlatforms: (params?: { siteId?: number; tenantId?: number }) =>
    http.get<any[]>('/publish-config/platforms', { params }),

  // 创建平台配置
  createPlatform: (data: any, tenantId?: number) =>
    http.post<any>('/publish-config/platforms', data, { params: { tenantId } }),

  // 更新平台配置
  updatePlatform: (id: number, data: any, tenantId?: number) =>
    http.put<any>(`/publish-config/platforms/${id}`, data, { params: { tenantId } }),

  // 删除平台配置
  deletePlatform: (id: number, tenantId?: number) =>
    http.delete<void>(`/publish-config/platforms/${id}`, { params: { tenantId } }),

  // 测试平台连接（网络可达性探测，未接入发布驱动）
  testPlatform: (id: number, tenantId?: number) =>
    http.post<{ success: boolean; message: string }>(`/publish-config/platforms/${id}/test`, null, { params: { tenantId } }),
}

// ==================== 发布队列 API ====================
export const publishQueueApi = {
  // 获取队列列表
  list: (params: { page?: number; size?: number; siteId?: number; status?: string; keyword?: string; tenantId?: number }) =>
    http.get<PageResult<PublishTask>>('/publish-queue', { params }),

  // 入队定时发布
  create: (body: { articleId: number; scheduledTime: string; priority?: number }, tenantId?: number) =>
    http.post<PublishTask>('/publish-queue', body, { params: { tenantId } }),

  // 立即发布这条队列记录
  publishNow: (id: number, tenantId?: number) =>
    http.post<{ id: number; status: string; publishTime: string; errorMessage: string }>(
      `/publish-queue/${id}/publish-now`, null, { params: { tenantId } }),

  // 调整优先级
  adjustPriority: (id: number, priority: number, tenantId?: number) =>
    http.put<PublishTask>(`/publish-queue/${id}/priority`, { priority }, { params: { tenantId } }),

  // 取消发布
  cancel: (id: number, tenantId?: number) =>
    http.put<PublishTask>(`/publish-queue/${id}/cancel`, null, { params: { tenantId } }),

  // 删除队列记录
  remove: (id: number, tenantId?: number) =>
    http.delete<void>(`/publish-queue/${id}`, { params: { tenantId } }),

  // 获取队列统计
  getStats: (tenantId?: number) =>
    http.get<{ pending: number; publishing: number; todayPublished: number; failed: number }>(
      '/publish-queue/stats', { params: { tenantId } }),
}

// ==================== 媒体库 API ====================
export const mediaApi = {
  // 获取项目列表
  projects: () =>
    http.get<any[]>('/workspace/media/projects'),

  // 获取媒体列表（可按项目筛选）
  list: (params?: { tenantId?: number; page?: number; size?: number; type?: string; category?: string }) =>
    http.get<PageResult<Media>>('/workspace/media', { params }),

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

  // 删除媒体
  delete: (id: number) =>
    http.delete<void>(`/workspace/media/${id}`),

  // 批量删除
  deleteBatch: (ids: number[]) =>
    http.post<{ deleted: number }>('/workspace/media/batch-delete', { ids }),
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
      window.open(`/api/admin/audit-logs/export?${queryStr.toString()}`, '_blank')
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

  // 报警管理
  alert: {
    rules: {
      list: (params: AlertRuleQuery) =>
        http.get<PageResult<AlertRule>>('/admin/alert/rules', { params }),
      get: (id: number) =>
        http.get<AlertRule>(`/admin/alert/rules/${id}`),
      create: (data: Partial<AlertRule>) =>
        http.post<AlertRule>('/admin/alert/rules', data),
      update: (id: number, data: Partial<AlertRule>) =>
        http.put<AlertRule>(`/admin/alert/rules/${id}`, data),
      delete: (id: number) =>
        http.delete<void>(`/admin/alert/rules/${id}`),
    },
    records: {
      list: (params: AlertRecordQuery) =>
        http.get<PageResult<AlertRecord>>('/admin/alert/records', { params }),
      get: (id: number) =>
        http.get<AlertRecord>(`/admin/alert/records/${id}`),
      updateStatus: (id: number, status: string) =>
        http.put<AlertRecord>(`/admin/alert/records/${id}/status`, { status }),
      getStats: (tenantId?: number) =>
        http.get<AlertRecordStats>('/admin/alert/records/stats', tenantId ? { params: { tenantId } } : {}),
    },
    channels: {
      list: (params: AlertChannelQuery) =>
        http.get<PageResult<AlertChannelConfig>>('/admin/alert/channels', { params }),
      get: (id: number) =>
        http.get<AlertChannelConfig>(`/admin/alert/channels/${id}`),
      create: (data: Partial<AlertChannelConfig>) =>
        http.post<AlertChannelConfig>('/admin/alert/channels', data),
      update: (id: number, data: Partial<AlertChannelConfig>) =>
        http.put<AlertChannelConfig>(`/admin/alert/channels/${id}`, data),
      delete: (id: number) =>
        http.delete<void>(`/admin/alert/channels/${id}`),
    }
  },
}

// ==================== 报警管理 API ====================
export const alertApi = adminApi.alert

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
  alert: alertApi,
}
