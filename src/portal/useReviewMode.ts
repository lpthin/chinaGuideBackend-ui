/**
 * 预览模式：客户/超管拿到带 ?reviewToken= 的链接时，页面上多出一层预览信息，
 * 逐页令牌那一档再多出「点哪块改哪块」的采集能力。
 *
 * 三条纪律：
 * 1. 令牌只从地址栏读，不写 sessionStorage——逐页令牌授权的是「这一页」，跳去别的页面还留着
 *    等于自动扩权。整站级令牌（候选站那一档）授权的就是这一整套站，翻页时由路由把 URL 上那一段
 *    补回去（{@code previewNavigation.ts}），补的是「本来就该在地址栏里的那一段」，不是另存一份；
 * 2. 上报字段严格等于后端 TicketForm 白名单（blockInstanceId/blockKey/path/viewport/clientText/intent），
 *    pageId 一律不上报：后端只认令牌里绑定的页面，接受访客指定页面就是越权入口；
 * 3. 提交失败要能看到，提交成功只能说「已收到」——后端对无效令牌也返回成功（不给探测者区分信号），
 *    所以前端没有能力承诺「运营一定会改」，文案不许超出这个事实。
 *    而<em>能不能提</em>这件事由后端的 {@code /context} 说（{@code ticketWritable}）：
 *    候选站那条链接按拍板 1A/R-3 没有写口，摆出工具条就是当着客户的面把他的意见丢进黑洞。
 */
import { computed, ref } from 'vue'
import {
  PREVIEW_TOKEN_PARAM,
  fetchReviewContext,
  fetchReviewIntentOptions,
  submitReviewTicket,
  type PortalReviewContext,
  type ReviewTicketPayload
} from './api/portalPublic'
import { rememberSitePreviewToken } from './previewNavigation'

/** 整站预览那条链接上的那句实话：只给后端事实支持得了的承诺 */
export const SITE_PREVIEW_NOTICE =
  '这是这一套方案的整站预览，链接只用来翻着看：它不能在这里提交修改意见。'
  + '要改哪里请回平台说，或用平台那条选择页链接答复「就这套」。'

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
/** 这一条令牌的作用域（后端 /context 那一份真相），没问过就是 null */
const context = ref<PortalReviewContext | null>(null)
const contextError = ref('')
/** context 属于哪一条令牌，以及那一次询问还在不在飞——翻页时同一条令牌只问一次 */
let contextToken: string | null = null
let contextPending: Promise<PortalReviewContext | null> | null = null
/** 词表已经为哪一条令牌取过：取数口是公开端点，翻页时不该一遍遍重问 */
let intentsToken: string | null = null

/** 地址栏里的令牌；类型放宽是因为 vue-router 的 query 值可能是数组 */
export function reviewTokenOf(query: Record<string, unknown> | null | undefined): string | null {
  const raw = query?.[PREVIEW_TOKEN_PARAM]
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
  /** 这一条链接开的是「一整站」——候选站预览那一档，翻页时由路由把令牌续上 */
  const sitePreview = computed(() => context.value?.scope === 'site')
  /**
   * 能不能在这条链接上提改版意见：只信后端 /context 那一行 scope 算出来的旗。
   * 问不到作用域时它就是 false——宁可少摆一个工具条，也不摆出「你说了我们会改」那副样子。
   */
  const ticketWritable = computed(() => context.value?.ticketWritable === true)

  function clearContext() {
    context.value = null
    contextError.value = ''
    contextToken = null
    contextPending = null
    intentsToken = null
    rememberSitePreviewToken(null)
  }

  /**
   * 这条令牌能开多大一片站、能不能提工单——只问后端那一份真相，同一条令牌只问一次。
   * PortalDynamicPage 取数之前先 await 它：拿「有没有 reviewToken 这段查询参数」当作用域，
   * 就是上面注释里那两种猜法之一。
   */
  function ensureContext(value: string | null): Promise<PortalReviewContext | null> {
    if (!value) {
      clearContext()
      return Promise.resolve(null)
    }
    if (contextToken === value) {
      return contextPending ?? Promise.resolve(context.value)
    }
    clearContext()
    contextToken = value
    contextPending = fetchReviewContext(value)
      .then(result => {
        context.value = result ?? null
        rememberSitePreviewToken(sitePreview.value ? value : null)
        // 整站预览走的是公开取数口，那一头的 RenderedPage 不带 reviewLabel；
        // 这一条链接叫什么名字只有令牌那一行知道，工具条上那句「正在看：xxx」靠它。
        if (context.value?.label) {
          label.value = context.value.label
        }
        return context.value
      })
      .catch(error => {
        // 问不到就当这条链接只能看：不猜「大概是逐页的吧」，更不猜「能提工单」
        context.value = null
        contextError.value = error instanceof Error && error.message
          ? error.message
          : '无法确认这条预览链接的权限，已按只读处理'
        return null
      })
      .finally(() => {
        contextPending = null
      })
    return contextPending
  }

  /**
   * 词表只在这条令牌确实能提的时候取，且一条令牌只取一次：
   * 整站预览那条链接摆不出提交框（拍板 1A/R-3），取词表就是白烧一次公开端点；
   * 翻页时同一条令牌再来一遍则是纯粹的浪费。
   */
  function loadIntentOptions(value: string) {
    if (!ticketWritable.value || intentsToken === value) {
      return
    }
    intentsToken = value
    fetchReviewIntentOptions(value).then(result => {
      intents.value = result || {}
    }).catch(() => {
      // 词表拿不到就让下拉为空，提交时不带 intent；不猜一个默认值冒充客户的选择
      intentsToken = null
    })
  }

  /** PortalDynamicPage 在拿到令牌/令牌变化时调用；无令牌即关闭，页面回到访客原样 */
  function activate(value: string | null, reviewLabel?: string | null) {
    if (!value) {
      deactivate()
      return
    }
    const changed = token.value !== value
    token.value = value
    label.value = reviewLabel ?? label.value
    if (changed) {
      selection.value = null
      feedback.value = null
      intents.value = {}
      // 先问作用域，再决定要不要词表：顺序反了就会给候选站那条链接取一份没人用的词表
      ensureContext(value).then(ctx => {
        // 等回包的这段时间里令牌可能被换掉或关掉，别把上一轮的词表挂到新一轮上
        if (token.value !== value || !ctx?.ticketWritable) {
          return
        }
        loadIntentOptions(value)
      })
    }
    installClickListener()
  }

  function deactivate() {
    token.value = null
    label.value = null
    selection.value = null
    selecting.value = false
    intents.value = {}
    feedback.value = null
    clearContext()
  }

  function startSelecting() {
    // 提交口不在这条链接上时，圈选连「选中」都不该发生：别让客户框出一块、写完意见再告诉他提不了
    if (!ticketWritable.value) {
      feedback.value = { kind: 'error', text: SITE_PREVIEW_NOTICE }
      return
    }
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
    if (!ticketWritable.value) {
      feedback.value = { kind: 'error', text: SITE_PREVIEW_NOTICE }
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
    sitePreview,
    ticketWritable,
    context,
    contextError,
    token,
    label,
    selection,
    selecting,
    submitting,
    feedback,
    intents,
    ensureContext,
    activate,
    deactivate,
    startSelecting,
    stopSelecting,
    clearSelection,
    submit
  }
}
