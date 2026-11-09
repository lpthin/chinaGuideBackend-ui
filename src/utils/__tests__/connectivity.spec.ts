import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { isOnline, networkRecovered, resetConnectivity, setupConnectivity } from '../connectivity'

/**
 * SPEC-UI-9 H1-3：断网横幅只看浏览器 online / offline 两个事件；
 * 恢复提示亮 3 秒后自动收起，不替页面自动重读。
 */
beforeEach(() => {
  resetConnectivity()
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('connectivity', () => {
  it('初始状态按 navigator.onLine 取值', () => {
    const target = new EventTarget()
    const stop = setupConnectivity(target as unknown as Pick<Window, 'addEventListener' | 'removeEventListener'>, () => false)
    expect(isOnline.value).toBe(false)
    stop()
  })

  it('离线→在线：横幅出现，恢复提示 3 秒后收起', () => {
    vi.useFakeTimers()
    const target = new EventTarget()
    let online = true
    const stop = setupConnectivity(
      target as unknown as Pick<Window, 'addEventListener' | 'removeEventListener'>,
      () => online
    )

    online = false
    target.dispatchEvent(new Event('offline'))
    expect(isOnline.value).toBe(false)
    expect(networkRecovered.value).toBe(false)

    online = true
    target.dispatchEvent(new Event('online'))
    expect(isOnline.value).toBe(true)
    expect(networkRecovered.value).toBe(true)

    vi.advanceTimersByTime(3000)
    expect(networkRecovered.value).toBe(false)
    stop()
  })

  it('恢复提示未收起前再次断网：先收起恢复提示，只留断网横幅', () => {
    vi.useFakeTimers()
    const target = new EventTarget()
    let online = true
    const stop = setupConnectivity(
      target as unknown as Pick<Window, 'addEventListener' | 'removeEventListener'>,
      () => online
    )

    online = false
    target.dispatchEvent(new Event('offline'))
    online = true
    target.dispatchEvent(new Event('online'))
    online = false
    target.dispatchEvent(new Event('offline'))

    expect(networkRecovered.value).toBe(false)
    expect(isOnline.value).toBe(false)
    vi.advanceTimersByTime(3000)
    expect(networkRecovered.value).toBe(false)
    stop()
  })

  it('卸载后不再响应事件', () => {
    const target = new EventTarget()
    const stop = setupConnectivity(
      target as unknown as Pick<Window, 'addEventListener' | 'removeEventListener'>,
      () => true
    )
    stop()
    target.dispatchEvent(new Event('offline'))
    expect(isOnline.value).toBe(true)
  })

  it('两个事件都走 [ui-info]，不混进 error', () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {})
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const target = new EventTarget()
    const stop = setupConnectivity(
      target as unknown as Pick<Window, 'addEventListener' | 'removeEventListener'>,
      () => true
    )

    target.dispatchEvent(new Event('offline'))
    target.dispatchEvent(new Event('online'))

    expect(info).toHaveBeenCalledWith('[ui-info] connectivity/offline', expect.anything())
    expect(info).toHaveBeenCalledWith('[ui-info] connectivity/online', expect.anything())
    expect(error).not.toHaveBeenCalled()
    stop()
  })
})
