// 计费系统 API
import http from './http'
import type {
  Invoice,
  Payment,
  Transaction,
  AccountBalance,
  ConsumptionStats,
  RechargePackage,
  InvoiceInfo,
  InvoiceQuery,
  PaymentQuery,
  TransactionQuery,
  InvoiceStatus,
  PageResult,
} from '../types/billing'

// 账单 API
export const invoiceApi = {
  // 获取账单列表
  list: (params: InvoiceQuery) =>
    http.get<PageResult<Invoice>>('/billing/invoices', { params }),

  // 获取账单详情
  get: (id: number) =>
    http.get<Invoice>(`/billing/invoices/${id}`),

  // 创建账单
  create: (data: Partial<Invoice>) =>
    http.post<Invoice>('/billing/invoices', data),

  // 更新账单
  update: (id: number, data: Partial<Invoice>) =>
    http.put<Invoice>(`/billing/invoices/${id}`, data),

  // 删除账单
  delete: (id: number) =>
    http.delete(`/billing/invoices/${id}`),

  // 批量删除
  batchDelete: (ids: number[]) =>
    http.delete('/billing/invoices/batch', { data: ids }),

  // 更新账单状态
  updateStatus: (id: number, status: InvoiceStatus) =>
    http.patch(`/billing/invoices/${id}/status`, { status }),

  // 发送账单
  send: (id: number, email?: string) =>
    http.post(`/billing/invoices/${id}/send`, { email }),

  // 下载账单
  download: (id: number) =>
    http.get(`/billing/invoices/${id}/download`, {
      responseType: 'blob',
    }),

  // 获取账单PDF
  getPdf: (id: number) =>
    http.get(`/billing/invoices/${id}/pdf`, {
      responseType: 'blob',
    }),
}

// 支付 API
export const paymentApi = {
  // 获取支付记录列表
  list: (params: PaymentQuery) =>
    http.get<PageResult<Payment>>('/billing/payments', { params }),

  // 获取支付详情
  get: (id: number) =>
    http.get<Payment>(`/billing/payments/${id}`),

  // 创建支付
  create: (data: Partial<Payment>) =>
    http.post<Payment>('/billing/payments', data),

  // 退款
  refund: (id: number, amount: number, reason?: string) =>
    http.post(`/billing/payments/${id}/refund`, { amount, reason }),

  // 取消支付
  cancel: (id: number) =>
    http.post(`/billing/payments/${id}/cancel`),
}

// 交易记录 API
export const transactionApi = {
  // 获取交易记录列表
  list: (params: TransactionQuery) =>
    http.get<PageResult<Transaction>>('/billing/transactions', { params }),

  // 获取交易详情
  get: (id: number) =>
    http.get<Transaction>(`/billing/transactions/${id}`),

  // 导出交易记录
  export: (params: TransactionQuery) =>
    http.get('/billing/transactions/export', {
      params,
      responseType: 'blob',
    }),
}

// 账户余额 API
export const balanceApi = {
  // 获取账户余额
  get: (tenantId: number) =>
    http.get<AccountBalance>('/billing/balance', { params: { tenantId } }),

  // 充值
  recharge: (tenantId: number, amount: number, packageId?: number) =>
    http.post<AccountBalance>('/billing/balance/recharge', {
      tenantId,
      amount,
      packageId,
    }),

  // 提现
  withdraw: (tenantId: number, amount: number, accountInfo: any) =>
    http.post<AccountBalance>('/billing/balance/withdraw', {
      tenantId,
      amount,
      accountInfo,
    }),

  // 转账
  transfer: (fromTenantId: number, toTenantId: number, amount: number, remark?: string) =>
    http.post<AccountBalance>('/billing/balance/transfer', {
      fromTenantId,
      toTenantId,
      amount,
      remark,
    }),
}

// 消费统计 API
export const statsApi = {
  // 获取消费统计
  getStats: (tenantId: number, periodType?: string, startDate?: string, endDate?: string) =>
    http.get<ConsumptionStats>('/billing/stats', {
      params: { tenantId, periodType, startDate, endDate },
    }),

  // 获取消费趋势
  getTrend: (tenantId: number, days: number = 30) =>
    http.get<{ date: string; amount: number }[]>('/billing/stats/trend', {
      params: { tenantId, days },
    }),

  // 获取消费构成
  getBreakdown: (tenantId: number, startDate?: string, endDate?: string) =>
    http.get<{ productType: string; productName: string; amount: number; percentage: number }[]>(
      '/billing/stats/breakdown',
      { params: { tenantId, startDate, endDate } }
    ),
}

// 充值套餐 API
export const packageApi = {
  // 获取套餐列表
  list: (tenantId: number) =>
    http.get<RechargePackage[]>('/billing/packages', { params: { tenantId } }),

  // 获取套餐详情
  get: (id: number) =>
    http.get<RechargePackage>(`/billing/packages/${id}`),

  // 创建套餐
  create: (data: Partial<RechargePackage>) =>
    http.post<RechargePackage>('/billing/packages', data),

  // 更新套餐
  update: (id: number, data: Partial<RechargePackage>) =>
    http.put<RechargePackage>(`/billing/packages/${id}`, data),

  // 删除套餐
  delete: (id: number) =>
    http.delete(`/billing/packages/${id}`),

  // 购买套餐
  purchase: (tenantId: number, packageId: number) =>
    http.post<AccountBalance>(`/billing/packages/${packageId}/purchase`, { tenantId }),
}

// 发票信息 API
export const invoiceInfoApi = {
  // 获取发票信息列表
  list: (tenantId: number) =>
    http.get<InvoiceInfo[]>('/billing/invoice-info', { params: { tenantId } }),

  // 获取发票信息详情
  get: (id: number) =>
    http.get<InvoiceInfo>(`/billing/invoice-info/${id}`),

  // 创建发票信息
  create: (data: Partial<InvoiceInfo>) =>
    http.post<InvoiceInfo>('/billing/invoice-info', data),

  // 更新发票信息
  update: (id: number, data: Partial<InvoiceInfo>) =>
    http.put<InvoiceInfo>(`/billing/invoice-info/${id}`, data),

  // 删除发票信息
  delete: (id: number) =>
    http.delete(`/billing/invoice-info/${id}`),

  // 设置默认
  setDefault: (id: number) =>
    http.post(`/billing/invoice-info/${id}/default`),
}

// 支付方式 API
export const paymentMethodApi = {
  // 获取可用支付方式
  list: (tenantId: number) =>
    http.get<{ type: string; name: string; icon: string; enabled: boolean }[]>('/billing/payment-methods', {
      params: { tenantId },
    }),

  // 创建支付订单
  createOrder: (tenantId: number, amount: number, method: string, returnUrl?: string) =>
    http.post<{ orderId: string; paymentUrl: string; qrCode?: string }>('/billing/payment-methods/order', {
      tenantId,
      amount,
      method,
      returnUrl,
    }),

  // 查询支付状态
  queryStatus: (orderId: string) =>
    http.get<{ status: string; paidAt?: string; transactionId?: string }>(`/billing/payment-methods/status/${orderId}`),
}
