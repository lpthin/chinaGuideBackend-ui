// 门户网站模块类型定义

// Banner：字段以后端 PortalBannerDTO 为准，接口没返回的字段不写进类型
export interface Banner {
  id: number
  tenantId: number
  siteId: number
  title: string
  subtitle?: string
  imageUrl: string
  linkUrl?: string
  /** 跳转方式，后端新建时默认 NONE */
  linkType?: string
  /** 读取用 DTO 的字段名，写回后端时是 sortOrder */
  sort: number
  /** ENABLED / DISABLED，门户只渲染 ENABLED */
  status: string
  publishStart?: string
  publishEnd?: string
  targetType?: string
  targetId?: number
  description?: string
  /** 演示内容包生成的行 */
  isDemo?: boolean
  createdAt: string
  updatedAt: string
}

// 职位
export interface JobPost {
  id: number
  tenantId: number
  siteId: number
  title: string
  department?: string
  jobType?: string
  location?: string
  salaryMin?: number
  salaryMax?: number
  salaryUnit?: string
  experienceReq?: string
  educationReq?: string
  description?: string
  requirements?: string
  benefits?: string
  sort: number
  /** OPEN / CLOSED，门户招聘页只列 OPEN */
  status: string
  viewCount?: number
  applyCount?: number
  publishAt?: string
  closeAt?: string
  /** 演示内容包生成的行 */
  isDemo?: boolean
  createdAt: string
  updatedAt: string
}

// 站内信
export interface PortalMessage {
  id: number
  tenantId: number
  senderId: number
  receiverId: number
  type: string
  title: string
  content: string
  isRead: boolean
  readAt: string
  createdAt: string
}

// 消息统计
export interface PortalMessageStats {
  totalMessages: number
  readCount: number
  unreadCount: number
  totalRecipients: number
}

// 广播消息发送
export interface PortalMessageBroadcast {
  scope: 'ALL_TENANTS' | 'SPECIFIC_TENANT'
  tenantId?: number
  title: string
  content: string
  type?: string
}

// 留言板
export interface Guestbook {
  id: number
  tenantId: number
  parentId: number | null
  name: string
  phone: string
  email: string
  company: string
  subject: string
  content: string
  reply: string
  replyAt: string
  replyUserId: number
  status: string
  /** 留言种类：取值与中文名只来自 GET /guestbook/types（I-1，前端不抄第二份词表） */
  type?: string | null
  ip: string
  createdAt: string
  updatedAt: string
}

// 企业信息
export interface CompanyInfo {
  id: number
  tenantId: number
  siteId?: number
  companyName: string
  englishName?: string
  shortName?: string
  foundedDate?: string
  creditCode?: string
  legalRepresentative?: string
  address?: string
  provinceId?: number
  provinceName?: string
  cityId?: number
  cityName?: string
  postalCode?: string
  phone?: string
  fax?: string
  email?: string
  website?: string
  serviceHotline?: string
  introduction?: string
  business?: string
  culture?: string
  industry?: string
  subIndustry?: string
  targetRegions?: string
  targetAudience?: string
  businessModel?: string
  coreProducts?: string
  featureProjects?: string
  competitorDomains?: string
  seedKeywords?: string
  excludedKeywords?: string
  searchLocales?: string
  wechat?: string
  weibo?: string
  douyin?: string
  linkedin?: string
  github?: string
  logoUrl?: string
  faviconUrl?: string
  certificateUrls?: string
  isDeleted?: number
  createTime?: string
  updateTime?: string
}

// SEO配置
export interface SeoConfig {
  id: number
  tenantId: number
  siteId?: number
  pageType: string
  pageKey: string
  seoTitle: string
  seoKeywords: string
  seoDescription: string
  ogImage: string
  ogTitle: string
  ogDescription: string
  structuredData: string
  updatedAt: string
}

// 查询参数
export interface BannerQuery {
  siteId?: number
  status?: string
  page?: number
  size?: number
}

export interface JobPostQuery {
  status?: string
  jobType?: string
  department?: string
  keyword?: string
  page?: number
  size?: number
}

export interface PortalMessageQuery {
  tenantId: number
  receiverId?: number
  isRead?: boolean
  page?: number
  size?: number
}

export interface GuestbookQuery {
  tenantId: number
  status?: string
  type?: string
  keyword?: string
  /** ISO 本地时间字符串，后端按 @DateTimeFormat(ISO.DATE_TIME) 收 */
  startDate?: string
  page?: number
  size?: number
}

// 创建/更新表单：写接口收的是后端实体，排序字段名是 sortOrder（读取时 DTO 给的是 sort）
export interface BannerForm {
  id?: number
  title: string
  subtitle?: string
  imageUrl: string
  linkUrl?: string
  linkType?: string
  sortOrder?: number
  description?: string
  publishStart?: string
  publishEnd?: string
}

export interface JobPostForm {
  id?: number
  title: string
  department?: string
  jobType?: string
  location?: string
  salaryMin?: number
  salaryMax?: number
  salaryUnit?: string
  experienceReq?: string
  educationReq?: string
  description?: string
  requirements?: string
  benefits?: string
  sortOrder?: number
}

export interface GuestbookReply {
  id: number
  reply: string
}

export interface CompanyInfoForm {
  id?: number
  tenantId?: number
  siteId?: number
  companyName?: string
  englishName?: string
  shortName?: string
  foundedDate?: string
  creditCode?: string
  legalRepresentative?: string
  address?: string
  provinceId?: number
  provinceName?: string
  cityId?: number
  cityName?: string
  postalCode?: string
  phone?: string
  fax?: string
  email?: string
  website?: string
  serviceHotline?: string
  introduction?: string
  business?: string
  culture?: string
  industry?: string
  subIndustry?: string
  targetRegions?: string
  targetAudience?: string
  businessModel?: string
  coreProducts?: string
  featureProjects?: string
  competitorDomains?: string
  seedKeywords?: string
  excludedKeywords?: string
  searchLocales?: string
  wechat?: string
  weibo?: string
  douyin?: string
  linkedin?: string
  github?: string
  logoUrl?: string
  faviconUrl?: string
  certificateUrls?: string
}

export interface SeoConfigForm {
  id?: number
  tenantId?: number
  siteId?: number
  pageType?: string
  pageKey: string
  seoTitle?: string
  seoKeywords?: string
  seoDescription?: string
  ogImage?: string
  ogTitle?: string
  ogDescription?: string
  structuredData?: string
}

// 分页结果
export interface PageResult<T> {
  records: T[]
  total: number
  page: number
  size: number
  pages: number
}
