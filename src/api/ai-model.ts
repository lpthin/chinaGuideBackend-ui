// AI 大模型配置 API
import http from './http'
import type {
  AIModel,
  ModelConfig,
  ModelPurposeMapping,
  ModelUsageLog,
  ModelUsageStatistics,
  VectorDatabaseConfig,
  EmbeddingConfig,
  ModelPerformanceMetrics,
  ModelConnectionTestResult,
  ModelQueryParams,
  UsageQueryParams,
  ModelConfigForm,
  VectorDatabaseForm,
  EmbeddingConfigForm,
  ModelProvider,
  ModelPurpose,
  ArticleTemplate,
  ArticleTemplateForm,
  ArticleTemplateQueryParams,
  ArticleGenerationLog,
} from '../types/ai-model'

// 模型 API (复用 modelConfigApi)
export const modelApi = {
  // 获取模型列表（复用 modelConfigApi）
  list: (params: ModelQueryParams) =>
    http.get<{
      records: AIModel[]
      total: number
    }>('/ai/model-configs', { params }),

  // 获取模型详情（复用 modelConfigApi）
  get: (id: number) =>
    http.get<AIModel>(`/ai/model-configs/${id}`),

  // 按提供商获取模型
  getByProvider: (provider: ModelProvider) =>
    http.get<AIModel[]>(`/ai/models/provider/${provider}`),

  // 测试模型连接
  testConnection: (configId: number) =>
    http.post<ModelConnectionTestResult>(`/ai/model-configs/${configId}/test`),
}

// 模型配置 API
export const modelConfigApi = {
  // 获取配置列表
  list: (params: { tenantId?: number; isActive?: boolean; page?: number; size?: number }) =>
    http.get<{
      records: ModelConfig[]
      total: number
      page: number
      size: number
    }>('/ai/model-configs', { params }),

  // 获取配置详情
  get: (id: number) =>
    http.get<ModelConfig>(`/ai/model-configs/${id}`),

  // 创建配置
  create: (tenantId: number, data: ModelConfigForm) =>
    http.post<ModelConfig>('/ai/model-configs', { tenantId, ...data }),

  // 更新配置
  update: (id: number, data: Partial<ModelConfigForm>) =>
    http.put<ModelConfig>(`/ai/model-configs/${id}`, data),

  // 删除配置
  delete: (id: number) =>
    http.delete(`/ai/model-configs/${id}`),

  // 设置为默认配置
  setDefault: (id: number) =>
    http.post<ModelConfig>(`/ai/model-configs/${id}/set-default`),

  // 切换启用状态
  toggleStatus: (id: number) =>
    http.post<ModelConfig>(`/ai/model-configs/${id}/toggle-status`),

  // 测试配置连接
  test: (id: number) =>
    http.post<ModelConnectionTestResult>(`/ai/model-configs/${id}/test`),

  // 测试新配置（不保存）
  testNew: (data: ModelConfigForm) =>
    http.post<ModelConnectionTestResult>('/ai/model-configs/test', data),
}

// 模型用途映射 API
export const modelPurposeApi = {
  // 获取所有用途映射
  list: (tenantId: number) =>
    http.get<ModelPurposeMapping[]>(`/ai/model-purposes`, { params: { tenantId } }),

  // 获取特定用途配置
  getByPurpose: (tenantId: number, purpose: ModelPurpose) =>
    http.get<ModelPurposeMapping>(`/ai/model-purposes/${purpose}`, { params: { tenantId } }),

  // 创建/更新用途配置
  set: (tenantId: number, purpose: ModelPurpose, modelConfigId: number) =>
    http.post<ModelPurposeMapping>('/ai/model-purposes', { tenantId, purpose, modelConfigId }),

  // 批量设置用途配置
  batchSet: (tenantId: number, mappings: { purpose: ModelPurpose; modelConfigId: number }[]) =>
    http.post<ModelPurposeMapping[]>('/ai/model-purposes/batch', { tenantId, mappings }),
}

// 向量数据库配置 API
export const vectorDbApi = {
  // 获取配置列表
  list: (tenantId: number) =>
    http.get<VectorDatabaseConfig[]>('/ai/vector-dbs', { params: { tenantId } }),

  // 获取配置详情
  get: (id: number) =>
    http.get<VectorDatabaseConfig>(`/ai/vector-dbs/${id}`),

  // 创建配置
  create: (tenantId: number, data: VectorDatabaseForm) =>
    http.post<VectorDatabaseConfig>('/ai/vector-dbs', { tenantId, ...data }),

  // 更新配置
  update: (id: number, data: Partial<VectorDatabaseForm>) =>
    http.put<VectorDatabaseConfig>(`/ai/vector-dbs/${id}`, data),

  // 删除配置
  delete: (id: number) =>
    http.delete(`/ai/vector-dbs/${id}`),

  // 设置为默认配置
  setDefault: (id: number) =>
    http.post<VectorDatabaseConfig>(`/ai/vector-dbs/${id}/set-default`),

  // 切换启用状态
  toggleStatus: (id: number) =>
    http.post<VectorDatabaseConfig>(`/ai/vector-dbs/${id}/toggle-status`),

  // 测试连接
  test: (id: number) =>
    http.post<{ success: boolean; message: string }>(`/ai/vector-dbs/${id}/test`),

  // 测试新配置
  testNew: (data: VectorDatabaseForm) =>
    http.post<{ success: boolean; message: string }>('/ai/vector-dbs/test', data),
}

// 向量化配置 API
export const embeddingConfigApi = {
  // 获取配置
  get: (tenantId: number) =>
    http.get<EmbeddingConfig>('/ai/embedding-config', { params: { tenantId } }),

  // 更新配置
  update: (tenantId: number, data: EmbeddingConfigForm) =>
    http.put<EmbeddingConfig>('/ai/embedding-config', { tenantId, ...data }),
}

// 用量与日志 API
export const usageApi = {
  // 获取用量概览
  getOverview: () =>
    http.get<any>('/ai/usage/today'),

  // 获取用量统计
  getStatistics: (params?: any) =>
    http.get<any[]>('/ai/usage/statistics', { params }),

  // 获取性能指标
  getPerformance: (tenantId: number) =>
    http.get<any>('/ai/usage/performance', { params: { tenantId, startDate: '', endDate: '' } }),

  // 获取调用日志
  getUsageRecords: (params: { page?: number; pageSize?: number }) =>
    http.get<{
      records: any[]
      total: number
    }>('/ai/usage/logs', { params: { page: params.page, size: params.pageSize } }),

  // 获取今日用量
  today: (tenantId: number) =>
    http.get<any>('/ai/usage/today', { params: { tenantId } }),
}

// AI模型使用统计 API
export const aiModelApi = {
  // 获取统计总览
  getStats: (params?: { tenantId?: number; startDate?: string; endDate?: string }) =>
    http.get<any>('/ai/model/stats', { params }),

  // 按模型统计
  getUsageByModel: (params?: { tenantId?: number; startDate?: string; endDate?: string }) =>
    http.get<any[]>('/ai/model/usage', { params }),

  // 按日期统计趋势
  getUsageTrend: (params?: { tenantId?: number; startDate?: string; endDate?: string }) =>
    http.get<any[]>('/ai/model/trend', { params }),

  // 获取调用日志列表
  getLogs: (params?: { tenantId?: number; page?: number; pageSize?: number; type?: string; keyword?: string }) =>
    http.get<{
      records: any[]
      total: number
    }>('/ai/model/logs', { params }),
}

// 软文模板 API
export const articleTemplateApi = {
  // 获取模板列表
  list: (params: ArticleTemplateQueryParams) =>
    http.get<{
      records: ArticleTemplate[]
      total: number
    }>('/ai/article-templates', { params }),

  // 获取模板详情
  get: (id: number) =>
    http.get<ArticleTemplate>(`/ai/article-templates/${id}`),

  // 创建模板
  create: (tenantId: number, data: ArticleTemplateForm) =>
    http.post<ArticleTemplate>('/ai/article-templates', { tenantId, ...data }),

  // 更新模板
  update: (id: number, data: Partial<ArticleTemplateForm>) =>
    http.put<ArticleTemplate>(`/ai/article-templates/${id}`, data),

  // 删除模板
  delete: (id: number) =>
    http.delete(`/ai/article-templates/${id}`),

  // 复制模板
  copy: (id: number) =>
    http.post<ArticleTemplate>(`/ai/article-templates/${id}/copy`),

  // 设置为启用/禁用
  toggleStatus: (id: number) =>
    http.post<ArticleTemplate>(`/ai/article-templates/${id}/toggle-status`),

  // 使用模板生成文章
  generate: (id: number, variables: Record<string, any>) =>
    http.post<{
      content: string
      wordCount: number
      tokensUsed: number
      cost: number
      duration: number
    }>(`/ai/article-templates/${id}/generate`, { variables }),

  // 获取生成记录
  generationLogs: (params: { tenantId: number; page?: number; size?: number }) =>
    http.get<{
      records: ArticleGenerationLog[]
      total: number
    }>('/ai/article-templates/generation-logs', { params }),
}

// AI 生成 API
export const aiGenerateApi = {
  generateArticle: (data: {
    prompt: string
    templateId?: number
    keywords?: string
    tenantId?: number
  }) =>
    http.post<{
      content: string
      wordCount: number
      tokensUsed: number
      model: string
      cost: number
      duration: number
    }>('/ai/generate/article', data),

  generateSeo: (data: {
    title?: string
    content?: string
    keywords?: string
  }) =>
    http.post<{
      seoTitle: string
      seoDescription: string
      seoKeywords: string[]
    }>('/ai/generate/seo', data),

  chunkPreview: (data: {
    content: string
    chunkSize?: number
    overlap?: number
  }) =>
    http.post<
      {
        text: string
        tokens: number
        size: number
      }[]
    >('/ai/embedding/chunk-preview', data),
}

export const adminAiStatsApi = {
  getSummary: () =>
    http.get<any>('/admin/ai/stats/summary'),

  getTrend: (days?: number) =>
    http.get<any[]>('/admin/ai/stats/trend', { params: { days } }),

  getTenantStats: (limit?: number) =>
    http.get<any>('/admin/ai/stats/tenant', { params: { limit } }),

  getModelStats: () =>
    http.get<any[]>('/admin/ai/stats/model'),
}

export default {
  model: modelApi,
  config: modelConfigApi,
  purpose: modelPurposeApi,
  vectorDb: vectorDbApi,
  embedding: embeddingConfigApi,
  usage: usageApi,
  aiModel: aiModelApi,
  articleTemplate: articleTemplateApi,
  generate: aiGenerateApi,
  adminAiStats: adminAiStatsApi,
}
