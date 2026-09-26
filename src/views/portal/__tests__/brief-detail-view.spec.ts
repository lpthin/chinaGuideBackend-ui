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
    briefGenerationApi: { estimate: vi.fn(), generate: vi.fn(), progress: vi.fn() }
  }
})

vi.mock('../../../api/workspace', () => ({
  tenantApi: { list: vi.fn() },
  siteApi: { list: vi.fn() }
}))

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
  props: ['title', 'message', 'type', 'description', 'label', 'span', 'column', 'bordered', 'size'],
  template: `<div class="${name}-stub"><span>{{ message }}{{ description }}</span>`
    + '<slot name="title" /><slot name="message" /><slot /><slot name="default" /></div>'
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

async function mountView(options: MountOptions = {}) {
  routeParams.current = { id: '12' }
  vi.mocked(siteBriefsApi.get).mockResolvedValue(brief({ status: options.status ?? 'ready' }) as any)
  vi.mocked(vocabularyApi.adminVocabulary).mockResolvedValue(VOCAB as any)
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
        'a-tooltip': PASS_THROUGH('ATooltip')
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
    click(byText('到站点管理只看这一单的站')[0])
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
