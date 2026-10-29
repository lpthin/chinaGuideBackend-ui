// 发票类型词表的唯一出处。库里 billing_invoice.invoice_type 那一列的注释给的就是
// ENTERPRISE-企业 / PERSONAL-个人 这两个大写代码，界面前几年自己写了 company/personal 一套，
// 于是写进去的代码没人念得回来，列表每行只能硬念「个人」。
// 口径与 utils/paymentMethod.ts 一致：库里与接口只走大写代码，认不出来就原样摆出来，不替它编名字。

import { PH_DASH } from './display'

export const InvoiceType = {
  ENTERPRISE: 'ENTERPRISE',
  PERSONAL: 'PERSONAL',
} as const

export type InvoiceTypeCode = (typeof InvoiceType)[keyof typeof InvoiceType]

const LABELS: Record<string, string> = {
  [InvoiceType.ENTERPRISE]: '企业',
  [InvoiceType.PERSONAL]: '个人',
}

/** 库里那一列 → 中文；没登记的代码原样带出，空值摆「—」 */
export function invoiceTypeLabel(code?: string | null): string {
  if (!code) return PH_DASH
  return LABELS[code.toUpperCase()] || String(code)
}

export function invoiceTypeColor(code?: string | null): string {
  if (code && code.toUpperCase() === InvoiceType.ENTERPRISE) return 'blue'
  return 'default'
}

/** 企业才要税号——这一条判据也只许有这一个出处 */
export function invoiceTypeNeedsTaxNo(code?: string | null): boolean {
  return Boolean(code) && String(code).toUpperCase() === InvoiceType.ENTERPRISE
}
