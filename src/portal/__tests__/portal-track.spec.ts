import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { Router } from 'vue-router'

const mocks = vi.hoisted(() => ({
  post: vi.fn(),
  beacon: vi.fn(),
  siteCode: { current: 'acme-portal' },
}))

vi.mock('axios', () => ({ default: { post: mocks.post } }))
vi.mock('../api/portalData', () => ({ resolveSiteCode: () => mocks.siteCode.current }))

async function loadTracking() {
  vi.resetModules()
  return import('../usePortalTrack')
}

/** afterEach 回调由 setupPortalTracking 注册，这里用一个假路由器把它们收集起来触发 */
function fakeRouter() {
  const hooks: Array<(to: any) => void> = []
  const router = { afterEach: (fn: (to: any) => void) => hooks.push(fn) } as unknown as Router
  return { router, emit: (path: string, name: string) => hooks.forEach((fn) => fn({ path, name })) }
}

describe('门户访客埋点 usePortalTrack', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.post.mockResolvedValue(undefined)
    mocks.beacon.mockReturnValue(true)
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-23T08:00:00Z'))
    mocks.siteCode.current = 'acme-portal'
    sessionStorage.clear()
    Object.defineProperty(navigator, 'sendBeacon', {
      value: mocks.beacon,
      configurable: true,
      writable: true,
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  function postedBody(call: number) {
    return mocks.post.mock.calls[call][1]
  }

  it('页面浏览走公开埋点端点，并把站点身份带在 query 上', async () => {
    const { trackPortalPageView } = await loadTracking()
    trackPortalPageView('/news')

    expect(mocks.post).toHaveBeenCalledTimes(1)
    expect(mocks.post.mock.calls[0][0]).toBe('/api/portal/public/track?site=acme-portal')
    expect(postedBody(0)).toMatchObject({ path: '/news', eventType: 'pageview' })
    expect(postedBody(0).sessionId).toBeTruthy()
  })

  it('解析不到站点码时不带 site 参数，交给后端按域名判断', async () => {
    mocks.siteCode.current = ''
    const { trackPortalPageView } = await loadTracking()
    trackPortalPageView('/')

    expect(mocks.post.mock.calls[0][0]).toBe('/api/portal/public/track')
  })

  it('同一会话内的 session id 保持不变，用于会话口径去重', async () => {
    const { trackPortalPageView } = await loadTracking()
    trackPortalPageView('/')
    trackPortalPageView('/about')

    expect(postedBody(0).sessionId).toBe(postedBody(1).sessionId)
  })

  it('停留时长用 sendBeacon 补报，避免页面卸载时请求被丢掉', async () => {
    const { trackPortalPageView, flushActiveDuration } = await loadTracking()
    trackPortalPageView('/news/slug-a')
    vi.advanceTimersByTime(5200)
    flushActiveDuration()

    expect(mocks.beacon).toHaveBeenCalledTimes(1)
    const [url, blob] = mocks.beacon.mock.calls[0]
    expect(url).toBe('/api/portal/public/track?site=acme-portal')
    // Blob 没有同步读内容的通用 API，这里只断言类型与大小符合 sendBeacon 的 JSON 约定
    expect(blob).toBeInstanceOf(Blob)
    expect(blob.type).toBe('application/json')
    expect(blob.size).toBeGreaterThan(0)
  })

  it('秒开秒走（不足 1 秒）不报停留时长，否则平均停留会被 0 拉平', async () => {
    const { trackPortalPageView, flushActiveDuration } = await loadTracking()
    trackPortalPageView('/news/slug-b')
    vi.advanceTimersByTime(500)
    flushActiveDuration()

    expect(mocks.beacon).not.toHaveBeenCalled()
  })

  it('停留时长结算过一次之后不会重复上报', async () => {
    const { trackPortalPageView, flushActiveDuration } = await loadTracking()
    trackPortalPageView('/cases/9')
    vi.advanceTimersByTime(3000)
    flushActiveDuration()
    flushActiveDuration()

    expect(mocks.beacon).toHaveBeenCalledTimes(1)
  })

  it('只有门户路由计入人工浏览；跳进后台时先结清上一页的停留', async () => {
    const { setupPortalTracking, flushActiveDuration } = await loadTracking()
    const { router, emit } = fakeRouter()
    setupPortalTracking(router)

    emit('/', 'portal-home')
    expect(mocks.post).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(2000)

    emit('/workspace/articles', 'workspace-articles')
    // 后台页面自己不算 PV，但门户那一页的时长必须结清
    expect(mocks.post).toHaveBeenCalledTimes(1)
    expect(mocks.beacon).toHaveBeenCalledTimes(1)

    flushActiveDuration()
    expect(mocks.beacon).toHaveBeenCalledTimes(1)
  })

  it('重复注册不会重复挂监听', async () => {
    const { setupPortalTracking } = await loadTracking()
    const { router, emit } = fakeRouter()
    setupPortalTracking(router)
    setupPortalTracking(router)

    emit('/about', 'portal-about')
    expect(mocks.post).toHaveBeenCalledTimes(1)
  })

  it('埋点失败对访客完全静默，不抛出也不提示', async () => {
    mocks.post.mockRejectedValue(new Error('network down'))
    const { trackPortalPageView } = await loadTracking()

    expect(() => trackPortalPageView('/news')).not.toThrow()
    await Promise.resolve()
  })

  it('isPortalRoute 只认 portal-* 命名，后台路由一律不计', async () => {
    const { isPortalRoute } = await loadTracking()

    expect(isPortalRoute('portal-home')).toBe(true)
    expect(isPortalRoute('portal-article-detail')).toBe(true)
    expect(isPortalRoute('workspace-articles')).toBe(false)
    expect(isPortalRoute(undefined)).toBe(false)
  })
})
