/**
 * 分包加载失败识别（SPEC-UI-9 H1-2）。
 *
 * 发版后老标签页点新入口，浏览器拿到的还是旧 index，按旧文件名去取分包就会 404：
 * 界面上停在「加载中」或白屏，没有任何可做的事。这里把三种浏览器文案收口到一个判定，
 * 命中后给一次全屏提示与「刷新页面」——只提示一次，避免刷新循环。
 *
 * 判定与提示分离：`isChunkLoadFailure` 纯函数（单测钉文案），
 * `notifyChunkLoadFailure` 负责「同一会话只提示一次」。
 */
import { ref } from 'vue'
import { logWarn } from './errorLog'
import { rememberRawDetail } from './errorRaw'

/** 提示文案：与全屏提示面板同一句，诊断包里也认这一条 */
export const CHUNK_FAILURE_TEXT = '页面版本已更新，刷新后继续'

/**
 * 三种真实浏览器文案：
 * - Chrome / Edge：Failed to fetch dynamically imported module
 * - Firefox：Importing a module script failed
 * - Safari：Load failed
 */
const CHUNK_FAILURE_PATTERNS: RegExp[] = [
  /Failed to fetch dynamically imported module/i,
  /Importing a module script failed/i,
  /Load failed/i,
]

export function isChunkLoadFailure(error: unknown): boolean {
  if (!error) return false
  const text = error instanceof Error ? `${error.name}: ${error.message}` : String(error)
  return CHUNK_FAILURE_PATTERNS.some((pattern) => pattern.test(text))
}

/** 全屏提示是否展示；由 App.vue 挂载的提示面板读它 */
export const chunkLoadNoticeVisible = ref(false)
/** 同一会话只提示一次：命中过就不再弹，避免「刷新→再失败→再提示」的循环 */
let notified = false

/** 命中返回 true；未命中返回 false，调用方不必再判断 */
export function notifyChunkLoadFailure(error: unknown): boolean {
  if (!isChunkLoadFailure(error)) return false
  const raw = error instanceof Error ? (error.stack || error.message) : String(error)
  logWarn('app/chunk-load-failed', raw)
  if (!notified) {
    notified = true
    rememberRawDetail(CHUNK_FAILURE_TEXT, raw)
    chunkLoadNoticeVisible.value = true
  }
  return true
}

/** 提示里的按钮：只刷新，不自动刷新（自动刷可能吞掉用户正在填的内容） */
export function reloadPageForChunkFailure(): void {
  if (typeof window !== 'undefined') window.location.reload()
}

/**
 * 监听 Vite 的 `vite:preloadError`：动态 import 失败时它先于 router.onError 触发。
 * 两个口都接，任一命中即提示（不同浏览器/失败时机只命中其中一个）。
 */
export function setupChunkLoadGuard(
  target: Pick<Window, 'addEventListener'> = window
): void {
  target.addEventListener('vite:preloadError', (event) => {
    const payload = (event as Event & { payload?: unknown }).payload
    notifyChunkLoadFailure(payload ?? event)
  })
}

/** 单测用：把「已提示」与可见状态清回初始 */
export function resetChunkLoadNotice(): void {
  notified = false
  chunkLoadNoticeVisible.value = false
}
