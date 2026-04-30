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
