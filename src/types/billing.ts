// 计费系统类型定义

// 货币类型
export enum Currency {
  CNY = 'CNY',
  USD = 'USD',
  EUR = 'EUR',
}

// 账单状态
export enum InvoiceStatus {
  DRAFT = 'draft',
  PENDING = 'pending',
  PAID = 'paid',
  OVERDUE = 'overdue',
  CANCELLED = 'cancelled',
  REFUNDED = 'refunded',
}

// 支付方式
export enum PaymentMethod {
  ALIPAY = 'alipay',
  WECHAT = 'wechat',
  BANK_TRANSFER = 'bank_transfer',
  CREDIT_CARD = 'credit_card',
  BALANCE = 'balance',
}

// 支付状态
export enum PaymentStatus {
  PENDING = 'pending',
  SUCCESS = 'success',
  FAILED = 'failed',
  REFUNDED = 'refunded',
  PARTIAL_REFUND = 'partial_refund',
}

// 交易类型
export enum TransactionType {
  CHARGE = 'charge',
  REFUND = 'refund',
  TRANSFER = 'transfer',
  WITHDRAW = 'withdraw',
  RECHARGE = 'recharge',
}

// 账单周期
export enum BillingCycle {
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
  YEARLY = 'yearly',
  ONCE = 'once',
}

// 产品类型
export enum ProductType {
  AI_MODEL = 'ai_model',
  STORAGE = 'storage',
  BANDWIDTH = 'bandwidth',
  API_CALL = 'api_call',
  SUBSCRIPTION = 'subscription',
  CONSULTING = 'consulting',
}

// 账单
export interface Invoice {
  id: number
  tenantId: number
  invoiceNo: string
  title: string
  amount: number
  currency: Currency
  status: InvoiceStatus
  billingCycle?: BillingCycle
  billingStartDate?: string
  billingEndDate?: string
  dueDate?: string
  paidAt?: string
  paidAmount?: number
  paymentMethod?: PaymentMethod
  paymentTransactionId?: string
  remark?: string
  invoiceUrl?: string
  discountAmount?: number
  type?: string
  taxNumber?: string
  email?: string
  createdAt: string
  updatedAt: string
  items?: InvoiceItem[]
}

// 账单项目
export interface InvoiceItem {
  id: number
  invoiceId: number
  productType: ProductType
  productName: string
  description?: string
  quantity: number
  unitPrice: number
  amount: number
  currency: Currency
  startTime?: string
  endTime?: string
  metadata?: Record<string, any>
}

// 支付记录
export interface Payment {
  id: number
  tenantId: number
  invoiceId?: number
  transactionNo: string
  amount: number
  currency: Currency
  paymentMethod: PaymentMethod
  status: PaymentStatus
  paidAt?: string
  refundAmount?: number
  refundAt?: string
  remark?: string
  metadata?: Record<string, any>
  createdAt: string
  updatedAt: string
}

// 交易记录
export interface Transaction {
  id: number
  tenantId: number
  transactionNo: string
  type: TransactionType
  amount: number
  currency: Currency
  balanceBefore: number
  balanceAfter: number
  relatedId?: number
  relatedType?: string
  description?: string
  remark?: string
  createdAt: string
}

// 账户余额
export interface AccountBalance {
  id: number
  tenantId: number
  balance: number
  frozenBalance: number
  availableBalance: number
  currency: Currency
  creditLimit?: number
  totalIncome: number
  totalExpense: number
  lastSettlementDate?: string
  nextSettlementDate?: string
  createdAt: string
  updatedAt: string
}

// 消费统计
export interface ConsumptionStats {
  tenantId: number
  totalAmount: number
  currency: Currency
  period: string
  periodType: 'day' | 'week' | 'month' | 'year'
  thisMonthExpense?: number
  lastMonthExpense?: number
  monthOverMonthGrowth?: number
  breakdown: {
    productType: ProductType
    productName: string
    amount: number
    percentage: number
  }[]
  dailyData: {
    date: string
    amount: number
  }[]
  comparison: {
    lastPeriodAmount: number
    growthRate: number
    growthAmount: number
  }
  topServices: {
    name: string
    amount: number
    usage: number
    unit: string
  }[]
}

// 充值套餐
export interface RechargePackage {
  id: number
  name: string
  description?: string
  originalAmount: number
  discountAmount: number
  bonusAmount: number
  totalAmount: number
  currency: Currency
  isPopular: boolean
  isRecommended: boolean
  validDays?: number
  sort: number
  status: string
  createdAt: string
}

// 发票信息
export interface InvoiceInfo {
  id: number
  tenantId: number
  type: 'personal' | 'company'
  title: string
  taxNumber?: string
  bankName?: string
  bankAccount?: string
  address?: string
  phone?: string
  email?: string
  receiverName?: string
  receiverPhone?: string
  receiverAddress?: string
  isDefault: boolean
  createdAt: string
  updatedAt: string
}

// 查询参数
export interface InvoiceQuery {
  tenantId: number
  status?: InvoiceStatus
  paymentMethod?: PaymentMethod
  startDate?: string
  endDate?: string
  keyword?: string
  page?: number
  size?: number
}

export interface PaymentQuery {
  tenantId: number
  status?: PaymentStatus
  paymentMethod?: PaymentMethod
  startDate?: string
  endDate?: string
  page?: number
  size?: number
}

export interface TransactionQuery {
  tenantId: number
  type?: TransactionType
  startDate?: string
  endDate?: string
  page?: number
  size?: number
}

// 分页结果
export interface PageResult<T> {
  records: T[]
  total: number
  page: number
  size: number
  pages: number
}
