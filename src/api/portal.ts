// 门户网站模块 API
import http from './http'
import type {
  PortalTemplate,
  PortalTemplateForm,
  PortalTemplateQuery,
  Banner,
  JobPost,
  JobApplication,
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

  // 批量删除
  batchDelete: (ids: number[]) =>
    http.delete('/portal/banners/batch', { data: ids })
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

  // 批量删除
  batchDelete: (ids: number[]) =>
    http.delete('/portal/jobs/batch', { data: ids })
}

// 职位申请 API
export const jobApplicationApi = {
  // 获取申请列表
  list: (tenantId: number, params?: { page?: number; size?: number; status?: string }) =>
    http.get<PageResult<JobApplication>>('/portal/job-applications', { params: { tenantId, ...params } }),

  // 获取职位的申请列表
  getByJobId: (jobId: number, params?: { page?: number; size?: number }) =>
    http.get<PageResult<JobApplication>>(`/portal/job-applications/job/${jobId}`, { params }),

  // 获取申请详情
  get: (id: number) =>
    http.get<JobApplication>(`/portal/job-applications/${id}`),

  // 提交申请
  submit: (data: Partial<JobApplication>) =>
    http.post<JobApplication>('/portal/job-applications', data),

  // 更新申请状态
  updateStatus: (id: number, status: string, remark?: string) =>
    http.put<JobApplication>(`/portal/job-applications/${id}/status`, { status, remark }),

  // 删除申请
  delete: (id: number) =>
    http.delete(`/portal/job-applications/${id}`)
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

  // 获取未读消息数
  unreadCount: (receiverId: number) =>
    http.get<{ count: number }>('/messages/unread-count', { params: { receiverId } }),

  // 获取消息详情
  get: (id: number) =>
    http.get<PortalMessage>(`/messages/${id}`),

  // 发送消息
  send: (data: { tenantId: number; receiverId: number; title: string; content: string }) =>
    http.post<PortalMessage>('/messages', data),

  // 标记已读
  markRead: (id: number) =>
    http.put(`/messages/${id}/read`),

  // 批量标记已读
  batchMarkRead: (ids: number[]) =>
    http.put('/messages/batch-read', { ids }),

  // 删除消息
  delete: (id: number) =>
    http.delete(`/messages/${id}`),

  // 批量删除
  batchDelete: (ids: number[]) =>
    http.delete('/messages/batch', { data: ids })
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

  // 回复留言
  reply: (id: number, reply: string) =>
    http.put<Guestbook>(`/guestbook/${id}/reply`, { reply }),

  // 审核通过
  approve: (id: number) =>
    http.put<Guestbook>(`/guestbook/${id}/approve`),

  // 删除留言
  delete: (id: number) =>
    http.delete(`/guestbook/${id}`),

  // 批量删除
  batchDelete: (ids: number[]) =>
    http.delete('/guestbook/batch', { data: ids })
}

// 企业信息 API
export const companyInfoApi = {
  get: () =>
    http.get<CompanyInfo>('/company/info'),

  update: (data: CompanyInfoForm) =>
    http.put<CompanyInfo>('/company/info', data)
}

// SEO配置 API
export const seoConfigApi = {
  // 获取SEO配置列表
  list: (tenantId: number) =>
    http.get<SeoConfig[]>('/portal/seo', { params: { tenantId } }),

  // 获取页面SEO配置
  getByPageKey: (tenantId: number, pageKey: string) =>
    http.get<SeoConfig>('/portal/seo/page', { params: { tenantId, pageKey } }),

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

// 门户模板 API
export const portalTemplateApi = {
  // 获取模板列表
  list: (params: PortalTemplateQuery) =>
    http.get<PageResult<PortalTemplate>>('/portal/templates', { params }),

  // 获取系统预设模板
  systemTemplates: () =>
    http.get<PortalTemplate[]>('/portal/templates/system'),

  // 获取模板详情
  get: (id: number) =>
    http.get<PortalTemplate>(`/portal/templates/${id}`),

  // 创建自定义模板
  create: (data: PortalTemplateForm) =>
    http.post<PortalTemplate>('/portal/templates', data),

  // 更新模板
  update: (id: number, data: PortalTemplateForm) =>
    http.put<PortalTemplate>(`/portal/templates/${id}`, data),

  // 删除模板
  delete: (id: number) =>
    http.delete(`/portal/templates/${id}`),

  // 复制模板
  copy: (id: number) =>
    http.post<PortalTemplate>(`/portal/templates/${id}/copy`),

  // 应用模板到租户
  apply: (id: number, tenantId: number) =>
    http.post(`/portal/templates/${id}/apply`, { tenantId }),

  // 获取租户当前使用的模板
  getCurrentTemplate: (tenantId: number) =>
    http.get<PortalTemplate>('/portal/templates/current', { params: { tenantId } }),

  // 预览模板
  preview: (id: number, config?: Partial<PortalTemplateForm>) =>
    http.post<string>(`/portal/templates/${id}/preview`, config)
}

export default {
  template: portalTemplateApi,
  banner: bannerApi,
  jobPost: jobPostApi,
  jobApplication: jobApplicationApi,
  message: portalMessageApi,
  guestbook: guestbookApi,
  companyInfo: companyInfoApi,
  seoConfig: seoConfigApi
}
