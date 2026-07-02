// 运营管理模块 API
import http from './http'
import type {
  CustomerCase,
  DataReport,
  CustomerCaseQuery,
  DataReportQuery,
  CustomerCaseForm,
  DataReportForm,
  PageResult
} from '../types/operation'

// 客户案例 API
export const customerCaseApi = {
  // 获取案例列表
  list: (params: CustomerCaseQuery) =>
    http.get<PageResult<CustomerCase>>('/operation/cases', { params }),

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
    http.delete('/operation/cases/batch', { data: ids })
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

  // 生成报表（异步）
  generate: (data: DataReportForm) =>
    http.post<{ taskId: string }>('/operation/reports/generate', data),

  // 查询生成状态
  status: (taskId: string) =>
    http.get<{ status: string; progress: number; reportId?: number }>(`/operation/reports/status/${taskId}`),

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
export const operationStatsApi = {
  // 获取概览统计
  overview: (tenantId: number, startDate?: string, endDate?: string) =>
    http.get<{
      totalViews: number
      totalLikes: number
      totalShares: number
      totalArticles: number
      totalCases: number
      totalJobPosts: number
      newUsers: number
    }>('/operation/stats/overview', { params: { tenantId, startDate, endDate } }),

  // 获取趋势数据
  trend: (tenantId: number, days: number = 7, type: 'views' | 'likes' | 'shares' = 'views') =>
    http.get<{ date: string; value: number }[]>('/operation/stats/trend', { params: { tenantId, days, type } }),

  // 获取热门文章排行
  topArticles: (tenantId: number, limit: number = 10) =>
    http.get<{ id: number; title: string; views: number; likes: number; shares: number }[]>('/operation/stats/top-articles', { params: { tenantId, limit } }),

  // 获取热门案例排行
  topCases: (tenantId: number, limit: number = 10) =>
    http.get<{ id: number; title: string; views: number }[]>('/operation/stats/top-cases', { params: { tenantId, limit } })
}

export default {
  customerCase: customerCaseApi,
  dataReport: dataReportApi,
  stats: operationStatsApi
}
