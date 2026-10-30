// 知识库模块类型定义
import type { EmptyCauseFields } from './emptyResult'

// 文件类型枚举
export enum KnowledgeFileType {
  IMAGE = 'image',
  PDF = 'pdf',
  WORD = 'word',
  PPT = 'ppt',
  EXCEL = 'excel',
  TEXT = 'text',
  OTHER = 'other'
}

// 解析状态枚举
export enum ParseStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  SUCCESS = 'success',
  FAILED = 'failed'
}

// 向量化状态枚举
export enum VectorStatus {
  NOT_VECTORIZED = 'not_vectorized',
  VECTORIZING = 'vectorizing',
  VECTORIZED = 'vectorized',
  FAILED = 'failed'
}

// 知识文档（文件上传）
export interface KnowledgeDocument {
  id: number
  tenantId: number
  categoryId: number
  categoryName?: string
  fileName: string
  fileUrl: string
  fileType: KnowledgeFileType
  fileSize: number
  fileSizeFormatted?: string
  parsedText?: string
  parseStatus: ParseStatus
  parseProgress: number
  parseError?: string
  vectorStatus: VectorStatus
  vectorId?: string
  vectorModel?: string
  chunkCount?: number
  vectorCount?: number
  tags: string[]
  uploadedBy: number
  uploadedByName?: string
  createdAt: string
  updatedAt: string
  cards?: KnowledgeCard[]
  title?: string
}

// 文档分块
export interface DocumentChunk {
  id: number
  documentId: number
  content: string
  embedding: number[]
  vectorId?: string
  chunkIndex: number
  tokenCount: number
  createdAt: string
}

// 知识实体
export interface KnowledgeEntity {
  id: number
  tenantId: number
  name: string
  type: string
  description?: string
  sourceDocumentId?: number
  occurrences: number
  confidence: number
  createdAt: string
}

// 知识关系
export interface KnowledgeRelation {
  id: number
  tenantId: number
  sourceEntityId: number
  targetEntityId: number
  sourceEntityName?: string
  targetEntityName?: string
  relationType: string
  confidence: number
  description?: string
  sourceDocumentId?: number
  createdAt: string
}

// 知识图谱节点（字段名与后端 GraphRead.GraphNodeView 一一对应，界面不许改叫 label/size）
export interface GraphNode {
  id: number
  name: string
  type: string
  description?: string
  confidence?: number
  degree: number
  sourceDocumentIds?: string
  createdAt?: string
  // 邻居那一口标出中心点；搜索那一口标出这一枚是真命中的
  isCenter?: boolean
  matched?: boolean
}

// 知识图谱边（source/target 是实体的数字 id，两端都在 nodes 里才画得出来）
export interface GraphLink {
  id: number
  source: number
  target: number
  sourceName?: string
  targetName?: string
  relationType: string
  description?: string
  confidence?: number
}

export interface GraphTypeCount {
  type: string
  count: number
}

// 知识图谱数据（GraphRead）
// 三个数的口径各不相同，界面上要念清楚：totalEntities/totalRelations 是这一家全量、
// matchedEntities 是筛选之后、nodes 是画布上真画出来的（受 limit 截断，truncated 为 true 时要说明）。
export interface KnowledgeGraphData {
  nodes: GraphNode[]
  links: GraphLink[]
  nodeCount: number
  linkCount: number
  totalEntities: number
  totalRelations: number
  matchedEntities: number
  entityTypes: GraphTypeCount[]
  relationTypes: GraphTypeCount[]
  recentEntities: GraphNode[]
  recentRelations: GraphLink[]
  nodeLimit: number
  truncated: boolean
  appliedTypes: string[]
  appliedRelationTypes: string[]
  appliedMinConfidence: number
  emptyReason?: string | null
  emptyLine?: string | null
  // 邻居那一口（/entities/{id}/neighbors）多回这几项
  centerId?: number
  centerName?: string
  depth?: number
  // 搜索那一口（/search）多回这几项
  keyword?: string
  matchedEntityCount?: number
  totalNodes?: number
  totalLinks?: number
}

// 知识库统计
export interface KnowledgeStats {
  totalDocuments: number
  totalCards: number
  totalCategories: number
  totalTags: number
  totalChunks: number
  totalEntities: number
  totalRelations: number
  vectorizedCount: number
  parsedSuccessCount: number
  storageUsed: number
  storageUsedFormatted: string
  weeklyGrowth: {
    documents: number
    cards: number
    percentage: number
  }
  topCategories: {
    id: number
    name: string
    count: number
  }[]
}

// 查询参数扩展
export interface KnowledgeDocumentQuery {
  tenantId: number
  categoryId?: number
  /** 只要「没归到任何项目」的那些行（界面上项目列表永远按 categoryId 滤，这类行原本没有任何出口） */
  unclassified?: boolean
  fileType?: KnowledgeFileType
  parseStatus?: ParseStatus
  vectorStatus?: VectorStatus
  keyword?: string
  tag?: string
  page?: number
  size?: number
}

export interface KnowledgeEntityQuery {
  tenantId: number
  type?: string
  keyword?: string
  page?: number
  size?: number
}

export interface KnowledgeRelationQuery {
  tenantId: number
  relationType?: string
  entityId?: number
  page?: number
  size?: number
}

// 表单类型
export interface KnowledgeDocumentForm {
  id?: number
  tenantId: number
  categoryId: number
  fileName?: string
  tags?: string
}

export interface DocumentParseConfig {
  ocrEnabled: boolean
  extractTables: boolean
  extractImages: boolean
  chunkSize: number
  chunkOverlap: number
}

export interface VectorSearchQuery {
  tenantId: number
  query: string
  topK?: number
  categoryId?: number
  similarityThreshold?: number
}

export interface VectorSearchResult {
  documentId: number
  documentName: string
  chunkId: number
  content: string
  similarity: number
  fileType: KnowledgeFileType
  categoryName?: string
}

// 知识分类
export interface KnowledgeCategory {
  id: number
  tenantId: number
  parentId: number | null
  name: string
  icon: string
  description: string
  sort: number
  status: string
  createdAt: string
  updatedAt: string
  children?: KnowledgeCategory[]
}

// 知识标签
export interface KnowledgeTag {
  id: number
  tenantId: number
  name: string
  color: string
  useCount: number
  createdAt: string
}

// 知识卡片
export interface KnowledgeCard {
  id: number
  tenantId: number
  categoryId: number
  categoryName?: string
  title: string
  summary: string
  content: string
  coverImage: string
  tags: string
  tagList?: string[]
  documentId?: number | null
  document?: {
    id: number
    title: string
    docType: string
    summary?: string
  } | null
  viewCount: number
  likeCount: number
  sort: number
  status: string
  createdAt: string
  updatedAt: string
}

// 阅读记录
export interface KnowledgeReadRecord {
  id: number
  tenantId: number
  cardId: number
  userId: number
  readDuration: number
  ip: string
  createdAt: string
}

// 列表查询参数
export interface KnowledgeCategoryQuery {
  tenantId: number
  parentId?: number
  status?: string
  page?: number
  size?: number
}

export interface KnowledgeCardQuery {
  tenantId: number
  categoryId?: number | null
  status?: string
  keyword?: string
  tag?: string
  documentId?: number | null
  page?: number
  size?: number
}

export interface KnowledgeTagQuery {
  tenantId: number
  keyword?: string
  page?: number
  size?: number
}

// 创建/更新表单
export interface KnowledgeCategoryForm {
  id?: number
  tenantId: number
  parentId?: number | null
  name: string
  icon?: string
  description?: string
  sort?: number
  status?: string
}

export interface KnowledgeCardForm {
  id?: number
  tenantId: number
  categoryId: number
  title: string
  summary?: string
  content: string
  coverImage?: string
  tags?: string
  documentId?: number | null
  sort?: number
  status?: string
}

export interface KnowledgeTagForm {
  id?: number
  tenantId: number
  name: string
  color?: string
}

// 分页结果
export interface PageResult<T> extends EmptyCauseFields {
  records: T[]
  total: number
  page: number
  size: number
  pages: number
}

// 任务类型枚举
export enum KnowledgeTaskType {
  PARSE = 'PARSE',
  VECTORIZE = 'VECTORIZE',
  PARSE_AND_VECTORIZE = 'PARSE_AND_VECTORIZE',
  EXTRACT_ENTITY = 'EXTRACT_ENTITY',
  REBUILD_GRAPH = 'REBUILD_GRAPH'
}

// 任务状态枚举
export enum KnowledgeTaskStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED'
}

// 知识任务
export interface KnowledgeTask {
  id: number
  tenantId: number
  taskType: KnowledgeTaskType
  targetType: string
  targetId?: number
  status: KnowledgeTaskStatus
  progress: number
  total: number
  completed: number
  errorMessage?: string
  retryCount: number
  maxRetry: number
  startedAt?: string
  completedAt?: string
  createdAt: string
  updatedAt: string
}

// 任务查询参数
export interface KnowledgeTaskQuery {
  tenantId?: number
  taskType?: KnowledgeTaskType
  status?: KnowledgeTaskStatus
  page?: number
  size?: number
}

// 统一搜索查询参数
export interface KnowledgeSearchQuery {
  query: string
  type?: 'all' | 'document' | 'card' | 'entity'
  categoryId?: number
  tag?: string
  fileType?: string
  timeRange?: 'all' | '7days' | '30days'
  sort?: 'relevance' | 'time' | 'name'
  page?: number
  size?: number
  tenantId?: number
}

// 统一搜索结果项
export interface KnowledgeSearchResultItem {
  id: number
  type: 'document' | 'card' | 'entity'
  title: string
  highlightedTitle: string
  content?: string
  snippet: string
  highlightedSnippet: string
  categoryId?: number
  documentId?: number
  tags?: string[]
  fileType?: string
  docType?: string
  fileName?: string
  entityType?: string
  aliases?: string[]
  confidence?: number
  viewCount?: number
  score?: number
  createdAt?: string
  updatedAt?: string
}

// 统一搜索结果
export interface KnowledgeSearchResult {
  records: KnowledgeSearchResultItem[]
  total: number
  page: number
  size: number
  pages: number
  query: string
  duration: number
}
