// Workspace 模块类型定义
import type { ArticleStatus, JobStatus, QueueStatus } from '../utils/contentStatus'

// 租户信息
export interface Tenant {
  id: number
  name: string
  code: string
  status: number
  logoUrl?: string
  contactEmail?: string
  contactPhone?: string
  website?: string
  description?: string
  createdAt?: string
  updatedAt?: string
}

// 仪表盘统计数据
export interface DashboardStats {
  totalArticles: number
  publishedCount: number
  draftCount: number
  totalViews: number
  todayCount: number
  pendingReview: number
  totalKeywords: number
  totalClusters: number
  avgScore: number
}

// 关键词聚类
export interface KeywordCluster {
  id: number
  name: string
  keywordCount: number
  avgSearchVolume: number
  avgCompetition: number
  status: 'active' | 'inactive'
  priority?: number
  searchIntent?: string
  articleDirection?: string
  articleTitle?: string
  contentPrompt?: string
  suggestedCategory?: string
  keywords?: string[]
  contentSuggestions?: KeywordContentSuggestion[]
  createdAt: string
  updatedAt: string
}

// 关键词内容建议
export interface KeywordContentSuggestion {
  id: number
  clusterId: number
  keyword?: string
  title: string
  outline?: string
  suggestion?: string
  contentPrompt?: string
  score?: number
  reason?: string
  priority?: 'high' | 'medium' | 'low'
  status: string
  createdAt: string
}

// 生成的文章内容
export interface GeneratedContent {
  id: number
  title: string
  content: string
  summary: string
  keywords: string
  categoryId: number
  status: ArticleStatus
  createdAt: string
  createdBy: string
  source?: string
  author?: string
  isTop?: boolean
  isRecommend?: boolean
  tags?: string[]
  seoTitle?: string
  seoDescription?: string
  seoKeywords?: string
}

// 审核项目（GET /workspace/reviews/pending 返回的就是文章，字段与后端一致）
export interface ReviewItem {
  id: number
  articleId: number
  title: string
  summary?: string
  status: ArticleStatus
  reviewer?: string
  reviewedAt?: string
  createdAt: string
}

// 待发布队列记录（后端 PublishQueueDTO）
export interface PublishTask {
  id: number
  tenantId?: number
  siteId?: number
  articleId: number
  title: string
  platform: string
  priority?: number
  status: QueueStatus
  scheduledTime?: string
  publishTime?: string
  errorMessage?: string
  createdAt?: string
}

// 发布记录（后端 publish_job）
export interface PublishRecord {
  id: number
  tenantId?: number
  siteId?: number
  articleId: number
  title?: string
  dryRun?: boolean
  status: JobStatus
  outputPath?: string
  errorMessage?: string
  createdAt: string
  finishedAt?: string
}

// 媒体库资源
export interface Media {
  id: number
  tenantId: number
  name: string
  url: string
  thumbnail: string
  fileSize: number
  fileType: string
  width: number
  height: number
  category: string
  tags: string
  useCount: number
  ocrStatus?: string      // OCR分析状态: ANALYZING/COMPLETED/FAILED
  ocrText?: string        // OCR提取的文字
  aiDescription?: string  // AI生成的图片描述
  originalName?: string   // 原始文件名
  mimeType?: string       // MIME类型
  createdAt: string
  updatedAt: string
}

// 媒体库查询参数
export interface MediaQuery {
  tenantId: number
  category?: string
  keyword?: string
  fileType?: string
  page?: number
  size?: number
}

// 媒体库统计
export interface MediaStats {
  total: number
  totalSize: number
  imageCount: number
  videoCount: number
  documentCount: number
}

// 审核查询参数
export interface ReviewQuery {
  tenantId: number
  status?: string
  reviewer?: string
  page?: number
  size?: number
}

// 发布任务查询参数
export interface PublishQuery {
  tenantId: number
  status?: string
  platform?: string
  page?: number
  size?: number
}

// 内容生成参数
export interface GenerateContentParams {
  keyword: string
  categoryId: number
  language: string
  tone: 'formal' | 'casual' | 'professional'
  wordCount: number
}

// 审核操作参数
export interface ReviewActionParams {
  id: number
  action: 'approve' | 'reject'
  comments?: string
}

// 分页结果
export interface PageResult<T> {
  records: T[]
  total: number
  page: number
  size: number
  pages: number
}

// 审计日志
export interface AuditLog {
  id: number
  tenantId: number
  userId: number
  username: string
  action: string
  module: string
  ip: string
  userAgent: string
  detail: string
  createdAt: string
}

// 审计日志查询参数
export interface AuditLogQuery {
  page?: number
  size?: number
  tenantId?: number
  action?: string
  module?: string
  username?: string
  startDate?: string
  endDate?: string
}

// 审计日志统计
export interface AuditLogStats {
  total: number
  todayTotal: number
  loginCount: number
  errorCount: number
  sensitiveCount: number
}

// 系统设置
export interface SystemSettings {
  site: SiteSettings
  ai: AiSettings
  workflow: WorkflowSettings
  system: Record<string, any>
  tenantId: number
}

export interface SiteSettings {
  name?: string
  description?: string
  logo?: string
  contactEmail?: string
  contactPhone?: string
  icp?: string
  copyright?: string
}

export interface AiSettings {
  defaultModel?: string
  apiKey?: string
  apiBaseUrl?: string
  temperature?: number
  maxTokens?: number
  streamEnabled?: boolean
  systemPrompt?: string
}

export interface WorkflowSettings {
  keywordCrawlInterval?: string
  keywordCrawlLimit?: number
  autoCrawlEnabled?: boolean
  clusterThreshold?: number
  minClusterSize?: number
  autoGenerateEnabled?: boolean
  dailyGenerateLimit?: number
  autoReviewEnabled?: boolean
  autoPublishEnabled?: boolean
  publishTime?: string
}

// 报警规则
// 与后端 AlertRule 实体一致：channels/receivers 为逗号分隔字符串，triggerCondition 为 JSON 字符串，isActive 为 0/1
export interface AlertRule {
  id: number
  tenantId: number
  name: string
  triggerType: 'api_error' | 'exception' | 'ai_model_unreachable' | 'ai_model_missing' | 'custom'
  triggerCondition: string | null
  severity: 'low' | 'medium' | 'high' | 'critical'
  channels: string
  receivers: string
  isActive: number
  createdAt: string
  updatedAt: string
}

// 弹窗表单使用的形态（多选/开关/JSON 编辑器）
export interface AlertRuleForm {
  id?: number
  tenantId?: number
  name: string
  triggerType: AlertRule['triggerType']
  triggerCondition: Record<string, any>
  severity: AlertRule['severity']
  channels: string[]
  receivers: string[]
  isActive: boolean
}

// 报警规则查询参数
export interface AlertRuleQuery {
  page?: number
  size?: number
  tenantId?: number
  name?: string
  triggerType?: string
  severity?: string
  isActive?: number
}

// 报警记录
export interface AlertRecord {
  id: number
  tenantId: number
  ruleId: number
  title: string
  content: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  status: 'pending' | 'processing' | 'resolved' | 'ignored'
  traceId?: string
  requestPath?: string
  userId?: number
  metadata?: Record<string, any>
  triggeredAt: string
  resolvedAt?: string
  createdAt: string
  updatedAt: string
}

// 报警记录查询参数
export interface AlertRecordQuery {
  page?: number
  size?: number
  tenantId?: number
  severity?: string
  status?: string
  ruleId?: number
  startDate?: string
  endDate?: string
}

// 报警记录统计
export interface AlertRecordStats {
  total: number
  todayCount: number
  pendingCount: number
  processingCount: number
  lowCount: number
  mediumCount: number
  highCount: number
  criticalCount: number
}

// 通知渠道配置
export interface AlertChannelConfig {
  id: number
  tenantId: number
  channelType: 'webhook' | 'sms' | 'email'
  name: string
  config: Record<string, any>
  isDefault: boolean
  createdAt: string
  updatedAt: string
}

// 通知渠道查询参数
export interface AlertChannelQuery {
  page?: number
  size?: number
  tenantId?: number
  channelType?: string
}
