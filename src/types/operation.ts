// 运营管理模块类型定义

// 运营统计相关类型
export interface OperationStats {
  totalArticles: number
  totalViews: number
  totalUsers: number
  totalLikes: number
}

export interface TrafficTrendItem {
  date: string
  views: number
  articles: number
}

export interface CategoryDistributionItem {
  categoryId: number
  categoryName: string
  count: number
}

export interface UserStats {
  totalUsers: number
  activeUsers: number
  newUsers: number
}

export interface UserGrowthItem {
  month: string
  newUsers: number
  activeUsers: number
}

export interface UserActivityItem {
  level: number
  levelKey: string
  description: string
  count: number
}

export interface TrafficSourceItem {
  source: string
  sourceKey: string
  count: number
}

export interface DeviceDistributionItem {
  device: string
  deviceKey: string
  count: number
}

// 客户案例
export interface CustomerCase {
  id: number
  tenantId: number
  customerName: string
  customerLogo: string
  industry: string
  title: string
  summary: string
  content: string
  coverImage: string
  tags: string
  tagList?: string[]
  viewCount: number
  sort: number
  status: string
  createdAt: string
  updatedAt: string
}

// 数据报表
export interface DataReport {
  id: number
  tenantId: number
  reportType: string
  reportName: string
  reportData: string
  parsedData?: ReportData
  startDate: string
  endDate: string
  status: string
  createdAt: string
  updatedAt: string
}

export interface ReportData {
  totalViews?: number
  totalLikes?: number
  totalShares?: number
  articleCount?: number
  keywordCount?: number
  topArticles?: ArticleRank[]
  topKeywords?: KeywordRank[]
  dailyStats?: DailyStat[]
}

export interface ArticleRank {
  id: number
  title: string
  views: number
}

export interface KeywordRank {
  keyword: string
  count: number
}

export interface DailyStat {
  date: string
  views: number
  likes: number
  shares: number
}

// 查询参数
export interface CustomerCaseQuery {
  tenantId: number
  industry?: string
  status?: string
  keyword?: string
  page?: number
  size?: number
}

export interface DataReportQuery {
  tenantId: number
  reportType?: string
  page?: number
  size?: number
}

// 创建/更新表单
export interface CustomerCaseForm {
  id?: number
  tenantId: number
  customerName: string
  customerLogo?: string
  industry?: string
  title: string
  summary?: string
  content: string
  coverImage?: string
  tags?: string
  sort?: number
  status?: string
}

export interface DataReportForm {
  id?: number
  tenantId: number
  reportType: string
  reportName: string
  reportData?: string
  startDate?: string
  endDate?: string
  status?: string
}

// 分页结果
export interface PageResult<T> {
  records: T[]
  total: number
  page: number
  size: number
  pages: number
}
