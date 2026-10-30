// 计费系统 API
import http from './http'
import type {
  Invoice,
  InvoiceCreatePayload,
  InvoiceStatistics,
  Payment,
  Transaction,
  AccountBalance,
  ConsumptionStats,
  RechargePackage,
  InvoiceInfo,
  InvoiceQuery,
  PaymentQuery,
  TransactionQuery,
  PageResult,
} from '../types/billing'
import type { EmptyCauseFields } from '../types/emptyResult'

// 账单 API
export const invoiceApi = {
  // 获取账单列表（M-P97：回包多了 emptyReason/emptyLine 两格，说明这一页为什么是空的）
  list: (params: InvoiceQuery) =>
    http.get<PageResult<Invoice> & EmptyCauseFields>('/billing/invoices', { params }),

  // 获取账单详情
  get: (id: number) =>
    http.get<Invoice>(`/billing/invoices/${id}`),

  // 获取账单详情（含明细项）
  getDetail: (id: number) =>
    http.get<{ invoice: any; items: any[] }>(`/billing/invoices/${id}/detail`),

  // 创建账单：写口吃的是实体那几列（totalAmount / invoiceType / taxNo / contactEmail），
  // 不是界面以前自造的 amount / type / taxNumber / email —— 那四个键后端一个都不认，整段丢掉
  create: (data: InvoiceCreatePayload) =>
    http.post<Invoice>('/billing/invoices', data),

  // 账单统计：全量的份数与金额（界面上那四张卡以前拿本页十条求和冒充总额）
  statistics: (params: { tenantId: number; startDate?: string; endDate?: string }) =>
    http.get<InvoiceStatistics>('/billing/invoices/statistics', { params }),

  // 支付账单
  pay: (id: number, data?: { paymentMethod?: string }) =>
    http.post(`/billing/invoices/${id}/pay`, data),

  // 导出发票列表
  export: (params: { tenantId: number; status?: string; paymentStatus?: string; startDate?: string; endDate?: string; keyword?: string }) =>
    http.get('/billing/invoices/export', {
      params,
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
  // 获取消费总览
  overview: (tenantId: number) =>
    http.get<any>('/billing/stats/overview', { params: { tenantId } }),

  /**
   * 消费统计。
   *
   * 以前这里还发 `periodType`/`startDate`/`endDate` 三格，而 `/billing/stats` 的口上只有 `tenantId`
   * 一个参数（现测 2026-10-30：这三格出现在 URL 里，后端一个字不消费，带与不带回的是同一份数）。
   * 发出去没人接，比根本没有这三个参数更坏：看代码的人以为这一屏能按周期筛。所以删掉。
   * 要真按周期统计得先立口径（哪张表、跨月流水算哪个月），那是新功能不是修缺陷。
   */
  getStats: (tenantId: number) =>
    http.get<ConsumptionStats>('/billing/stats', { params: { tenantId } }),

  // 获取消费趋势
  getTrend: (tenantId: number, days: number = 30) =>
    http.get<{ date: string; amount: number }[]>('/billing/stats/trend', {
      params: { tenantId, days },
    }),

  // 获取消费构成（同 getStats：这一口只认 tenantId，日期参数已按后端删掉）
  getBreakdown: (tenantId: number) =>
    http.get<{ productType: string; productName: string; amount: number; percentage: number | null }[]>(
      '/billing/stats/breakdown',
      { params: { tenantId } }
    ),

  // 获取月度消费对比
  getMonthlyCompare: (tenantId: number, months: number = 6) =>
    http.get<{ months: string[]; currentYear: number[]; lastYear: number[] }>(
      '/billing/stats/monthly-compare',
      { params: { tenantId, months } }
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
  // 获取可用支付方式（后端 BillingPaymentMethodController 回的是 code/name/icon/enabled，
  // 以前这里声明成 type，照着它写的消费者会拿到 undefined）
  list: (tenantId: number) =>
    http.get<{ code: string; name: string; icon: string; enabled: boolean }[]>('/billing/payment-methods', {
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

// 订单 API
export const orderApi = {
  // 获取订单列表
  list: (params: { tenantId: number; status?: string; keyword?: string; page?: number; size?: number; startDate?: string; endDate?: string }) =>
    http.get<PageResult<any>>('/billing/orders', { params }),

  // 获取订单详情
  get: (id: number) =>
    http.get<any>(`/billing/orders/${id}`),

  // 导出订单
  export: (params: { tenantId: number; status?: string; startDate?: string; endDate?: string }) =>
    http.get('/billing/orders/export', {
      params,
      responseType: 'blob',
    }),
}

// 钱包 API
export const walletApi = {
  // 获取钱包信息
  getInfo: (tenantId: number) =>
    http.get<any>('/billing/wallet/info', { params: { tenantId } }),

  // 获取交易记录（M-P90：回包多了 emptyReason/emptyLine 两格，说明这一页为什么是空的）
  getTransactions: (params: { tenantId: number; type?: string; startDate?: string; endDate?: string; keyword?: string; page?: number; size?: number }) =>
    http.get<PageResult<any> & EmptyCauseFields>('/billing/transactions', { params }),

  // 充值
  recharge: (tenantId: number, amount: number, paymentMethod: string) =>
    http.post<any>('/billing/wallet/recharge', { tenantId, amount, paymentMethod }),

  // 导出交易记录
  exportTransactions: (params: any) =>
    http.get('/billing/transactions/export', { params, responseType: 'blob' }),
}

// 客户管理 API
export const customerApi = {
  // 获取客户列表（M-P89：回包多了 emptyReason/emptyLine 两格，说明这一页为什么是空的）
  list: (params: { tenantId: number; status?: string; keyword?: string; page?: number; size?: number }) =>
    http.get<PageResult<any> & EmptyCauseFields>('/billing/customers', { params }),

  // 获取客户详情
  get: (id: number) =>
    http.get<any>(`/billing/customers/${id}`),

  // 创建客户
  create: (data: any) =>
    http.post<any>('/billing/customers', data),

  // 更新客户
  update: (id: number, data: any) =>
    http.put<any>(`/billing/customers/${id}`, data),

  // 删除客户
  delete: (id: number) =>
    http.delete(`/billing/customers/${id}`),

  // 启用/禁用客户
  toggleStatus: (id: number, status: string) =>
    http.patch(`/billing/customers/${id}/status`, { status }),
}

// 热门服务 API
export const topServicesApi = {
  // 获取热门服务列表
  getTopServices: (tenantId: number) =>
    http.get<any[]>('/billing/top-services', { params: { tenantId } }),
}
