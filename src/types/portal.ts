// 门户网站模块类型定义

// 门户模板
export enum PortalTemplateType {
  TECH = 'tech',
  MARKETING = 'marketing',
  MINIMAL = 'minimal'
}

export interface PortalTemplateColorConfig {
  primary: string
  secondary: string
  accent: string
  background: string
  text: string
  textSecondary: string
}

export interface PortalTemplateFontConfig {
  headingFont: string
  bodyFont: string
  baseFontSize: number
}

export interface PortalTemplateLayoutConfig {
  headerStyle: 'classic' | 'modern' | 'centered'
  footerStyle: 'full' | 'compact' | 'minimal'
  sidebarEnabled: boolean
  contentWidth: 'full' | 'boxed' | 'narrow'
}

export interface PortalTemplate {
  id: number
  tenantId: number
  name: string
  code: string
  description: string
  type: string
  thumbnail: string
  previewUrl: string
  configJson: string
  isSystem: boolean
  isActive: boolean
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export interface PortalTemplateForm {
  id?: number
  tenantId?: number
  name: string
  description?: string
  type?: string
  thumbnail?: string
  previewUrl?: string
  configJson?: string
  isSystem?: boolean
  isActive?: boolean
  sortOrder?: number
}

export interface PortalTemplateQuery {
  tenantId?: number
  type?: string
  isSystem?: boolean
  isActive?: boolean
  keyword?: string
  page?: number
  size?: number
}

// Banner
export interface Banner {
  id: number
  tenantId: number
  position: string
  title: string
  subtitle: string
  imageUrl: string
  linkUrl: string
  linkTarget: string
  description: string
  sort: number
  clickCount: number
  status: string
  creatorId: number
  createdAt: string
  updatedAt: string
}

// 职位
export interface JobPost {
  id: number
  tenantId: number
  title: string
  department: string
  jobType: string
  location: string
  minSalary: number
  maxSalary: number
  salaryUnit: string
  experienceRequirement: string
  educationRequirement: string
  description: string
  responsibilities: string
  requirements: string
  benefits: string
  contactName: string
  contactPhone: string
  contactEmail: string
  sort: number
  status: string
  viewCount: number
  creatorId: number
  createdAt: string
  updatedAt: string
}

// 职位申请
export interface JobApplication {
  id: number
  tenantId: number
  jobPostId: number
  name: string
  phone: string
  email: string
  resumeUrl: string
  selfIntroduction: string
  status: string
  remark: string
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
  pageKey: string
  pageTitle: string
  metaKeywords: string
  metaDescription: string
  ogTitle: string
  ogDescription: string
  robotsContent: string
  canonicalUrl: string
  createdAt: string
  updatedAt: string
}

// 查询参数
export interface BannerQuery {
  tenantId: number
  position?: string
  status?: string
  page?: number
  size?: number
}

export interface JobPostQuery {
  tenantId: number
  jobType?: string
  status?: string
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
  page?: number
  size?: number
}

// 创建/更新表单
export interface BannerForm {
  id?: number
  tenantId: number
  position: string
  title?: string
  subtitle?: string
  imageUrl: string
  linkUrl?: string
  linkTarget?: string
  description?: string
  sort?: number
  status?: string
}

export interface JobPostForm {
  id?: number
  tenantId: number
  title: string
  department?: string
  jobType?: string
  location?: string
  minSalary?: number
  maxSalary?: number
  salaryUnit?: string
  experienceRequirement?: string
  educationRequirement?: string
  description?: string
  responsibilities?: string
  requirements?: string
  benefits?: string
  contactName?: string
  contactPhone?: string
  contactEmail?: string
  sort?: number
  status?: string
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
  tenantId: number
  pageKey: string
  pageTitle?: string
  metaKeywords?: string
  metaDescription?: string
  ogTitle?: string
  ogDescription?: string
  robotsContent?: string
  canonicalUrl?: string
}

// 分页结果
export interface PageResult<T> {
  records: T[]
  total: number
  page: number
  size: number
  pages: number
}
