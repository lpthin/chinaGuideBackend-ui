export interface ApiResponse<T> {
  success: boolean
  code: string
  message: string
  data: T
}

export interface LoginResult {
  token: string
  username?: string
  userId?: number
}

export interface LoginRequest {
  username: string
  password: string
}

export interface Site {
  id?: number
  code: string
  name: string
  domain?: string
  description?: string
  brandName?: string
  industry?: string
  subIndustry?: string
  targetRegions?: string
  targetAudience?: string
  businessModel?: string
  coreProducts?: string
  competitorDomains?: string
  seedKeywords?: string
  excludedKeywords?: string
  searchLocales?: string
  siteType?: string
  defaultLocale?: string
  enabledLocales?: string
  enabledLocalesList?: string[]
  frontendProjectPath?: string
  publishMode?: string
  themeCode?: string
  status?: string
}

export interface Category {
  id?: number
  siteId?: number
  parentId?: number | null
  code: string
  slug: string
  name: string
  description?: string
  moduleCode?: string
  sortOrder?: number
  status?: string
}

export interface Keyword {
  id?: number
  siteId?: number
  rawKeyword: string
  normalizedKeyword?: string
  keywordType?: string
  sourceCodes?: string
  sourceScore?: number
  collectionBatchNo?: string
  priority?: number
  status?: string
  createdAt?: string
  updatedAt?: string
}


export interface KeywordCollectionJob {
  id?: number
  siteId?: number
  batchNo: string
  sourceCodes: string
  candidateCount: number
  savedCount: number
  status: string
  message?: string
  createdAt?: string
}

export interface HotwordCollectionResult {
  batchNo: string
  candidateCount: number
  savedCount: number
  sources: string[]
  sourceStats: Record<string, number>
  samples: string[]
}

export interface KeywordContentSuggestion {
  id?: number
  siteId?: number
  clusterId?: number
  title: string
  contentPrompt: string
  score?: number
  reason?: string
  status?: string
  createdAt?: string
  updatedAt?: string
}

export interface KeywordCluster {
  id?: number
  siteId?: number
  name: string
  searchIntent?: string
  suggestedCategory?: string
  articleDirection?: string
  articleTitle?: string
  contentPrompt?: string
  priority?: number
  sourceKeywordIds?: string
  createdAt?: string
  contentSuggestions?: KeywordContentSuggestion[]
}

export interface Article {
  id?: number
  siteId?: number
  categoryId?: number
  slug: string
  articleType?: string
  status?: string
  sourceLocale?: string
  publishedAt?: string
  createdAt?: string
  updatedAt?: string
  title?: string
}

export interface ArticleVersion {
  id?: number
  articleId?: number
  locale?: string
  title: string
  summary?: string
  contentMd?: string
  contentHtml?: string
  seoTitle?: string
  seoDescription?: string
  keywords?: string
  faqJson?: string
  schemaJson?: string
  llmsSummary?: string
  geoCitationSummary?: string
  featuredMediaId?: number
  translationStatus?: string
  aiModel?: string
  aiPromptVersion?: string
  reviewedBy?: number
  reviewedAt?: string
  createdAt?: string
  updatedAt?: string
}

export interface PublishDiff {
  path: string
  changeType: string
  oldSize: number
  newSize: number
  preview: string
}

export interface PublishRollbackResult {
  sourcePublishJobId: number
  gitHeadBefore: string
  gitHeadAfter: string
  restoredFiles: string[]
}

export interface PublishResult {
  publishJobId: number
  dryRun: boolean
  outputPath: string
  affectedFiles: string[]
  diffs?: PublishDiff[]
}

export interface DashboardStats {
  keywords: number
  clusters: number
  articles: number
  pendingReviews: number
  approvedArticles: number
  pageViews: number
  todayPageViews: number
}

export interface PublishJob {
  id?: number
  siteId?: number
  articleId?: number
  dryRun?: boolean
  status?: string
  outputPath?: string
  affectedFiles?: string
  gitHeadBefore?: string
  gitHeadAfter?: string
  errorMessage?: string
  createdAt?: string
  finishedAt?: string
}


export interface PromptTemplate {
  id?: number
  siteId?: number | null
  purpose: string
  version?: string
  name: string
  templateText: string
  enabled?: boolean
  createdAt?: string
  updatedAt?: string
}

export interface AiCallLog {
  id?: number
  siteId?: number
  provider?: string
  model?: string
  purpose?: string
  inputHash?: string
  outputSummary?: string
  success?: boolean
  errorMessage?: string
  tokenEstimate?: number
  costEstimate?: number
  createdAt?: string
}

export interface AiCallStats {
  totalCalls: number
  successCalls: number
  failedCalls: number
  totalTokens: number
  costEstimate: number
}


export interface Role {
  id?: number
  code: string
  name: string
  description?: string
  createdAt?: string
  updatedAt?: string
}

export interface Permission {
  id?: number
  code: string
  name: string
  module: string
  action: string
  createdAt?: string
}


export interface Media {
  id?: number
  siteId: number
  fileName: string
  originalName: string
  mimeType: string
  fileSize: number
  storagePath: string
  altText?: string
  caption?: string
  width?: number
  height?: number
  createdAt?: string
}


export interface ArticleComment {
  id?: number
  siteId: number
  articleId: number
  articleTitle?: string
  parentId?: number
  authorName?: string
  authorEmail?: string
  content: string
  status?: string
  reviewedBy?: number
  reviewedAt?: string
  createdAt?: string
}

export interface FormDefinition {
  id?: number
  siteId?: number
  name: string
  code: string
  description?: string
  status?: string
  fieldsJson: string
  submitButtonText?: string
  successMessage?: string
  createdAt?: string
  updatedAt?: string
}

export interface LeadSubmission {
  id?: number
  siteId?: number
  formId?: number
  status?: string
  contactName?: string
  contactEmail?: string
  contactPhone?: string
  payloadJson?: string
  sourcePage?: string
  ipAddress?: string
  userAgent?: string
  remark?: string
  createdAt?: string
  updatedAt?: string
}

export interface Notification {
  id?: number
  siteId?: number
  type?: string
  title: string
  content?: string
  targetType?: string
  targetId?: number
  status?: string
  readAt?: string
  createdAt?: string
}

export interface VirtualInteractionRequest {
  articleId: number
  commentCount: number
  likeCount: number
  status?: string
}

export interface VirtualInteractionResult {
  comments: ArticleComment[]
  likesCreated: number
}
