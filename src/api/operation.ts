// 运营管理模块 API
import http from './http'
import type {
  CustomerCase,
  DataReport,
  CustomerCaseQuery,
  DataReportQuery,
  CustomerCaseForm,
  DataReportForm,
  PageResult,
  OperationStats,
  OperationDashboard,
  TrafficTrendItem,
  CategoryDistributionItem,
  UserStats,
  UserGrowthItem,
  UserActivityItem,
  TrafficSourceItem,
  DeviceDistributionItem
} from '../types/operation'

// 客户案例服务端统计（GET /operation/cases/statistics）
export interface CustomerCaseStatistics {
  total: number
  published: number
  draft: number
  totalViews: number
  industryCount: number
}

/**
 * 案例 AI 起草的预估（这一发一次模型都不调，只拼提示词）。
 * 三个 AI 出口（组装 / 巡检 / 案例）在这一步的形状是同一个：预计消耗 + 剩余 + 开关 + 一句人话。
 */
export interface CaseDraftEstimate {
  caseId: number
  estimatedTokens: number
  remainingTokens: number
  /** 后端总开关。关掉时界面上说清楚「确认了也不会调用」，而不是让人点了才知道 */
  aiDraftEnabled: boolean
  notice: string | null
  /**
   * 这一个数是怎么量出来的（后端 `TokenYardstick` 一处给）：字数除以 4 的下界，不是账单。
   * 与 `notice` 分两格：`notice` 非空 = 这一轮不受理。
   */
  tokenBasis?: string | null
}

/** 出稿结果：case 是写库之后的那一行，界面直接拿它覆盖自己，不自己拼一份 */
export interface CaseDraftResult {
  case: CustomerCase
  /** 门禁 4 的提示（疑似照抄参考站、外链素材）。warn 档不拦，但必须让人看见 */
  warnings: string[]
  attempts: number
  /** 这一版的留档行 id，也就是账单上那笔扣费的 bizId */
  draftId: number
  tokensCharged: number
}

// 客户案例 API
export const customerCaseApi = {
  // 获取案例列表
  list: (params: CustomerCaseQuery) =>
    http.get<PageResult<CustomerCase>>('/operation/cases', { params }),

  // 获取全量统计（非当前页汇总）
  statistics: (tenantId?: number | null) =>
    http.get<CustomerCaseStatistics>('/operation/cases/statistics', {
      params: tenantId ? { tenantId } : {}
    }),

  // 获取案例详情
  get: (id: number) =>
    http.get<CustomerCase>(`/operation/cases/${id}`),

  // 创建案例
  create: (data: CustomerCaseForm) =>
    http.post<CustomerCase>('/operation/cases', data),

  // 更新案例
  update: (id: number, data: CustomerCaseForm) =>
    http.put<CustomerCase>(`/operation/cases/${id}`, data),

  // 删除案例
  delete: (id: number) =>
    http.delete(`/operation/cases/${id}`),

  // 批量删除
  batchDelete: (ids: number[]) =>
    http.delete('/operation/cases/batch', { data: ids }),

  /**
   * AI 起草的预估：一次模型都不调，只把提示词拼起来量一下规模。
   * 用 GET 而不是那五条 estimate 的 POST——这一发真的什么都不改。
   */
  estimateAiDraft: (id: number) =>
    http.get<CaseDraftEstimate>(`/operation/cases/${id}/ai-draft/estimate`),

  /**
   * 让 AI 重写这一条案例（问题四「稿子全部交给 AI」在案例这一路的落点）。
   * confirm 必须由界面上的勾选传进来：缺了后端直接拒，不会因为请求体恰好为空而默默花租户的钱。
   * 被门禁拦下的那些轮一次都不扣，所以这里也不需要「失败回滚」的兜底。
   */
  aiDraft: (id: number, confirm: boolean, instruction?: string) =>
    http.post<CaseDraftResult>(`/operation/cases/${id}/ai-draft`, { confirm, instruction })
}

// 数据报表 API
export const dataReportApi = {
  // 获取报表列表
  list: (params: DataReportQuery) =>
    http.get<PageResult<DataReport>>('/operation/reports', { params }),

  // 获取最新报表
  latest: (tenantId: number, limit: number = 5) =>
    http.get<DataReport[]>('/operation/reports/latest', { params: { tenantId, limit } }),

  // 获取报表详情
  get: (id: number) =>
    http.get<DataReport>(`/operation/reports/${id}`),

  // 创建报表
  create: (data: DataReportForm) =>
    http.post<DataReport>('/operation/reports', data),

  // 导出报表
  export: (id: number, format: 'excel' | 'pdf' = 'excel') =>
    http.get(`/operation/reports/${id}/export`, {
      params: { format },
      responseType: 'blob'
    }),

  // 删除报表
  delete: (id: number) =>
    http.delete(`/operation/reports/${id}`),

  // 批量删除
  batchDelete: (ids: number[]) =>
    http.delete('/operation/reports/batch', { data: ids })
}

// 运营统计 API
export const operationApi = {
  // 获取基础统计数据
  getStats: (tenantId: number, startDate?: string, endDate?: string) =>
    http.get<OperationStats>('/operation/stats', { params: { tenantId, startDate, endDate } }),

  // 获取流量趋势（给了日期区间时后端按区间出桶，days 只在没选区间的兜底场景生效）
  getTrafficTrend: (tenantId: number, days: number = 7, startDate?: string, endDate?: string) =>
    http.get<TrafficTrendItem[]>('/operation/traffic/trend', {
      params: { tenantId, days, startDate, endDate }
    }),

  // 获取分类分布
  getCategoryDistribution: (tenantId: number, startDate?: string, endDate?: string) =>
    http.get<CategoryDistributionItem[]>('/operation/category/distribution', {
      params: { tenantId, startDate, endDate }
    }),

  // 获取用户统计
  getUserStats: (tenantId: number) =>
    http.get<UserStats>('/operation/user/stats', { params: { tenantId } }),

  // 获取用户增长
  getUserGrowth: (tenantId: number, months: number = 6, startDate?: string, endDate?: string) =>
    http.get<UserGrowthItem[]>('/operation/user/growth', {
      params: { tenantId, months, startDate, endDate }
    }),

  // 获取用户活跃度
  getUserActivity: (tenantId: number, startDate?: string, endDate?: string) =>
    http.get<UserActivityItem[]>('/operation/user/activity', {
      params: { tenantId, startDate, endDate }
    }),

  // 获取流量来源
  getTrafficSource: (tenantId: number, startDate?: string, endDate?: string) =>
    http.get<TrafficSourceItem[]>('/operation/traffic/source', {
      params: { tenantId, startDate, endDate }
    }),

  // 获取设备分布
  getDeviceDistribution: (tenantId: number, startDate?: string, endDate?: string) =>
    http.get<DeviceDistributionItem[]>('/operation/device/distribution', {
      params: { tenantId, startDate, endDate }
    }),

  // 获取运营看板总览（读不到那一家时带 tenantUnreadable + 成因）
  getDashboard: (tenantId: number) =>
    http.get<OperationDashboard>('/operation/dashboard', { params: { tenantId } }),

  /**
   * 导出统计报表。后端回的一律是 CSV 文件（带 BOM、附件头）。
   * 参数不对（比如不认识的导出内容）时后端回的是 <b>JSON</b> 错误包而不是文件，
   * 所以调用方必须看 responseType:'blob' 拿到的载荷形状再决定是存文件还是报错。
   */
  exportStats: (
    tenantId: number,
    type: 'article' | 'knowledge' | 'user' | 'traffic' = 'article',
    startDate?: string,
    endDate?: string
  ) =>
    http.get('/operation/stats/export', {
      params: { tenantId, type, startDate, endDate },
      responseType: 'blob'
    })
}

export default {
  customerCase: customerCaseApi,
  dataReport: dataReportApi,
  operation: operationApi
}
