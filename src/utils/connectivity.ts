/**
 * 断网感知（SPEC-UI-9 H1-3）。
 *
 * 全站此前没有任何 online / offline 监听：断网时 N 个页面各报各的「无法连接服务器」，
 * 恢复联网后也没有人告诉你「可以再试了」。这里只做两件事：
 * 1. 把浏览器的联网状态变成响应式 `isOnline`；
 * 2. 恢复联网后亮 3 秒「网络已恢复」再自动收起。
 *
 * 刻意不替页面自动重读：一次联网若引发几十页并发读，会把后端刚恢复的那几秒再打满。
 */
import { ref } from 'vue'
import { logInfo } from './errorLog'

export const isOnline = ref(true)
/** 断网→恢复时短暂亮起；3 秒后自动收起 */
export const networkRecovered = ref(false)

const RECOVER_HIDE_MS = 3000
let hideTimer: ReturnType<typeof setTimeout> | null = null

function clearHideTimer(): void {
  if (hideTimer !== null) {
    clearTimeout(hideTimer)
    hideTimer = null
  }
}

/**
 * 注册监听；返回卸载函数。
 * `target` 与 `readOnline` 可注入，单测不必真的切系统网络。
 */
export function setupConnectivity(
  target: Pick<Window, 'addEventListener' | 'removeEventListener'> = window,
  readOnline: () => boolean = () => navigator.onLine
): () => void {
  isOnline.value = readOnline()

  const onOffline = (): void => {
    clearHideTimer()
    networkRecovered.value = false
    isOnline.value = false
    logInfo('connectivity/offline', { at: Date.now() })
  }

  const onOnline = (): void => {
    isOnline.value = true
    networkRecovered.value = true
    clearHideTimer()
    hideTimer = setTimeout(() => {
      networkRecovered.value = false
      hideTimer = null
    }, RECOVER_HIDE_MS)
    logInfo('connectivity/online', { at: Date.now() })
  }

  target.addEventListener('online', onOnline)
  target.addEventListener('offline', onOffline)

  return () => {
    target.removeEventListener('online', onOnline)
    target.removeEventListener('offline', onOffline)
    clearHideTimer()
  }
}

/** 单测用：清回「在线且没有恢复提示」 */
export function resetConnectivity(): void {
  isOnline.value = true
  networkRecovered.value = false
  clearHideTimer()
}
