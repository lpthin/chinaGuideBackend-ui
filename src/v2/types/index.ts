// V2 类型统一导出
export * from './knowledge'
export * from './case'
export * from './billing'
export * from './article'
export * from './portal'
export * from './operation'
export * from './auth'

// 基础类型
export interface ApiResponse<T = any> {
  success: boolean
  code: number | string
  message: string
  data: T
  timestamp: string
}

export interface PageParams {
  page?: number
  size?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export interface PageResult<T> {
  records: T[]
  total: number
  page: number
  size: number
  pages: number
}

// 通用查询参数
export interface BaseQueryParams extends PageParams {
  tenantId: number
  status?: string
  keyword?: string
  startDate?: string
  endDate?: string
}

// 通用删除/批量操作参数
export interface BatchOperationParams {
  ids: number[]
  tenantId: number
  operatorId?: number
}

// 通用状态枚举
export type StatusType = 'active' | 'inactive' | 'pending' | 'deleted'

// 排序类型
export type SortOrder = 'asc' | 'desc'

// 基础实体
export interface BaseEntity {
  id?: number
  tenantId: number
  createdAt?: string
  updatedAt?: string
}

// 树形实体
export interface TreeNode extends BaseEntity {
  parentId?: number | null
  name: string
  sort?: number
  children?: TreeNode[]
}

// 站点信息（供热词采集、内容生成使用）
export interface Site {
  id?: number
  code: string
  name: string
  domain: string
  description: string
  brandName: string
  industry: string
  subIndustry: string
  targetRegions: string
  targetAudience: string
  businessModel: string
  coreProducts: string
  competitorDomains: string
  seedKeywords: string
  excludedKeywords: string
  searchLocales: string
  siteType: string
  defaultLocale: string
  enabledLocales: string
  frontendProjectPath: string
  publishMode: string
  themeCode: string
  status: string
}

// 仪表盘统计数据
export interface DashboardStats {
  totalArticles: number
  totalKeywords: number
  totalViews: number
  pendingReview: number
  todayCount: number
}

// Prompt 模板
export interface PromptTemplate {
  id?: number
  name: string
  purpose: string
  version: string
  templateText: string
  enabled: boolean
  isSystem: boolean
}
