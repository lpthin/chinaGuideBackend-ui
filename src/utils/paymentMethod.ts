// 支付方式词表的唯一出处，取值与后端 PaymentMethods 逐字一致（全大写代码）。
// 历史上界面用小写（'alipay'）、后端读口往界面回 toLowerCase、库里大小写混存，
// 于是同一格「这一笔怎么付的」有四种说法。口径：接口走大写代码，界面念中文。

export type PaymentMethodCode =
  | 'WECHAT'
  | 'ALIPAY'
  | 'BANK_TRANSFER'
  | 'CREDIT_CARD'
  | 'BALANCE'

// 顺序与后端 PaymentMethods.codeToLabel() 一致：支付方式列表那一口按这个顺序念
export const PAYMENT_METHOD_ORDER: PaymentMethodCode[] = [
  'WECHAT',
  'ALIPAY',
  'BANK_TRANSFER',
  'CREDIT_CARD',
  'BALANCE',
]

const LABELS: Record<PaymentMethodCode, string> = {
  WECHAT: '微信支付',
  ALIPAY: '支付宝',
  BANK_TRANSFER: '银行转账',
  CREDIT_CARD: '信用卡',
  BALANCE: '余额支付',
}

/** 收口成大写代码；历史小写行照认，认不出来给 null（读旧数据用，不惯着脏值） */
export function normalizePaymentMethod(raw?: string | null): PaymentMethodCode | null {
  if (!raw) return null
  const upper = String(raw).trim().toUpperCase()
  return upper in LABELS ? (upper as PaymentMethodCode) : null
}

/** 念给人听的中文；没登记的代码原样带出，不编一个名字 */
export function paymentMethodLabel(raw?: string | null): string {
  const code = normalizePaymentMethod(raw)
  if (!code) return raw ? String(raw) : '-'
  return LABELS[code]
}

export const paymentMethodOptions = (): { value: PaymentMethodCode; label: string }[] =>
  PAYMENT_METHOD_ORDER.map((code) => ({ value: code, label: LABELS[code] }))
