/**
 * 提示中枢（SPEC-UI-11 §4.1 / §5）：收、排队、去重、频率、静音、忙碌抑制。
 *
 * 页面只往这里投递 `RobotNotice`，不认识气泡与形象；中枢只认识契约，不认识任何视图。
 * 这一层的全部判断都是纯函数可测的：时间、存储、定时器、忙碌判定都从 `deps` 注入，
 * 单测不需要渲染组件，也不需要真的等 12 秒。
 *
 * 三条硬边界（改代码前先看）：
 * 1. 同一时刻只显示一条；p1 可打断 p2/p3，被打断的那条**回队列不丢弃**（§5.2）。
 * 2. 忙碌时不说话，消息留在队列里，等现场恢复再补（§5.3）。
 * 3. 去重记录落 `localStorage`，跨标签页也只说一次（§5.4）。
 */
import { ref, type Ref } from 'vue'
import {
  ROBOT_AUTO_HIDE_MS,
  ROBOT_INTRO_KEY,
  ROBOT_PRIORITY_ORDER,
  ROBOT_QUEUE_LIMIT,
  ROBOT_RATE_RULES,
  ROBOT_ROUTE_DELAY_MS,
  ROBOT_SEEN_KEY,
  type RobotCategory,
  type RobotDedupe,
  type RobotFrequency,
  type RobotNotice,
  type RobotPosition,
  type RobotPriority
} from './robotTypes'
import {
  clearRobotPrefs,
  defaultRobotPrefs,
  isRobotQuiet,
  mergeRobotPreference,
  muteRobotKey,
  muteRobotPage,
  readRobotPrefs,
  robotQuietUntil,
  unmuteAllRobot,
  unmuteRobotKey,
  unmuteRobotPage,
  unionRobotList,
  writeRobotPrefs,
  type RemoteRobotPreference,
  type RobotPrefs,
  type RobotPrefsPayload,
  type RobotStorage
} from './robotPrefs'
import {
  ROBOT_SOURCES,
  withSourceDefaults,
  type RobotNoticeInput
} from './robotRegistry'
import { robotBlockingReason } from './robotBusy'
import { ROBOT_COPY } from '../../copy/robot'

const SESSION_WINDOW_MS = 12 * 60 * 60 * 1000
const PUSH_DEBOUNCE_MS = 1500

/** 后端偏好接口的客户端面（登录拉取 / 改动防抖推送），由默认依赖接上真接口 */
export interface RobotRemoteStore {
  load(): Promise<RemoteRobotPreference>
  save(
    payload: RobotPrefsPayload,
    meta: { clientUpdatedAt: number; baseVersion: number }
  ): Promise<{ version: number; updatedAt: number | null; conflict: boolean; server: RemoteRobotPreference | null }>
}

export interface RobotTelemetryEvent {
  type: 'show' | 'dismiss' | 'detail' | 'action' | 'mute'
  key: string
  page: string
  action?: string
}

export interface RobotCenterDeps {
  storage: RobotStorage
  now?: () => number
  setTimer?: (fn: () => void, ms: number) => number
  clearTimer?: (id: number) => void
  /** 返回非 null 表示现在不能说（输入框聚焦、弹窗开着、错误块可见） */
  isBlocked?: () => string | null
  /** 不传 = 只走本地；传了就启用跨端同步（失败静默） */
  remote?: RobotRemoteStore | null
  onTelemetry?: (event: RobotTelemetryEvent) => void
}

interface SeenEntry {
  at: number
  once: RobotDedupe
}

export type RobotSeenMap = Record<string, SeenEntry>

interface QueuedNotice {
  notice: RobotNotice
  /** 被 p1 抢占后回到队列的那一条：已经计过一次去重，放行时不再拦 */
  resumed?: boolean
}

function startOfDay(now: number): number {
  const date = new Date(now)
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

/** 一个 `once` 口径在存储里保留多久（毫秒）；`ever` 返回 0 表示永不过期 */
export function robotDedupeWindow(once: RobotDedupe, now: number): number {
  if (once === 'ever') return 0
  if (once === 'session') return SESSION_WINDOW_MS
  // page / day 都按「今天」记：验收 #2 要求刷新同一页不再重复说，
  // 只记内存的 page 档撑不过一次刷新，跨标签去重也做不到。
  return startOfDay(now) + 24 * 60 * 60 * 1000 - now
}

export function readRobotSeen(storage: RobotStorage, now: number): RobotSeenMap {
  const raw = storage.getItem(ROBOT_SEEN_KEY)
  if (!raw) return {}
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return {}
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {}
  const seen: RobotSeenMap = {}
  for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
    if (!value || typeof value !== 'object') continue
    const entry = value as Record<string, unknown>
    if (typeof entry.at !== 'number' || !Number.isFinite(entry.at)) continue
    const once = entry.once
    if (once !== 'session' && once !== 'page' && once !== 'day' && once !== 'ever') continue
    if (isRobotSeenExpired({ at: entry.at, once }, now)) continue
    seen[key] = { at: entry.at, once }
  }
  return seen
}

export function isRobotSeenExpired(entry: SeenEntry, now: number): boolean {
  const window = robotDedupeWindow(entry.once, entry.at)
  if (window === 0) return false
  return now - entry.at >= window
}

export function writeRobotSeen(storage: RobotStorage, seen: RobotSeenMap): void {
  storage.setItem(ROBOT_SEEN_KEY, JSON.stringify(seen))
}

/** 今天已经说了几条：以「真正展示过」的 key 计，正好是每日上限要数的那个数 */
export function robotSpokenToday(seen: RobotSeenMap, now: number): number {
  const dayStart = startOfDay(now)
  return Object.values(seen).filter(entry => entry.at >= dayStart).length
}

export interface RobotCenter {
  /** 当前偏好（响应式；设置面板直接绑它） */
  readonly prefs: Ref<RobotPrefs>
  /** 当前该说的那一条；null = 不说话 */
  readonly active: Ref<RobotNotice | null>
  /** 有话说但没说（被频率/队列/忙碌挡住）时冒角标 */
  readonly badge: Ref<boolean>
  /** 当前页面标识（路由路径），静音「这一页」与去重都按它 */
  readonly pageKey: Ref<string>
  /** 现在不能说话的原因；null = 可以说 */
  readonly blockedReason: Ref<string | null>
  /** 设置面板开关（Host 与面板共用） */
  readonly settingsOpen: Ref<boolean>
  /** 详情展开状态（气泡里「看详细说明」） */
  readonly detailOpen: Ref<boolean>
  /**
   * 本页已登记的「口径 / 引导」卡片，页头问号从这里取全文（R-5）。
   *
   * 与 `active` 的区别是：它不受频率、静音、去重影响——用户手动点开就必须看得到，
   * 否则「关掉」就变成了不可逆（§15 风险表「用户找不到被搬走的解释」）。
   */
  readonly helpEntries: Ref<RobotNotice[]>

  /** 登录态变化：按账号重读偏好；传 null 表示登出（按 §5.4 清本机这一份） */
  attachUser(userId: number | string | null): Promise<void>
  /** 进入一页：重置本页计数、延迟 800ms 再说话（§5.2） */
  enterPage(pageKey: string): void
  leavePage(): void
  /** 页面投递一条消息；`ready: false` 表示页面数据未就绪，先压住 */
  announce(input: RobotNoticeInput, options?: { ready?: boolean }): void
  /** 页面数据就绪：把压住的消息放出来 */
  setReady(ready: boolean): void
  /** 页面自报忙碌（正在加载/提交），与输入框、弹窗并列进闭嘴规则第 1 条 */
  setBusy(reason: string, busy: boolean): void
  /** 现场恢复（输入框失焦、弹窗关闭）后补说 */
  flush(): void
  /** 关闭当前这一条；`timeout` 表示到点自动收 */
  dismiss(reason?: 'user' | 'timeout' | 'action'): void
  /** 打开设置面板 / 详情 */
  openSettings(open: boolean): void
  openDetail(open: boolean): void
  /** 执行气泡里的动作 */
  runAction(kind: 'navigate' | 'dismiss', actionLabel?: string): void

  setRate(rate: RobotFrequency): void
  setCategory(category: RobotCategory, enabled: boolean): void
  muteKey(key: string): void
  muteCurrent(): void
  mutePage(): void
  unmuteKey(key: string): void
  unmutePage(page: string): void
  restoreAll(): void
  setQuiet(choice: 'hour' | 'today' | null): void
  setPosition(position: RobotPosition): void
  setAvatar(visible: boolean): void

  /** 仅供测试/登出时重置内存态 */
  reset(): void
}

interface ResolvedDeps extends Required<Omit<RobotCenterDeps, 'remote' | 'onTelemetry'>> {
  remote: RobotRemoteStore | null
  onTelemetry: (event: RobotTelemetryEvent) => void
}

function resolveDeps(deps: RobotCenterDeps): ResolvedDeps {
  return {
    storage: deps.storage,
    now: deps.now ?? (() => Date.now()),
    setTimer: deps.setTimer ?? ((fn, ms) => setTimeout(fn, ms) as unknown as number),
    clearTimer: deps.clearTimer ?? ((id) => clearTimeout(id)),
    isBlocked: deps.isBlocked ?? (() => robotBlockingReason(typeof document === 'undefined' ? null : document)),
    remote: deps.remote ?? null,
    onTelemetry: deps.onTelemetry ?? (() => {})
  }
}

export function createRobotCenter(raw: RobotCenterDeps): RobotCenter {
  const deps = resolveDeps(raw)

  const prefs = ref<RobotPrefs>(defaultRobotPrefs())
  const active = ref<RobotNotice | null>(null)
  const badge = ref(false)
  const pageKey = ref('')
  const blockedReason = ref<string | null>(null)
  const settingsOpen = ref(false)
  const detailOpen = ref(false)
  const helpEntries = ref<RobotNotice[]>([])

  let userId: number | string | null = null
  let seen: RobotSeenMap = readRobotSeen(deps.storage, deps.now())
  let pageSpoken = 0
  let ready = true
  let queue: QueuedNotice[] = []
  let held: RobotNotice[] = []
  const busyReasons = new Set<string>()

  let hideTimer: number | null = null
  let routeTimer: number | null = null
  let pushTimer: number | null = null
  let pushing = false
  /** 路由切换后的 800ms 静默窗（§5.2）；enterPage 之外默认放行 */
  let routeArmed = true

  function now(): number {
    return deps.now()
  }

  function track(event: Omit<RobotTelemetryEvent, 'page'>): void {
    try {
      deps.onTelemetry({ ...event, page: pageKey.value })
    } catch {
      // 埋点不能反过来把机器人弄挂
    }
  }

  function updatePrefs(patch: Partial<RobotPrefs>, options: { push?: boolean } = {}): void {
    prefs.value = { ...prefs.value, ...patch, clientUpdatedAt: now() }
    writeRobotPrefs(prefs.value, userId, deps.storage)
    if (options.push !== false) schedulePush()
  }

  function payloadOf(value: RobotPrefs): RobotPrefsPayload {
    const { serverVersion: _serverVersion, clientUpdatedAt: _clientUpdatedAt, ...payload } = value
    return payload
  }

  function schedulePush(): void {
    if (!deps.remote || userId === null) return
    if (pushTimer !== null) deps.clearTimer(pushTimer)
    pushTimer = deps.setTimer(() => {
      pushTimer = null
      void pushPrefs()
    }, PUSH_DEBOUNCE_MS)
  }

  /**
   * 推送一次。失败一律静默（§6.2）：它本身是后台能力，同步失败不该在界面上弹任何东西。
   * 冲突时按「标量取服务端、静音清单取并集」合并后重推一次，不阻塞用户。
   */
  async function pushPrefs(): Promise<void> {
    if (!deps.remote || userId === null || pushing) return
    pushing = true
    try {
      const result = await deps.remote.save(payloadOf(prefs.value), {
        clientUpdatedAt: prefs.value.clientUpdatedAt,
        baseVersion: prefs.value.serverVersion
      })
      if (result.conflict && result.server) {
        const merged = mergeRobotPreference(prefs.value, result.server)
        prefs.value = merged
        writeRobotPrefs(prefs.value, userId, deps.storage)
        const retry = await deps.remote.save(payloadOf(merged), {
          clientUpdatedAt: merged.clientUpdatedAt,
          baseVersion: result.server.version
        })
        if (!retry.conflict) {
          prefs.value = { ...prefs.value, serverVersion: retry.version }
          writeRobotPrefs(prefs.value, userId, deps.storage)
        }
      } else {
        prefs.value = { ...prefs.value, serverVersion: result.version }
        writeRobotPrefs(prefs.value, userId, deps.storage)
      }
    } catch {
      // 离线/后端未上线：本地照常生效，下次登录再同步
    } finally {
      pushing = false
    }
  }

  async function pullPrefs(): Promise<void> {
    if (!deps.remote || userId === null) return
    try {
      const remote = await deps.remote.load()
      const localHadNewer = prefs.value.clientUpdatedAt > (remote.updatedAt ?? 0)
      if (localHadNewer && remote.payload) {
        // 本机是在离线期间改的（比服务端晚）：档位这些以本机为准，只把对方静音的那些并进来，
        // 否则「断网时关掉了提示、一联网又被打开」——本地就不该只是被覆盖的缓存。
        prefs.value = {
          ...prefs.value,
          mutedKeys: unionRobotList(prefs.value.mutedKeys, remote.payload.mutedKeys),
          mutedPages: unionRobotList(prefs.value.mutedPages, remote.payload.mutedPages),
          introSeen: prefs.value.introSeen || remote.payload.introSeen,
          serverVersion: remote.version
        }
      } else {
        prefs.value = mergeRobotPreference(prefs.value, remote)
      }
      writeRobotPrefs(prefs.value, userId, deps.storage)
      // 服务端还没有记录（首次登录）或本机改得更晚：把这一份推上去
      if (!remote.payload || localHadNewer) schedulePush()
    } catch {
      // 接口不可用：只走本地
    }
  }

  function blockedNow(): string | null {
    if (isRobotQuiet(prefs.value, now())) return 'quiet'
    if (busyReasons.size > 0) return [...busyReasons][0]
    return deps.isBlocked()
  }

  function stopHideTimer(): void {
    if (hideTimer !== null) {
      deps.clearTimer(hideTimer)
      hideTimer = null
    }
  }

  function startHideTimer(notice: RobotNotice): void {
    stopHideTimer()
    // p1 不自动收起：任务结果要等用户自己处理或手动关（§9）
    if (notice.priority === 'p1' || notice.priority === 'p0') return
    hideTimer = deps.setTimer(() => {
      hideTimer = null
      dismiss('timeout')
    }, ROBOT_AUTO_HIDE_MS)
  }

  function markSeen(notice: RobotNotice): void {
    seen = {
      ...seen,
      [notice.key]: { at: now(), once: notice.once ?? 'day' }
    }
    writeRobotSeen(deps.storage, seen)
  }

  function isSeen(notice: RobotNotice): boolean {
    const entry = seen[notice.key]
    if (!entry) return false
    return !isRobotSeenExpired(entry, now())
  }

  function allowedByRate(notice: RobotNotice): boolean {
    const rule = ROBOT_RATE_RULES[prefs.value.rate]
    if (rule.perPage <= 0 || rule.daily <= 0) return false
    if (rule.categories && !rule.categories.includes(notice.category)) return false
    if (rule.priorities && !rule.priorities.includes(notice.priority)) return false
    // p1/p0 不受「每页 N 条」限制：任务结果与失败兜底的价值高于安静，
    // 该打断就打断（抢占时会把额度还回去，见 enqueue），否则「页面已经讲过一句」会把它彻底吞掉。
    if (pageSpoken >= rule.perPage && ROBOT_PRIORITY_ORDER[notice.priority] > ROBOT_PRIORITY_ORDER.p1) {
      return false
    }
    return robotSpokenToday(seen, now()) < rule.daily
  }

  function show(notice: RobotNotice): void {
    active.value = notice
    detailOpen.value = false
    badge.value = false
    markSeen(notice)
    pageSpoken += 1
    startHideTimer(notice)
    if (notice.key === ROBOT_INTRO_KEY && !prefs.value.introSeen) {
      // 自我介绍每个账号只说一次，说过就记进偏好（跟着账号跨端同步）
      updatePrefs({ introSeen: true })
    }
    track({ type: 'show', key: notice.key })
  }

  /** 队列里挑下一条能说的；不能说的按规则丢弃或只留角标 */
  function pump(): void {
    if (active.value) return
    // 路由刚切过来的 800ms 里不开口（§5.2），消息先在队列里等
    if (!routeArmed) {
      if (queue.length > 0) badge.value = true
      return
    }
    const block = blockedNow()
    blockedReason.value = block
    if (block) {
      if (queue.length > 0) badge.value = true
      return
    }
    while (queue.length > 0) {
      const entry = queue.shift() as QueuedNotice
      const notice = entry.notice
      if (notice.expiresAt !== undefined && notice.expiresAt <= now()) continue
      if (!entry.resumed && isSeen(notice)) continue
      // 被抢占后回来的那条已经占过一次「每页额度」，补说时不再被频率二次拦住
      if (!entry.resumed && !allowedByRate(notice)) {
        // 被频率挡住：p1 至少冒个角标，别让「有任务结果」这件事彻底消失
        if (notice.priority === 'p1') badge.value = true
        continue
      }
      show(notice)
      return
    }
    badge.value = false
  }

  function enqueue(notice: RobotNotice): void {
    if (!prefs.value.avatar) return
    if (!prefs.value.categories[notice.category]) return
    if (prefs.value.mutedKeys.includes(notice.key)) return
    if (pageKey.value && prefs.value.mutedPages.includes(pageKey.value)) return
    if (isSeen(notice)) return
    if (active.value?.key === notice.key) return
    if (queue.some(item => item.notice.key === notice.key)) return

    if (!allowedByRate(notice)) {
      if (notice.priority === 'p1') badge.value = true
      return
    }

    const current = active.value
    const preempts = current
      ? ROBOT_PRIORITY_ORDER[notice.priority] < ROBOT_PRIORITY_ORDER[current.priority]
      : false

    if (current && preempts) {
      // p1 抢占 p2/p3：当前那条先让位，等这一条说完继续（§5.2 不丢弃）
      stopHideTimer()
      active.value = null
      // 刚才那一次展示没有说完，把本页的额度还回去，补说时才不会被「每页 1 条」二次拦住
      pageSpoken = Math.max(0, pageSpoken - 1)
      queue.unshift({ notice: current, resumed: true })
      // 新的这一条排在它前面：抢占的意义就是「更重要的先说完」
      queue.unshift({ notice })
      pump()
      return
    }

    if (queue.length >= ROBOT_QUEUE_LIMIT) {
      badge.value = true
      return
    }

    queue.push({ notice })
    pump()
  }

  function dismiss(reason: 'user' | 'timeout' | 'action' = 'user'): void {
    const current = active.value
    if (!current) return
    stopHideTimer()
    active.value = null
    detailOpen.value = false
    if (reason !== 'timeout') track({ type: 'dismiss', key: current.key })
    if (reason === 'timeout' && queue.length === 0) badge.value = false
    pump()
  }

  /**
   * 把「口径 / 引导」类消息登记成这一页的可复看卡片。
   *
   * 登记发生在静音、分类开关、去重这些闸门之前：问号是手动入口，
   * 用户既可以把这类消息关掉，也随时能点开看全文——两者不冲突（§3 场景 4）。
   * 任务结果与系统提醒不进这里：它们不是「这一页怎么读」。
   */
  function rememberHelp(notice: RobotNotice): void {
    if (notice.category !== 'scope' && notice.category !== 'guide') return
    const index = helpEntries.value.findIndex(item => item.key === notice.key)
    const next = helpEntries.value.slice()
    if (index >= 0) next[index] = notice
    else next.push(notice)
    next.sort((a, b) => ROBOT_PRIORITY_ORDER[a.priority] - ROBOT_PRIORITY_ORDER[b.priority])
    helpEntries.value = next
  }

  function pushNotice(input: RobotNoticeInput, options: { ready?: boolean } = {}): void {
    const notice = withSourceDefaults(input)
    if (!notice.key || !notice.text) return
    if (notice.expiresAt !== undefined && notice.expiresAt <= now()) return
    rememberHelp(notice)
    if (!prefs.value.avatar) return
    if (!prefs.value.categories[notice.category]) return
    if (prefs.value.mutedKeys.includes(notice.key)) return
    if (pageKey.value && prefs.value.mutedPages.includes(pageKey.value)) return
    if (isSeen(notice)) return

    const pageReady = options.ready ?? ready
    if (!pageReady) {
      if (!held.some(item => item.key === notice.key)) held.push(notice)
      return
    }
    enqueue(notice)
  }

  function maybeIntroduce(): void {
    if (prefs.value.introSeen) return
    // 自我介绍与页面数据无关：它是「我在哪儿、怎么关」，不抢数据就绪这一道闸
    pushNotice(
      {
        key: ROBOT_INTRO_KEY,
        category: 'guide',
        priority: 'p2',
        text: ROBOT_COPY.intro.text,
        detail: ROBOT_COPY.intro.detail,
        once: 'ever',
        sourceId: ROBOT_SOURCES.onboarding
      },
      { ready: true }
    )
  }

  function resetPageState(): void {
    stopHideTimer()
    if (routeTimer !== null) {
      deps.clearTimer(routeTimer)
      routeTimer = null
    }
    active.value = null
    detailOpen.value = false
    // 说明卡跟着页面走：换一页之后问号里不该还挂着上一页的口径
    helpEntries.value = []
    queue = []
    held = []
    pageSpoken = 0
    badge.value = false
    // 定时器已经撤掉，静默窗也随之解除；否则清一次状态就会把机器人永久冻在「还没到 800ms」
    routeArmed = true
  }

  function enterRobotPage(nextPageKey: string): void {
    const changed = nextPageKey !== pageKey.value
    pageKey.value = nextPageKey
    if (changed) resetPageState()
    routeArmed = false
    if (routeTimer !== null) deps.clearTimer(routeTimer)
    routeTimer = deps.setTimer(() => {
      routeTimer = null
      routeArmed = true
      maybeIntroduce()
      pump()
    }, ROBOT_ROUTE_DELAY_MS)
  }

  function muteNoticeKey(key: string): void {
    updatePrefs({ mutedKeys: muteRobotKey(prefs.value, key).mutedKeys })
    track({ type: 'mute', key })
    if (active.value?.key === key) dismiss('user')
  }

  function muteCurrentNotice(): void {
    const current = active.value
    if (current) muteNoticeKey(current.key)
  }

  function muteCurrentPage(): void {
    if (!pageKey.value) return
    const current = active.value
    updatePrefs({ mutedPages: muteRobotPage(prefs.value, pageKey.value).mutedPages })
    if (current) track({ type: 'mute', key: current.key, action: 'page' })
    dismiss('user')
  }

  return {
    prefs,
    active,
    badge,
    pageKey,
    blockedReason,
    settingsOpen,
    detailOpen,
    helpEntries,

    async attachUser(nextUserId) {
      if (nextUserId === userId) return
      const previous = userId
      // 登出：清本机这一份缓存，换号不继承上一个人的静音与频率（§5.4）
      if (previous !== null && (nextUserId === null || nextUserId === '')) {
        clearRobotPrefs(previous, deps.storage)
      }
      userId = nextUserId
      prefs.value = readRobotPrefs(userId, deps.storage)
      seen = readRobotSeen(deps.storage, now())
      const currentPage = pageKey.value
      resetPageState()
      // 首次挂载时 Host 的「进入页面」可能早于登录态就绪，这里补一次，别把首访引导吞掉
      if (currentPage) enterRobotPage(currentPage)
      await pullPrefs()
    },

    enterPage(nextPageKey) {
      enterRobotPage(nextPageKey)
    },

    leavePage() {
      resetPageState()
      routeArmed = true
      pageKey.value = ''
    },

    announce(input, options) {
      pushNotice(input, options)
    },

    setReady(value) {
      ready = value
      if (!value) return
      const pending = held
      held = []
      for (const notice of pending) enqueue(notice)
    },

    setBusy(reason, busy) {
      if (busy) busyReasons.add(reason)
      else busyReasons.delete(reason)
      blockedReason.value = blockedNow()
      if (!busy) pump()
    },

    flush() {
      pump()
    },

    dismiss,

    openSettings(open) {
      settingsOpen.value = open
      if (open) detailOpen.value = false
    },

    openDetail(open) {
      detailOpen.value = open
      if (open && active.value) track({ type: 'detail', key: active.value.key })
    },

    runAction(kind, actionLabel) {
      const current = active.value
      if (current) track({ type: 'action', key: current.key, action: actionLabel ?? kind })
      dismiss('action')
    },

    setRate(rate) {
      updatePrefs({ rate })
      pump()
    },

    setCategory(category, enabled) {
      updatePrefs({ categories: { ...prefs.value.categories, [category]: enabled } })
    },

    muteKey: muteNoticeKey,

    muteCurrent: muteCurrentNotice,

    mutePage: muteCurrentPage,

    unmuteKey(key) {
      updatePrefs({ mutedKeys: unmuteRobotKey(prefs.value, key).mutedKeys })
    },

    unmutePage(page) {
      updatePrefs({ mutedPages: unmuteRobotPage(prefs.value, page).mutedPages })
    },

    restoreAll() {
      const restored = unmuteAllRobot(prefs.value)
      updatePrefs({ mutedKeys: restored.mutedKeys, mutedPages: restored.mutedPages })
    },

    setQuiet(choice) {
      updatePrefs({ quietUntil: choice ? robotQuietUntil(choice, now()) : null })
      if (!choice) pump()
    },

    setPosition(position) {
      updatePrefs({ position })
    },

    setAvatar(visible) {
      updatePrefs({ avatar: visible })
      if (!visible) dismiss('user')
    },

    reset() {
      stopHideTimer()
      resetPageState()
      prefs.value = readRobotPrefs(userId, deps.storage)
      seen = readRobotSeen(deps.storage, now())
      pageKey.value = ''
      settingsOpen.value = false
      blockedReason.value = null
      busyReasons.clear()
      ready = true
    }
  }
}

/** 浏览器里就用 localStorage；单测/SSR 环境退化成内存，绝不因为存储不可用把页面弄挂 */
function browserStorage(): RobotStorage {
  try {
    if (typeof window !== 'undefined' && window.localStorage) return window.localStorage
  } catch {
    // 隐私模式禁用存储时会抛异常
  }
  const memory = new Map<string, string>()
  return {
    getItem: key => memory.get(key) ?? null,
    setItem: (key, value) => void memory.set(key, value),
    removeItem: key => void memory.delete(key)
  }
}

/**
 * 真接口在用到时才加载（`import()`）：`api/http.ts` 会引 router，router 又引 views，
 * 而 views 将来会引 `useRobotNotices` —— 静态引入会绕成一个环。动态引入把这个环断开，
 * 也让只测中枢的用例不必拉起整个应用。
 */
const defaultRemote: RobotRemoteStore = {
  async load() {
    const { robotPreferenceApi } = await import('../../api/robotPreference')
    return robotPreferenceApi.get()
  },
  async save(payload, meta) {
    const { robotPreferenceApi } = await import('../../api/robotPreference')
    return robotPreferenceApi.put(payload, meta)
  }
}

/** 全应用唯一一份：RobotHost 与 useRobotNotices 都从这里取 */
export const robotCenter = createRobotCenter({
  storage: browserStorage(),
  remote: defaultRemote
})
