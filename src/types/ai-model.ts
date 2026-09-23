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
  VISION = 'vision',              // 视觉模型（能看图的多模态模型）
  EMBEDDING = 'embedding',        // 向量化模型
  IMAGE = 'image',                // 图像模型（生成图片，不能看图）
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
  healthStatus?: 'unknown' | 'passed' | 'failed' | string
  lastHealthCheckAt?: string
  lastHealthLatencyMs?: number
  lastHealthError?: string
  healthConsecutiveFailures?: number
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

// 向量数据库连接配置（纯连接登记表；维度/相似度/索引等参数由 EmbeddingConfig 统一管理）
export interface VectorDatabaseConfig {
  id: number
  tenantId: number
  dbType: string
  name: string
  host?: string
  port?: number
  endpoint?: string
  username?: string
  password?: string
  databaseName?: string
  schemaName?: string
  paramsJson?: string
  apiKey?: string
  collectionName?: string
  isActive: boolean
  isDefault?: boolean
  remark?: string
  createdAt: string
  updatedAt: string
}

// 向量化配置（每租户一条，向量参数的唯一事实来源）
export interface EmbeddingConfig {
  id: number
  tenantId: number
  chunkStrategy: ChunkStrategy | string
  chunkSize: number
  chunkOverlap: number
  separator?: string
  enableSemanticChunk?: boolean
  embeddingModelId?: number
  embeddingModel?: string
  vectorDbId?: number
  vectorDbType?: string
  dimension?: number
  similarityMetric: SimilarityAlgorithm | string
  topK: number
  minScore?: number
  collectionName?: string
  indexType?: string
  createdAt: string
  updatedAt: string
}

// 模型连接测试结果（字段名与后端 toTestResult 一致）
export interface ModelConnectionTestResult {
  success: boolean
  message: string
  responseTime: number
  dimension?: number
}

// 全量健康巡检结果
export interface ModelHealthCheckSummary {
  total: number
  passed: number
  failed: number
  skipped: number
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

// 向量数据库连接表单
export interface VectorDatabaseForm {
  name: string
  dbType: string
  host?: string
  port?: number
  endpoint?: string
  username?: string
  password?: string
  databaseName?: string
  schemaName?: string
  apiKey?: string
  collectionName?: string
  remark?: string
  isActive: boolean
}

// 向量化配置表单
export interface EmbeddingConfigForm {
  chunkStrategy: ChunkStrategy | string
  chunkSize: number
  chunkOverlap: number
  separator: string
  enableSemanticChunk: boolean
  embeddingModelId?: number
  vectorDbId?: number
  dimension: number
  similarityMetric: SimilarityAlgorithm | string
  topK: number
  minScore: number
  collectionName: string
  indexType: string
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

// 软文模板（variables 为 JSON 字符串，前端自行解析）
export interface ArticleTemplate {
  id: number
  tenantId: number
  name: string
  templateType?: string
  category: ArticleTemplateCategory | string
  description?: string
  content: string
  variables?: string
  isSystem: boolean
  isActive: boolean
  version?: number
  status?: string
  sortOrder?: number
  tags?: string
  createdAt: string
  updatedAt: string
}

// 软文模板表单（variables 表单内为数组，提交时序列化为 JSON 字符串）
export interface ArticleTemplateForm {
  name: string
  templateType?: string
  category: ArticleTemplateCategory | string
  description?: string
  content: string
  variables: ArticleTemplateVariable[] | string
  isActive: boolean
  sortOrder?: number
}

// 软文模板查询参数
export interface ArticleTemplateQueryParams {
  tenantId?: number
  templateType?: string
  category?: ArticleTemplateCategory | string
  keyword?: string
  page?: number
  size?: number
}
