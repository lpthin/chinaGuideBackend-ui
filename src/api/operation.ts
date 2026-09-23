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

  // 获取流量趋势
  getTrafficTrend: (tenantId: number, days: number = 7) =>
    http.get<TrafficTrendItem[]>('/operation/traffic/trend', { params: { tenantId, days } }),

  // 获取分类分布
  getCategoryDistribution: (tenantId: number) =>
    http.get<CategoryDistributionItem[]>('/operation/category/distribution', { params: { tenantId } }),

  // 获取用户统计
  getUserStats: (tenantId: number) =>
    http.get<UserStats>('/operation/user/stats', { params: { tenantId } }),

  // 获取用户增长
  getUserGrowth: (tenantId: number, months: number = 6) =>
    http.get<UserGrowthItem[]>('/operation/user/growth', { params: { tenantId, months } }),

  // 获取用户活跃度
  getUserActivity: (tenantId: number) =>
    http.get<UserActivityItem[]>('/operation/user/activity', { params: { tenantId } }),

  // 获取流量来源
  getTrafficSource: (tenantId: number) =>
    http.get<TrafficSourceItem[]>('/operation/traffic/source', { params: { tenantId } }),

  // 获取设备分布
  getDeviceDistribution: (tenantId: number) =>
    http.get<DeviceDistributionItem[]>('/operation/device/distribution', { params: { tenantId } }),

  // 获取运营看板总览
  getDashboard: (tenantId: number) =>
    http.get<{
      today: { views: number; articles: number; activeUsers: number }
      weeklyTrend: TrafficTrendItem[]
      keyMetrics: {
        totalArticles: number
        totalViews: number
        totalComments: number
        totalLikes: number
        totalUsers: number
      }
    }>('/operation/dashboard', { params: { tenantId } }),

  // 导出统计报表
  exportStats: (tenantId: number, type: 'article' | 'traffic' | 'user' = 'article', format: 'excel' | 'csv' = 'excel') =>
    http.get('/operation/stats/export', {
      params: { tenantId, type, format },
      responseType: 'blob'
    })
}

export default {
  customerCase: customerCaseApi,
  dataReport: dataReportApi,
  operation: operationApi
}
