import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  chunkLoadNoticeVisible,
  isChunkLoadFailure,
  notifyChunkLoadFailure,
  resetChunkLoadNotice,
  setupChunkLoadGuard
} from '../chunkLoad'

/**
 * SPEC-UI-9 H1-2：三种真实浏览器文案都算分包失败，别的一律不算；
 * 同一会话只提示一次，避免刷新循环。
 */
beforeEach(() => {
  resetChunkLoadNotice()
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('isChunkLoadFailure', () => {
  it.each([
    'Failed to fetch dynamically imported module: /assets/WorkspaceView-abc.js',
    'Importing a module script failed.',
    'Load failed',
  ])('识别浏览器文案：%s', (message) => {
    expect(isChunkLoadFailure(new TypeError(message))).toBe(true)
  })

  it('普通网络错误与业务异常不算分包失败', () => {
    expect(isChunkLoadFailure(new Error('Network Error'))).toBe(false)
    expect(isChunkLoadFailure('Network Error')).toBe(false)
    expect(isChunkLoadFailure(new Error('请求失败（HTTP 500）'))).toBe(false)
    expect(isChunkLoadFailure(null)).toBe(false)
    expect(isChunkLoadFailure(undefined)).toBe(false)
  })
})

describe('notifyChunkLoadFailure', () => {
  it('命中时展示提示并留一条 warn；未命中不展示', () => {
    expect(notifyChunkLoadFailure(new Error('Network Error'))).toBe(false)
    expect(chunkLoadNoticeVisible.value).toBe(false)

    expect(notifyChunkLoadFailure(new TypeError('Load failed'))).toBe(true)
    expect(chunkLoadNoticeVisible.value).toBe(true)
    expect(console.warn).toHaveBeenCalledWith('[ui-warn] app/chunk-load-failed', expect.anything())
  })

  it('同一会话最多提示一次：第二次命中不再弹出', () => {
    notifyChunkLoadFailure(new TypeError('Load failed'))
    chunkLoadNoticeVisible.value = false
    notifyChunkLoadFailure(new TypeError('Importing a module script failed.'))
    expect(chunkLoadNoticeVisible.value).toBe(false)
  })

  it('vite:preloadError 事件把 payload 当错误识别', () => {
    let handler: ((event: unknown) => void) | undefined
    setupChunkLoadGuard({
      addEventListener: (_type: string, listener: (event: unknown) => void) => {
        handler = listener
      }
    } as unknown as Pick<Window, 'addEventListener'>)

    handler?.({ payload: new TypeError('Failed to fetch dynamically imported module: /a.js') })
    expect(chunkLoadNoticeVisible.value).toBe(true)
  })
})
