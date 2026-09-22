// 案例管理模块类型定义

// 案例状态枚举
// 后端 case_info 写路径只会产生这两个值：create 默认 DRAFT、publish 置 PUBLISHED、
// unpublish 回 DRAFT（入库大写、DTO 转小写）。审核进度由独立的 reviewStatus 表达。
export enum CaseStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published'
}

// 案例优先级枚举
export enum CasePriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent'
}

// 案例类型枚举
export enum CaseType {
  CUSTOMER_SUCCESS = 'customer_success',
  TECHNICAL_IMPLEMENTATION = 'technical_implementation',
  BEST_PRACTICE = 'best_practice',
  INDUSTRY_SOLUTION = 'industry_solution',
  PRODUCT_DEMO = 'product_demo'
}

// 案例标签
export interface CaseTag {
  id: number
  tenantId: number
  name: string
  color: string
  useCount: number
  createdAt: string
}

// 案例分类
export interface CaseCategory {
  id: number
  tenantId: number
  parentId: number | null
  name: string
  icon: string
  description: string
  sort: number
  status: string
  caseCount: number
  createdAt: string
  updatedAt: string
  children?: CaseCategory[]
}

// 案例
export interface Case {
  id: number
  tenantId?: number
  siteId?: number
  caseNo?: string
  categoryId: number
  categoryName?: string
  title: string
  subtitle?: string
  summary: string
  content: string
  customerName?: string
  customerIndustry?: string
  customerScale?: string
  tags: string
  tagList?: string[]
  coverImage?: string
  bannerImage?: string
  caseDate?: string
  projectDuration?: string
  projectBudget?: number
  difficultyLevel?: string
  sortOrder?: number
  viewCount: number
  likeCount: number
  shareCount: number
  status: CaseStatus
  reviewStatus?: string
  reviewerId?: number
  reviewerName?: string
  reviewTime?: string
  reviewComment?: string
  version?: number
  isPublished?: boolean
  publishedAt?: string
  seoTitle?: string
  seoKeywords?: string
  seoDescription?: string
  seoUrl?: string
  templateType?: string
  createdAt: string
  updatedAt: string
  type?: CaseType
  priority?: CasePriority
  authorId?: number
  authorName?: string
}

// 案例统计（GET /cases/statistics）
export interface CaseStatistics {
  total: number
  published: number
  draft: number
  pendingReview: number
}

// 列表查询参数
export interface CaseQuery {
  tenantId?: number
  siteId?: number
  categoryId?: number | null
  status?: CaseStatus
  reviewStatus?: string
  type?: CaseType
  priority?: CasePriority
  keyword?: string
  page?: number
  size?: number
}

export interface CaseCategoryQuery {
  tenantId?: number
  siteId?: number
  status?: string
}

export interface CaseCategoryForm {
  id?: number
  tenantId?: number
  siteId?: number
  parentId?: number | null
  name: string
  icon?: string
  description?: string
  sort?: number
  status?: string
}

// 创建/更新表单
export interface CaseForm {
  id?: number
  tenantId?: number
  siteId?: number
  caseNo?: string
  categoryId?: number | null
  title: string
  subtitle?: string
  summary?: string
  content?: string
  customerName?: string
  customerIndustry?: string
  customerScale?: string
  type?: CaseType | string
  priority?: CasePriority | string
  authorId?: number | null
  coverImage?: string
  bannerImage?: string
  caseDate?: string
  projectDuration?: string
  projectBudget?: number
  difficultyLevel?: string
  sortOrder?: number
  tags?: string
  status?: CaseStatus | string
  reviewStatus?: string
  isPublished?: boolean
  publishedAt?: string
  seoTitle?: string
  seoKeywords?: string
  seoDescription?: string
  seoUrl?: string
  templateType?: string
}

// 分页结果
export interface PageResult<T> {
  records: T[]
  total: number
  page: number
  size: number
  pages?: number
}
