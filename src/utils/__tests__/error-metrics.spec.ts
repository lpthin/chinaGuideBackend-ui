import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  getErrorMetrics,
  recordErrorExposure,
  recordFalseEmpty,
  recordPageView,
  recordRecovery,
  recordRetryAttempt,
  recordRetryOutcome,
  resetErrorMetrics,
} from '../errorMetrics'

/**
 * SPEC-UI-8 G1：四个数的口径钉在这里。
 *
 * 这些断言钉的是「怎么算」而不是「现在恰好是多少」：
 * 错误曝光率按页面浏览计（同一页多次错误只算一次），重试成功率按每一次重试计，
 * 误判空态与「错误 + 0 行」是两个数，恢复耗时取平均。
 */
beforeEach(() => {
  resetErrorMetrics()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('errorMetrics 口径', () => {
  it('什么都没发生时四个数都是 0，比率不出现 NaN', () => {
    const m = getErrorMetrics()
    expect(m.pageViews).toBe(0)
    expect(m.exposureRate).toBe(0)
    expect(m.retrySuccessRate).toBe(0)
    expect(m.falseEmptyRate).toBe(0)
    expect(m.avgRecoveryMs).toBe(0)
  })

  it('错误曝光率 = 出过错误的页面浏览 / 总页面浏览，同一页多次错误只算一次', () => {
    recordPageView('/workspace/a')
    recordErrorExposure('读取失败', 'table', true)
    recordErrorExposure('读取失败', 'table', true)
    recordPageView('/workspace/b')
    recordPageView('/workspace/c')

    const m = getErrorMetrics()
    expect(m.pageViews).toBe(3)
    expect(m.exposedPageViews).toBe(1)
    expect(m.exposures).toBe(2)
    expect(m.exposureRate).toBeCloseTo(1 / 3)
    // 「错误 + 0 行」是独立的风险触发数，不并进误判空态
    expect(m.errorZeroRowCases).toBe(2)
    expect(m.falseEmptyShown).toBe(0)
  })

  it('换页后本页曝光标记重置：下一页的错误是新的曝光页面', () => {
    recordPageView('/workspace/a')
    recordErrorExposure('读取失败', 'table', false)
    recordPageView('/workspace/b')
    recordErrorExposure('读取失败', 'empty', false)

    const m = getErrorMetrics()
    expect(m.exposedPageViews).toBe(2)
    expect(m.pageViews).toBe(2)
    expect(m.exposureRate).toBe(1)
  })

  it('重试成功率 = 重试后读成功次数 / 重试次数', () => {
    recordRetryAttempt('读取失败', 'manual')
    recordRetryOutcome(false, 'manual')
    recordRetryAttempt('读取失败', 'auto')
    recordRetryOutcome(true, 'auto')

    const m = getErrorMetrics()
    expect(m.retryAttempts).toBe(2)
    expect(m.retrySuccesses).toBe(1)
    expect(m.retrySuccessRate).toBe(0.5)
  })

  it('恢复耗时取平均，不取 P95', () => {
    recordRecovery(1000, '读取失败')
    recordRecovery(3000, '读取失败')

    const m = getErrorMetrics()
    expect(m.recoveryCount).toBe(2)
    expect(m.avgRecoveryMs).toBe(2000)
  })

  it('误判空态单独计数并能算出比率（本版调用点应为 0）', () => {
    recordPageView('/workspace/a')
    recordErrorExposure('读取失败', 'table', true)
    recordFalseEmpty('读取失败', 'table')

    const m = getErrorMetrics()
    expect(m.falseEmptyShown).toBe(1)
    expect(m.falseEmptyRate).toBe(1)
  })

  it('reset 把累计值、当前页、本页曝光标记一起清回初始', () => {
    recordPageView('/workspace/a')
    recordErrorExposure('读取失败', 'table', true)
    resetErrorMetrics()

    const m = getErrorMetrics()
    expect(m.pageViews).toBe(0)
    expect(m.exposures).toBe(0)
    // 重置后第一页的错误要能重新算成一次曝光
    recordPageView('/workspace/b')
    recordErrorExposure('读取失败', 'table', true)
    expect(getErrorMetrics().exposedPageViews).toBe(1)
  })

  it('事件走 [ui-info] 通道，不混进 error / warn', () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {})
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})

    recordPageView('/workspace/a')
    recordErrorExposure('读取失败', 'table', true)
    recordRetryAttempt('读取失败', 'manual')
    recordRetryOutcome(true, 'manual')
    recordRecovery(800, '读取失败')

    expect(info).toHaveBeenCalledWith('[ui-info] metrics/page_view', expect.anything())
    expect(info).toHaveBeenCalledWith('[ui-info] metrics/error_exposure', expect.anything())
    expect(info).toHaveBeenCalledWith('[ui-info] metrics/retry_attempt', expect.anything())
    expect(info).toHaveBeenCalledWith('[ui-info] metrics/retry_outcome', expect.anything())
    expect(info).toHaveBeenCalledWith('[ui-info] metrics/recovery', expect.anything())
    expect(error).not.toHaveBeenCalled()
  })
})
