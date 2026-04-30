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

export interface PublishResult {
  publishJobId: number
  dryRun: boolean
  outputPath: string
  affectedFiles: string[]
}

export interface DashboardStats {
  keywords: number
  clusters: number
  articles: number
  pendingReviews: number
  approvedArticles: number
}
