// 案例管理模块类型定义

// 案例状态枚举
export enum CaseStatus {
  DRAFT = 'draft',
  REVIEWING = 'reviewing',
  APPROVED = 'approved',
  PUBLISHED = 'published',
  ARCHIVED = 'archived',
  REJECTED = 'rejected'
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

// 案例附件
export interface CaseAttachment {
  id: number
  caseId: number
  fileName: string
  fileUrl: string
  fileSize: number
  fileType: string
  uploadedBy: number
  uploadedByName?: string
  createdAt: string
}

// 案例评论
export interface CaseComment {
  id: number
  caseId: number
  userId: number
  userName: string
  userAvatar?: string
  content: string
  parentId?: number
  createdAt: string
}

// 案例版本记录
export interface CaseVersion {
  id: number
  caseId: number
  version: string
  title: string
  changeLog: string
  createdBy: number
  createdByName?: string
  createdAt: string
}

// 案例
export interface Case {
  id: number
  tenantId: number
  categoryId: number
  categoryName?: string
  title: string
  summary: string
  content: string
  coverImage?: string
  type: CaseType
  status: CaseStatus
  priority: CasePriority
  customerName?: string
  customerIndustry?: string
  customerScale?: string
  tags: string
  tagList?: string[]
  viewCount: number
  likeCount: number
  shareCount: number
  downloadCount: number
  authorId: number
  authorName?: string
  reviewerId?: number
  reviewerName?: string
  publishedAt?: string
  createdAt: string
  updatedAt: string
  attachments?: CaseAttachment[]
  comments?: CaseComment[]
  versions?: CaseVersion[]
}

// 案例统计
export interface CaseStats {
  totalCases: number
  publishedCases: number
  draftCases: number
  reviewingCases: number
  totalViews: number
  totalLikes: number
  totalShares: number
  weeklyGrowth: {
    cases: number
    views: number
    percentage: number
  }
  topCategories: {
    id: number
    name: string
    count: number
  }[]
  topTags: {
    id: number
    name: string
    count: number
  }[]
  recentActivities: {
    id: number
    type: string
    title: string
    time: string
    userName: string
  }[]
  statusDistribution: {
    status: CaseStatus
    count: number
    label: string
  }[]
  typeDistribution: {
    type: CaseType
    count: number
    label: string
  }[]
}

// 列表查询参数
export interface CaseQuery {
  tenantId: number
  categoryId?: number | null
  status?: CaseStatus
  type?: CaseType
  priority?: CasePriority
  authorId?: number
  keyword?: string
  startDate?: string
  endDate?: string
  page?: number
  size?: number
}

export interface CaseCategoryQuery {
  tenantId: number
  parentId?: number | null
  status?: string
  page?: number
  size?: number
}

export interface CaseTagQuery {
  tenantId: number
  keyword?: string
  page?: number
  size?: number
}

// 创建/更新表单
export interface CaseForm {
  id?: number
  tenantId: number
  categoryId: number
  title: string
  summary?: string
  content: string
  coverImage?: string
  type: CaseType
  priority: CasePriority
  customerName?: string
  customerIndustry?: string
  customerScale?: string
  tags?: string
  status?: CaseStatus
}

export interface CaseCategoryForm {
  id?: number
  tenantId: number
  parentId?: number | null
  name: string
  icon?: string
  description?: string
  sort?: number
  status?: string
}

export interface CaseTagForm {
  id?: number
  tenantId: number
  name: string
  color?: string
}

// 审核表单
export interface CaseReviewForm {
  caseId: number
  status: CaseStatus.APPROVED | CaseStatus.REJECTED
  comment?: string
}

// 分页结果
export interface PageResult<T> {
  records: T[]
  total: number
  page: number
  size: number
  pages: number
}
