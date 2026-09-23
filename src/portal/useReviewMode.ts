/**
 * 预览批注模式：客户拿到带 ?reviewToken= 的预览链接时，页面上多出一层「点哪块改哪块」的采集能力。
 *
 * 三条纪律：
 * 1. 令牌只从地址栏读，不写 sessionStorage——它授权的是「这一页」，跳去别的页面还留着等于自动扩权；
 * 2. 上报字段严格等于后端 TicketForm 白名单（blockInstanceId/blockKey/path/viewport/clientText/intent），
 *    pageId 一律不上报：后端只认令牌里绑定的页面，接受访客指定页面就是越权入口；
 * 3. 提交失败要能看到，提交成功只能说「已收到」——后端对无效令牌也返回成功（不给探测者区分信号），
 *    所以前端没有能力承诺「运营一定会改」，文案不许超出这个事实。
 */
import { computed, ref } from 'vue'
import { fetchReviewIntentOptions, submitReviewTicket, type ReviewTicketPayload } from './api/portalPublic'

export interface ReviewSelection {
  instanceId: string
  blockKey: string | null
  /** 页面路径，给运营定位用；后端只当文本线索存，不参与鉴权 */
  path: string | null
  /** 区块在这一页上的序号，从 1 开始：给客户的「你要改的是第几块」，比 blockKey 好读 */
  index: number
}

const token = ref<string | null>(null)
const label = ref<string | null>(null)
const selection = ref<ReviewSelection | null>(null)
const selecting = ref(false)
const intents = ref<Record<string, string>>({})
const submitting = ref(false)
const feedback = ref<{ kind: 'ok' | 'error'; text: string } | null>(null)

/** 地址栏里的令牌；类型放宽是因为 vue-router 的 query 值可能是数组 */
export function reviewTokenOf(query: Record<string, unknown> | null | undefined): string | null {
  const raw = query?.reviewToken
  const value = Array.isArray(raw) ? raw[0] : raw
  return typeof value === 'string' && value.length > 0 ? value : null
}

/** 访客正在看的视口：以后端词表为准（desktop/tablet/mobile），按窗口宽度分档 */
export function viewportOfWidth(width: number): 'desktop' | 'tablet' | 'mobile' {
  if (width >= 1024) return 'desktop'
  if (width >= 768) return 'tablet'
  return 'mobile'
}

function onDocumentClick(event: MouseEvent) {
  if (!selecting.value) {
    return
  }
  const target = event.target as HTMLElement | null
  const node = target?.closest?.('[data-review-instance-id]') as HTMLElement | null
  if (!node) {
    return
  }
  // 圈选模式下区块里的链接不该跳转：点了就是「我要改这块」，不是「我要进去看」
  event.preventDefault()
  event.stopPropagation()
  selection.value = {
    instanceId: node.dataset.reviewInstanceId || '',
    blockKey: node.dataset.reviewBlockKey || null,
    path: node.dataset.reviewPath || null,
    index: Number(node.dataset.reviewIndex || 0)
  }
  selecting.value = false
}

/** 监听器只装一次：靠 selecting 开关控制是否生效，比在 start/stop 里成对 add/remove 更难漏掉解绑 */
let listenerInstalled = false

function installClickListener() {
  if (listenerInstalled || typeof document === 'undefined') {
    return
  }
  listenerInstalled = true
  // capture：在区块自己的点击处理之前拿到事件
  document.addEventListener('click', onDocumentClick, true)
}

export function useReviewMode() {
  const enabled = computed(() => !!token.value)

  /** PortalDynamicPage 在拿到令牌/令牌变化时调用；无令牌即关闭，页面回到访客原样 */
  function activate(value: string | null, reviewLabel?: string | null) {
    if (!value) {
      deactivate()
      return
    }
    if (token.value !== value) {
      selection.value = null
      feedback.value = null
      intents.value = {}
      fetchReviewIntentOptions(value).then(result => {
        intents.value = result || {}
      }).catch(() => {
        // 词表拿不到就让下拉为空，提交时不带 intent；不猜一个默认值冒充客户的选择
      })
    }
    token.value = value
    label.value = reviewLabel ?? label.value
    installClickListener()
  }

  function deactivate() {
    token.value = null
    label.value = null
    selection.value = null
    selecting.value = false
    intents.value = {}
    feedback.value = null
  }

  function startSelecting() {
    selection.value = null
    feedback.value = null
    selecting.value = true
  }

  function stopSelecting() {
    selecting.value = false
  }

  function clearSelection() {
    selection.value = null
    feedback.value = null
  }

  async function submit(clientText: string, intent: string | null): Promise<boolean> {
    const current = selection.value
    if (!token.value || !current) {
      return false
    }
    const text = (clientText || '').trim()
    if (!text) {
      feedback.value = { kind: 'error', text: '请先写下这条区块要怎么改' }
      return false
    }
    submitting.value = true
    const payload: ReviewTicketPayload = {
      blockInstanceId: current.instanceId,
      blockKey: current.blockKey,
      // 报的是这一页的对外路径（后端 RenderedPage.path），不是访客地址栏：
      // 令牌页面可能被挂在不同 slug 下，运营看的是「站点上的哪一页」。
      path: current.path,
      viewport: viewportOfWidth(window.innerWidth),
      clientText: text,
      intent: intent || null
    }
    try {
      await submitReviewTicket(token.value, payload)
      feedback.value = { kind: 'ok', text: '已收到，这条反馈会进入改版工单列表' }
      selection.value = null
      return true
    } catch (error) {
      feedback.value = {
        kind: 'error',
        text: error instanceof Error && error.message ? error.message : '提交失败，请稍后重试'
      }
      return false
    } finally {
      submitting.value = false
    }
  }

  return {
    enabled,
    token,
    label,
    selection,
    selecting,
    submitting,
    feedback,
    intents,
    activate,
    deactivate,
    startSelecting,
    stopSelecting,
    clearSelection,
    submit
  }
}
