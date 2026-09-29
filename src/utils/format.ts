/**
 * 格式化单一出口（Spec-F §9.2-5）：日期一律 formatDate / formatDateTime，
 * 金额走 formatMoney，率走 formatPercent（1 位小数 + %）。
 * 旧导出先留着（页面还在 import），下一包迁完页面后删除。
 */
import { PH_DASH } from './display'

/** @deprecated 相对时间与绝对时间混在一个出口里；改用 formatDateTime（绝对）或页面自证的相对文案 */
export function formatTime(time: string | Date | undefined): string {
  if (!time) return '-'

  const date = typeof time === 'string' ? new Date(time) : time
  const now = new Date()
  const diff = now.getTime() - date.getTime()

  // 小于1分钟
  if (diff < 60 * 1000) {
    return '刚刚'
  }
  // 小于1小时
  if (diff < 60 * 60 * 1000) {
    return `${Math.floor(diff / (60 * 1000))}分钟前`
  }
  // 小于24小时
  if (diff < 60 * 60 * 1000 * 24) {
    return `${Math.floor(diff / (60 * 60 * 1000))}小时前`
  }
  // 小于7天
  if (diff < 7 * 24 * 60 * 60 * 1000) {
    return `${Math.floor(diff / (24 * 60 * 60 * 1000))}天前`
  }

  // 超过7天显示具体日期（与今天输出逐字一致的绝对时间形态，内部口径收敛到 formatDateTime）
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hour = String(date.getHours()).padStart(2, '0')
  const minute = String(date.getMinutes()).padStart(2, '0')

  if (year === now.getFullYear()) {
    return `${month}-${day} ${hour}:${minute}`
  }
  return `${year}-${month}-${day} ${hour}:${minute}`
}

/**
 * 格式化文件大小
 */
export function formatFileSize(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

/** @deprecated 千分位数字请用 formatMoney；本函数仅为兼容存量页面保留 */
export function formatNumber(num: number | null | undefined): string {
  if (num === null || num === undefined || Number.isNaN(Number(num))) return '-'
  return Number(num).toLocaleString('zh-CN')
}

/** 金额/数量千分位的唯一出口（合并了 billing 两页与各视图里 6 处 toLocaleString 手抄）。空值给占位符。 */
export function formatMoney(value: number | string | null | undefined, decimals = 0): string {
  if (value === null || value === undefined || value === '' || Number.isNaN(Number(value))) return PH_DASH
  return Number(value).toLocaleString('zh-CN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

/**
 * 绝对时间：后端 LocalDateTime 直出的 ISO 串不能直接渲染
 */
export function formatDateTime(time: string | Date | number | undefined | null, withSeconds = false): string {
  if (!time) return '-'
  const date = typeof time === 'number' ? new Date(time) : typeof time === 'string' ? new Date(time) : time
  if (Number.isNaN(date.getTime())) return '-'
  const pad = (n: number) => String(n).padStart(2, '0')
  const base = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
  return withSeconds ? `${base}:${pad(date.getSeconds())}` : base
}

/** 只到日期，不含时分 */
export function formatDate(time: string | Date | number | undefined | null): string {
  return formatDateTime(time).slice(0, 10)
}

/**
 * 百分比：入参既可能是 0~1 的比例，也可能是已经乘过 100 的百分数。§9.5：率显示 1 位小数带 %。
 */
export function formatPercent(value: number | null | undefined, digits = 1, alreadyPercent = false): string {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '-'
  const pct = alreadyPercent ? Number(value) : Number(value) * 100
  return `${pct.toFixed(digits)}%`
}

/** 保留小数，空值返回占位符而不是 NaN */
export function formatDecimal(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '-'
  return Number(value).toFixed(digits)
}
