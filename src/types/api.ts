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
  siteType?: string
  defaultLocale?: string
  enabledLocales?: string
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
  priority?: number
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
  priority?: number
  sourceKeywordIds?: string
  createdAt?: string
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
