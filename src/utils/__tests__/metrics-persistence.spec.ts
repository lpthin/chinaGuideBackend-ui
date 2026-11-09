import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * SPEC-UI-9 H4-3：刷新一次不该把「刚发生的那一发」连同 requestId 一起抹掉。
 * 会话快照落 sessionStorage：同标签页刷新仍在、关标签即清。
 *
 * 这些用例故意在 import 之前先写好 sessionStorage，再 resetModules + 动态 import，
 * 模拟「刷新后模块重新初始化」；静态 import 会把恢复时机提前，测不到回灌。
 */
const RAW_KEY = '__ui_error_raw_v1'
const METRICS_KEY = '__ui_error_metrics_v1'

beforeEach(() => {
  sessionStorage.clear()
  vi.resetModules()
})

describe('会话快照回灌', () => {
  it('原文台账刷新后仍能被错误块取到（含 requestId）', async () => {
    sessionStorage.setItem(
      RAW_KEY,
      JSON.stringify({
        entries: [
          ['读取失败', { rawText: 'GET /api/a → HTTP 500\nrequestId: req-9', at: Date.now(), page: '/workspace/a' }]
        ]
      })
    )
    const raw = await import('../errorRaw')
    expect(raw.errorRawDetail('读取失败')).toContain('requestId: req-9')
  })

  it('度量快照刷新后连当前页与曝光标记一起恢复', async () => {
    sessionStorage.setItem(
      METRICS_KEY,
      JSON.stringify({
        global: {
          pageViews: 3,
          exposedPageViews: 1,
          exposures: 2,
          errorZeroRowCases: 1,
          falseEmptyShown: 0,
          retryAttempts: 1,
          retrySuccesses: 1,
          recoveryCount: 1,
          recoveryTotalMs: 800
        },
        pages: [
          ['/workspace/a', {
            pageViews: 2,
            exposedPageViews: 1,
            exposures: 2,
            errorZeroRowCases: 1,
            falseEmptyShown: 0,
            retryAttempts: 1,
            retrySuccesses: 1,
            recoveryCount: 1,
            recoveryTotalMs: 800
          }]
        ],
        currentPath: '/workspace/a',
        currentViewExposed: true
      })
    )
    const metrics = await import('../errorMetrics')
    expect(metrics.getErrorMetrics().pageViews).toBe(3)
    expect(metrics.getErrorMetrics().avgRecoveryMs).toBe(800)
    expect(metrics.getErrorMetricsByPage()['/workspace/a'].exposures).toBe(2)
  })

  it('坏快照静默降级：不清空页面、不影响首屏', async () => {
    sessionStorage.setItem(RAW_KEY, '不是 JSON')
    sessionStorage.setItem(METRICS_KEY, '{"global": "坏了"}')
    const raw = await import('../errorRaw')
    const metrics = await import('../errorMetrics')
    expect(raw.errorRawDetail('读写口')).toBeNull()
    expect(metrics.getErrorMetrics().pageViews).toBe(0)
  })

  it('每次记录都回写会话快照，刷新前就已在存储里', async () => {
    const raw = await import('../errorRaw')
    raw.resetRawDetails()
    raw.rememberRawDetail('读取失败', 'HTTP 500')
    expect(sessionStorage.getItem(RAW_KEY)).toContain('HTTP 500')

    const metrics = await import('../errorMetrics')
    metrics.resetErrorMetrics()
    metrics.recordPageView('/workspace/a')
    expect(sessionStorage.getItem(METRICS_KEY)).toContain('/workspace/a')
  })
})
