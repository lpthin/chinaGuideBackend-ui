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
 * 2. §9-1 那句「按历史低估 1.2~4.2 倍算的，不是最终账单」必须跟在数字旁边，一个字不改；
 * 3. generate 只发亲手勾过的那一发：confirm 参数来自 checkbox，不是代码默认值；
 *    后端拒（缺确认/开关没开）时那句中文原样挂在页面上；
 * 4. 进度按套列，没有总百分比；进度口读不到时错误原文挂出来，不把「没取到」演成「没在跑」；
 * 5. P4（转正/客户选择页）不摆按钮，只有一句原话；
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

/** 缺省报价：aiEnabled=true，用于「正常报出价」的那几条；个别用例用自己的 estimateData 顶掉它 */
const DEFAULT_ESTIMATE = {
  briefId: 12,
  candidateCount: 2,
  estimatedTokens: 260000,
  remainingTokens: 900000,
  aiEnabled: true,
  breakdown: '2 套 × 每套 7 页 × 演示内容 10 文章 + 3 案例'
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
    vi.mocked(briefGenerationApi.progress).mockResolvedValue(
      (options.progressData ?? { briefId: 12, candidates: [] }) as any
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
    expect(text).toContain('260000')
    expect(text).toContain('900000')
    expect(text).toContain('2 套 × 每套 7 页 × 演示内容 10 文章 + 3 案例')
    // 这句一个字不许改：估算闸门偏松是明令缓决的后果，不许藏
    expect(text).toContain(ESTIMATE_UNDERESTIMATE_DISCLAIMER)
    wrapper.unmount()
  })

  it('aiEnabled=false 的预估不是报价：开关没开时连确认框都不给勾', async () => {
    const wrapper = await mountView({
      estimateData: {
        briefId: 12, candidateCount: 2, estimatedTokens: 100, remainingTokens: null,
        aiEnabled: false, notice: '组装开关没开'
      }
    })
    click(byText('先估算消耗（不调模型）')[0])
    await flushPromises()
    expect(wrapper.text()).toContain('后端回了「这一路没开」')
    expect(checkbox()!.disabled).toBe(true)
    wrapper.unmount()
  })

  it('看过报价并亲手勾上后执行才会发出去，且 confirm 带的就是勾本身；成功后重拉单子与进度', async () => {
    const wrapper = await mountView({ generateData: { briefId: 12 } })
    click(byText('先估算消耗（不调模型）')[0])
    await flushPromises()
    expect(checkbox()!.disabled).toBe(false)
    checkbox()!.click()
    await flushPromises()
    expect(wrapper.text()).toContain('确认框已经勾上')
    click(byText('开始出方案（建2套候选）')[0])
    await flushPromises()
    expect(briefGenerationApi.generate).toHaveBeenCalledWith(12, true)
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
      progressData: {
        briefId: 12,
        candidates: [
          { siteId: 31, candidateNo: 1, status: 'running', statusLabel: '进行中', stage: 'demo_content', stageLabel: '演示内容生成' },
          { siteId: 32, candidateNo: 2, status: 'failed', stage: 'image', errorMessage: '图片模型不可用：该图位交付后由你上传' }
        ]
      }
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
  it('③④⑤ 那一段只有原话没有按钮：转正/预览发送/客户选择页都不摆', async () => {
    const wrapper = await mountView()
    expect(wrapper.text()).toContain('这一段的后端口还没有（P4')
    const labels = [...document.querySelectorAll('button')].map(node => (node.textContent || '').replace(/\s+/g, ''))
    expect(labels.filter(label => /转正|发给客户|选择页/.test(label))).toEqual([])
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
