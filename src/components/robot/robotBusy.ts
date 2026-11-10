/**
 * 「现在能不能说话」的现场判定（SPEC-UI-11 §5.3 第 2~4 条）。
 *
 * 中枢只认一个 `() => string | null`：返回 null = 可以说，返回字符串 = 为什么不能说。
 * 把 DOM 判定单独放在这里，中枢本身就能在单测里跑纯逻辑，不必造一棵真的组件树。
 *
 * 判据只认「看得见」：antd 的 Modal / Drawer 关掉之后节点还留在 DOM 里，
 * 按选择器数节点会把「刚关过弹窗」误判成「一直开着」。所以统一按 `getClientRects().length` 量。
 */
export const ROBOT_BLOCK_INPUT = 'input'
export const ROBOT_BLOCK_MODAL = 'modal'
export const ROBOT_BLOCK_ERROR = 'error'

function isVisible(element: Element): boolean {
  // happy-dom / jsdom 里没有布局，getClientRects 一律为空；测试要的是「有没有这个节点」，
  // 所以只有真实浏览器（实现了非空的 getClientRects）才按可见性过滤。
  if (typeof element.getClientRects !== 'function') return true
  const rects = element.getClientRects()
  if (rects.length > 0) return true
  const style = typeof window !== 'undefined' ? window.getComputedStyle(element) : null
  return !!style && style.display !== 'none' && style.visibility !== 'hidden'
}

function hasVisible(doc: Document, selector: string): boolean {
  return Array.from(doc.querySelectorAll(selector)).some(isVisible)
}

/** 输入框聚焦：中文输入法联想框开着的时候也算，避免弹一条把候选词顶掉 */
export function isEditingSomewhere(doc: Document): boolean {
  const active = doc.activeElement
  if (!active || active === doc.body) return false
  const element = active as HTMLElement
  const tag = element.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  return element.isContentEditable === true
}

/**
 * 当前是否被硬约束挡住。
 *
 * 顺序就是「越靠近用户手上的动作越优先」，只用于调试日志，不参与决策。
 */
export function robotBlockingReason(doc: Document | null): string | null {
  if (!doc) return null
  if (isEditingSomewhere(doc)) return ROBOT_BLOCK_INPUT
  if (hasVisible(doc, '.ant-modal-wrap, .ant-drawer-content-wrapper')) return ROBOT_BLOCK_MODAL
  // popconfirm 与普通 popover 共用一套浮层：只拦真正打开的那种
  if (hasVisible(doc, '.ant-popover:not(.ant-popover-hidden)')) return ROBOT_BLOCK_MODAL
  // 页面正在显示错误块时不叠加一句解释（SPEC-UI-9 的错误块自己已经说清了下一步）
  if (hasVisible(doc, '[data-state="error"]')) return ROBOT_BLOCK_ERROR
  return null
}
