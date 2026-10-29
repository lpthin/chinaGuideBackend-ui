// 账单状态词表的唯一出处：库里那两列（status / payment_status）折成人看的一档，
// 再加上这一档怎么念、什么颜色。以前费用页、账单详情、开票详情三处各抄了一份名单，
// 于是同一张账单在三屏能念出「待支付 / pending / ISSUED」三种说法。

import { InvoiceStatus } from '../types/billing'
import { PH_DASH } from './display'

/** billing_invoice.status（账单本身那一列） */
export const INVOICE_STATUS_CODES: Record<string, InvoiceStatus> = {
  DRAFT: InvoiceStatus.DRAFT,
  ISSUED: InvoiceStatus.PENDING,
  PENDING: InvoiceStatus.PENDING,
  PAID: InvoiceStatus.PAID,
  OVERDUE: InvoiceStatus.OVERDUE,
  CANCELLED: InvoiceStatus.CANCELLED,
  REFUNDED: InvoiceStatus.REFUNDED,
}

/** billing_invoice.payment_status（收款那一列）：付没付比账单状态更硬，先认它 */
export const PAYMENT_STATUS_TO_INVOICE: Record<string, InvoiceStatus> = {
  UNPAID: InvoiceStatus.PENDING,
  PARTIAL: InvoiceStatus.PENDING,
  PAID: InvoiceStatus.PAID,
}

/**
 * 读口的两种形状都走这里：列表口已经折过小写档（pending/paid…），
 * 详情口回的是库里那两列的原始大写代码（ISSUED/UNPAID…）。
 * 认不出来的一律落「待支付」以外不许编——留原样由 label 那一步兜。
 */
export function foldInvoiceStatus(status?: string, paymentStatus?: string): InvoiceStatus {
  const fromPayment = paymentStatus ? PAYMENT_STATUS_TO_INVOICE[paymentStatus.toUpperCase()] : undefined
  if (fromPayment) return fromPayment
  if (!status) return InvoiceStatus.PENDING
  const upper = status.toUpperCase()
  return INVOICE_STATUS_CODES[upper] || (status as InvoiceStatus)
}

const LABELS: Record<string, string> = {
  [InvoiceStatus.DRAFT]: '草稿',
  [InvoiceStatus.PENDING]: '待支付',
  [InvoiceStatus.PAID]: '已支付',
  [InvoiceStatus.OVERDUE]: '已逾期',
  [InvoiceStatus.CANCELLED]: '已取消',
  [InvoiceStatus.REFUNDED]: '已退款',
}

const COLORS: Record<string, string> = {
  [InvoiceStatus.DRAFT]: 'default',
  [InvoiceStatus.PENDING]: 'orange',
  [InvoiceStatus.PAID]: 'green',
  [InvoiceStatus.OVERDUE]: 'red',
  [InvoiceStatus.CANCELLED]: 'default',
  [InvoiceStatus.REFUNDED]: 'blue',
}

/** 念给人听；词表里没有的代码原样带出，不替它起名字 */
export function invoiceStatusLabel(status?: string): string {
  if (!status) return PH_DASH
  return LABELS[status] || String(status)
}

export function invoiceStatusColor(status?: string): string {
  if (!status) return 'default'
  return COLORS[status] || 'default'
}
