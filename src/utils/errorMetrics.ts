/**
 * 读失败度量（SPEC-UI-8 G1；SPEC-UI-9 H4 加分桶与持久化）。
 *
 * 四个数（口径写死在这里，页面不各算各的）：
 * 1. 错误曝光率 = 至少出现过一次错误块的页面浏览 / 总页面浏览；
 * 2. 重试成功率 = 重试后读成功的次数 / 重试次数；
 * 3. 误判空态率 = 错误态仍渲染空态的次数 / 错误曝光次数（M1 判据之后应恒为 0，
 *    另单独记「错误 + 0 行」的风险触发数，用来看 M1 到底挡了多少次）；
 * 4. 恢复耗时 = 错误出现到错误消失的平均毫秒数。
 *
 * 会话内累计并落 localStorage（跨标签保留 7 天，SPEC-UI-10 G-5）：刷新一次不该把
 * 「刚发生的那一发」连同 requestId 一起抹掉（SPEC-UI-9 H4-3）。
 * 存储不可用（无痕 / 配额满）时静默降级为内存。
 */
import { errorKindOfText } from './errorText'
import { logInfo } from './errorLog'

/** 读失败发生在哪一块；分开记是为了看「同一个读口在两种壳里各发生了几次」 */
export type ErrorSurface = 'table' | 'empty' | 'block'
/** 重试是谁发起的：用户点 / 只读页自动退避（U3） */
export type RetrySource = 'manual' | 'auto'

export interface ErrorMetricsSnapshot {
  pageViews: number
  exposedPageViews: number
  /** exposedPageViews / pageViews；没有页面浏览时为 0 */
  exposureRate: number
  exposures: number
  errorZeroRowCases: number
  falseEmptyShown: number
  /** falseEmptyShown / exposures；没有曝光时为 0 */
  falseEmptyRate: number
  retryAttempts: number
  retrySuccesses: number
  /** retrySuccesses / retryAttempts；没有重试时为 0 */
  retrySuccessRate: number
  recoveryCount: number
  avgRecoveryMs: number
}

interface MetricsState {
  pageViews: number
  exposedPageViews: number
  exposures: number
  errorZeroRowCases: number
  falseEmptyShown: number
  retryAttempts: number
  retrySuccesses: number
  recoveryCount: number
  recoveryTotalMs: number
}

const EMPTY_STATE: MetricsState = {
  pageViews: 0,
  exposedPageViews: 0,
  exposures: 0,
  errorZeroRowCases: 0,
  falseEmptyShown: 0,
  retryAttempts: 0,
  retrySuccesses: 0,
  recoveryCount: 0,
  recoveryTotalMs: 0
}

let state: MetricsState = { ...EMPTY_STATE }
/** 按页面分桶（SPEC-UI-9 H4-1）：全局四个数不动，另存一份「哪一页最常读失败」 */
const pageStates = new Map<string, MetricsState>()
/** 最近一次页面浏览的路径：曝光 / 重试事件带上它，日志里才认得出是哪一屏 */
let currentPath = ''
/** 这一页浏览是否已经记过曝光：曝光率按页面浏览算，同一页多次错误只算一次 */
let currentViewExposed = false

export const ERROR_METRICS_STORAGE_KEY = '__ui_error_metrics_v1'
/** 度量跨标签保留 7 天（SPEC-UI-10 G-5）：原来落 sessionStorage，关标签就清，看板只能当次自测 */
const METRICS_TTL_MS = 7 * 24 * 60 * 60 * 1000
/** 开发页与 hidden 路由不进分母：它们是治理工具，不是业务页面浏览 */
const EXCLUDED_PREFIX = '/workspace/dev/'

/** 错误类型分布的中文名（SPEC-UI-10 G-4）：看板要回答「错在哪」，不只「哪页差」 */
const KIND_LABELS: Record<string, string> = {
  offline: '断网',
  timeout: '超时',
  forbidden: '无权限',
  unauthorized: '登录过期',
  server: '服务异常',
  chunk: '分包失败',
  unknown: '其他'
}

/** 累计每种错误的次数：只在曝光时记，重试不重复计 */
let kindCounts: Record<string, number> = {}

function ratio(numerator: number, denominator: number): number {
  return denominator > 0 ? numerator / denominator : 0
}

function snapshotOf(source: MetricsState): ErrorMetricsSnapshot {
  return {
    pageViews: source.pageViews,
    exposedPageViews: source.exposedPageViews,
    exposureRate: ratio(source.exposedPageViews, source.pageViews),
    exposures: source.exposures,
    errorZeroRowCases: source.errorZeroRowCases,
    falseEmptyShown: source.falseEmptyShown,
    falseEmptyRate: ratio(source.falseEmptyShown, source.exposures),
    retryAttempts: source.retryAttempts,
    retrySuccesses: source.retrySuccesses,
    retrySuccessRate: ratio(source.retrySuccesses, source.retryAttempts),
    recoveryCount: source.recoveryCount,
    avgRecoveryMs: source.recoveryCount > 0 ? Math.round(source.recoveryTotalMs / source.recoveryCount) : 0
  }
}

function bucket(path: string): MetricsState {
  let found = pageStates.get(path)
  if (!found) {
    found = { ...EMPTY_STATE }
    pageStates.set(path, found)
  }
  return found
}

interface PersistedMetrics {
  global: MetricsState
  pages: Array<[string, MetricsState]>
  currentPath: string
  currentViewExposed: boolean
  /** 落盘时间：超过 TTL 的一律丢弃，避免半年前的旧数据混进来（G-5） */
  savedAt?: number
  /** 错误类型分布（G-4） */
  kinds?: Record<string, number>
}

function pickState(value: unknown): MetricsState {
  const fallback = { ...EMPTY_STATE }
  if (!value || typeof value !== 'object') return fallback
  for (const key of Object.keys(fallback) as Array<keyof MetricsState>) {
    const raw = (value as Record<string, unknown>)[key]
    if (typeof raw === 'number' && Number.isFinite(raw) && raw >= 0) fallback[key] = raw
  }
  return fallback
}

function persist(): void {
  try {
    if (typeof localStorage === 'undefined') return
    const payload: PersistedMetrics = {
      global: state,
      pages: Array.from(pageStates.entries()),
      currentPath,
      currentViewExposed,
      savedAt: Date.now(),
      kinds: kindCounts
    }
    localStorage.setItem(ERROR_METRICS_STORAGE_KEY, JSON.stringify(payload))
  } catch {
    // 无痕模式 / 配额满：度量静默降级为内存，不影响页面
  }
}

function restore(): void {
  try {
    if (typeof localStorage === 'undefined') return
    const raw = localStorage.getItem(ERROR_METRICS_STORAGE_KEY)
    if (!raw) return
    const parsed = JSON.parse(raw) as Partial<PersistedMetrics>
    // 超过 7 天的旧数据不当基线（G-5）：宁可从零开始，也不要拿过期样本下结论
    if (typeof parsed.savedAt !== 'number' || Date.now() - parsed.savedAt > METRICS_TTL_MS) {
      localStorage.removeItem(ERROR_METRICS_STORAGE_KEY)
      return
    }
    state = pickState(parsed.global)
    pageStates.clear()
    for (const [path, value] of parsed.pages ?? []) {
      if (typeof path === 'string') pageStates.set(path, pickState(value))
    }
    kindCounts = {}
    for (const [kind, count] of Object.entries(parsed.kinds ?? {})) {
      if (typeof count === 'number' && Number.isFinite(count) && count > 0) kindCounts[kind] = count
    }
    currentPath = typeof parsed.currentPath === 'string' ? parsed.currentPath : ''
    currentViewExposed = !!parsed.currentViewExposed
  } catch {
    // 坏数据当没有：下一次写入会覆盖
  }
}

restore()

/**
 * 分桶与日志用的页面键：去掉查询串与哈希，只留路径（SPEC-UI-9 B1）。
 * 站内 Tab 是写进地址栏的（`?tab=`），按 fullPath 分桶会把同一页裂成好几个桶，
 * 明细里就看不出「哪一页最差」。
 */
function pageKeyOf(path: string): string {
  const cut = path.search(/[?#]/)
  return cut < 0 ? path : path.slice(0, cut)
}

/** 路由 afterEach 每落一页记一次；同时重置「本页是否已曝光」的标记 */
export function recordPageView(path: string): void {
  const key = pageKeyOf(path)
  // 开发页与 hidden 路由不进页面浏览分母（SPEC-UI-9 H4-1）
  if (!key || key.startsWith(EXCLUDED_PREFIX)) return
  state.pageViews += 1
  bucket(key).pageViews += 1
  currentPath = key
  currentViewExposed = false
  logInfo('metrics/page_view', { path: key, pageViews: state.pageViews })
  persist()
}

/**
 * 页面内 Tab 切换（不改路由）由宿主显式调（SPEC-UI-9 H4-1）。
 * Tab 是一次新的浏览面，语义与落一页一致；被动切换不会被自动计数。
 */
export function recordView(key: string): void {
  recordPageView(key)
}

/**
 * 错误块出现时记一次曝光。
 * `zeroRows` = 这一发错误发生时屏幕上没有一行可看（错误块整块顶上来）；
 * 它是「误判空态」的邻居，不是同一个数——M1 之后前者仍会发生，后者应为 0。
 */
export function recordErrorExposure(humanText: string, surface: ErrorSurface, zeroRows: boolean): void {
  state.exposures += 1
  const kind = errorKindOfText(humanText) ?? 'unknown'
  kindCounts[kind] = (kindCounts[kind] ?? 0) + 1
  const page = bucket(currentPath)
  page.exposures += 1
  if (!currentViewExposed) {
    state.exposedPageViews += 1
    page.exposedPageViews += 1
    currentViewExposed = true
  }
  if (zeroRows) {
    state.errorZeroRowCases += 1
    page.errorZeroRowCases += 1
  }
  logInfo('metrics/error_exposure', {
    surface,
    kind,
    zeroRows,
    page: currentPath,
    text: humanText,
    exposures: state.exposures
  })
  persist()
}

/**
 * 错误态下仍然渲染了空态——M1 判据（`!loading && !error && 0 行`）保证本版没有这条路径，
 * 计数应恒为 0。留着这一发是为了让「万一哪天有人绕过判据」能留下痕迹，而不是悄悄错报。
 */
export function recordFalseEmpty(humanText: string, surface: ErrorSurface): void {
  state.falseEmptyShown += 1
  bucket(currentPath).falseEmptyShown += 1
  logInfo('metrics/false_empty', { surface, page: currentPath, text: humanText })
  persist()
}

/** 重试真正发出去时记一次（被防连点守卫拦下的不算） */
export function recordRetryAttempt(humanText: string, source: RetrySource): void {
  state.retryAttempts += 1
  bucket(currentPath).retryAttempts += 1
  logInfo('metrics/retry_attempt', {
    source,
    page: currentPath,
    text: humanText,
    retryAttempts: state.retryAttempts
  })
  persist()
}

/** 这一发重试的结果：读成功算成功，读失败算失败（页面下次再点会记新的一次尝试） */
export function recordRetryOutcome(success: boolean, source: RetrySource): void {
  if (success) {
    state.retrySuccesses += 1
    bucket(currentPath).retrySuccesses += 1
  }
  logInfo('metrics/retry_outcome', {
    success,
    source,
    page: currentPath,
    retrySuccesses: state.retrySuccesses
  })
  persist()
}

/** 错误消失时记一次恢复耗时；由调用方用本地开始时间算好毫秒交进来 */
export function recordRecovery(elapsedMs: number, humanText: string): void {
  const safeMs = Math.max(0, Math.round(elapsedMs))
  state.recoveryCount += 1
  state.recoveryTotalMs += safeMs
  const page = bucket(currentPath)
  page.recoveryCount += 1
  page.recoveryTotalMs += safeMs
  logInfo('metrics/recovery', { ms: safeMs, page: currentPath, text: humanText })
  persist()
}

/** 会话内快照：简报与控制台排查用；比率在这个出口算，页面不重复实现 */
export function getErrorMetrics(): ErrorMetricsSnapshot {
  return snapshotOf(state)
}

/**
 * 按页面分桶快照（SPEC-UI-9 H4-1）。
 * 返回普通对象方便直接 JSON / 表格渲染；页面键是去掉 query/hash 的路径（SPEC-UI-9 B1）。
 */
export function getErrorMetricsByPage(): Record<string, ErrorMetricsSnapshot> {
  const result: Record<string, ErrorMetricsSnapshot> = {}
  for (const [path, value] of pageStates) result[path] = snapshotOf(value)
  return result
}

/** 单测用：把累计值、当前路径、本页曝光标记一起清回初始（连同持久化快照） */
export function resetErrorMetrics(): void {
  state = { ...EMPTY_STATE }
  pageStates.clear()
  kindCounts = {}
  currentPath = ''
  currentViewExposed = false
  try {
    if (typeof localStorage !== 'undefined') localStorage.removeItem(ERROR_METRICS_STORAGE_KEY)
  } catch {
    // 存储不可用：内存已经清干净
  }
}

export interface ErrorKindRow {
  kind: string
  label: string
  count: number
  /** 占全部曝光的比例；没有曝光时为 0 */
  ratio: number
}

/**
 * 错误类型分布（SPEC-UI-10 G-4）：看板用来回答「错在哪」，按次数倒序。
 * 只统计曝光，不统计重试——同一发错误重试十次仍是同一错。
 */
export function getErrorKindBreakdown(): ErrorKindRow[] {
  const total = Object.values(kindCounts).reduce((sum, n) => sum + n, 0)
  return Object.entries(kindCounts)
    .filter(([, count]) => count > 0)
    .map(([kind, count]) => ({ kind, label: KIND_LABELS[kind] ?? kind, count, ratio: ratio(count, total) }))
    .sort((a, b) => b.count - a.count)
}
