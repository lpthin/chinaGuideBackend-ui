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

/**
 * 「模型类型」那一格的词表与中文名，前端<b>只这一处</b>：弹窗里的多选、列表上的筛选、
 * 表格里那块牌子念的都是它。以前这五个中文名散在 `ModelConfigView.vue` 的两处（模板里的
 * `<a-select-option>` 与 `getModelTypeName` 里那份 map），与后端 `AiProtocols.label()` /
 * `AiModelScopes.label()` 的「一个词只有一个出处」正相反。
 *
 * 词表、判定与写口的闸都在后端 `ai/AiModelTypes` 那一处：那边加一个词，这一份要跟着加，
 * 否则保存时后端 `normalizeForStore` 会把这个词当面拒掉（不会静默丢弃）。
 */
export const MODEL_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: 'chat', label: '聊天模型' },
  { value: 'vision', label: '视觉模型' },
  { value: 'embedding', label: '向量化模型' },
  { value: 'image', label: '图像模型' },
  { value: 'audio', label: '语音模型' },
]

/** 生图那一族的写法：与后端 `AiModelTypes.isImageGenerating` 认的那几个词同口径 */
const IMAGE_FAMILY = ['image', 'image-gen', 'text-to-image', 'image-generation']

/**
 * 库里 `model_type` 那一格 → 一个词一个词。
 *
 * 2026-10-22 起这一格可以多选（一台既能对话又能看图的模型要标得下两件事），
 * 存的是逗号分隔的串如 `chat,vision`。认不出的词原样带回来，不在这儿丢——
 * 存量那些 `gpt`、`bge-m3-embedding` 带着「这一行到底算哪一类」的线索，丢了就判不出来。
 */
export function splitModelTypes(raw?: string | null): string[] {
  const words: string[] = []
  for (const token of String(raw ?? '').split(',')) {
    const word = token.trim().toLowerCase()
    if (word && !words.includes(word)) words.push(word)
  }
  return words
}

/** 多选框那个数组 → 库里那一格：按词表顺序收、去重，词表外的脏词排在后面原样带回去 */
export function joinModelTypes(values?: string[] | null): string {
  const words = (values ?? [])
    .map(value => String(value ?? '').trim().toLowerCase())
    .filter(Boolean)
  const unique = [...new Set(words)]
  const known = MODEL_TYPE_OPTIONS.map(option => option.value).filter(value => unique.includes(value))
  const unknown = unique.filter(value => !MODEL_TYPE_OPTIONS.some(option => option.value === value))
  return [...known, ...unknown].join(',')
}

/** 表格里那一格念出来的一句话：一个词念全名（聊天模型），多个词念短名相加（聊天 + 视觉） */
export function describeModelTypes(raw?: string | null): string {
  const words = splitModelTypes(raw)
  if (words.length === 0) return '未标类型'
  if (words.length === 1) return labelOfModelType(words[0])
  return words.map(word => labelOfModelType(word).replace(/模型$/, '')).join(' + ')
}

/** 某一个词的中文名；认不出来就原样念回来——显示成空白等于那一格看着像没填 */
function labelOfModelType(word: string): string {
  return MODEL_TYPE_OPTIONS.find(option => option.value === word)?.label || word
}

/** 这一行有没有勾某个能力词（列表筛选用的就是这一句：多选之后「全等于」筛不出 `chat,vision`） */
export function hasModelType(raw: string | null | undefined, code: string): boolean {
  return splitModelTypes(raw).includes(code)
}

/** 这一行能不能生图（决定「试出一张图」那颗按钮）：带 embedding 的词不算，CLIP 那一族是真实存在的 */
export function isImageGeneratingType(raw?: string | null): boolean {
  return splitModelTypes(raw).some(word => !word.includes('embedding') && IMAGE_FAMILY.includes(word))
}

/** 这一行是不是「按用途挑行」读得到的那一族：只有聊天/文本那一路看 `purpose_scope` */
export function isChatCapableType(raw?: string | null): boolean {
  return splitModelTypes(raw).some(word =>
    !word.includes('embedding') && !IMAGE_FAMILY.includes(word)
    && (word.includes('chat') || word.includes('text')))
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
  /** 这一格是逗号分隔的多个能力词（如 `chat,vision`），认词与念法见 {@link splitModelTypes} / {@link describeModelTypes} */
  modelType?: ModelType | string
  apiEndpoint?: string
  /** 接口协议：留空表示由后端按接口地址推断（语义只写在后端 AiProtocols，前端不重复实现） */
  apiProtocol?: string
  /**
   * 每 1000 token 的单价（元）。null = 没定过价 ⇒ 这一笔的钱界面念「未配价」（不报钱，也不报 ¥0.00）；
   * 0 = 真免费 ⇒ 费用是 ¥0.00。这两个词分工写死：「未统计」只留给后端压根没有口径的格子（环比、那两率）。
   * 这一格只由 setPrice 那个口写（整表单那条 PUT 走 updateById，null 不进 SET，清不掉旧价）。
   */
  pricePer1kTokens?: number | null
  /**
   * 这一行单价的出处（哪天从哪个公开页抄的、取的输入还是输出那一档），跟单价同走 setPrice。
   * 单价清成「未定价」时后端会把它一起清掉——出处不能比它活的久。
   */
  priceNote?: string | null
  /**
   * 限定用途（V182）：空串＝通用行，所有用途都选得到；非空＝只服务这一个用途的专用行，别的用途借不走。
   * 能填的那几个取值由后端那一支 {@code purpose-scope-options} 给，前端不抄词表（见 {@link PurposeScopeOption}）。
   */
  purposeScope?: string | null
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

// 图像模型「试出一张图」的结果（字段名与后端 AiModelConfigController#probeImageModel 一致）
// 后端刻意不回图字节也不回外链：这一口验的是「这一行能不能出图」，入库只走编排任务
export interface ImageProbeResult {
  protocol: string
  protocolName: string
  endpoint: string
  model: string
  success: boolean
  bytes?: number
  mimeType?: string
  elapsedMs: number
  message: string
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

// 「限定用途」那一个下拉的选项：由后端 purpose-scope-options 那支口给，前端不自己抄词表
export interface PurposeScopeOption {
  code: string
  label: string
}

// 模型配置表单
export interface ModelConfigForm {
  name: string
  modelId?: number
  provider?: string
  modelName?: string
  /**
   * 出接口的那一串：逗号分隔的多个能力词（如 `chat,vision`），2026-10-22 起可以多选。
   * 弹窗里绑的是数组，换算只走 {@link joinModelTypes} / {@link splitModelTypes} 这两句；
   * 空串是合法值＝未标类型。
   */
  modelType?: string
  /** 限定用途：空串＝清回通用行（这一列 NOT NULL DEFAULT ''，空串是一个真值，不是「没填」） */
  purposeScope?: string
  apiKey: string
  baseUrl?: string
  apiEndpoint?: string
  apiProtocol?: string
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
