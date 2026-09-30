import { describe, it, expect, vi } from 'vitest'
import { ARTICLE_STATUS, QUEUE_STATUS } from '../contentStatus'
import { RUN_STATUS, INVOICE_STATUS, statusMeta } from '../statusTokens'
import { PH_DASH, PH_NONE, PH_NOT_SET, PH_NOT_MEASURED, PH_NOT_RUN, PH_NOT_COVERED } from '../display'
import { required, requiredSelect, maxLength } from '../rules'
import { logError } from '../errorLog'
import { formatMoney, formatPercent, formatDate, formatDateTime, formatDateTimeWithZone, TIME_ZONE_NOTE, formatTime, formatNumber } from '../format'

/**
 * P0 单源件：状态合表、占位符分工、rules 派生红星、错误留痕、格式化出口。
 */
describe('statusTokens 合表', () => {
  it('contentStatus 三张表原样复用（对象同一性＝字面量逐字未动）', () => {
    expect(statusMeta('article', 'published').label).toBe(ARTICLE_STATUS.published.label)
    expect(statusMeta('queue', 'pending').color).toBe(QUEUE_STATUS.pending.color)
  })

  it('needs_human 四处出现，按多数合为橙；引用探测的红是被改的那一处', () => {
    expect(RUN_STATUS.needs_human.color).toBe('orange')
  })

  it('发票文案与 BillingView 今天渲染的逐字一致', () => {
    expect(INVOICE_STATUS.PENDING.label).toBe('待支付')
    expect(INVOICE_STATUS.REFUNDED.color).toBe('blue')
  })

  it('未知状态原样显示、空值给 ASCII 横杠（沿用 contentStatus 行为，不与 PH_DASH 混）', () => {
    expect(statusMeta('run', 'zzz')).toEqual({ label: 'zzz', color: 'default' })
    expect(statusMeta('run', undefined).label).toBe('-')
  })
})

describe('display 占位符', () => {
  it('六个值各指一个东西，互不相等', () => {
    const all = [PH_DASH, PH_NONE, PH_NOT_SET, PH_NOT_MEASURED, PH_NOT_RUN, PH_NOT_COVERED]
    expect(new Set(all).size).toBe(6)
    expect(PH_DASH).toBe('—')
    expect(PH_NOT_MEASURED).toBe('未取到')
  })
})

describe('rules 工厂', () => {
  it('消息带 label，输入类与选择类措辞分开', () => {
    expect(required('品牌名')).toEqual({ required: true, message: '请填写品牌名' })
    expect(requiredSelect('站点')).toEqual({ required: true, message: '请选择站点' })
    expect(maxLength(50, '标题').max).toBe(50)
  })
})

describe('logError', () => {
  it('一条可查的行：带 code 前缀与原始错误，不抛', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const err = new Error('boom')
    expect(() => logError('citation.load', err)).not.toThrow()
    expect(spy).toHaveBeenCalledWith('[ui-error] citation.load', err)
    spy.mockRestore()
  })
})

describe('format 出口', () => {
  it('formatMoney 千分位， decimals 可选，空值给 PH_DASH', () => {
    expect(formatMoney(1234567)).toBe('1,234,567')
    expect(formatMoney(12.3, 2)).toBe('12.30')
    expect(formatMoney(null)).toBe(PH_DASH)
  })

  it('formatPercent 默认 1 位小数带 %，两种入参口径都认', () => {
    expect(formatPercent(0.3245)).toBe('32.5%')
    expect(formatPercent(32.45, 1, true)).toBe('32.5%')
  })

  it('formatDate / formatDateTime 行为不变（旧导出留着，页面还在用）', () => {
    const d = new Date(2026, 0, 5, 9, 7)
    expect(formatDateTime(d)).toBe('2026-01-05 09:07')
    expect(formatDate(d)).toBe('2026-01-05')
    expect(formatDateTime('')).toBe('-')
  })

  it('formatTime / formatNumber 仍在且输出与今天一致（deprecated 但没坏）', () => {
    expect(formatTime(new Date())).toBe('刚刚')
    expect(formatNumber(1000)).toBe('1,000')
  })

  it('G8：带时区那一支——数字原样穿透，只补「这是哪个时区」那一句', () => {
    expect(TIME_ZONE_NOTE).toBe('北京时间 UTC+8')
    expect(formatDateTimeWithZone('2026-10-01T00:07:05')).toBe('2026-10-01 00:07（北京时间 UTC+8）')
    expect(formatDateTimeWithZone('2026-10-01T00:07:05', true)).toBe('2026-10-01 00:07:05（北京时间 UTC+8）')
    // 后端 `LocalDateTime` 直出的串不带偏移：本地解析 + 本地渲染正好抵消，
    // 所以屏幕上那串数字恒等于服务器写库那一刻的北京墙钟——这一条就是「只加标注、不换算」的依据。
    expect(formatDateTimeWithZone('2026-09-30T02:24:51', true).startsWith('2026-09-30 02:24:51')).toBe(true)
    // 空值不许拼出「-（北京时间 UTC+8）」这种话
    expect(formatDateTimeWithZone(null)).toBe('-')
    expect(formatDateTimeWithZone(undefined)).toBe('-')
    expect(formatDateTimeWithZone('')).toBe('-')
  })
})
