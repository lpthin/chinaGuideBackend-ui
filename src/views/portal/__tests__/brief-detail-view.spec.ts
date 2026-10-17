import { describe, it, expect, beforeEach, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { Button, Checkbox, Tag, message } from 'ant-design-vue'
import BriefDetailView from '../BriefDetailView.vue'
import {
  briefGenerationApi,
  siteBriefsApi,
  vocabularyApi,
  ESTIMATE_UNDERESTIMATE_DISCLAIMER
} from '../../../api/siteBriefs'
import { siteApi, tenantApi } from '../../../api/workspace'
import { siteBriefDeliveryApi } from '../../../api/siteBriefDelivery'

/**
 * 需求单详情的「出方案」四步门禁（Spec-C §3.2 / 拍板 9A / §9-1 / §6.2，任务 P3）。
 * 这批用例原来分两处：门禁的「不许假装能花」形状在已删除的建站流水线用例里守「每步有真去处」，
 * 详情页只读的那几条在源码扫描用例里。P3 把主线挪进这一页，断言集整档重写在这里，
 * 守的行为一条不少：
 * 1. 预估 → 勾选 → 执行的顺序是闸：没出价之前确认框与执行按钮都是灭的（一次点击都不该在
 *    没人看过价格的情况下发生）；aiEnabled=false 的预估不是报价，连确认都不给勾；
 *    只缺图像模型（missingSwitches 有话）不是闸——拍板 8B 明令配图不阻塞一套候选；
 * 2. §9-1 那句「这不是最终账单」必须跟在数字旁边，一个字不改，而且只显示后端那一份；
 * 3. generate 只发亲手勾过的那一发，并且带着上一次那份凭据（estimateId + expectedTokens）：
 *    缺凭据后端就中文拒、一次模型都不调（curl 实测），界面上点了必被拒等于这一发根本花不出去；
 *    后端拒（缺确认/开关没开）时那句中文原样挂在页面上；
 * 4. 进度按套列，没有总百分比；进度口读不到时错误原文挂出来，不把「没取到」演成「没在跑」；
 * 5. ③④ 的判据是「留痕里真有一条选定」而不是状态看着像：没有可点动作时页面说清为什么没有；
 * 6. 每一步有真去处（吸收建站流水线旧用例的行为）：候选画廊、组装任务、录入页都是真跳转。
 *
 * 与同族用例同一口径：纯 helper 走真实现（importOriginal + spread），只把网络口换成 vi.fn；
 * 交互全挂真实控件（setup.ts 的空壳桩件 emit 不出事件，用它测出来的「没反应」是假的）。
 */

const { pushSpy, routeParams } = vi.hoisted(() => ({
  pushSpy: vi.fn(),
  routeParams: { current: {} as Record<string, string> }
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: pushSpy }),
  useRoute: () => ({ params: routeParams.current, query: {} })
}))

vi.mock('ant-design-vue', async () => {
  const actual = await vi.importActual<Record<string, any>>('ant-design-vue')
  return {
    ...actual,
    message: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() }
  }
})

vi.mock('../../../api/http', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() }
}))

vi.mock('../../../api/siteBriefs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../api/siteBriefs')>()
  return {
    ...actual,
    siteBriefsApi: {
      list: vi.fn(),
      get: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      summaryPreview: vi.fn()
    },
    vocabularyApi: { adminVocabulary: vi.fn(), portalVocabulary: vi.fn() },
    briefGenerationApi: {
      estimate: vi.fn(),
      generate: vi.fn(),
      progress: vi.fn(),
      rerunEstimate: vi.fn(),
      rerunFailed: vi.fn()
    }
  }
})

vi.mock('../../../api/workspace', () => ({
  tenantApi: { list: vi.fn() },
  siteApi: { list: vi.fn() }
}))

// P4 三口（留痕/转正/收口）：纯函数（hasChosenDecision）走真实现，只把网络口换成 vi.fn。
// 默认在 mountView 里统一挂空回包——转正按钮的判据是「留痕里真有一条选定」，默认空 = 没按钮。
vi.mock('../../../api/siteBriefDelivery', async importOriginal => {
  const actual = await importOriginal<Record<string, any>>()
  return {
    ...actual,
    siteBriefDeliveryApi: {
      promote: vi.fn(),
      regenerate: vi.fn(),
      decisions: vi.fn()
    }
  }
})

const TABLE_STUB = defineComponent({
  name: 'ATable',
  props: { dataSource: { type: Array, default: () => [] }, columns: { type: Array, default: () => [] } },
  setup(props: any, { slots }: any) {
    return () => {
      if (!props.dataSource.length) {
        return h('div', { class: 'table-stub table-stub--empty' }, slots.emptyText ? slots.emptyText() : null)
      }
      return h(
        'div',
        { class: 'table-stub' },
        props.dataSource.flatMap((record: any) =>
          props.columns.map((column: any) => (slots.bodyCell ? slots.bodyCell({ column, record }) : null))
        )
      )
    }
  }
})

const PASS_THROUGH = (name: string) => ({
  name,
  props: ['title', 'message', 'type', 'description', 'label', 'span', 'column', 'bordered', 'size', 'header'],
  template: `<div class="${name}-stub"><span>{{ message }}{{ description }}</span>`
    + '<slot name="title" /><slot name="message" /><slot /><slot name="default" />'
    // header 是 a-collapse-panel 那一栏的标题（「……后端原话逐字」那一句）：不渲就等于测试没读过它
    + `<span class="fold-header">${'{{ header }}'}</span></div>`
})

function brief(overrides: Record<string, unknown> = {}) {
  return {
    id: 12,
    tenantId: 15,
    siteId: null,
    status: 'ready',
    statusLabel: null,
    candidateCount: 2,
    demoContentMode: 'full',
    industry: null,
    subIndustry: null,
    audiences: [],
    primaryGoal: null,
    mustHave: [],
    tone: null,
    languages: [],
    scale: null,
    avoid: [],
    channels: [],
    businessModel: null,
    brandColor: null,
    referenceUrls: [],
    notes: null,
    requirementsSummary: '按 13 题选择渲染的那句话',
    createdBy: 'admin',
    createdAt: '2026-09-28T10:00:00',
    updatedAt: '2026-09-28T10:00:00',
    ...overrides
  }
}

const VOCAB = {
  questions: [],
  siteProfile: [],
  candidateMaxCount: 3,
  demoContentModes: [{ value: 'full', label: '整套演示', articleCount: 10, caseCount: 3 }],
  statusLabels: { draft: '草稿', ready: '待出方案', generating: '生成中', awaiting_client: '等客户确认' }
}

function site(id: number, overrides: Record<string, unknown> = {}) {
  return { id, code: `s${id}`, name: `站点 ${id}`, domain: '', status: 'candidate', tenantId: 15, buildBriefId: 12, ...overrides }
}

interface MountOptions {
  status?: string
  sites?: any[]
  sitesError?: string
  progressData?: unknown
  progressError?: string
  estimateData?: Record<string, unknown>
  generateError?: string
  generateData?: unknown
  /** ③ 的留痕回包：转正按钮唯一的判据（默认空 = 没按钮） */
  decisions?: unknown[]
  /** ④ promote 的回执（D5-3 的交棒清单就挂在这一格里） */
  promoteData?: Record<string, unknown> | null
  /** 词表那一发故意不回：用来抓「还在路上」那一屏界面上说了什么（10-16 走查现场） */
  vocabularyPending?: boolean
  /** M-P34 补跑那张价签的回包；不给就是「这一屏还没出过补跑的价」，两个把手都该是灭的 */
  rerunEstimateData?: Record<string, unknown> | null
  /** 补跑受理那一发的回执（后端 `RoundStart`：整轮读数 + notices） */
  rerunData?: unknown
  /** 补跑那两支里任意一支出错时后端那句中文 */
  rerunError?: string
}

/**
 * 缺省报价：`aiEnabled=true`，用于「正常报出价」的那几条；个别用例用自己的 estimateData 顶掉它。
 *
 * <p><b>形状是照 2026-09-26 的真回包抄的，不是照界面想的</b>：外层是「哪一单的哪一次估算 + 凭据」，
 * 数字装在 `estimate` 那一层里，`breakdown`/`missingSwitches` 是数组。
 * 这一族用例以前按扁平形状 stub（`estimatedTokens` 与 `aiEnabled` 直接挂外层、`breakdown` 是一个字符串），
 * 于是视图读嵌套回包时全读成 undefined：报价显示 undefined、确认框永远勾不上、
 * 「开始出方案」在界面上根本发不出去——而这套用例一片绿。stub 必须说后端那句真话。</p>
 */
const DEFAULT_QUOTE = {
  candidateCount: 2,
  pagesPerCandidate: 7,
  demoArticles: 10,
  demoCases: 3,
  imageSlots: 2,
  tokenEquivalentsPerImage: 1500,
  estimatedTokens: 260000,
  aiEnabled: true,
  /** 缺省按「已交付」给：这一格是后端 V142 交付态的读数，界面只转述不自己判 */
  tenantBearsCost: true,
  imageAvailable: true,
  breakdown: [
    '合计预估：260000 token（2 套 × 130000 token/套）',
    '当月剩余配额：900000 token'
  ],
  missingSwitches: [] as string[],
  notice: null as string | null
}

const DEFAULT_ESTIMATE = {
  briefId: 12,
  attempt: 1,
  estimateId: 'est-2026-09-26-a1',
  requirementsSummary: '后端渲染的那句需求原话',
  estimate: DEFAULT_QUOTE
}

/** 造一份估算回包：只改里层那颗价签，外层凭据形状不动（免得又测回扁平那份假契约） */
function estimateWith(overrides: Record<string, unknown>) {
  return { ...DEFAULT_ESTIMATE, estimate: { ...DEFAULT_QUOTE, ...overrides } }
}

/**
 * M-P34 补跑那张价签的缺省：数字**故意与整轮那张不一样**（只数失败那一套 ⇒ 130000 而不是 260000），
 * 凭据号也不同。这样「执行那一发带回去的是哪张价签」才是一次真判据——
 * 两份一样的数测不出串用。
 */
const RERUN_ESTIMATE = {
  briefId: 12,
  attempt: 1,
  estimateId: 'est-rerun-a1-sets2',
  requirementsSummary: '后端渲染的那句需求原话',
  estimate: {
    ...DEFAULT_QUOTE,
    candidateCount: 1,
    estimatedTokens: 130000,
    breakdown: [
      '套数：1 套（每套一条独立进度，一套失败不影响其余）',
      '合计预估：130000 token（1 套 × 130000 token/套）'
    ]
  }
}

function failedProgressRow(overrides: Record<string, unknown> = {}) {
  return {
    candidateId: 502,
    siteId: 201,
    attempt: 1,
    candidateNo: 2,
    stage: 'copy',
    stageLabel: '逐页文案',
    status: 'failed',
    statusLabel: '失败',
    errorMessage: '第 2 套在「逐页文案」这一步失败：模型没有回答。',
    notices: [] as string[],
    ...overrides
  }
}

function succeededProgressRow(overrides: Record<string, unknown> = {}) {
  return {
    candidateId: 501,
    siteId: 200,
    attempt: 1,
    candidateNo: 1,
    stage: 'done',
    stageLabel: '已完成',
    status: 'succeeded',
    statusLabel: '已交付',
    errorMessage: null,
    notices: [] as string[],
    ...overrides
  }
}

async function mountView(options: MountOptions = {}) {
  routeParams.current = { id: '12' }
  vi.mocked(siteBriefsApi.get).mockResolvedValue(brief({ status: options.status ?? 'ready' }) as any)
  if (options.vocabularyPending) {
    // 永远不 resolve：这一屏就是「词表还在路上」那一刻的界面
    vi.mocked(vocabularyApi.adminVocabulary).mockReturnValue(new Promise(() => {}) as any)
  } else {
    vi.mocked(vocabularyApi.adminVocabulary).mockResolvedValue(VOCAB as any)
  }
  vi.mocked(tenantApi.list).mockResolvedValue([{ id: 15, code: 't-a', name: '甲租户' }] as any)
  if (options.sitesError) {
    vi.mocked(siteApi.list).mockRejectedValueOnce(new Error(options.sitesError))
  } else {
    vi.mocked(siteApi.list).mockResolvedValue((options.sites ?? []) as any)
  }
  if (options.progressError) {
    vi.mocked(briefGenerationApi.progress).mockRejectedValue(new Error(options.progressError))
  } else {
    // 真回包就是**一个数组**（每套一行），不是 `{briefId, candidates:[…]}`
    vi.mocked(briefGenerationApi.progress).mockResolvedValue(
      (options.progressData ?? []) as any
    )
  }
  // 口子的默认实现统一在这里挂：用例要通过 options 传自己的回包，
  // 在 mountView 之前直接 mockResolvedValue 会被这里的默认值覆盖掉（报价以哪份为准不能靠顺序碰运气）
  vi.mocked(briefGenerationApi.estimate).mockResolvedValue((options.estimateData ?? DEFAULT_ESTIMATE) as any)
  if (options.generateError) {
    vi.mocked(briefGenerationApi.generate).mockRejectedValue(new Error(options.generateError))
  } else {
    vi.mocked(briefGenerationApi.generate).mockResolvedValue((options.generateData ?? { briefId: 12 }) as any)
  }
  // M-P34 补跑那两支：默认「没出过价、没受理过」，用例用自己的回包顶掉
  if (options.rerunError) {
    vi.mocked(briefGenerationApi.rerunEstimate).mockRejectedValue(new Error(options.rerunError))
    vi.mocked(briefGenerationApi.rerunFailed).mockRejectedValue(new Error(options.rerunError))
  } else {
    vi.mocked(briefGenerationApi.rerunEstimate)
      .mockResolvedValue((options.rerunEstimateData ?? RERUN_ESTIMATE) as any)
    vi.mocked(briefGenerationApi.rerunFailed).mockResolvedValue((options.rerunData ?? null) as any)
  }
  // 留痕默认是空的（没有客户真选定的记录 → 没有转正按钮）；要走到 ④ 的用例走 options 传自己的回包
  vi.mocked(siteBriefDeliveryApi.decisions).mockResolvedValue((options.decisions ?? []) as any)
  vi.mocked(siteBriefDeliveryApi.promote).mockResolvedValue((options.promoteData ?? null) as any)
  vi.mocked(siteBriefDeliveryApi.regenerate).mockResolvedValue(null as any)
  const wrapper = mount(BriefDetailView, {
    attachTo: document.body,
    global: {
      stubs: {
        'a-button': Button,
        'a-checkbox': Checkbox,
        'a-tag': Tag,
        'a-table': TABLE_STUB,
        'a-space': PASS_THROUGH('ASpace'),
        'a-alert': PASS_THROUGH('AAlert'),
        'a-card': PASS_THROUGH('ACard'),
        'a-descriptions': PASS_THROUGH('ADescriptions'),
        'a-descriptions-item': PASS_THROUGH('ADescriptionsItem'),
        'a-empty': PASS_THROUGH('AEmpty'),
        'a-tooltip': PASS_THROUGH('ATooltip'),
        // 真 popconfirm 走 teleport + rAF，这里要钉的是 confirm 之后上屏的那份回执：换成把默认槽渲出来的壳
        'a-popconfirm': PASS_THROUGH('APopconfirm'),
        // FoldedText 那一句人话 + 展开：桩要真把插槽与栏标题渲出来，测试才读得到「原文一个字都没丢」
        'a-collapse': PASS_THROUGH('ACollapse'),
        'a-collapse-panel': PASS_THROUGH('ACollapsePanel')
      }
    }
  })
  await flushPromises()
  return wrapper
}

function byText(text: string) {
  return [...document.querySelectorAll('button')].filter(
    node => (node.textContent || '').replace(/\s+/g, '') === text
  )
}

function click(node: Element) {
  node.dispatchEvent(new MouseEvent('click', { bubbles: true }))
}

function checkbox() {
  return document.querySelector('input[type="checkbox"]') as HTMLInputElement | null
}

/**
 * 补跑那一族自己的勾：按**它自己那句确认话**找，不按 DOM 序号。
 *
 * <p>这一屏的 `a-space` / `a-card` 桩件把默认槽渲了两遍（`<slot />` 与 `<slot name="default" />`），
 * 所以 DOM 里每颗勾都存在两份——序号 1 是「整轮那颗的第二份」，拿它当补跑那颗会一路假红。
 * 判据要落在文字上：这颗勾的签名对象是第二张价签，不是整轮那张。</p>
 */
function rerunCheckbox() {
  const wrapper = [...document.querySelectorAll('label')].find(
    node => (node.textContent || '').includes('我已看过补跑这一趟的预估')
  )
  return wrapper?.querySelector('input[type="checkbox"]') as HTMLInputElement | undefined
}

const RERUN_ESTIMATE_BUTTON = '只补失败的那几套：先估算（不调模型）'
const RERUN_RUN_BUTTON = '只补失败的那几套：开始跑（第2套）'

/** 这一单名下有站：`onMounted` 才会真去拉进度（ready 且没站时这一屏根本不发那一发 GET） */
const LINKED_SITES = [site(200, { candidateNo: 1 }), site(201, { candidateNo: 2 })]

beforeEach(() => {
  document.body.innerHTML = ''
  vi.clearAllMocks()
})

describe('门禁顺序：预估 → 勾选 → 执行', () => {
  it('没出价之前确认框与「开始出方案」都是灭的：一次点击都不该在没人看过价格的情况下发生', async () => {
    const wrapper = await mountView()
    const text = wrapper.text()
    expect(text).toContain('还没有预估')
    expect(checkbox()).toBeTruthy()
    expect(checkbox()!.disabled).toBe(true)
    const runButton = byText('开始出方案（建2套候选）')[0]
    expect((runButton as HTMLButtonElement).disabled).toBe(true)
    expect(briefGenerationApi.generate).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('点「先估算消耗」调 §5 的 estimate 口；数字旁边必须跟 §9-1 那句原话与后端的 breakdown', async () => {
    const wrapper = await mountView()
    click(byText('先估算消耗（不调模型）')[0])
    await flushPromises()
    expect(briefGenerationApi.estimate).toHaveBeenCalledWith(12)
    const text = wrapper.text()
    // 价签本体在 `estimate` 那一层：这一句红过一次就是「数字显示成 undefined」那四处假界面之一
    expect(text).toContain('260000')
    expect(text).toContain('当月剩余配额：900000 token')
    expect(text).toContain('合计预估：260000 token（2 套 × 130000 token/套）')
    // 后端没给 notice 时才允许出现本地兜底那句（它不许带具体倍数——倍数只有后端知道）
    expect(text).toContain(ESTIMATE_UNDERESTIMATE_DISCLAIMER)
    wrapper.unmount()
  })

  /**
   * M-P33 拍板 6：这一屏在价签下面并排摆「到这一刻已经花了多少」。
   * 钉两件事：句子逐字来自后端那一份（`WorkbenchBurnLedger`），以及**这一份读数不拦确认**——
   * 钱多、未配价、读不到，都不许变成第七道闸。
   */
  it('需求单详情把「已替平台烧了多少」逐行摆出来：只读数，不因为读不到就拦确认', async () => {
    const wrapper = await mountView({
      estimateData: {
        ...DEFAULT_ESTIMATE,
        platformBurn: {
          calls: 5,
          successCalls: 4,
          failedCalls: 1,
          tokenEquivalents: 8000,
          cost: null,
          lines: [
            '这条建站链在这一家名下已经跑过 5 发外呼（成功 4 发、失败 1 发），流水表记的 token 合计 8000。',
            '失败那 1 发没有 token 数（那一行落库时留空），所以上面那个合计里没有它们。',
            '钱：这一族用到的模型行到今天一条都没定过价，这里是「未配价」，不是一个 0 元。',
            '这些钱没有一分进过他的额度：交付没确定之前，这条链由平台承担，系统不设硬闸。'
          ],
          tokenBasis: '这一份是 ai_call_log 那把字数尺（提示词字数 ÷ 4）'
        }
      } as any
    })
    click(byText('先估算消耗（不调模型）')[0])
    await flushPromises()
    const text = wrapper.text()

    expect(text).toContain('已经跑过 5 发外呼')
    expect(text).toContain('失败那 1 发没有 token 数')
    expect(text).toContain('未配价')
    expect(text).toContain('系统不设硬闸')
    expect(text).toContain('这一份是 ai_call_log 那把字数尺')
    // 价签那一句仍然单独在：已烧与待烧是两个口径，界面不合成一句
    expect(text).toContain('合计预估：260000 token')
    // 门禁还是那六道：这一份读数缺席、难看、未配价，都不许多拦一道
    expect(checkbox()).toBeTruthy()
    expect(checkbox()!.disabled).toBe(false)
    wrapper.unmount()
  })

  /** 后端没下发这一份：念「这一发没回读数」，不许界面自己补一个 0（0 是「一次都没跑过」那句真话） */
  it('需求单详情：后端没回已烧读数时念「没回读数」，不念成 0 发', async () => {
    const wrapper = await mountView()
    click(byText('先估算消耗（不调模型）')[0])
    await flushPromises()
    const text = wrapper.text()

    expect(text).toContain('后端这一发没回读数')
    expect(text).not.toContain('跑过 0 发')
    // 这一格读不到不动别的格：价签照念、确认照勾（这一页从来不渲染 estimateId 原串，别拿它当把手）
    expect(text).toContain('预计 260000 token')
    expect(checkbox()).toBeTruthy()
    expect(checkbox()!.disabled).toBe(false)
    wrapper.unmount()
  })

  it('未交付（售前）的那一趟不许说「扣这个租户的配额」：V142 起这一趟由平台承担', async () => {
    const wrapper = await mountView({
      estimateData: estimateWith({
        tenantBearsCost: false,
        breakdown: [
          '合计预估：260000 token（2 套 × 130000 token/套）',
          '计费：该租户尚未交付（超管确定交付后才计入其额度），本次由平台承担，不进它的账单'
        ]
      })
    })
    click(byText('先估算消耗（不调模型）')[0])
    await flushPromises()
    const text = wrapper.text()
    expect(text).toContain('由平台承担')
    // 反向：说明、确认框都不许再宣称扣他的配额；剩余额度是后端在该交付时才念的数，界面不自己拼
    expect(text).not.toContain('扣这个租户的 token 配额')
    expect(text).not.toContain('确认出方案会消耗租户配额')
    wrapper.unmount()
  })

  /**
   * 10-16 走查现场：出方案那一发成功后 `runGenerate` 会把 `estimate` 清成 null（价签要重新看），
   * 于是计费那句话退回默认档「扣这个租户的配额」——可后端在三十秒前刚说过这一趟由平台承担。
   * 钱的方向被界面反过来念，等于给一次没发生的扣费背书。
   */
  it('出方案成功后价签被清掉，那句钱的话也不许翻回「扣租户配额」：售前的口径一路跟到回执', async () => {
    const wrapper = await mountView({
      generateData: { briefId: 12, attempt: 1 },
      estimateData: estimateWith({
        tenantBearsCost: false,
        breakdown: [
          '合计预估：260000 token（2 套 × 130000 token/套）',
          '计费：该租户尚未交付（超管确定交付后才计入其额度），本次由平台承担，不进它的账单'
        ]
      })
    })
    click(byText('先估算消耗（不调模型）')[0])
    await flushPromises()
    checkbox()!.click()
    await flushPromises()
    click(byText('开始出方案（建2套候选）')[0])
    await flushPromises()
    expect(briefGenerationApi.generate).toHaveBeenCalled()
    const text = wrapper.text()
    expect(text).toContain('由平台承担')
    expect(text).not.toContain('扣这个租户的 token 配额')
    expect(text).not.toContain('确认出方案会消耗租户配额')
    wrapper.unmount()
  })

  it('后端给了 notice 就只显示那一份：界面不许在旁边再拼一遍本地常量（两处真相）', async () => {
    const backendNotice = '这是预估，不是账单：实测 0.83～1.13 倍，更早的样本低估过 1.23～4.2 倍'
    const wrapper = await mountView({
      estimateData: estimateWith({ notice: backendNotice })
    })
    click(byText('先估算消耗（不调模型）')[0])
    await flushPromises()
    const text = wrapper.text()
    expect(text).toContain(backendNotice)
    expect(text).not.toContain(ESTIMATE_UNDERESTIMATE_DISCLAIMER)
    wrapper.unmount()
  })

  it('aiEnabled=false 的预估不是报价：开关没开时连确认框都不给勾', async () => {
    const wrapper = await mountView({
      estimateData: estimateWith({
        estimatedTokens: 100, aiEnabled: false, notice: '组装开关没开'
      })
    })
    click(byText('先估算消耗（不调模型）')[0])
    await flushPromises()
    expect(wrapper.text()).toContain('后端回了「这一路没开」')
    expect(checkbox()!.disabled).toBe(true)
    wrapper.unmount()
  })

  /**
   * 拍板 8B：配图那条路缺模型时 `missingSwitches` 有话，但 `aiEnabled` 仍是 true。
   *
   * 这一条守的是「缺口只显示、不门禁」：拿 missingSwitches 当闸就是把 8B 反着实现一遍——
   * 该出一套纯文字候选的时候，界面上那颗确认框根本勾不上。2026-09-26 真跑第一次就是这样：
   * 开关全开、图模型没配，后端照样让 generate 跑成了。
   */
  it('只缺图像模型（missingSwitches 有话、aiEnabled 仍 true）：缺口原话列出来，确认框照样能勾', async () => {
    const reason = '演示内容与首页主视觉会没有图（没有 model_type=image 的图像模型）：要出图得同时配一条模型并打开 app.ai.image.enabled'
    const wrapper = await mountView({
      estimateData: estimateWith({
        imageAvailable: false,
        missingSwitches: [reason],
        notice: '这是预估，不是账单：实测 0.83～1.13 倍'
      })
    })
    click(byText('先估算消耗（不调模型）')[0])
    await flushPromises()
    expect(wrapper.text()).toContain(reason)
    expect(checkbox()!.disabled).toBe(false)
    // 门禁本身不松：不勾仍然点不动（缺图不是「可以不勾就花」的理由）
    expect(byText('开始出方案（建2套候选）')[0].hasAttribute('disabled')).toBe(true)
    checkbox()!.click()
    await flushPromises()
    expect(byText('开始出方案（建2套候选）')[0].hasAttribute('disabled')).toBe(false)
    expect(briefGenerationApi.generate).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('看过报价并亲手勾上后执行才会发出去，且带着上一次那份凭据；成功后重拉单子与进度', async () => {
    const wrapper = await mountView({ generateData: { briefId: 12, attempt: 1 } })
    click(byText('先估算消耗（不调模型）')[0])
    await flushPromises()
    expect(checkbox()!.disabled).toBe(false)
    checkbox()!.click()
    await flushPromises()
    expect(wrapper.text()).toContain('确认框已经勾上')
    click(byText('开始出方案（建2套候选）')[0])
    await flushPromises()
    // 9A 那道闸认的是这两样：少带一样后端就中文拒绝、一次模型都不调（curl 实测），
    // 所以「只发 {confirm}」这一发在界面上永远花不出去——断言必须钉住凭据真的跟着走了
    expect(briefGenerationApi.generate).toHaveBeenCalledWith(12, true, {
      estimateId: 'est-2026-09-26-a1',
      expectedTokens: 260000
    })
    expect(briefGenerationApi.progress).toHaveBeenCalled()
    wrapper.unmount()
  })

  it('后端拒的时候那句中文原样挂出来（缺确认/开关没开都是它的账，不翻译不改写）', async () => {
    const wrapper = await mountView({
      generateError: '确认缺失：必须看过预估并勾选 confirm 才允许出方案'
    })
    click(byText('先估算消耗（不调模型）')[0])
    await flushPromises()
    checkbox()!.click()
    // 勾上之后要先让渲染把这颗按钮从灭的变成亮着的，再点它（点禁用按钮不会有任何反应，那是假的「发出去」）
    await flushPromises()
    click(byText('开始出方案（建2套候选）')[0])
    await flushPromises()
    expect(wrapper.text()).toContain('确认缺失：必须看过预估并勾选 confirm 才允许出方案')
    expect(vi.mocked(message.error).mock.calls.flat().join()).toContain('确认缺失')
    wrapper.unmount()
  })

  it('已出过方案的单（awaiting_client）：门禁关门并说清为什么，不让人重复烧钱', async () => {
    const wrapper = await mountView({ status: 'awaiting_client' })
    expect(wrapper.text()).toContain('出方案的门禁只对')
    expect(wrapper.text()).toContain('草稿、待出方案')
    expect(briefGenerationApi.generate).not.toHaveBeenCalled()
    wrapper.unmount()
  })
})

/**
 * 10-16 走查现场：这一屏在词表回来的前一瞬间说过两句假话——
 * 「共 0 题，其中 0 题有答案」和「词表里一道题都没有：…刷新重试」。
 * 那一发请求还在路上，既不是「这单没答题」，也不是「词表空了」。
 */
describe('词表还在路上：不许把「还没取到」念成「这单没答题」或「词表空了」', () => {
  it('那一发请求还没回：这一格说「正在取」，不报 0 题、也不报词表空', async () => {
    const wrapper = await mountView({ vocabularyPending: true })
    const text = wrapper.text()
    expect(text).toContain('词表正在取')
    expect(text).not.toContain('词表里一道题都没有')
    expect(text).not.toMatch(/共 0 题/)
    wrapper.unmount()
  })

  it('词表真回包空了（不是还在路上）才念那一句红字', async () => {
    const wrapper = await mountView()
    expect(wrapper.text()).toContain('共 ')
    expect(wrapper.text()).not.toContain('词表正在取')
    wrapper.unmount()
  })
})

describe('进度按套显示（§6.2：任一步失败只影响该套）', () => {

  it('每套各一行：阶段与状态用后端 label，label 没有就露原码；没有总百分比', async () => {
    const wrapper = await mountView({
      status: 'generating',
      sites: [site(31, { candidateNo: 1 }), site(32, { candidateNo: 2 })],
      progressData: [
        {
          candidateId: 71, siteId: 31, attempt: 1, candidateNo: 1, status: 'running',
          statusLabel: '进行中', stage: 'demo_content', stageLabel: '演示内容生成',
          estimatedTokens: 130000, notices: ['演示内容是 AI 生成的，交付后可替换']
        },
        {
          candidateId: 72, siteId: 32, attempt: 1, candidateNo: 2, status: 'failed',
          stage: 'image', errorMessage: '图片模型不可用：该图位交付后由你上传',
          imageDone: 1, imageFailed: 0, imageSkipped: 1
        }
      ]
    })
    const text = wrapper.text()
    expect(text).toContain('第 1 套')
    expect(text).toContain('进行中')
    expect(text).toContain('演示内容生成')
    expect(text).toContain('第 2 套')
    // statusLabel 缺失的那套：露原码，不编中文（I-1）
    expect(text).toContain('failed')
    // 失败原因是后端原话，挂在失败的那一套上
    expect(text).toContain('图片模型不可用：该图位交付后由你上传')
    // 每套自己的降级说明与本套预估也照实列（进度口一行一套，不是整单一份）
    expect(text).toContain('演示内容是 AI 生成的，交付后可替换')
    expect(text).toContain('本套预计 130000 token')
    // 没有假装同步的东西：整页不许出现总百分比
    expect(text).not.toMatch(/\d+%/)
    expect(text).toContain('进度按套显示')
    wrapper.unmount()
  })

  it('进度口读不到：错误原文挂出来，并明说这不是「没在跑」', async () => {
    // 这一单是 ready 且名下没站：页面挂载时不会自己去拉进度（拉了也演不出东西），
    // 所以这里真点「刷新进度」——错误原文要挂的就是这一发拿回的东西
    const wrapper = await mountView({ progressError: 'Request failed with status code 404' })
    click(byText('刷新进度')[0])
    await flushPromises()
    const text = wrapper.text()
    expect(text).toContain('进度没读到')
    expect(text).toContain('Request failed with status code 404')
    expect(text).toContain('不是「没在跑」')
    wrapper.unmount()
  })
})

describe('P4 的诚实边界与每一步的真去处', () => {
  it('③④ 的闸是「留痕里真有一条选定」：留痕为空时只有原话，不摆点了只会拿回拒绝的按钮', async () => {
    // P4 之前这一格连后端口都没有（断言的是「这一段的后端口还没有（P4」）。
    // 现在三口有了，要守的行为没变、只是挪了位置：没有客户真选过的留痕，就不许出现转正/重跑按钮，
    // 页面必须说清「今天为什么没有可点的动作」——界面不许谎报到哪一步。
    const wrapper = await mountView()
    expect(wrapper.text()).toContain('这一格今天没有可点的动作')
    const labels = [...document.querySelectorAll('button')].map(node => (node.textContent || '').replace(/\s+/g, ''))
    expect(labels.filter(label => /转正交棒|收口重跑|发给客户|选择页/.test(label))).toEqual([])
    wrapper.unmount()
  })

  it('每一步有真去处：画廊/组装/回列表都走真路由跳转（吸收建站流水线旧用例的行为）', async () => {
    const wrapper = await mountView({ sites: [site(31, { candidateNo: 1 })] })
    click(byText('候选画廊：并排比较每一套')[0])
    expect(pushSpy).toHaveBeenLastCalledWith({ name: 'workspace-portal-brief-candidates', params: { id: '12' } })
    click(byText('这一站的组装任务')[0])
    expect(pushSpy).toHaveBeenLastCalledWith({ name: 'workspace-portal-assemble-jobs', query: { siteId: '31' } })
    click(byText('到站点清单只看这一单的站')[0])
    expect(pushSpy).toHaveBeenLastCalledWith({ name: 'workspace-sites', query: { briefId: '12' } })
    wrapper.unmount()
  })

  it('候选行按 V115 的 build_brief_id 认亲并显示站点状态（中文只来自那份一份的说法）', async () => {
    const wrapper = await mountView({ sites: [site(31, { candidateNo: 1 }), site(32, { candidateNo: 2, status: 'archived' })] })
    const text = wrapper.text()
    expect(text).toContain('第 1 套')
    expect(text).toContain('候选站')
    expect(text).toContain('已归档候选')
    wrapper.unmount()
  })
})

/**
 * D5-3：转正回执里的交棒清单。三条纪律——
 * 1. 那句原话与三条链接**只渲染后端回执给的内容**（前端不拼第二份路径，I-1）；
 * 2. `urlRelative` 的行如实写明「相对路径、要自己拼后台域名」，绝对路径的行不挂这句；
 * 3. 老回执（后端还没带这两格）时这一节整个不出现——没给就是没给，不演「清单已备好」。
 */
describe('④ 转正交棒：回执里的交棒清单原样上屏（D5-3）', () => {
  const CHOSEN = [{ id: 3, sessionId: 9, chosenSiteId: 31, chosenSiteName: '纳欣官网', candidateNo: 1, clientNote: null, createdAt: null }]
  const RECEIPT = {
    briefId: 12, siteId: 31, siteName: '纳欣广告官网', briefStatus: 'promoted', briefStatusLabel: '已交付',
    tenantName: '甲租户',
    maintenanceUrl: '/workspace/portal/content?siteId=31', maintenanceUrlRelative: true,
    archivedSiteIds: [32, 33], revokedTokenCount: 2,
    archivedNotice: '另外 2 套候选已转为「已归档」，租户后台不会列出它们。',
    handoverNotice: '这三处是示意内容，请替换：展示内容 / 案例 / 公司信息。'
      + '另：本站的演示文章（标题带「示例｜」）同样是 AI 生成的示意内容，在「内容工作台」进来的文章列表里可以整篇替换或直接删除。',
    handoverItems: [
      { key: 'showcase', label: '展示内容', url: '/workspace/portal/showcase?siteId=31', urlRelative: true,
        notice: '团队、里程碑、客户标志、数据、评价、资质、常见问题这七类里的示意条目（标题带「示例｜」），请逐条换成真实资料，不需要的直接删' },
      { key: 'case', label: '案例', url: 'https://admin.test/workspace/case/list?siteId=31', urlRelative: false,
        notice: 'AI 生成的演示案例：不写客户名称与效果数字，交付后可替换' },
      { key: 'company', label: '公司信息', url: '/workspace/portal/company?siteId=31', urlRelative: true,
        notice: '「关于我们」「联系我们」两栏读的那些字段还要人填' }
    ]
  }

  it('点「转正交棒」后：那句原话与三条链接原样上屏，相对路径的行如实写明要拼后台域名', async () => {
    const wrapper = await mountView({ status: 'decided', decisions: CHOSEN, promoteData: RECEIPT })
    // 模板里 promote 在前、regenerate 在后：第一颗 popconfirm 就是转正那一发
    wrapper.findAllComponents({ name: 'APopconfirm' })[0].vm.$emit('confirm')
    await flushPromises()
    const text = wrapper.text()
    expect(siteBriefDeliveryApi.promote).toHaveBeenCalledWith(12)
    // 原话一个字不改地挂出来
    expect(text).toContain('这三处是示意内容，请替换：展示内容 / 案例 / 公司信息。')
    expect(text).toContain('团队、里程碑、客户标志、数据、评价、资质、常见问题这七类里的示意条目')
    // 链接只用后端给的那三条 url：href 逐字对得上，这一头一个字都没拼
    // （ACard 的 PASS_THROUGH 桩会把默认槽渲两遍，所以断言 scope 在第一条清单里）
    const list = wrapper.find('.brief-detail__handover')
    const items = list.findAll('li')
    expect(items).toHaveLength(3)
    expect(items.map(node => node.find('a').attributes('href'))).toEqual([
      '/workspace/portal/showcase?siteId=31',
      'https://admin.test/workspace/case/list?siteId=31',
      '/workspace/portal/company?siteId=31'
    ])
    // 相对路径的两条各挂一句「要拼后台域名」，绝对路径那条不挂（说了就是谎报）
    expect(items[0].text()).toContain('这是相对路径')
    expect(items[1].text()).not.toContain('这是相对路径')
    expect(items[2].text()).toContain('这是相对路径')
    wrapper.unmount()
  })

  it('后端还没带这两格的旧回执：这一节整个不出现，不演「清单已备好」', async () => {
    const legacy = { ...RECEIPT } as Record<string, unknown>
    delete legacy.handoverNotice
    delete legacy.handoverItems
    const wrapper = await mountView({ status: 'decided', decisions: CHOSEN, promoteData: legacy })
    wrapper.findAllComponents({ name: 'APopconfirm' })[0].vm.$emit('confirm')
    await flushPromises()
    expect(wrapper.text()).toContain('已交付')
    expect(wrapper.text()).not.toContain('交棒清单')
    expect(document.querySelectorAll('.brief-detail__handover').length).toBe(0)
    wrapper.unmount()
  })
})

/**
 * M-P34：「只补这一轮里失败的那几套」这一族门禁。
 *
 * <p>这一族与整轮那一族<b>必须各带一套确认</b>：后端把 `mode=rerunFailed|sets=第几套` 盖进了
 * `estimateId` 的散列，两张价签互不通用（拿整轮那张来补跑会被 9A 拒，反过来也一样）。
 * 所以这里的判据不是「多一个按钮」，而是四件事：</p>
 * <ol>
 *   <li>把手只在<b>进度里真有失败行</b>且状态在那两档时才亮；不亮的时候要说是哪一格不满足，
 *       而且「进度没读到」要说成<b>不知道</b>，不许念成「这一轮没有要补的」；</li>
 *   <li>价格这一发走的是<b>第二支</b> estimate 口，上屏的是这一趟真会跑的那几套的数；</li>
 *   <li>执行那一发带回去的凭据是<b>补跑那张</b>（130000 / est-rerun-a1-sets2），
 *       不是整轮那张（260000 / est-2026-09-26-a1）——两份数故意不一样，串用了才测得出来；</li>
 *   <li>回执里后端那几句原话（只补哪几套、成功那几套不动）逐字上屏，且这一发之后勾与价签收回：
 *       要再补一次得重新看过价格。</li>
 * </ol>
 */
describe('M-P34：只补失败那一套（第二张价签、第二道确认）', () => {
  it('进度里有失败的那一套：把手摆出来，但没看过这一趟的价格之前勾与执行都是灭的', async () => {
    const wrapper = await mountView({
      sites: LINKED_SITES,
      progressData: [succeededProgressRow(), failedProgressRow()]
    })
    const text = wrapper.text()
    expect(text).toContain('只补这一轮里失败的那几套（成功的那几套一个字不动）')
    // 第几套只从进度行取：这一屏没在猜「第 2 套」
    expect(text).toContain('第 2 套')
    const estimateButton = byText(RERUN_ESTIMATE_BUTTON)[0] as HTMLButtonElement | undefined
    expect(estimateButton).toBeTruthy()
    expect(estimateButton!.disabled).toBe(false)
    expect(rerunCheckbox()!.disabled).toBe(true)
    const runButton = byText(RERUN_RUN_BUTTON)[0] as HTMLButtonElement | undefined
    expect(runButton).toBeTruthy()
    expect(runButton!.disabled).toBe(true)
    expect(text).toContain('还没看过补跑这一趟的价格')
    expect(briefGenerationApi.rerunFailed).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('这一轮的进度里没有失败的那一套：不给能点的把手，并说清去走「收口重跑」', async () => {
    const wrapper = await mountView({ sites: LINKED_SITES, progressData: [succeededProgressRow()] })
    const text = wrapper.text()
    expect(byText(RERUN_ESTIMATE_BUTTON)[0]!.hasAttribute('disabled')).toBe(true)
    expect(text).toContain('这一轮的进度里没有失败的那一套')
    expect(text).toContain('收口重跑')
    // 这一条是「真没有」，不是「没读到」：两句不许互换
    expect(text).not.toContain('这不是「没有」')
    wrapper.unmount()
  })

  it('进度没读到：那句是「界面不知道」，不是「这一轮没有要补的」', async () => {
    const wrapper = await mountView({ progressError: 'Request failed with status code 503' })
    expect(byText(RERUN_ESTIMATE_BUTTON)[0]!.hasAttribute('disabled')).toBe(true)
    const text = wrapper.text()
    expect(text).toContain('这不是「没有」')
    expect(text).toContain('先点上面的「刷新进度」')
    expect(text).not.toContain('这一轮的进度里没有失败的那一套')
    wrapper.unmount()
  })

  it('客户已选定（decided）：这一档不开放补跑，理由说清只有那两档', async () => {
    const wrapper = await mountView({
      status: 'decided',
      sites: LINKED_SITES,
      progressData: [succeededProgressRow(), failedProgressRow()]
    })
    expect(byText(RERUN_ESTIMATE_BUTTON)[0]!.hasAttribute('disabled')).toBe(true)
    const text = wrapper.text()
    expect(text).toContain('补跑只在「待出方案」与「等客户确认」两档开放')
    expect(text).toContain('会跟交付凭证打架')
    expect(briefGenerationApi.rerunEstimate).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('点补跑的「先估算」打的是第二张口：上屏这一趟的数，整轮那张一个都不出现', async () => {
    const wrapper = await mountView({
      sites: LINKED_SITES,
      progressData: [succeededProgressRow(), failedProgressRow()]
    })
    click(byText(RERUN_ESTIMATE_BUTTON)[0])
    await flushPromises()
    expect(briefGenerationApi.rerunEstimate).toHaveBeenCalledWith(12)
    // 这一发不该顺带把整轮那张也算了一遍：两支口各自独立
    expect(briefGenerationApi.estimate).not.toHaveBeenCalled()
    const text = wrapper.text()
    expect(text).toContain('这张价签只算补跑这一趟：预计 130000 token')
    expect(text).toContain('合计预估：130000 token（1 套 × 130000 token/套）')
    expect(text).not.toContain('260000')
    expect(rerunCheckbox()!.disabled).toBe(false)
    wrapper.unmount()
  })

  it('执行那一发带回的是补跑那张凭据（130000 / est-rerun-a1-sets2），不是整轮那张', async () => {
    const wrapper = await mountView({
      sites: LINKED_SITES,
      progressData: [succeededProgressRow(), failedProgressRow()]
    })
    click(byText(RERUN_ESTIMATE_BUTTON)[0])
    await flushPromises()
    // 先只出价不勾：这一发不会发出去（花钱的调用不接受默认确认）
    click(byText(RERUN_RUN_BUTTON)[0])
    await flushPromises()
    expect(briefGenerationApi.rerunFailed).not.toHaveBeenCalled()
    rerunCheckbox()!.click()
    await flushPromises()
    expect(byText(RERUN_RUN_BUTTON)[0]!.hasAttribute('disabled')).toBe(false)
    click(byText(RERUN_RUN_BUTTON)[0])
    await flushPromises()
    expect(briefGenerationApi.rerunFailed).toHaveBeenCalledWith(12, true, {
      estimateId: 'est-rerun-a1-sets2',
      expectedTokens: 130000
    })
    // 整轮那一发一次都没被带走：补跑不是「再来一轮」
    expect(briefGenerationApi.generate).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('回执里后端那几句原话逐字上屏；这一发之后勾与价签收回，要再补得重新看过价格', async () => {
    const wrapper = await mountView({
      sites: LINKED_SITES,
      progressData: [succeededProgressRow(), failedProgressRow()],
      rerunData: {
        briefId: 12,
        attempt: 1,
        estimatedTokens: 130000,
        notices: [
          '本次只补这一轮里失败的 1 套（第 2 套），成功的那 1 套不动：站、页面、内容与已发的预览链接原样保留。',
          '截图那一步不重跑：已有截图沿用上一趟。'
        ]
      }
    })
    click(byText(RERUN_ESTIMATE_BUTTON)[0])
    await flushPromises()
    rerunCheckbox()!.click()
    await flushPromises()
    click(byText(RERUN_RUN_BUTTON)[0])
    await flushPromises()
    const text = wrapper.text()
    // 界面不复述后端的口径，只逐字列它说的话
    expect(text).toContain('本次只补这一轮里失败的 1 套（第 2 套），成功的那 1 套不动：站、页面、内容与已发的预览链接原样保留。')
    expect(text).toContain('截图那一步不重跑：已有截图沿用上一趟。')
    expect(text).toContain('补跑已受理')
    expect(text).toContain('成功的那几套一个字不动')
    // 价签收回：这一屏回到「没看过价格」那一档，两颗确认都灭
    expect(rerunCheckbox()!.disabled).toBe(true)
    expect(byText(RERUN_RUN_BUTTON)[0]!.hasAttribute('disabled')).toBe(true)
    expect(text).toContain('还没看过补跑这一趟的价格')
    wrapper.unmount()
  })

  it('补跑那张价签读不到时后端那句中文原样挂着：不翻译、不改写，也不给勾', async () => {
    const wrapper = await mountView({
      sites: LINKED_SITES,
      progressData: [succeededProgressRow(), failedProgressRow()],
      rerunError: 'SITE_PROPOSAL_RERUN_INFLIGHT：这一轮还有 1 套没跑完，现在补跑会和它抢同一批页面对象'
    })
    click(byText(RERUN_ESTIMATE_BUTTON)[0])
    await flushPromises()
    const text = wrapper.text()
    expect(text).toContain('这一轮还有 1 套没跑完，现在补跑会和它抢同一批页面对象')
    expect(vi.mocked(message.error).mock.calls.flat().join()).toContain('SITE_PROPOSAL_RERUN_INFLIGHT')
    expect(rerunCheckbox()!.disabled).toBe(true)
    expect(briefGenerationApi.rerunFailed).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('补跑那张价签也带「钱算在谁头上」的读数：平台承担那一档不许被界面念成消耗租户配额', async () => {
    const wrapper = await mountView({
      sites: LINKED_SITES,
      progressData: [succeededProgressRow(), failedProgressRow()],
      rerunEstimateData: {
        ...RERUN_ESTIMATE,
        estimate: { ...RERUN_ESTIMATE.estimate, tenantBearsCost: false }
      }
    })
    click(byText(RERUN_ESTIMATE_BUTTON)[0])
    await flushPromises()
    const labels = [...document.querySelectorAll('label')].map(node => (node.textContent || '').replace(/\s+/g, ''))
    const confirm = labels.find(label => label.includes('我已看过补跑这一趟的预估'))
    expect(confirm).toBeTruthy()
    expect(confirm).toContain('由平台承担')
    expect(confirm).not.toContain('会消耗租户配额')
    wrapper.unmount()
  })
})
