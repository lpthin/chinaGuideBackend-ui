// Workspace 模块类型定义

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
  createdAt: string
  updatedAt: string
}

// 关键词内容建议
export interface KeywordContentSuggestion {
  id: number
  clusterId: number
  keyword: string
  title: string
  outline: string
  suggestion: string
  priority: 'high' | 'medium' | 'low'
  status: 'pending' | 'generated' | 'published'
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
  status: 'draft' | 'reviewing' | 'published'
  createdAt: string
  createdBy: string
}

// 审核项目
export interface ReviewItem {
  id: number
  articleId: number
  title: string
  status: 'pending' | 'approved' | 'rejected'
  reviewer: string
  reviewTime: string
  comments: string
  submittedAt: string
}

// 发布任务
export interface PublishTask {
  id: number
  articleId: number
  title: string
  platform: string
  status: 'pending' | 'publishing' | 'success' | 'failed'
  scheduledTime: string
  publishTime?: string
  errorMessage?: string
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
