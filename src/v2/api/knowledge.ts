// 知识库模块 API
import http from './http'
import type {
  KnowledgeCategory,
  KnowledgeCard,
  KnowledgeTag,
  KnowledgeDocument,
  KnowledgeEntity,
  KnowledgeRelation,
  KnowledgeStats,
  KnowledgeGraphData,
  KnowledgeCategoryQuery,
  KnowledgeCardQuery,
  KnowledgeTagQuery,
  KnowledgeDocumentQuery,
  KnowledgeEntityQuery,
  KnowledgeRelationQuery,
  KnowledgeCategoryForm,
  KnowledgeCardForm,
  KnowledgeTagForm,
  KnowledgeDocumentForm,
  DocumentParseConfig,
  VectorSearchQuery,
  VectorSearchResult,
  KnowledgeTask,
  KnowledgeTaskQuery,
  PageResult,
  KnowledgeSearchQuery,
  KnowledgeSearchResult
} from '../types/knowledge'

export interface KnowledgeCategoryStats {
  id: number
  name: string
  documentCount: number
  cardCount: number
  totalCount: number
}

// 知识分类 API
export const knowledgeCategoryApi = {
  // 获取分类列表（分页）
  list: (params: KnowledgeCategoryQuery) =>
    http.get<PageResult<KnowledgeCategory>>('/knowledge/categories', { params }),

  // 获取全部分类（不分页）
  all: (tenantId: number) =>
    http.get<KnowledgeCategory[]>('/knowledge/categories/all', { params: { tenantId } }),

  // 获取分类统计
  stats: (tenantId: number, status?: string) =>
    http.get<KnowledgeCategoryStats[]>('/knowledge/categories/stats', { params: { tenantId, status } }),

  // 获取分类详情
  get: (id: number) =>
    http.get<KnowledgeCategory>(`/knowledge/categories/${id}`),

  // 创建分类
  create: (data: KnowledgeCategoryForm) =>
    http.post<KnowledgeCategory>('/knowledge/categories', data),

  // 更新分类
  update: (id: number, data: KnowledgeCategoryForm) =>
    http.put<KnowledgeCategory>(`/knowledge/categories/${id}`, data),

  // 删除分类
  delete: (id: number) =>
    http.delete(`/knowledge/categories/${id}`),

  // 批量删除
  batchDelete: (ids: number[]) =>
    http.delete('/knowledge/categories/batch', { data: ids })
}

// 知识卡片 API
export const knowledgeCardApi = {
  // 获取卡片列表（分页）
  list: (params: KnowledgeCardQuery) =>
    http.get<PageResult<KnowledgeCard>>('/knowledge/cards', { params }),

  // 搜索卡片
  search: (params: KnowledgeCardQuery) =>
    http.get<PageResult<KnowledgeCard>>('/knowledge/cards/search', { params }),

  // 获取卡片详情
  get: (id: number) =>
    http.get<KnowledgeCard>(`/knowledge/cards/${id}`),

  // 创建卡片
  create: (data: KnowledgeCardForm) =>
    http.post<KnowledgeCard>('/knowledge/cards', data),

  // 更新卡片
  update: (id: number, data: KnowledgeCardForm) =>
    http.put<KnowledgeCard>(`/knowledge/cards/${id}`, data),

  // 删除卡片
  delete: (id: number) =>
    http.delete(`/knowledge/cards/${id}`),

  // 批量删除
  batchDelete: (ids: number[]) =>
    http.post<{ success: boolean; count: number }>('/knowledge/cards/batch/delete', { ids }),

  // 批量设置分类
  batchSetCategory: (ids: number[], categoryId: number | null) =>
    http.post<{ success: boolean; count: number }>('/knowledge/cards/batch/category', { ids, categoryId }),

  // 批量设置标签
  batchSetTags: (ids: number[], tags: string) =>
    http.post<{ success: boolean; count: number }>('/knowledge/cards/batch/tags', { ids, tags }),

  // 点赞卡片
  like: (id: number) =>
    http.post(`/knowledge/cards/${id}/like`)
}

// 知识标签 API
export const knowledgeTagApi = {
  // 获取标签列表
  list: (params: KnowledgeTagQuery) =>
    http.get<KnowledgeTag[]>('/knowledge/tags', { params }),

  // 获取热门标签
  popular: (tenantId: number, limit: number = 10) =>
    http.get<KnowledgeTag[]>('/knowledge/tags/popular', { params: { tenantId, limit } }),

  // 创建标签
  create: (data: KnowledgeTagForm) =>
    http.post<KnowledgeTag>('/knowledge/tags', data),

  // 更新标签
  update: (id: number, data: KnowledgeTagForm) =>
    http.put<KnowledgeTag>(`/knowledge/tags/${id}`, data),

  // 删除标签
  delete: (id: number) =>
    http.delete(`/knowledge/tags/${id}`),

  // 批量删除
  batchDelete: (ids: number[]) =>
    http.delete('/knowledge/tags/batch', { data: ids })
}

// 阅读记录 API
export const knowledgeReadRecordApi = {
  // 获取用户阅读记录
  userRecords: (userId: number, params?: { page?: number; size?: number }) =>
    http.get(`/knowledge/read-records/user/${userId}`, { params }),

  // 获取卡片阅读统计
  cardStats: (cardId: number) =>
    http.get(`/knowledge/read-records/card/${cardId}`)
}

// 知识文档 API
export const knowledgeDocumentApi = {
  // 获取文档列表
  list: (params: KnowledgeDocumentQuery) =>
    http.get<PageResult<KnowledgeDocument>>('/knowledge/documents', { params }),

  // 获取文档详情
  get: (id: number) =>
    http.get<KnowledgeDocument>(`/knowledge/documents/${id}`),

  // 上传文档
  upload: (tenantId: number, formData: FormData, onUploadProgress?: (progressEvent: any) => void) =>
    http.post<KnowledgeDocument>('/knowledge/documents/upload', formData, {
      params: { tenantId },
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress
    }),

  // 更新文档信息
  update: (id: number, data: Partial<KnowledgeDocumentForm>) =>
    http.put<KnowledgeDocument>(`/knowledge/documents/${id}`, data),

  // 删除文档
  delete: (id: number) =>
    http.delete(`/knowledge/documents/${id}`),

  // 批量删除
  batchDelete: (ids: number[]) =>
    http.post<{ success: boolean; count: number }>('/knowledge/documents/batch/delete', { ids }),

  // 批量设置分类
  batchSetCategory: (ids: number[], categoryId: number | null) =>
    http.post<{ success: boolean; count: number }>('/knowledge/documents/batch/category', { ids, categoryId }),

  // 解析文档
  parse: (id: number, config?: DocumentParseConfig) =>
    http.post<KnowledgeDocument>(`/knowledge/documents/${id}/parse`, config),

  // 批量解析
  batchParse: (ids: number[], config?: DocumentParseConfig) =>
    http.post('/knowledge/documents/batch-parse', { ids, config }),

  // 获取解析状态
  parseStatus: (id: number) =>
    http.get<{ status: string; progress: number; error?: string }>(`/knowledge/documents/${id}/parse-status`),

  // 向量化文档
  vectorize: (id: number, model?: string) =>
    http.post<KnowledgeDocument>(`/knowledge/documents/${id}/vectorize`, { model }),

  // 批量向量化
  batchVectorize: (ids: number[], model?: string) =>
    http.post('/knowledge/documents/batch-vectorize', { ids, model }),

  // 下载文档
  download: (id: number) =>
    http.get(`/knowledge/documents/${id}/download`, { responseType: 'blob' }),

  // 预览文档
  preview: (id: number) =>
    http.get<{
      id: number
      title: string
      fileName: string
      originalName: string
      fileUrl: string
      fileSize: number
      fileType: string
      docType: string
      parseStatus: string
      content: string
      summary: string
      createdAt: string
      fileDownloadUrl: string
      previewType: 'image' | 'pdf' | 'text' | 'office' | 'other'
    }>(`/knowledge/documents/${id}/preview`),

  // 文件下载地址
  fileUrl: (id: number) =>
    `/api/v2/knowledge/documents/${id}/file`,

  // 批量设置标签
  batchSetTags: (ids: number[], tags: string) =>
    http.post<{ success: boolean; count: number }>('/knowledge/documents/batch/tags', { ids, tags }),

  // 获取文档关联的卡片列表
  getCards: (id: number) =>
    http.get<KnowledgeCard[]>(`/knowledge/documents/${id}/cards`)
}

// 向量搜索 API
export const vectorSearchApi = {
  // 语义搜索
  search: (params: VectorSearchQuery) =>
    http.post<VectorSearchResult[]>('/knowledge/vector-search', params),

  // 相似文档推荐
  similar: (documentId: number, topK?: number) =>
    http.get<VectorSearchResult[]>(`/knowledge/vector-search/similar/${documentId}`, { params: { topK } }),

  // 问答检索
  qa: (tenantId: number, question: string, topK?: number) =>
    http.post<{ answer: string; sources: VectorSearchResult[] }>('/knowledge/vector-search/qa', { tenantId, question, topK })
}

export interface StreamQAReference {
  chunkId: number
  documentId: number
  title: string
  snippet: string
  similarity: number
}

export interface StreamQACallbacks {
  onMessage?: (content: string) => void
  onDone?: (references: StreamQAReference[]) => void
  onError?: (error: Error) => void
}

export const smartQAApi = {
  streamQA: (tenantId: number, question: string, topK: number = 5, callbacks: StreamQACallbacks = {}): () => void => {
    const token = localStorage.getItem('geocms_token')
    const tenantIdHeader = localStorage.getItem('geocms_tenant_id')
    const tenantCode = localStorage.getItem('geocms_tenant_code')

    const params = new URLSearchParams()
    params.append('question', question)
    params.append('tenantId', String(tenantId))
    params.append('topK', String(topK))

    const url = `/api/v2/knowledge/smart-qa/stream?${params.toString()}`

    const abortController = new AbortController()
    let isCancelled = false
    let fullContent = ''
    let references: StreamQAReference[] = []

    const headers: Record<string, string> = {
      'Accept': 'text/event-stream'
    }
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }
    if (tenantIdHeader) {
      headers['X-Tenant-Id'] = tenantIdHeader
    }
    if (tenantCode) {
      headers['X-Tenant-Code'] = tenantCode
    }

    fetch(url, {
      method: 'GET',
      headers,
      signal: abortController.signal
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }

        const reader = response.body?.getReader()
        if (!reader) {
          throw new Error('No response body')
        }

        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done || isCancelled) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            const trimmed = line.trim()
            if (!trimmed || !trimmed.startsWith('data:')) continue

            const dataStr = trimmed.slice(5).trim()
            if (!dataStr) continue

            try {
              const event = JSON.parse(dataStr)
              if (event.type === 'content') {
                fullContent += event.content
                callbacks.onMessage?.(event.content)
              } else if (event.type === 'references') {
                references = event.data || []
              } else if (event.type === 'done') {
                callbacks.onDone?.(references)
              }
            } catch (e) {
              console.warn('Failed to parse SSE event:', dataStr)
            }
          }
        }
      })
      .catch((error) => {
        if (error.name === 'AbortError') return
        console.error('Stream QA error:', error)
        callbacks.onError?.(error)
      })

    return () => {
      isCancelled = true
      abortController.abort()
    }
  }
}

export interface ExtractedEntity {
  name: string
  type: string
  description?: string
  confidence: number
  tenantId?: number
}

export interface ExtractedRelation {
  sourceName: string
  targetName: string
  relationType: string
  description?: string
  confidence: number
  tenantId?: number
}

export interface ExtractionResult {
  documentId: number
  entities: ExtractedEntity[]
  relations: ExtractedRelation[]
  status: string
}

export interface ConfirmExtractionResult {
  documentId: number
  createdEntities: number
  createdRelations: number
  skippedEntities: number
  skippedRelations: number
  status: string
}

export interface RebuildTaskStatus {
  status: string
  progress?: number
  totalDocuments?: number
  processedDocuments?: number
  extractedEntities?: number
  extractedRelations?: number
  message?: string
  error?: string
  startTime?: number
  endTime?: number
}

// 知识实体 API
export const knowledgeEntityApi = {
  // 获取实体列表
  list: (params: KnowledgeEntityQuery) =>
    http.get<PageResult<KnowledgeEntity>>('/knowledge/entities', { params }),

  // 获取实体详情
  get: (id: number) =>
    http.get<KnowledgeEntity>(`/knowledge/entities/${id}`),

  // 创建实体
  create: (data: Partial<KnowledgeEntity>) =>
    http.post<KnowledgeEntity>('/knowledge/entities', data),

  // 更新实体
  update: (id: number, data: Partial<KnowledgeEntity>) =>
    http.put<KnowledgeEntity>(`/knowledge/entities/${id}`, data),

  // 删除实体
  delete: (id: number) =>
    http.delete(`/knowledge/entities/${id}`),

  // 合并实体
  merge: (sourceIds: number[], targetId: number) =>
    http.post('/knowledge/entities/merge', { sourceIds, targetId }),

  // 从文档提取实体和关系
  extractFromDocument: (documentId: number) =>
    http.post<ExtractionResult>('/knowledge/entities/extract', { documentId }),

  // 确认提取结果并入库
  confirmExtraction: (documentId: number, entities: ExtractedEntity[], relations: ExtractedRelation[]) =>
    http.post<ConfirmExtractionResult>('/knowledge/entities/confirm-extraction', { documentId, entities, relations })
}

// 知识关系 API
export const knowledgeRelationApi = {
  // 获取关系列表
  list: (params: KnowledgeRelationQuery) =>
    http.get<PageResult<KnowledgeRelation>>('/knowledge/relations', { params }),

  // 获取关系详情
  get: (id: number) =>
    http.get<KnowledgeRelation>(`/knowledge/relations/${id}`),

  // 创建关系
  create: (data: Partial<KnowledgeRelation>) =>
    http.post<KnowledgeRelation>('/knowledge/relations', data),

  // 更新关系
  update: (id: number, data: Partial<KnowledgeRelation>) =>
    http.put<KnowledgeRelation>(`/knowledge/relations/${id}`, data),

  // 删除关系
  delete: (id: number) =>
    http.delete(`/knowledge/relations/${id}`),

  // 从文档提取关系
  extractFromDocument: (documentId: number) =>
    http.post<KnowledgeRelation[]>(`/knowledge/relations/extract/${documentId}`)
}

// 知识图谱 API
export const knowledgeGraphApi = {
  // 获取图谱数据
  getGraph: (limit?: number, type?: string) =>
    http.get<KnowledgeGraphData>('/knowledge/graph', { params: { limit, type } }),

  // 获取实体邻接关系
  getNeighbors: (entityId: number, depth?: number) =>
    http.get<KnowledgeGraphData>(`/knowledge/graph/entities/${entityId}/neighbors`, { params: { depth } }),

  // 搜索图谱
  search: (keyword: string, limit?: number) =>
    http.get<KnowledgeGraphData>('/knowledge/graph/search', { params: { keyword, limit } }),

  // 重建图谱
  rebuild: () =>
    http.post<RebuildTaskStatus>('/knowledge/graph/rebuild'),

  // 获取重建状态
  getRebuildStatus: () =>
    http.get<RebuildTaskStatus>('/knowledge/graph/rebuild-status')
}

// 知识库统计 API
export const knowledgeStatsApi = {
  // 获取完整统计
  getStats: (tenantId: number) =>
    http.get<KnowledgeStats>('/knowledge/stats', { params: { tenantId } }),

  // 获取增长趋势
  getTrend: (tenantId: number, days?: number) =>
    http.get<{ date: string; documents: number; cards: number }[]>('/knowledge/stats/trend', { params: { tenantId, days } })
}

// 知识任务 API
export const knowledgeTaskApi = {
  list: (params: KnowledgeTaskQuery) =>
    http.get<PageResult<KnowledgeTask>>('/knowledge/tasks', { params }),

  get: (id: number) =>
    http.get<KnowledgeTask>(`/knowledge/tasks/${id}`),

  retry: (id: number) =>
    http.post<KnowledgeTask>(`/knowledge/tasks/${id}/retry`),

  recent: (limit: number = 10, taskType?: string) =>
    http.get<KnowledgeTask[]>('/knowledge/tasks/recent', { params: { limit, taskType } })
}

// 统一搜索 API
export const knowledgeSearchApi = {
  search: (params: KnowledgeSearchQuery) =>
    http.post<KnowledgeSearchResult>('/knowledge/search', params)
}

export default {
  category: knowledgeCategoryApi,
  card: knowledgeCardApi,
  tag: knowledgeTagApi,
  readRecord: knowledgeReadRecordApi,
  document: knowledgeDocumentApi,
  vectorSearch: vectorSearchApi,
  smartQA: smartQAApi,
  entity: knowledgeEntityApi,
  relation: knowledgeRelationApi,
  graph: knowledgeGraphApi,
  stats: knowledgeStatsApi,
  task: knowledgeTaskApi,
  search: knowledgeSearchApi
}
