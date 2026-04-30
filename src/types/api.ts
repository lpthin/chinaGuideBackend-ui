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
