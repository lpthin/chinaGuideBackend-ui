// 充值订单状态词表的唯一出处，取值与后端 RechargeOrderStatuses 逐字一致（全大写代码）。
// 改前界面用小写比对：那四张统计卡（待支付/已支付/已取消/已退款）恒为 0，
// 状态标签与导出 CSV 念的是英文代码。

export type RechargeOrderStatus = 'PENDING' | 'PAID' | 'CANCELLED' | 'REFUNDED'

// 顺序与后端词表一致，筛选按钮与统计卡按这个顺序摆
export const ORDER_STATUS_ORDER: RechargeOrderStatus[] = ['PENDING', 'PAID', 'CANCELLED', 'REFUNDED']

const META: Record<RechargeOrderStatus, { label: string; color: string }> = {
  PENDING: { label: '待支付', color: 'orange' },
  PAID: { label: '已支付', color: 'green' },
  CANCELLED: { label: '已取消', color: 'default' },
  // 库里列注释只登记了三个状态；退款那一格现在只写在 billing_payment 的行上，
  // 这里留一份中文是给界面「已退款」那一档一个认得出的名字
  REFUNDED: { label: '已退款', color: 'blue' },
}

/** 折成大写；空给 null，认不出来也原样给回大写（筛选入参用，与后端 fold 同形） */
export function foldOrderStatus(raw?: string | null): string | null {
  if (raw === undefined || raw === null) return null
  const value = String(raw).trim()
  return value === '' ? null : value.toUpperCase()
}

/** 未知状态原样显示，避免把脏数据静默归成某个已知状态 */
export function orderStatusMeta(raw?: string | null): { label: string; color: string } {
  const code = foldOrderStatus(raw)
  if (!code) return { label: '-', color: 'default' }
  return META[code as RechargeOrderStatus] ?? { label: String(raw), color: 'default' }
}

export const orderStatusLabel = (raw?: string | null) => orderStatusMeta(raw).label
export const orderStatusColor = (raw?: string | null) => orderStatusMeta(raw).color

/** 统计卡用：把一行的状态归到四档里那一档，认不出的不计数 */
export function countByStatus(records: any[]): Record<RechargeOrderStatus, number> {
  const counts = { PENDING: 0, PAID: 0, CANCELLED: 0, REFUNDED: 0 } as Record<RechargeOrderStatus, number>
  for (const record of records) {
    const code = foldOrderStatus(record?.status)
    if (code && code in counts) counts[code as RechargeOrderStatus] += 1
  }
  return counts
}
