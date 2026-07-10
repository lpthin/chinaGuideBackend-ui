// AI 大模型配置管理类型定义

// 模型提供商枚举
export const enum ModelProvider {
  DASHSCOPE = 'dashscope',       // 通义千问
  WENXIN = 'wenxin',              // 文心一言
  ZHIPU = 'zhipu',                // 智谱 AI
  DEEPSEEK = 'deepseek',          // DeepSeek
  ANTHROPIC = 'anthropic',        // Claude
  OPENAI = 'openai',              // OpenAI
  VOLCENGINE = 'volcengine',      // 火山引擎
  OLLAMA = 'ollama',              // Ollama 本地模型
}

// 模型类型枚举
export const enum ModelType {
  CHAT = 'chat',                  // 聊天模型
  EMBEDDING = 'embedding',        // 向量化模型
  IMAGE = 'image',                // 图像模型
  AUDIO = 'audio',                // 语音模型
}

// 模型用途枚举
export const enum ModelPurpose {
  ARTICLE_GENERATE = 'article_generate',      // 文章生成
  CONTENT_REVIEW = 'content_review',          // 内容审核
  KEYWORD_EXTRACT = 'keyword_extract',        // 关键词提炼
  SUGGESTION = 'suggestion',                   // 内容建议
  EMBEDDING = 'embedding',                     // 向量化
  OCR = 'ocr',                                 // OCR 识别
}

// 向量数据库类型枚举
export const enum VectorDatabaseType {
  MILVUS = 'milvus',             // Milvus
  PG_VECTOR = 'pgvector',         // PGVector
  CHROMA = 'chroma',              // Chroma
  PINECONE = 'pinecone',          // Pinecone
  WEAVIATE = 'weaviate',          // Weaviate
}

// 相似度算法枚举
export const enum SimilarityAlgorithm {
  COSINE = 'cosine',             // 余弦相似度
  EUCLIDEAN = 'euclidean',        // 欧氏距离
  DOT_PRODUCT = 'dot_product',    // 点积
}

// 分块策略枚举
export const enum ChunkStrategy {
  FIXED = 'fixed',               // 固定大小
  SEMANTIC = 'semantic',         // 语义分块
  STRUCTURE = 'structure',       // 按文档结构
}

// 基础模型信息
export interface AIModel {
  id: number
  name: string
  displayName: string
  provider: ModelProvider
  type: ModelType
  description?: string
  maxTokens: number
  maxInputTokens?: number
  maxOutputTokens?: number
  dimension?: number
  supportsStreaming?: boolean
  supportFunctionCall?: boolean
  pricePer1kInput?: number
  pricePer1kOutput?: number
  pricePerImage?: number
  pricePerMinute?: number
  contextWindow?: number
  isActive: boolean
  isDefault: boolean
  createdAt: string
  updatedAt: string
}

// 模型配置
export interface ModelConfig {
  id: number
  modelId: number
  name: string
  tenantId: number
  isSystemDefault?: boolean
  isDefault?: boolean
  apiKey: string
  baseUrl?: string
  apiVersion?: string
  isActive: boolean
  priority: number
  temperature?: number
  maxTokens?: number
  topP?: number
  presencePenalty?: number
  frequencyPenalty?: number
  stopSequences?: string[]
  enableRetry?: boolean
  maxRetryTimes?: number
  retryDelay?: number
  retryBackoffMultiplier?: number
  provider?: ModelProvider | string
  modelName?: string
  modelType?: ModelType | string
  apiEndpoint?: string
  sortOrder?: number
  createdAt: string
  updatedAt: string
}

// 模型用途映射
export interface ModelPurposeMapping {
  id: number
  tenantId: number
  purpose: ModelPurpose
  modelConfigId: number
  modelConfig?: ModelConfig
  isActive: boolean
  createdAt: string
  updatedAt: string
}

// 调用日志
export interface ModelUsageLog {
  id: number
  tenantId: number
  modelConfigId: number
  modelName: string
  provider: ModelProvider
  purpose: ModelPurpose
  inputTokens: number
  outputTokens: number
  totalTokens: number
  cost: number
  duration?: number
  success: boolean
  errorMessage?: string
  requestId?: string
  createdAt: string
}

// 用量统计
export interface ModelUsageStatistics {
  date: string
  tenantId: number
  provider: ModelProvider
  modelName: string
  purpose: ModelPurpose
  totalTokens: number
  totalCost: number
  callCount: number
  successCount: number
  avgDuration?: number
}

// 向量数据库配置
export interface VectorDatabaseConfig {
  id: number
  tenantId: number
  type: VectorDatabaseType
  name: string
  isSystemDefault: boolean
  isActive: boolean
  host?: string
  port?: number
  endpoint?: string
  apiKey?: string
  username?: string
  password?: string
  database?: string
  collection?: string
  dimension: number
  indexType?: string
  metricType?: SimilarityAlgorithm
  nlist?: number
  efConstruction?: number
  efSearch?: number
  schema?: Record<string, any>
  createdAt: string
  updatedAt: string
}

// 向量化配置
export interface EmbeddingConfig {
  id: number
  tenantId: number
  chunkStrategy: ChunkStrategy
  chunkSize: number
  chunkOverlap: number
  embeddingModelId: number
  embeddingModel?: AIModel
  vectorDatabaseId: number
  vectorDatabase?: VectorDatabaseConfig
  similarityAlgorithm: SimilarityAlgorithm
  topK: number
  minScore?: number
  enableRerank?: boolean
  rerankModelId?: number
  rerankModel?: AIModel
  rerankTopN?: number
  enableCache?: boolean
  cacheTtl?: number
  enableBatch?: boolean
  batchSize?: number
  dimension?: number
  collection?: string
  indexType?: string
  createdAt: string
  updatedAt: string
}

// 性能指标统计
export interface ModelPerformanceMetrics {
  successRate: number
  avgResponseTime: number
  p50ResponseTime: number
  p90ResponseTime: number
  p99ResponseTime: number
  errorRate: number
  timeoutRate: number
  totalCalls: number
  totalTokens: number
  totalCost: number
}

// 模型连接测试结果
export interface ModelConnectionTestResult {
  success: boolean
  message: string
  latency?: number
  modelName?: string
  maxTokens?: number
}

// 模型查询参数
export interface ModelQueryParams {
  tenantId: number
  provider?: ModelProvider
  type?: ModelType
  purpose?: ModelPurpose
  isActive?: boolean
  page?: number
  size?: number
}

// 用量查询参数
export interface UsageQueryParams {
  tenantId: number
  startDate: string
  endDate: string
  provider?: ModelProvider
  modelName?: string
  purpose?: ModelPurpose
  groupBy?: 'date' | 'model' | 'provider' | 'purpose'
}

// 模型配置表单
export interface ModelConfigForm {
  name: string
  modelId?: number
  provider?: string
  modelName?: string
  modelType?: string
  apiKey: string
  baseUrl?: string
  apiEndpoint?: string
  apiVersion?: string
  isActive: boolean
  isDefault?: boolean
  priority: number
  sortOrder?: number
  temperature?: number
  maxTokens?: number
  topP?: number
  enableRetry?: boolean
  maxRetryTimes?: number
  retryDelay?: number
}

// 向量数据库配置表单
export interface VectorDatabaseForm {
  name: string
  type: VectorDatabaseType
  host?: string
  port?: number
  endpoint?: string
  apiKey?: string
  username?: string
  password?: string
  database?: string
  collection?: string
  dimension: number
  indexType?: string
  metricType?: SimilarityAlgorithm
  nlist?: number
  efConstruction?: number
  efSearch?: number
}

// 向量化配置表单
export interface EmbeddingConfigForm {
  chunkStrategy: ChunkStrategy
  chunkSize: number
  chunkOverlap: number
  embeddingModelId: number
  vectorDatabaseId: number
  similarityAlgorithm: SimilarityAlgorithm
  topK: number
  minScore?: number
  enableRerank?: boolean
  rerankModelId?: number
  enableCache?: boolean
  cacheTtl?: number
  enableBatch?: boolean
  batchSize?: number
}

// 提供商信息
export interface ProviderInfo {
  id: ModelProvider
  name: string
  icon?: string
  website?: string
  documentationUrl?: string
  models: AIModel[]
}

// 模型下拉选项
export interface ModelOption {
  label: string
  value: number
  provider: ModelProvider
  type: ModelType
  disabled?: boolean
}

// 软文模板分类枚举
export const enum ArticleTemplateCategory {
  MARKETING = 'marketing',         // 营销推广
  NEWS = 'news',                   // 新闻资讯
  PRODUCT = 'product',             // 产品介绍
  BRAND = 'brand',                 // 品牌宣传
  CASE_STUDY = 'case_study',       // 案例分析
  INDUSTRY = 'industry',           // 行业分析
  ANNOUNCEMENT = 'announcement',   // 公告通知
  CUSTOM = 'custom',               // 自定义
}

// 软文模板变量定义
export interface ArticleTemplateVariable {
  key: string
  label: string
  type: 'text' | 'textarea' | 'select' | 'number' | 'date'
  required: boolean
  defaultValue?: string
  options?: string[]
  placeholder?: string
}

// 软文模板
export interface ArticleTemplate {
  id: number
  tenantId: number
  name: string
  category: ArticleTemplateCategory
  description?: string
  content: string
  variables: ArticleTemplateVariable[]
  modelConfigId?: number
  modelConfig?: ModelConfig
  isSystem: boolean
  isActive: boolean
  useCount: number
  createdBy?: number
  createdAt: string
  updatedAt: string
}

// 软文模板表单
export interface ArticleTemplateForm {
  name: string
  category: ArticleTemplateCategory
  description?: string
  content: string
  variables: ArticleTemplateVariable[]
  modelConfigId?: number
  isActive: boolean
}

// 软文生成记录
export interface ArticleGenerationLog {
  id: number
  tenantId: number
  templateId?: number
  templateName?: string
  modelConfigId: number
  modelName: string
  title?: string
  content: string
  variables?: Record<string, any>
  wordCount: number
  tokensUsed: number
  cost: number
  duration?: number
  success: boolean
  errorMessage?: string
  createdAt: string
}

// 软文模板查询参数
export interface ArticleTemplateQueryParams {
  tenantId: number
  category?: ArticleTemplateCategory
  isActive?: boolean
  isSystem?: boolean
  keyword?: string
  page?: number
  size?: number
}
