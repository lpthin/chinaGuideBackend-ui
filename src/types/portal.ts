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
/**
 * 字段名照 `GET /messages` 现场真回的键写（`MessageController` 直接返回 `Message` 实体，
 * 实测键集：content/createTime/delFlag/id/isDeleted/readTime/receiverId/receiverName/
 * senderId/senderName/status/summary/tenantId/title/type）。
 *
 * 这一版之前抄的是 `isRead/readAt/createdAt`——后端根本没这三个键，所以界面上
 * 「已读/未读」那一列恒显示未读、「发送时间」列恒显示 `-`、状态筛选发了个后端不认的
 * `isRead` 参数于是筛不动。跟留言板同一类病（库里没那几个名字）。
 *
 * `status` 只有 `unread`/`read` 两个值；收件箱里它表示「我读了没」，
 * 发件箱里同一列表示「对方读了没」（一行 = 一个收件人的那份副本）。
 */
export interface PortalMessage {
  id: number
  tenantId: number
  senderId: number
  senderName?: string
  receiverId: number
  receiverName?: string
  type: string
  title: string
  content: string
  summary?: string
  status: string
  isDeleted?: number
  createTime: string
  readTime?: string
}

// 消息统计
/**
 * `GET /messages/stats` 真回的三个数（后端 `MessageService.getStats`，拍板：按当前登录用户算）。
 * 每一项的谓词与它下面那张表用的同一条（收件箱 = `receiver_id = 我`，发件箱 = `sender_id = 我`），
 * 所以卡片与表格天然对得上，不是「各算一份再指望它们同步」。
 *
 * 这一口从前回四个键、背后只有两句 SQL：`total/inbox/outbox` 都是 `tenant_id + is_deleted`，
 * 恒等且不分收发件人，现场实测租户 1 报 outbox=7 而真发件箱只有 2 行。更早一版界面抄的是
 * `totalMessages / readCount / unreadCount / totalRecipients`，一个都对不上，四格永远 0。
 */
export interface PortalMessageStats {
  inbox: number
  unread: number
  outbox: number
}

/**
 * 平台档（超管没选租户）里 `GET /messages/broadcast-summary` 的一行 = 我发出的公告摊出去之后的阅读情况。
 * 字段照后端 `BroadcastReadRow` 的字写，别再抄一套（上一版就是抄错键名导致四格恒 0）。
 *
 * 摊行是后端 `sendMessageToAllTenants` 在发送时按收件人一行一行插的，所以 delivered 是副本份数不是人数期望；
 * 被删掉的那一份从 delivered 里挪进 removedCount，不混进「没读」。
 */
export interface PortalBroadcastReadRow {
  title: string
  type?: string
  sentTime: string
  delivered: number
  readCount: number
  unreadCount: number
  removedCount: number
  tenantCount: number
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
// 留言板：字段名按后端实体 portal_guestbook 的列来（userName / replyContent / createTime…）。
// 这里以前写的是 name / reply / createdAt 那一套——库里没这几个名字，界面上那几列因此一直是空的。
export interface Guestbook {
  id: number
  tenantId: number
  siteId: number | null
  userName: string | null
  phone: string | null
  email: string | null
  content: string
  /** 留资表单里的访客公司名（V139）：普通留言没有这一格 */
  companyName?: string | null
  /** 预算档位码（V139）：中文说法只来自 GET /guestbook/budgets，库里存的就是这个码 */
  budgetCode?: string | null
  /** 留言种类：取值与中文名只来自 GET /guestbook/types（I-1，前端不抄第二份词表） */
  type?: string | null
  status: string
  replyContent?: string | null
  replierName?: string | null
  replyTime?: string | null
  createTime?: string | null
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

/**
 * `GET /messages` 与 `GET /messages/outbox` 认的查询键，照 `MessageController` 的形参写：
 * `status` / `keyword` / `page` / `size` / `tenantId`。
 *
 * 之前这里写的是 `isRead?: boolean`，界面也就发 `isRead=true`，后端没这个形参，
 * 于是状态筛选点了等于没点。`tenantId` 可选：日常走的是 http 里那对租户头。
 */
export interface PortalMessageQuery {
  tenantId?: number
  status?: string
  keyword?: string
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

// 分页结果
export interface PageResult<T> {
  records: T[]
  total: number
  page: number
  size: number
  pages: number
}
