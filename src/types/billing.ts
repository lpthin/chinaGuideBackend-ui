// 计费系统类型定义
// 支付方式这一族的大写代码与中文念法只有一张表：src/utils/paymentMethod.ts
import type { PaymentMethodCode } from '../utils/paymentMethod'
import type { EmptyReason } from '../utils/emptyPage'

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

// 支付方式：库里那一列存的是大写代码（WECHAT/ALIPAY/BANK_TRANSFER/CREDIT_CARD/BALANCE），
// 代码清单与中文念法都在 src/utils/paymentMethod.ts，这里只给它起个别名，不再抄第二份名单
//（以前这里是小写枚举，界面拿它去比库里的大写代码，比不中）
export type PaymentMethod = PaymentMethodCode

// 支付状态
export enum PaymentStatus {
  PENDING = 'pending',
  SUCCESS = 'success',
  FAILED = 'failed',
  REFUNDED = 'refunded',
  PARTIAL_REFUND = 'partial_refund',
}

// 交易类型：与 billing_transaction.type 那一列的真值同名（后端 BillingTransactionTypes）
// 界面念法见 WalletView 里那张词表；以前这里是 charge/withdraw，库里一个大写都没有，等于一张没人对过的名单
export enum TransactionType {
  RECHARGE = 'RECHARGE',
  CONSUME = 'CONSUME',
  REFUND = 'REFUND',
  TRANSFER = 'TRANSFER',
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
  // 库里那一列的原始代码；写这一列只用词表里的代码，读的时候词表认不出就原样摆出来，不编名字
  paymentMethod?: string
  paymentTransactionId?: string
  remark?: string
  invoiceUrl?: string
  discountAmount?: number
  // 下面四格是库里那四列本来的名字（invoice_type / tax_no / contact_email / unpaid_amount）。
  // 以前这里写的是界面自造的 type / taxNumber / email，读口根本不投影这些键，
  // 于是「税号」列恒空、「个人/企业」每行硬念一个，写回去时后端一个键也不认。
  invoiceType?: string
  taxNo?: string
  contactEmail?: string
  unpaidAmount?: number
  totalAmount?: number
  billingDate?: string
  paymentStatus?: string
  createdAt: string
  updatedAt: string
  items?: InvoiceItem[]
}

/**
 * 申请开票那一发的载荷：键名必须是后端实体自己那几列。
 * 写成 amount/type/taxNumber/email 时 Spring 会静默丢掉不认识的键，
 * 界面念「开票申请已提交」，库里落一条金额、税号、类型、邮箱全空的行。
 */
export interface InvoiceCreatePayload {
  tenantId: number
  title: string
  invoiceType?: string
  taxNo?: string
  totalAmount: number
  contactEmail?: string
  remark?: string
}

/** 账单统计口：全量的份数与金额，不是本页十条求和 */
export interface InvoiceStatistics {
  totalCount: number
  paidCount: number
  unpaidCount: number
  totalAmount: number
  paidAmount: number
  unpaidAmount: number
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
  // 这里以前有一格 creditLimit?: number：后端那一格是写死的 50000.00，billing_wallet 表里没有 credit_limit 这一列
  // （M-P91 拍板 2 已把那一格从后端读口摘掉，类型里也不留，免得又有人接它）
  totalIncome: number
  totalExpense: number
  lastSettlementDate?: string
  nextSettlementDate?: string
  createdAt: string
  updatedAt: string
}

/**
 * `GET /api/billing/stats` 现测回包（2026-10-30）的那十格，多一格不写。
 *
 * 以前这一份类型里写着 `totalAmount`／`period`／`periodType`／`breakdown`／`dailyData`／
 * `comparison`／`topServices`——后端一个字都没回过，界面上也没有一行读它们。类型编得比接口全，
 * 下一个接这一屏的人就会去读一个永远是 undefined 的格子，再把它当 0 摆出去。
 */
export interface ConsumptionStats {
  balance: number
  totalIncome: number
  totalExpense: number
  thisMonthExpense: number
  lastMonthExpense: number
  /**
   * 环比涨跌百分比。上月一分钱没花就没有分母，这个数不存在，后端回 null（以前它写死 100）。
   * 界面此时念「上月没有消费，比不出涨跌」，不许摆 0% 或 +100%。
   */
  monthOverMonthGrowth: number | null
  pendingInvoices: number
  pendingAmount: number
  lastMonthInvoices: number
  /** 「这一家在这个库里没有身份」，与「这一家这个月没花钱」是两件事 */
  tenantUnreadable: boolean
  /** 只在读不到时才有；成因的唯一出处是后端 `EmptyResultReasons`，界面不另编一句 */
  emptyReason?: EmptyReason
  emptyLine?: string
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
