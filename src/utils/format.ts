/**
 * 格式化时间为相对时间或绝对时间
 */
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
  if (diff < 24 * 60 * 60 * 1000) {
    return `${Math.floor(diff / (60 * 60 * 1000))}小时前`
  }
  // 小于7天
  if (diff < 7 * 24 * 60 * 60 * 1000) {
    return `${Math.floor(diff / (24 * 60 * 60 * 1000))}天前`
  }

  // 超过7天显示具体日期
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

/**
 * 格式化数字（千分位）
 */
export function formatNumber(num: number | null | undefined): string {
  if (num === null || num === undefined || Number.isNaN(Number(num))) return '-'
  return Number(num).toLocaleString('zh-CN')
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
 * 百分比：入参既可能是 0~1 的比例，也可能是已经乘过 100 的百分数
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
