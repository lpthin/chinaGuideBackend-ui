/**
 * 门户访客侧埋点：把「真人看了哪个页面」上报给 /api/portal/public/track。
 *
 * <p>口径边界（和后台报表的命名一一对应，不要混用）：</p>
 * <ul>
 *   <li>只有浏览器会执行这段代码，爬虫不执行 JS，所以这里的数字代表<b>人工浏览</b>；
 *       爬虫由后端按 User-Agent 在它能看到的少数路径上识别，报表里叫「AI 抓取（服务端识别）」。</li>
 *   <li>两者口径不同、不可相加，因此这里也从不把 pageview 和 duration 合成一个「浏览量」。</li>
 * </ul>
 *
 * <p>上报的 path 只取不含查询串的路径（后端有路由白名单，带 ?category= 的会被拒），
 * 站点身份沿用域名解析 + 本地预览的 ?site= 会话值。</p>
 */
import type { Router } from 'vue-router'
import axios from 'axios'
import { resolveSiteCode } from './api/portalData'

const TRACK_ENDPOINT = '/api/portal/public/track'
const SESSION_KEY = 'portal.track.session'
/** 一天上限：定时器在后台标签页会被节流，页面挂着不走人时不能算成无限长停留 */
const MAX_DURATION_MS = 86_400_000
/** 秒开秒走（含误点返回）不报停留时长，否则平均停留时长会被 0 拉平 */
const MIN_DURATION_MS = 1000

type TrackEventType = 'pageview' | 'duration'

interface TrackPayload {
  path: string
  eventType: TrackEventType
  durationMs?: number
  sessionId?: string
}

let active: { path: string; since: number | null } | null = null
let installed = false

export function portalSessionId(): string {
  try {
    let id = sessionStorage.getItem(SESSION_KEY)
    if (!id) {
      id = typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`
      sessionStorage.setItem(SESSION_KEY, id)
    }
    return id
  } catch {
    // 隐私模式：退化成一次性 id，本次会话仍然可去重，只是跨页丢失
    return `ephemeral-${Date.now().toString(36)}`
  }
}

/** 独立可调：单元测试与手动补报都走这里 */
export function trackPortalEvent(payload: TrackPayload, viaBeacon = false): void {
  const site = resolveSiteCode()
  const url = site ? `${TRACK_ENDPOINT}?site=${encodeURIComponent(site)}` : TRACK_ENDPOINT
  const body = { ...payload, sessionId: payload.sessionId || portalSessionId() }
  if (viaBeacon && typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
    // 页面已经在卸载，普通请求大概率来不及发出去；sendBeacon 不收 axios 的错误也无妨，
    // 统计不能干扰页面本身。
    try {
      navigator.sendBeacon(url, new Blob([JSON.stringify(body)], { type: 'application/json' }))
      return
    } catch {
      // 落到下面的 axios 分支
    }
  }
  axios.post(url, body).catch(() => {
    // 埋点失败不提示、不重试：访客不该因为统计而看到错误
  })
}

export function trackPortalPageView(path: string): void {
  flushActiveDuration()
  active = { path, since: Date.now() }
  trackPortalEvent({ path, eventType: 'pageview' })
}

/** 结算当前页面的停留时长（页面隐藏/卸载/路由跳转前调用） */
export function flushActiveDuration(): void {
  if (!active || active.since === null) {
    return
  }
  const elapsed = Date.now() - active.since
  active.since = null
  if (elapsed >= MIN_DURATION_MS && elapsed <= MAX_DURATION_MS) {
    trackPortalEvent({ path: active.path, eventType: 'duration', durationMs: elapsed }, true)
  }
}

export function isPortalRoute(name: unknown): boolean {
  return typeof name === 'string' && name.startsWith('portal-')
}

/** 在 main.ts 里注册一次；只作用于门户路由，后台页面不进统计 */
export function setupPortalTracking(router: Router): void {
  if (installed || typeof window === 'undefined') {
    return
  }
  installed = true
  router.afterEach((to) => {
    if (isPortalRoute(to.name)) {
      trackPortalPageView(to.path)
    } else {
      // 从门户跳进后台：这一页的停留要先结清，否则时长会被算到下一个页面上
      flushActiveDuration()
      active = null
    }
  })
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      flushActiveDuration()
    } else if (active && active.since === null) {
      active.since = Date.now()
    }
  })
  window.addEventListener('pagehide', flushActiveDuration)
}
