/**
 * 读失败度量（SPEC-UI-8 G1）：会话内累计，只落 `[ui-info]` 日志，不做看板、不落 localStorage。
 *
 * 四个数（口径写死在这里，页面不各算各的）：
 * 1. 错误曝光率 = 至少出现过一次错误块的页面浏览 / 总页面浏览；
 * 2. 重试成功率 = 重试后读成功的次数 / 重试次数；
 * 3. 误判空态率 = 错误态仍渲染空态的次数 / 错误曝光次数（M1 判据之后应恒为 0，
 *    另单独记「错误 + 0 行」的风险触发数，用来看 M1 到底挡了多少次）；
 * 4. 恢复耗时 = 错误出现到错误消失的平均毫秒数。
 *
 * 只做会话内累计：刷新即清零。没有后端埋点端点时不假装有，日志留在控制台。
 */
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
/** 最近一次页面浏览的路径：曝光 / 重试事件带上它，日志里才认得出是哪一屏 */
let currentPath = ''
/** 这一页浏览是否已经记过曝光：曝光率按页面浏览算，同一页多次错误只算一次 */
let currentViewExposed = false

function ratio(numerator: number, denominator: number): number {
  return denominator > 0 ? numerator / denominator : 0
}

/** 路由 afterEach 每落一页记一次；同时重置「本页是否已曝光」的标记 */
export function recordPageView(path: string): void {
  state.pageViews += 1
  currentViewExposed = false
  currentPath = path
  logInfo('metrics/page_view', { path, pageViews: state.pageViews })
}

/**
 * 错误块出现时记一次曝光。
 * `zeroRows` = 这一发错误发生时屏幕上没有一行可看（错误块整块顶上来）；
 * 它是「误判空态」的邻居，不是同一个数——M1 之后前者仍会发生，后者应为 0。
 */
export function recordErrorExposure(humanText: string, surface: ErrorSurface, zeroRows: boolean): void {
  state.exposures += 1
  if (!currentViewExposed) {
    state.exposedPageViews += 1
    currentViewExposed = true
  }
  if (zeroRows) state.errorZeroRowCases += 1
  logInfo('metrics/error_exposure', {
    surface,
    zeroRows,
    page: currentPath,
    text: humanText,
    exposures: state.exposures
  })
}

/**
 * 错误态下仍然渲染了空态——M1 判据（`!loading && !error && 0 行`）保证本版没有这条路径，
 * 计数应恒为 0。留着这一发是为了让「万一哪天有人绕过判据」能留下痕迹，而不是悄悄错报。
 */
export function recordFalseEmpty(humanText: string, surface: ErrorSurface): void {
  state.falseEmptyShown += 1
  logInfo('metrics/false_empty', { surface, page: currentPath, text: humanText })
}

/** 重试真正发出去时记一次（被防连点守卫拦下的不算） */
export function recordRetryAttempt(humanText: string, source: RetrySource): void {
  state.retryAttempts += 1
  logInfo('metrics/retry_attempt', {
    source,
    page: currentPath,
    text: humanText,
    retryAttempts: state.retryAttempts
  })
}

/** 这一发重试的结果：读成功算成功，读失败算失败（页面下次再点会记新的一次尝试） */
export function recordRetryOutcome(success: boolean, source: RetrySource): void {
  if (success) state.retrySuccesses += 1
  logInfo('metrics/retry_outcome', {
    success,
    source,
    page: currentPath,
    retrySuccesses: state.retrySuccesses
  })
}

/** 错误消失时记一次恢复耗时；由调用方用本地开始时间算好毫秒交进来 */
export function recordRecovery(elapsedMs: number, humanText: string): void {
  const safeMs = Math.max(0, Math.round(elapsedMs))
  state.recoveryCount += 1
  state.recoveryTotalMs += safeMs
  logInfo('metrics/recovery', { ms: safeMs, page: currentPath, text: humanText })
}

/** 会话内快照：简报与控制台排查用；比率在这个出口算，页面不重复实现 */
export function getErrorMetrics(): ErrorMetricsSnapshot {
  return {
    pageViews: state.pageViews,
    exposedPageViews: state.exposedPageViews,
    exposureRate: ratio(state.exposedPageViews, state.pageViews),
    exposures: state.exposures,
    errorZeroRowCases: state.errorZeroRowCases,
    falseEmptyShown: state.falseEmptyShown,
    falseEmptyRate: ratio(state.falseEmptyShown, state.exposures),
    retryAttempts: state.retryAttempts,
    retrySuccesses: state.retrySuccesses,
    retrySuccessRate: ratio(state.retrySuccesses, state.retryAttempts),
    recoveryCount: state.recoveryCount,
    avgRecoveryMs: state.recoveryCount > 0 ? Math.round(state.recoveryTotalMs / state.recoveryCount) : 0
  }
}

/** 单测用：把累计值、当前路径、本页曝光标记一起清回初始 */
export function resetErrorMetrics(): void {
  state = { ...EMPTY_STATE }
  currentPath = ''
  currentViewExposed = false
}
