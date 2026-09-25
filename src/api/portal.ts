// 门户网站模块 API
import http from './http'
import type {
  Banner,
  JobPost,
  PortalMessage,
  PortalMessageStats,
  PortalMessageBroadcast,
  Guestbook,
  CompanyInfo,
  SeoConfig,
  BannerQuery,
  JobPostQuery,
  PortalMessageQuery,
  GuestbookQuery,
  BannerForm,
  JobPostForm,
  GuestbookReply,
  CompanyInfoForm,
  SeoConfigForm,
  PageResult
} from '../types/portal'

// Banner API
export const bannerApi = {
  // 获取Banner列表
  list: (params: BannerQuery) =>
    http.get<PageResult<Banner>>('/portal/banners', { params }),

  // 获取Banner详情
  get: (id: number) =>
    http.get<Banner>(`/portal/banners/${id}`),

  // 创建Banner
  create: (data: BannerForm) =>
    http.post<Banner>('/portal/banners', data),

  // 更新Banner
  update: (id: number, data: BannerForm) =>
    http.put<Banner>(`/portal/banners/${id}`, data),

  // 删除Banner
  delete: (id: number) =>
    http.delete(`/portal/banners/${id}`),

  // 上架/下架：门户只渲染 ENABLED 的 Banner，状态只能走这两个动作
  enable: (id: number) =>
    http.post<Banner>(`/portal/banners/${id}/enable`),

  disable: (id: number) =>
    http.post<Banner>(`/portal/banners/${id}/disable`)
}

// 职位管理 API
export const jobPostApi = {
  // 获取职位列表
  list: (params: JobPostQuery) =>
    http.get<PageResult<JobPost>>('/portal/jobs', { params }),

  // 获取职位详情
  get: (id: number) =>
    http.get<JobPost>(`/portal/jobs/${id}`),

  // 创建职位
  create: (data: JobPostForm) =>
    http.post<JobPost>('/portal/jobs', data),

  // 更新职位
  update: (id: number, data: JobPostForm) =>
    http.put<JobPost>(`/portal/jobs/${id}`, data),

  // 删除职位
  delete: (id: number) =>
    http.delete(`/portal/jobs/${id}`),

  // 上架/下架：门户招聘页只列 OPEN 职位
  publish: (id: number) =>
    http.post<JobPost>(`/portal/jobs/${id}/publish`),

  close: (id: number) =>
    http.post<JobPost>(`/portal/jobs/${id}/close`)
}

// 站内信 API
export const portalMessageApi = {
  // 获取消息列表（收件箱）
  list: (params: PortalMessageQuery) =>
    http.get<PageResult<PortalMessage>>('/messages', { params }),

  // 获取消息统计
  stats: () =>
    http.get<PortalMessageStats>('/messages/stats'),

  // 获取发件箱列表
  outbox: (params: PortalMessageQuery) =>
    http.get<PageResult<PortalMessage>>('/messages/outbox', { params }),

  // 广播发送消息
  broadcast: (data: PortalMessageBroadcast) =>
    http.post<{ count: number }>('/messages/broadcast', data),

  // 获取消息详情
  get: (id: number) =>
    http.get<PortalMessage>(`/messages/${id}`),

  // 发送消息
  send: (data: { tenantId: number; receiverId: number; title: string; content: string }) =>
    http.post<PortalMessage>('/messages', data),

  // 标记已读
  markRead: (id: number) =>
    http.put(`/messages/${id}/read`),

  // 删除消息
  delete: (id: number) =>
    http.delete(`/messages/${id}`)
}

// 留言板 API
export const guestbookApi = {
  // 获取留言列表
  list: (params: GuestbookQuery) =>
    http.get<PageResult<Guestbook>>('/guestbook', { params }),

  // 获取留言详情
  get: (id: number) =>
    http.get<Guestbook>(`/guestbook/${id}`),

  // 提交留言
  submit: (data: Partial<Guestbook>) =>
    http.post<Guestbook>('/guestbook', data),

  /** 留言种类的中文标签（普通留言 / 留资线索）。列表页那个徽标只有这一个来源 */
  types: () =>
    http.get<Record<string, string>>('/guestbook/types'),

  // 回复留言
  reply: (id: number, replyContent: string, replierName?: string) =>
    http.put<Guestbook>(`/guestbook/${id}/reply`, { replyContent, replierName }),

  // 删除留言
  delete: (id: number) =>
    http.delete(`/guestbook/${id}`)
}

// 企业信息 API
export const companyInfoApi = {
  get: (tenantId?: number | null) =>
    http.get<CompanyInfo>('/company/info', { params: tenantId ? { tenantId } : {} }),

  update: (data: CompanyInfoForm, tenantId?: number | null) =>
    http.put<CompanyInfo>('/company/info', data, { params: tenantId ? { tenantId } : {} }),

  // 品牌标识图片上传，返回 { url }
  uploadImage: (kind: 'logo' | 'favicon' | 'certificate', file: File, tenantId?: number | null) => {
    const formData = new FormData()
    formData.append('file', file)
    return http.post<{ url: string }>(`/company/${kind}`, formData, {
      params: tenantId ? { tenantId } : {},
      headers: { 'Content-Type': 'multipart/form-data' }
    })
  }
}

// SEO配置 API
export const seoConfigApi = {
  // 获取SEO配置列表
  list: (params: { tenantId?: number; siteId?: number; pageType?: string; keyword?: string } = {}) =>
    http.get<SeoConfig[]>('/portal/seo', { params }),

  // 获取SEO配置详情
  get: (id: number) =>
    http.get<SeoConfig>(`/portal/seo/${id}`),

  // 创建SEO配置
  create: (data: SeoConfigForm) =>
    http.post<SeoConfig>('/portal/seo', data),

  // 更新SEO配置
  update: (id: number, data: SeoConfigForm) =>
    http.put<SeoConfig>(`/portal/seo/${id}`, data),

  // 删除SEO配置
  delete: (id: number) =>
    http.delete(`/portal/seo/${id}`)
}


export default {
  banner: bannerApi,
  jobPost: jobPostApi,
  message: portalMessageApi,
  guestbook: guestbookApi,
  companyInfo: companyInfoApi,
  seoConfig: seoConfigApi
}
