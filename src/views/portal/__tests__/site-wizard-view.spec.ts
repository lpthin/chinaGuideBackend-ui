import { describe, it, expect, beforeEach, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { Button } from 'ant-design-vue'
import SiteWizardView from '../SiteWizardView.vue'
import { siteBriefsApi, briefGenerationApi, vocabularyApi, type SiteBrief } from '../../../api/siteBriefs'
import { siteSpecApi, type SpecDocumentView } from '../../../api/siteSpec'
import { siteBriefDeliveryApi } from '../../../api/siteBriefDelivery'
import type { BriefCandidateSite } from '../../../api/siteBriefs'

/**
 * 新建网站向导（Spec-M §7.1 / M-P4）钉的七件事：
 *
 * 1. **这一页不是一条新流水线**：进页面只发只读 GET，一次 POST/PUT 都不许有——
 *    出初稿、签字、估价、开始出方案、发预览令牌、转正全部留在各自那一页由人亲手按；
 * 2. 「读失败」不许念成「还没有」：说明书读挂了就报那一句原话，不出现空态那句承诺；
 * 3. 五步的完成状态只由后端读数推：说明书看 status、出方案看候选行有没有 siteId、
 *    比较看 previewIssued、转正看需求单名下的 siteId；
 * 4. 「建出站」的判据取最保守那一档：只有候选行真的挂上了站才算走完第三步；
 * 5. 「待人工」那一套单独数，不许并进失败；
 * 6. 没选需求单时，后面每一步的主按钮都是 disabled，且「下一步」被拦下时给一句人话；
 * 7. 步号与单号写在地址里：带着 ?step=candidates&briefId=7 进来就在那一步，切步会 replace 回去；
 * 8. **第一步就地录**：这一格里嵌的是独立录入页那一份前采表单（同一个组件、同一个写口），
 *    存下来向导就认下这一单——所以词表那一发只读 GET 有两个读者（向导念状态、表单挂题目），
 *    这是两件事而不是两份真相，测试按实数钉住。
 * 9. **同一份表单在两个入口的默认值要一样**：向导里点「录一份新需求单」必须和独立页 `/portal/brief/new`
 *    刚进来时给同一套默认（套数按词表上限拉满、档位 full）；现场就是靠这一条抓出「新单带上一单读数」的。
 *
 * 挂真实 Button（读 DOM 的 disabled），不用全局 stub 演交互。
 */

vi.mock('../../../api/http', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() }
}))

const routeState = vi.hoisted(() => ({ query: {} as Record<string, string> }))
const pushSpy = vi.hoisted(() => vi.fn())
const replaceSpy = vi.hoisted(() => vi.fn())
vi.mock('vue-router', () => ({
  useRoute: () => ({ params: {}, query: routeState.query }),
  useRouter: () => ({ push: pushSpy, replace: replaceSpy })
}))

vi.mock('../../../api/siteBriefs', async importOriginal => {
  const actual = await importOriginal<typeof import('../../../api/siteBriefs')>()
  return {
    ...actual,
    // 第一步内嵌了前采表单：它会按单号读回那一单（向导自己不读），桩里得给它这一口，
    // 否则 loadBrief 里的 undefined 会被表单当成「那一发失败了」弹成错误
    siteBriefsApi: {
      list: vi.fn(),
      get: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      // 第一步内嵌的前采表单要读那份栏目词表（UIB-1：它走超管自己这一口，不走租户侧）
      sectionCatalogue: vi.fn().mockResolvedValue([])
    },
    vocabularyApi: { adminVocabulary: vi.fn() },
    briefGenerationApi: { candidates: vi.fn(), progress: vi.fn(), estimate: vi.fn(), streamProgress: vi.fn() }
  }
})

// 第 5 步的客户答复留痕是纯 GET：桩里只给读口，转正/重跑那两口在这一页根本不该被摸到
vi.mock('../../../api/siteBriefDelivery', async importOriginal => {
  const actual = await importOriginal<typeof import('../../../api/siteBriefDelivery')>()
  return {
    ...actual,
    siteBriefDeliveryApi: { decisions: vi.fn(), promote: vi.fn(), regenerate: vi.fn() }
  }
})

vi.mock('../../../api/siteSpec', async importOriginal => {
  const actual = await importOriginal<typeof import('../../../api/siteSpec')>()
  return { ...actual, siteSpecApi: { read: vi.fn() } }
})

vi.mock('ant-design-vue', async () => {
  const actual = await vi.importActual<Record<string, any>>('ant-design-vue')
  return {
    ...actual,
    message: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() }
  }
})

function brief(overrides: Partial<SiteBrief> = {}): SiteBrief {
  return {
    id: 7,
    tenantId: 15,
    siteId: null,
    status: 'ready',
    statusLabel: null,
    candidateCount: 0,
    demoContentMode: 'standard',
    industry: 'advertising',
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
    requirementsSummary: null,
    createdBy: null,
    createdAt: null,
    updatedAt: null,
    brandName: '测试品牌',
    businessScope: null,
    audienceNote: null,
    uvp: null,
    trustAnchors: [],
    pagePlan: null,
    homeLayout: null,
    colorSecondary: null,
    fontHint: null,
    complianceNote: null,
    notDoing: [],
    ...overrides
  } as SiteBrief
}

function specDoc(overrides: Partial<SpecDocumentView> = {}): SpecDocumentView {
  return {
    specId: 4,
    briefId: 7,
    tenantId: 15,
    exists: true,
    status: 'AI_DRAFTED',
    statusLabel: 'AI 初稿（未确认）',
    specVersion: 1,
    confirmedBy: null,
    confirmedAt: null,
    aiDraftProvider: 'dashscope',
    aiDraftModel: 'qwen3.7-plus',
    aiDraftAt: null,
    draftStatus: null,
    draftStatusLabel: '还没异步出过初稿',
    draftStartedAt: null,
    draftWaitMs: null,
    draftErrorMessage: null,
    draftLatencyNote: null,
    maxSectionChars: 6000,
    sections: [
      { key: 'overview', title: '1 项目概述', order: 1, content: '有字', charCount: 2, blank: false, overLimit: false },
      { key: 'strategy', title: '2 战略分析', order: 2, content: null, charCount: 0, blank: true, overLimit: false }
    ],
    notices: [],
    blockers: ['第 2 段「战略分析」还是空的'],
    ...overrides
  } as SpecDocumentView
}

/**
 * 内嵌的前采表单挂得出题，第一步才算「就地录」：这一份最小词表带 groups（后端真实下发形状），
 * 两题分属两段，打星的只有品牌那一题。
 */
const VOCAB_WITH_QUESTIONS = {
  statusLabels: {},
  candidateMaxCount: 3,
  demoContentModes: [{ value: 'full', label: '带全套', articleCount: 8, caseCount: 3 }],
  questions: [
    { key: 'brand_name', group: 'basic', label: '品牌全称', select: 'text', required: true, evidence: '页脚用这一串字', options: [] },
    { key: 'page_plan', group: 'structure', label: '页面清单', select: 'pages', required: false, options: [] }
  ],
  groups: { basic: '基础段：这是谁、给谁看', structure: '结构段：要哪几页' }
}

function candidate(overrides: Partial<BriefCandidateSite> = {}): BriefCandidateSite {
  return {
    candidateId: 11,
    siteId: 52,
    siteName: '候选 A',
    siteCode: 'candidate-a',
    attempt: 1,
    candidateNo: 1,
    skeletonKey: 'corporate-base',
    focus: '案例优先',
    tone: 'professional',
    stage: 'done',
    status: 'succeeded',
    previewToken: null,
    previewUrl: null,
    previewExpiresAt: null,
    previewIssued: false,
    needsHuman: false,
    notices: [],
    ...overrides
  } as BriefCandidateSite
}

/**
 * 视图这一层的假流（M-P33 批 C）：只记「订了哪几个事件」与「关没关」，一条真的连接都不起。
 * 两条腿的机制本身（换腿、5 秒一眼、坏 JSON 不改读数）钉在 `utils/__tests__/proposal-progress-follow.spec.ts`，
 * 这里钉的是**这一屏上真摆出来的那几句话**：接没接上推送、等了多久那一格、终态的绿。
 */
class WizardStreamStub {
  static instances: WizardStreamStub[] = []

  handlers = new Map<string, ((event: any) => void)[]>()
  closed = 0

  constructor(public url: string) {
    WizardStreamStub.instances.push(this)
  }

  addEventListener(name: string, handler: (event: any) => void) {
    this.handlers.set(name, [...(this.handlers.get(name) ?? []), handler])
  }

  close() {
    this.closed += 1
  }

  emit(name: string, rows: unknown) {
    // 后端流里 data 就是 progress 那一份数组的 JSON 文本
    ;(this.handlers.get(name) ?? []).forEach(handler => handler({ data: JSON.stringify(rows) }))
  }

  get listening(): string[] {
    return [...this.handlers.keys()]
  }
}

/** 在跑那一形的进度行：等待面那几格只有非终态才有读数，终态那两格后端回 null */
function runningRow(overrides: Record<string, any> = {}) {
  return {
    candidateId: 11,
    candidateNo: 1,
    siteId: 52,
    stage: 'copy',
    stageLabel: '文案',
    status: 'running',
    statusLabel: '在跑',
    errorMessage: null,
    notices: [],
    stageWaitMs: 95000,
    roundElapsedMs: 400000,
    stageLatencyMinMs: 60000,
    stageLatencyMaxMs: 540000,
    stageLatencyNote: '这一步以往成功回答实测在 1 分 ~ 9 分之间（只报区间，不是「还要等多久」）',
    ...overrides
  } as any
}

/** 接上假流：EventSource 这一层由测试代管，视图不许真的去连 */
function followWithFakeStream() {
  vi.stubGlobal('EventSource', WizardStreamStub)
  vi.mocked(briefGenerationApi.streamProgress).mockImplementation(
    (id: number) => new WizardStreamStub(`stream-${id}`) as never
  )
}

const PASS_THROUGH = (name: string) => ({
  name,
  props: ['title', 'label', 'message', 'type', 'dataSource', 'columns', 'pagination', 'options', 'value', 'disabled', 'steps', 'modelValue', 'placeholder', 'rows', 'checked', 'color'],
  template: `<div class="${name}-stub"><slot name="title" /><slot name="message" /><slot /></div>`
})

/** 下拉要真的能选人：用原生 select 顶掉 a-select，测试按 value 触发 change */
const SELECT_STUB = {
  name: 'a-select',
  props: ['value', 'options', 'placeholder'],
  emits: ['update:value'],
  template: `<select class="pick" @change="$emit('update:value', Number($event.target.value))">
    <option v-for="opt in options" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
  </select>`
}

/**
 * 步骤条两头都要真：`a-steps` 只当容器，`a-step` 把真组件传下来的 title/status 原样渲出来，
 * 测试才读得到「哪一步算走完了」。真 WizardSteps 一次只渲当前那一步的插槽（这就是界面上的事实），
 * 所以要断哪一步的话，就从地址里带 step 进那一步——不许为测试把五步全摊平。
 */
const STEPS_STUB = {
  name: 'a-steps',
  template: '<div class="steps-stub"><slot /></div>'
}
const STEP_STUB = {
  name: 'a-step',
  props: ['title', 'status'],
  template: '<i class="step-stub" :data-status="status || \'none\'">{{ title }}</i>'
}

function mounted() {
  return mount(SiteWizardView, {
    attachTo: document.body,
    global: {
      stubs: {
        'a-alert': PASS_THROUGH('a-alert'),
        'a-tag': PASS_THROUGH('a-tag'),
        'a-form': PASS_THROUGH('a-form'),
        'a-form-item': PASS_THROUGH('a-form-item'),
        'a-space': PASS_THROUGH('a-space'),
        'a-table': {
          name: 'a-table',
          props: ['dataSource', 'columns'],
          // 桩也要真走 #bodyCell：第 3、4 步摆的就是格子里那些读数，不渲就等于测试没读过它们。
          // 行首那一串 `站点|有没有发过地址` 是这几条用例的把手，单独一个类，不跟格子混
          template: '<div class="table-stub"><div v-for="row in dataSource" :key="row.candidateId ?? row.siteId" class="row">'
            + '<span class="row-summary">{{ row.siteName }}|{{ row.previewIssued ? \'issued\' : \'none\' }}</span>'
            + '<span v-for="(col, i) in columns || []" :key="col.key ?? i" class="cell"><slot name="bodyCell" :column="col" :record="row" /></span>'
            + '</div></div>'
        },
        'a-steps': STEPS_STUB,
        'a-step': STEP_STUB,
        'a-select': SELECT_STUB,
        'a-button': Button,
        // 第一步内嵌的前采表单会渲出这些控件：Vue 把 render 函数里用到的每个组件都提前 resolve 一次，
        // 不补齐就是在满屏「Failed to resolve component」里混进真回归，所以这一族的桩要跟着表单走
        'a-input': PASS_THROUGH('a-input'),
        'a-textarea': PASS_THROUGH('a-textarea'),
        'a-input-number': PASS_THROUGH('a-input-number'),
        'a-radio-group': PASS_THROUGH('a-radio-group'),
        'a-radio': PASS_THROUGH('a-radio'),
        'a-checkbox-group': PASS_THROUGH('a-checkbox-group'),
        'a-checkbox': PASS_THROUGH('a-checkbox'),
        'a-switch': PASS_THROUGH('a-switch'),
        'a-cascader': PASS_THROUGH('a-cascader'),
        // FoldedText 的展开壳：桩只把插槽里的原文渲出来，测试才读得到「后端原话一字没丢」
        'a-collapse': PASS_THROUGH('a-collapse'),
        'a-collapse-panel': PASS_THROUGH('a-collapse-panel')
      }
    }
  })
}

/** 按题干找向导第一步那一格里的输入件：placeholder 已不抄词表的证据句（Spec-M §10.8 末段），
 *  测试的把手因此换成「这一题的标签」。 */
function inputOfQuestion(wrapper: any, labelFragment: string) {
  return wrapper.findAllComponents({ name: 'a-input' }).find((node: any) => String(
    node.element?.closest?.('.brief-intake__question')
      ?.querySelector('.brief-intake__q-label')?.textContent ?? ''
  ).includes(labelFragment))
}

/** 站到某一步：走的是地址那条真路（`?step=`），不是测试后门 */
function mountAt(step: string, briefId?: string) {
  document.body.innerHTML = ''
  routeState.query = { step, ...(briefId ? { briefId } : {}) }
  return mounted()
}

function bodyText() {
  return document.body.textContent || ''
}

function buttonThat(text: string) {
  // 两个汉字的按钮 ant-design-vue 会在中间塞一个空格（「保 存」），比对前先抹掉空白
  return [...document.body.querySelectorAll('button')].find(node =>
    (node.textContent || '').replace(/\s+/g, '').includes(text.replace(/\s+/g, ''))
  ) as HTMLButtonElement | undefined
}

function click(node: HTMLButtonElement | undefined) {
  // 真实点击：ant Button 的 click 要落到 DOM 事件上，不能用 emitWrapper 演
  expect(node, '界面上应有那颗按钮').toBeTruthy()
  node!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  return flushPromises()
}

function steps() {
  return [...document.body.querySelectorAll('.step-stub')] as HTMLElement[]
}

beforeEach(() => {
  document.body.innerHTML = ''
  routeState.query = {}
  // EventSource 是测试替视图代管的（上一条用例可能把它抹成了 undefined 走轮询那条腿）：每条用例从头装
  vi.unstubAllGlobals()
  WizardStreamStub.instances = []
  pushSpy.mockReset()
  replaceSpy.mockReset()
  vi.mocked(siteBriefsApi.list).mockReset()
  // 内嵌的前采表单会读单、也会存单：这三口的实现要跟着清，否则上一条用例的桩回包会漏进下一条
  vi.mocked(siteBriefsApi.get).mockReset()
  vi.mocked(siteBriefsApi.create).mockReset()
  vi.mocked(siteBriefsApi.update).mockReset()
  vi.mocked(vocabularyApi.adminVocabulary).mockReset()
  vi.mocked(siteSpecApi.read).mockReset()
  vi.mocked(briefGenerationApi.candidates).mockReset()
  vi.mocked(briefGenerationApi.progress).mockReset()
  vi.mocked(briefGenerationApi.streamProgress).mockReset()
  vi.mocked(briefGenerationApi.estimate).mockReset()
  vi.mocked(siteBriefDeliveryApi.decisions).mockReset()
  vi.mocked(siteBriefDeliveryApi.promote).mockReset()
  vi.mocked(siteBriefDeliveryApi.regenerate).mockReset()
})

describe('新建网站向导', () => {
  it('进页面只发只读 GET：花钱与签字那几发一个都不在这页', async () => {
    vi.mocked(siteBriefsApi.list).mockResolvedValue([brief()])
    vi.mocked(vocabularyApi.adminVocabulary).mockResolvedValue({ statusLabels: {}, demoContentModes: [] } as any)
    vi.mocked(siteSpecApi.read).mockResolvedValue(specDoc())
    vi.mocked(briefGenerationApi.candidates).mockResolvedValue([])

    mounted()
    await flushPromises()

    expect(siteBriefsApi.list).toHaveBeenCalledTimes(1)
    // 词表这一发有两个读者：向导自己（状态那格中文）与内嵌的前采表单（挂哪些题、段怎么分）。
    // 两处都是同一个只读 GET，界面上没有第二份词表真相；这里按实数钉，不假装只有一次
    expect(vocabularyApi.adminVocabulary).toHaveBeenCalledTimes(2)
    expect(siteBriefsApi.get).toHaveBeenCalledWith(7)
    expect(siteSpecApi.read).toHaveBeenCalledWith(7)
    expect(briefGenerationApi.candidates).toHaveBeenCalledWith(7)
    const http = (await import('../../../api/http')).default as Record<string, any>
    expect(http.post).not.toHaveBeenCalled()
    expect(http.put).not.toHaveBeenCalled()
    expect(siteBriefsApi.create).not.toHaveBeenCalled()
    expect(siteBriefsApi.update).not.toHaveBeenCalled()
  })

  it('一份需求单都没有：后面四步的主按钮全是 disabled，话只说今天真能做的那一步', async () => {
    vi.mocked(siteBriefsApi.list).mockResolvedValue([])
    vi.mocked(vocabularyApi.adminVocabulary).mockResolvedValue({} as any)
    vi.mocked(siteSpecApi.read).mockResolvedValue(specDoc())
    vi.mocked(briefGenerationApi.candidates).mockResolvedValue([])

    mountAt('intake')
    await flushPromises()

    expect(bodyText()).toContain('还没有选定需求单')
    // 「录一份新需求单」是唯一不需要单号的动作，它必须还能按
    expect(buttonThat('录一份新需求单')?.disabled).toBe(false)
    expect(buttonThat('看这一单的详情')?.disabled).toBe(true)

    mountAt('spec')
    await flushPromises()
    expect(siteSpecApi.read).not.toHaveBeenCalled()
    expect(buttonThat('去这一页出初稿')?.disabled).toBe(true)
    // 没有单号时那一步只说「要先有需求单」，不许把说明书的空态承诺念出来
    expect(bodyText()).toContain('要先有需求单')
    expect(bodyText()).not.toContain('这一单还没有说明书')

    mountAt('generate')
    await flushPromises()
    expect(buttonThat('去需求单详情按')?.disabled).toBe(true)

    mountAt('candidates')
    await flushPromises()
    expect(buttonThat('打开候选画廊')?.disabled).toBe(true)
    expect(briefGenerationApi.candidates).not.toHaveBeenCalled()

    mountAt('deliver')
    await flushPromises()
    expect(buttonThat('回需求单详情做选定与转正')?.disabled).toBe(true)
  })

  it('说明书已确认那一步才算走完，其余状态一律不许念成完成', async () => {
    vi.mocked(siteBriefsApi.list).mockResolvedValue([brief()])
    vi.mocked(vocabularyApi.adminVocabulary).mockResolvedValue({} as any)
    vi.mocked(siteSpecApi.read).mockResolvedValue(specDoc({ status: 'CONFIRMED', statusLabel: '已确认', blockers: [] }))
    vi.mocked(briefGenerationApi.candidates).mockResolvedValue([])

    mountAt('spec', '7')
    await flushPromises()

    expect(steps()[1].dataset.status).toBe('finish')
    expect(bodyText()).toContain('已确认的第 1 版')
    // 没有说明书页那份「还差什么」的清单：已确认就不该再列拦下的原因
    expect(bodyText()).not.toContain('第 2 段「战略分析」还是空的')
  })

  it('没确认的说明书把「还差什么」列在页面上，不让人猜', async () => {
    vi.mocked(siteBriefsApi.list).mockResolvedValue([brief()])
    vi.mocked(vocabularyApi.adminVocabulary).mockResolvedValue({} as any)
    vi.mocked(siteSpecApi.read).mockResolvedValue(specDoc())
    vi.mocked(briefGenerationApi.candidates).mockResolvedValue([])

    mountAt('spec', '7')
    await flushPromises()

    expect(steps()[1].dataset.status).toBe('process')
    expect(bodyText()).toContain('第 2 段「战略分析」还是空的')
    expect(bodyText()).toContain('空着 1 段')
  })

  it('初稿那一发正在异步跑：第 2 步说清「下面这几段还是原来那一版」，不演成初稿已经在了', async () => {
    vi.mocked(siteBriefsApi.list).mockResolvedValue([brief()])
    vi.mocked(vocabularyApi.adminVocabulary).mockResolvedValue({} as any)
    vi.mocked(siteSpecApi.read).mockResolvedValue(specDoc({
      draftStatus: 'RUNNING',
      draftStatusLabel: '出初稿中',
      draftStartedAt: '2026-10-17T02:10:00',
      draftWaitMs: 96000
    }))
    vi.mocked(briefGenerationApi.candidates).mockResolvedValue([])

    mountAt('spec', '7')
    await flushPromises()

    expect(bodyText()).toContain('出初稿中：下面这几段还是原来那一版')
    // 指针只指一次：进度与区间的读数归说明书那一页，向导不养第二张嘴（M-P16 #248）
    expect(bodyText()).toContain('都在说明书那一页读')
    // 这一句在 RUNNING 时是假话：那一份文档根本不是这一发的初稿
    expect(bodyText()).not.toContain('空着 1 段')
    expect(steps()[1].dataset.status).not.toBe('finish')
  })

  it('七段都填了字时不许念成「空着 0 段」，也不许提前说已确认', async () => {
    // 现场那一单（需求单 #59）就是这个形状：statusLabel「草稿（人编辑中，未确认）」+ 无空段
    vi.mocked(siteBriefsApi.list).mockResolvedValue([brief()])
    vi.mocked(vocabularyApi.adminVocabulary).mockResolvedValue({} as any)
    vi.mocked(siteSpecApi.read).mockResolvedValue(specDoc({ blockers: [], sections: [
      { key: 'overview', title: '1 项目概述', order: 1, content: '有字', charCount: 2, blank: false, overLimit: false }
    ] }))
    vi.mocked(briefGenerationApi.candidates).mockResolvedValue([])

    mountAt('spec', '59')
    await flushPromises()

    expect(bodyText()).toContain('签字才能放行生成')
    expect(bodyText()).not.toContain('空着 0 段')
    // 没签字就绝不算走完：这一步顶多是 process
    expect(steps()[1].dataset.status).toBe('process')
  })

  it('第一步那格把候选数念成「要出几套」（意图），不念成已经建出来的套数', async () => {
    vi.mocked(siteBriefsApi.list).mockResolvedValue([brief({ candidateCount: 3 })])
    vi.mocked(vocabularyApi.adminVocabulary).mockResolvedValue({} as any)
    vi.mocked(siteSpecApi.read).mockResolvedValue(specDoc())
    vi.mocked(briefGenerationApi.candidates).mockResolvedValue([])

    mountAt('intake')
    await flushPromises()

    expect(bodyText()).toContain('这一单要出几套：3')
    expect(bodyText()).not.toContain('候选套数：3')
    // 真正建出来几套只有候选那一屏说得出：这里一套都还没有
    expect(bodyText()).not.toContain('候选 3 套')
  })

  it('说明书读失败不冒充「还没有说明书」：报的是那一发的原话', async () => {
    vi.mocked(siteBriefsApi.list).mockResolvedValue([brief()])
    vi.mocked(vocabularyApi.adminVocabulary).mockResolvedValue({} as any)
    vi.mocked(siteSpecApi.read).mockRejectedValue(new Error('site_spec:edit 没有，读不到'))
    vi.mocked(briefGenerationApi.candidates).mockResolvedValue([])

    mountAt('spec', '7')
    await flushPromises()

    expect(bodyText()).toContain('说明书没读到：site_spec:edit 没有，读不到')
    expect(bodyText()).not.toContain('这一单还没有说明书')
    expect(steps()[1].dataset.status).toBe('error')
  })

  it('第三步要候选真的建出了站才算走完：待人工那一套单列，不并进失败', async () => {
    vi.mocked(siteBriefsApi.list).mockResolvedValue([brief()])
    vi.mocked(vocabularyApi.adminVocabulary).mockResolvedValue({} as any)
    vi.mocked(siteSpecApi.read).mockResolvedValue(specDoc({ status: 'CONFIRMED', blockers: [] }))
    vi.mocked(briefGenerationApi.candidates).mockResolvedValue([
      candidate(),
      candidate({ candidateId: 12, siteId: null, siteName: null, candidateNo: 2, previewIssued: false }),
      candidate({ candidateId: 13, candidateNo: 3, needsHuman: true, previewIssued: true })
    ])

    mountAt('generate', '7')
    await flushPromises()

    expect(steps()[2].dataset.status).toBe('finish')
    expect(bodyText()).toContain('候选 3 套，建出站 2 套')
    // 第三步走完 ⇒ 第四步「发过预览」才算走完，第五步还只是进行中
    expect(steps()[3].dataset.status).toBe('finish')
    expect(steps()[4].dataset.status).toBe('process')

    mountAt('candidates', '7')
    await flushPromises()

    // 表里只摆建出了站的那两套（第 2 套 siteId 还是 null，不许混进来充数），
    // 预览那一格照后端回包念：一套没发过、一套已发放
    expect([...document.body.querySelectorAll('.row-summary')].map(node => node.textContent)).toEqual(['候选 A|none', '候选 A|issued'])
    expect(bodyText()).toContain('已发放预览地址 1 / 2 套')
    expect(bodyText()).toContain('其中 1 套带「待人工」措辞')
  })

  it('没发过预览地址时第四步不许念成完成：那一枚令牌只能由人在画廊按套签', async () => {
    vi.mocked(siteBriefsApi.list).mockResolvedValue([brief()])
    vi.mocked(vocabularyApi.adminVocabulary).mockResolvedValue({} as any)
    vi.mocked(siteSpecApi.read).mockResolvedValue(specDoc({ status: 'CONFIRMED', blockers: [] }))
    vi.mocked(briefGenerationApi.candidates).mockResolvedValue([candidate()])

    mountAt('candidates', '7')
    await flushPromises()

    expect(steps()[3].dataset.status).toBe('process')
    expect(bodyText()).toContain('已发放预览地址 0 / 1 套')
  })

  it('转正那一步看的是需求单名下的站点：回填了才算走完，并给出只看这一单站点的去处', async () => {
    vi.mocked(siteBriefsApi.list).mockResolvedValue([brief({ siteId: 63 })])
    vi.mocked(vocabularyApi.adminVocabulary).mockResolvedValue({} as any)
    vi.mocked(siteSpecApi.read).mockResolvedValue(specDoc({ status: 'CONFIRMED', blockers: [] }))
    vi.mocked(briefGenerationApi.candidates).mockResolvedValue([candidate({ previewIssued: true })])

    mountAt('deliver', '7')
    await flushPromises()

    expect(steps()[4].dataset.status).toBe('finish')
    expect(bodyText()).toContain('这一单已绑定站点 #63')

    await click(buttonThat('到站点清单只看这一单的站'))
    expect(pushSpy).toHaveBeenCalledWith({ name: 'workspace-sites', query: { briefId: '7' } })
  })

  it('每一步的去处都带着这一单的号：说明书走 params.brief，画廊走 params.id', async () => {
    vi.mocked(siteBriefsApi.list).mockResolvedValue([brief()])
    vi.mocked(vocabularyApi.adminVocabulary).mockResolvedValue({} as any)
    vi.mocked(siteSpecApi.read).mockResolvedValue(specDoc())
    vi.mocked(briefGenerationApi.candidates).mockResolvedValue([candidate()])

    mountAt('spec', '7')
    await flushPromises()
    await click(buttonThat('去这一页出初稿'))
    expect(pushSpy).toHaveBeenCalledWith({ name: 'workspace-portal-brief-spec', params: { brief: '7' } })
    pushSpy.mockClear()

    mountAt('candidates', '7')
    await flushPromises()
    await click(buttonThat('打开候选画廊'))
    expect(pushSpy).toHaveBeenCalledWith({ name: 'workspace-portal-brief-candidates', params: { id: '7' } })
  })

  it('步号在地址里：带着 step=candidates 进来就在那一步，换步会 replace 回地址', async () => {
    vi.mocked(siteBriefsApi.list).mockResolvedValue([brief()])
    vi.mocked(vocabularyApi.adminVocabulary).mockResolvedValue({} as any)
    vi.mocked(siteSpecApi.read).mockResolvedValue(specDoc())
    vi.mocked(briefGenerationApi.candidates).mockResolvedValue([candidate({ previewIssued: true })])

    mountAt('candidates', '7')
    await flushPromises()

    // 那一屏上是第四步自己的话：说明确实停在这一步，不是回到第一步
    expect(bodyText()).toContain('已发放预览地址 1 / 1 套')
    expect(buttonThat('上一步')?.disabled).toBe(false)

    await click(buttonThat('上一步'))
    expect(replaceSpy).toHaveBeenCalledWith({ query: { step: 'generate', briefId: '7' } })
  })

  it('还没选单就点下一步：拦下并给一句人话，步号不动', async () => {
    vi.mocked(siteBriefsApi.list).mockResolvedValue([])
    vi.mocked(vocabularyApi.adminVocabulary).mockResolvedValue({} as any)
    vi.mocked(siteSpecApi.read).mockResolvedValue(specDoc())
    vi.mocked(briefGenerationApi.candidates).mockResolvedValue([])

    mounted()
    await flushPromises()

    await click(buttonThat('下一步'))
    expect(bodyText()).toContain('先回到第一步选一份需求单')
    expect(replaceSpy).not.toHaveBeenCalled()
  })

  it('选另一份需求单会把单号写回地址并重读那一单的事实', async () => {
    vi.mocked(siteBriefsApi.list).mockResolvedValue([brief(), brief({ id: 36, brandName: '另一家', status: 'awaiting_client' })])
    vi.mocked(vocabularyApi.adminVocabulary).mockResolvedValue({} as any)
    vi.mocked(siteSpecApi.read).mockResolvedValue(specDoc({ briefId: 36 }))
    vi.mocked(briefGenerationApi.candidates).mockResolvedValue([])

    const wrapper = mounted()
    await flushPromises()
    expect(siteSpecApi.read).toHaveBeenLastCalledWith(7)

    const pick = document.body.querySelector('.pick') as HTMLSelectElement
    pick.value = '36'
    pick.dispatchEvent(new Event('change'))
    await flushPromises()
    await wrapper.vm.$nextTick()

    expect(siteSpecApi.read).toHaveBeenLastCalledWith(36)
    expect(replaceSpy).toHaveBeenCalledWith({ query: { step: 'intake', briefId: '36' } })
  })

  /**
   * M-P4 第一步「就地录」的那一条：这一格里嵌的就是独立页那一份前采表单（同一个组件，
   * 不存在第二套提交形状），存下来之后向导认下这一单、把号写回地址、重读后面几步的事实。
   * 这里点的是表单自己的真实保存按钮，向导不替它按，也不许把人送去另一页（push 一次都不发）。
   */
  it('第一步就地录：内嵌表单存下来后向导认下这一单，并重读后三步的读数', async () => {
    document.body.innerHTML = ''
    // 租户号走的是地址那条既有交棒路（props 优先、地址兜底）：向导不给表单传租户，交棒链接因此不必改
    routeState.query = { step: 'intake', tenantId: '15' }
    vi.mocked(siteBriefsApi.list).mockResolvedValue([])
    vi.mocked(vocabularyApi.adminVocabulary).mockResolvedValue(VOCAB_WITH_QUESTIONS as any)
    vi.mocked(siteBriefsApi.create).mockResolvedValue(brief({ id: 88, status: 'draft', brandName: '某某科技' }) as any)
    vi.mocked(siteSpecApi.read).mockResolvedValue(specDoc({ briefId: 88 }))
    vi.mocked(briefGenerationApi.candidates).mockResolvedValue([])

    const wrapper = mounted()
    await flushPromises()

    // 题真的挂在这一格：步进行说「第 1 / 2 题」并点名当前这一题的题干
    expect(document.body.querySelector('.brief-intake__question')).toBeTruthy()
    expect(bodyText()).toContain('第 1 / 2 题「品牌全称」')
    // 进度条把每一题的题干都摆出来（那是导航），但别题的控件不许在这一屏上渲
    expect(bodyText()).toContain('页面清单')
    expect(document.querySelector('.brief-intake__page-row')).toBeNull()
    expect(document.querySelector('.brief-intake__question .brief-intake__q-label')!.textContent).toContain('品牌全称')

    const brand = inputOfQuestion(wrapper, '品牌全称')
    expect(brand, '词表里那题的输入格应挂在向导第一步上').toBeTruthy()
    brand!.vm.$emit('update:value', '某某科技')
    await flushPromises()

    await click(buttonThat('保存'))

    expect(siteBriefsApi.create).toHaveBeenCalledTimes(1)
    const payload = vi.mocked(siteBriefsApi.create).mock.calls[0][0] as any
    expect(payload.tenantId).toBe(15)
    expect(payload.brandName).toBe('某某科技')
    // 向导认下这一单：单号写回地址，后三步改读这一单的事实（说明书那一发是新的单号，不是 7）
    expect(replaceSpy).toHaveBeenCalledWith({ query: { step: 'intake', briefId: '88' } })
    expect(siteSpecApi.read).toHaveBeenLastCalledWith(88)
    expect(briefGenerationApi.candidates).toHaveBeenLastCalledWith(88)
    expect(steps()[0].dataset.status).toBe('finish')
    // 就地录不是另开一页：这一趟没把人 push 去独立录入页
    expect(pushSpy).not.toHaveBeenCalled()
  })

  it('先看老单再点「录一份新需求单」：套数与档位回到词表默认，不把上一单的读数带进新单', async () => {
    document.body.innerHTML = ''
    routeState.query = { step: 'intake', tenantId: '15' }
    vi.mocked(siteBriefsApi.list).mockResolvedValue([brief({ id: 7, status: 'draft' })])
    // #7 那份读的是「0 套 + standard 档」——新单的 payload 里只要出现这两个值，就是内嵌新建把旧读数带过来了
    vi.mocked(siteBriefsApi.get).mockResolvedValue(brief({ id: 7, status: 'draft', candidateCount: 0, demoContentMode: 'standard' }) as any)
    vi.mocked(vocabularyApi.adminVocabulary).mockResolvedValue(VOCAB_WITH_QUESTIONS as any)
    vi.mocked(siteBriefsApi.create).mockResolvedValue(brief({ id: 91, status: 'draft' }) as any)
    vi.mocked(siteSpecApi.read).mockResolvedValue(specDoc({ briefId: 91 }))
    vi.mocked(briefGenerationApi.candidates).mockResolvedValue([])

    const wrapper = mounted()
    await flushPromises()
    expect(siteBriefsApi.get).toHaveBeenCalledWith(7)

    await click(buttonThat('录一份新需求单')!)
    await flushPromises()
    expect(bodyText()).toContain('第 1 / 2 题')

    const brand = inputOfQuestion(wrapper, '品牌全称')
    brand!.vm.$emit('update:value', '新的一单')
    await flushPromises()
    await click(buttonThat('保存'))

    expect(siteBriefsApi.create).toHaveBeenCalledTimes(1)
    const payload = vi.mocked(siteBriefsApi.create).mock.calls[0][0] as any
    // 与独立页 `/portal/brief/new` 刚进来时同一份默认：套数按词表上限拉满、档位取 full（拍板 7）
    expect(payload.candidateCount).toBe(3)
    expect(payload.demoContentMode).toBe('full')
    expect(payload.brandName).toBe('新的一单')
  })

  // ---- M-P8：读数搬进向导（他拍板那条「一步只摊开一步的事」），下面这些用例钉的是「摆在这一屏」而不是「跳了页」 ----

  /** 进度行最小形状：只给这一屏真读的那几格，多余字段一律不编（后端没回的就得念「没取到」） */
  function progressRow(overrides: Record<string, any> = {}) {
    return {
      candidateId: 11,
      candidateNo: 1,
      siteId: 52,
      stage: 'done',
      stageLabel: '建完了',
      // 终态码只认后端那一份（ProposalStages.SUCCEEDED = 'succeeded'）：
      // 这里以前写 'success'，界面拿它判「这一套绿了」的那一格就永远不绿——桩替后端撒了谎
      status: 'succeeded',
      statusLabel: '成功',
      errorMessage: null,
      notices: [],
      ...overrides
    } as any
  }

  it('第 2 步把每一段的现状摊在这一格里：空着的段直接点名，段数只认后端回的那份', async () => {
    vi.mocked(siteBriefsApi.list).mockResolvedValue([brief()])
    vi.mocked(vocabularyApi.adminVocabulary).mockResolvedValue({} as any)
    vi.mocked(siteSpecApi.read).mockResolvedValue(specDoc())
    vi.mocked(briefGenerationApi.candidates).mockResolvedValue([])

    mountAt('spec', '7')
    await flushPromises()

    // 段名与顺序是后端那份（这里两份段：第 2 段是空的）
    expect(bodyText()).toContain('1 项目概述')
    expect(bodyText()).toContain('2 战略分析')
    expect(bodyText()).toContain('空着')
    // 「七段」这种界面自己数的数不许出现：桩里只有 2 段，念成七段就是谎报
    expect(bodyText()).toContain('2 段里写了 1 段、空着 1 段')
    expect(bodyText()).not.toContain('七段')
  })

  it('第 3 步的价签只由人点：进这一屏一次 POST 都不发，点了那一颗才发并摆出凭据', async () => {
    vi.mocked(siteBriefsApi.list).mockResolvedValue([brief()])
    vi.mocked(vocabularyApi.adminVocabulary).mockResolvedValue({} as any)
    vi.mocked(siteSpecApi.read).mockResolvedValue(specDoc({ status: 'CONFIRMED' }))
    vi.mocked(briefGenerationApi.candidates).mockResolvedValue([])
    vi.mocked(briefGenerationApi.progress).mockResolvedValue([])
    vi.mocked(briefGenerationApi.estimate).mockResolvedValue({
      briefId: 7,
      attempt: 2,
      estimateId: 'est-abc',
      estimate: {
        candidateCount: 3,
        pagesPerCandidate: 5,
        estimatedTokens: 120000,
        aiEnabled: true,
        tenantBearsCost: false,
        breakdown: ['3 套 × 每套 5 页', '演示内容 8 篇 / 3 条'],
        missingSwitches: [],
        notice: '实测大约是估算的 0.83 倍'
      }
    } as any)

    mountAt('generate', '7')
    await flushPromises()

    // 进屏只发了那几发 GET：估算虽然是零模型调用，但它是 POST，界面不许替人按
    expect(briefGenerationApi.estimate).not.toHaveBeenCalled()
    const http = (await import('../../../api/http')).default as Record<string, any>
    expect(http.post).not.toHaveBeenCalled()

    await click(buttonThat('在这一屏算一次价'))
    expect(briefGenerationApi.estimate).toHaveBeenCalledTimes(1)
    expect(briefGenerationApi.estimate).toHaveBeenCalledWith(7)
    // 花的凭据与那句「不是最终账单」摆在屏上：那一发花钱要同时带这两个值
    expect(bodyText()).toContain('est-abc')
    expect(bodyText()).toContain('3 套、每套 5 页，预估 120000 token')
    expect(bodyText()).toContain('这只是预估，不是最终账单')
    expect(bodyText()).toContain('不扣这个租户的配额')
    // 明细与那句关于偏差的话是后端拼的，界面上原样摆
    expect(bodyText()).toContain('实测大约是估算的 0.83 倍')
  })

  it('第 3 步：出方案开关没开时不念成一张可以花的价签', async () => {
    vi.mocked(siteBriefsApi.list).mockResolvedValue([brief()])
    vi.mocked(vocabularyApi.adminVocabulary).mockResolvedValue({} as any)
    vi.mocked(siteSpecApi.read).mockResolvedValue(specDoc())
    vi.mocked(briefGenerationApi.candidates).mockResolvedValue([])
    vi.mocked(briefGenerationApi.progress).mockResolvedValue([])
    vi.mocked(briefGenerationApi.estimate).mockResolvedValue({
      briefId: 7,
      estimateId: 'est-off',
      estimate: {
        candidateCount: 0,
        pagesPerCandidate: 0,
        estimatedTokens: 0,
        aiEnabled: false,
        breakdown: [],
        missingSwitches: ['候选站生成开关没开'],
        notice: null
      }
    } as any)

    mountAt('generate', '7')
    await flushPromises()
    await click(buttonThat('在这一屏算一次价'))

    expect(bodyText()).toContain('出方案开关没开')
    expect(bodyText()).not.toContain('预估 0 token')
    expect(bodyText()).toContain('候选站生成开关没开')
  })

  it('第 3 步把失败那套的原因摆在明面上：那是这一发失败了，不是「还在跑」', async () => {
    vi.mocked(siteBriefsApi.list).mockResolvedValue([brief()])
    vi.mocked(vocabularyApi.adminVocabulary).mockResolvedValue({} as any)
    vi.mocked(siteSpecApi.read).mockResolvedValue(specDoc())
    vi.mocked(briefGenerationApi.candidates).mockResolvedValue([candidate()])
    vi.mocked(briefGenerationApi.progress).mockResolvedValue([
      progressRow({ status: 'failed', statusLabel: '失败', errorMessage: '文案没通过极限用语闸：最好 / 第一' })
    ])

    mountAt('generate', '7')
    await flushPromises()

    expect(bodyText()).toContain('文案没通过极限用语闸')
    expect(bodyText()).toContain('建出站 1 套')
    expect(bodyText()).toContain('其中 1 套有失败记录')
  })

  it('第 3 步进度读挂了：报「没读到」，不许念成「还在跑」', async () => {
    vi.mocked(siteBriefsApi.list).mockResolvedValue([brief()])
    vi.mocked(vocabularyApi.adminVocabulary).mockResolvedValue({} as any)
    vi.mocked(siteSpecApi.read).mockResolvedValue(specDoc())
    vi.mocked(briefGenerationApi.candidates).mockResolvedValue([candidate()])
    vi.mocked(briefGenerationApi.progress).mockRejectedValue(new Error('502 网关没通'))

    mountAt('generate', '7')
    await flushPromises()

    expect(bodyText()).toContain('逐套进度没读到')
    expect(bodyText()).toContain('502 网关没通')
    // 读挂了就一格进度都不摆：没有读数还画出「跑到哪一步了」那张表，才是真把界面念成还在跑
    expect(bodyText()).not.toContain('每一套跑到哪一步了')
  })

  it('第 4 步：每一套的账不用点开这一行就看得见，取不到念「没取到」不念 0', async () => {
    vi.mocked(siteBriefsApi.list).mockResolvedValue([brief()])
    vi.mocked(vocabularyApi.adminVocabulary).mockResolvedValue({} as any)
    vi.mocked(siteSpecApi.read).mockResolvedValue(specDoc())
    vi.mocked(briefGenerationApi.candidates).mockResolvedValue([
      candidate({ candidateNo: 1 }),
      candidate({ candidateId: 12, candidateNo: 2, siteId: 53, siteName: '候选 B' })
    ])
    // 只有第 1 套读得到进度：第 2 套那些格子必须念「没取到」，念 0 是说「一张图都没出」
    vi.mocked(briefGenerationApi.progress).mockResolvedValue([
      progressRow({ demoArticles: 8, demoCases: 3, imageDone: 2, imageFailed: 0, imageSkipped: 1, promptTokens: 900, completionTokens: 4000 })
    ])

    mountAt('candidates', '7')
    await flushPromises()

    expect(bodyText()).toContain('每一套的账')
    expect(bodyText()).toContain('第 1 套')
    expect(bodyText()).toContain('文章 8 篇 / 案例 3 条')
    expect(bodyText()).toContain('成功 2 张、失败 0 张、跳过 1 张')
    expect(bodyText()).toContain('跳过不等于失败')
    expect(bodyText()).toContain('实耗 900 + 4000 token')
    expect(bodyText()).toContain('文章 没取到 篇')
    // 这三本账不许再藏在「点开这一行」里
    expect(document.body.querySelectorAll('.ant-table-row-expand-icon').length).toBe(0)
  })

  it('第 4 步：待人工那一套把话摊开，并说清它跟失败是两件事', async () => {
    vi.mocked(siteBriefsApi.list).mockResolvedValue([brief()])
    vi.mocked(vocabularyApi.adminVocabulary).mockResolvedValue({} as any)
    vi.mocked(siteSpecApi.read).mockResolvedValue(specDoc())
    vi.mocked(briefGenerationApi.candidates).mockResolvedValue([candidate({ needsHuman: true })])
    vi.mocked(briefGenerationApi.progress).mockResolvedValue([
      progressRow({ notices: ['这句措辞没过极限用语闸，改完再发预览链接'] })
    ])

    mountAt('candidates', '7')
    await flushPromises()

    expect(bodyText()).toContain('这一套带着要人过目的话')
    expect(bodyText()).toContain('这句措辞没过极限用语闸')
    expect(bodyText()).toContain('「待人工」与「失败」是两件事')
    // 令牌明文在这一屏一个都不出现：它只在签发那一刻存在过
    expect(bodyText()).toContain('预览令牌绑站不绑页')
  })

  it('第 4 步：候选行自己带中文标签就用自己的，不靠进度那一行（进度挂了也不露原码）', async () => {
    vi.mocked(siteBriefsApi.list).mockResolvedValue([brief()])
    vi.mocked(vocabularyApi.adminVocabulary).mockResolvedValue({} as any)
    vi.mocked(siteSpecApi.read).mockResolvedValue(specDoc())
    vi.mocked(briefGenerationApi.candidates).mockResolvedValue([
      candidate({ stage: 'done', stageLabel: '已完成', status: 'succeeded', statusLabel: '已产出' })
    ])
    // 进度这一端点这一次压根没读到：候选列表自己带标签，就不该因为进度缺位退回去露码
    vi.mocked(briefGenerationApi.progress).mockRejectedValue(new Error('进度接口没通'))

    mountAt('candidates', '7')
    await flushPromises()

    expect(bodyText()).toContain('已完成')
    expect(bodyText()).not.toContain('done')
  })

  it('第 4 步：候选行没带标签（后端还是旧版）时按 candidateId 借进度那一行，借不到才露原码', async () => {
    vi.mocked(siteBriefsApi.list).mockResolvedValue([brief()])
    vi.mocked(vocabularyApi.adminVocabulary).mockResolvedValue({} as any)
    vi.mocked(siteSpecApi.read).mockResolvedValue(specDoc())
    vi.mocked(briefGenerationApi.candidates).mockResolvedValue([
      candidate({ candidateId: 99, stage: 'demo', status: 'running' })
    ])
    vi.mocked(briefGenerationApi.progress).mockResolvedValue([
      progressRow({ candidateId: 99, stage: 'demo', stageLabel: '演示内容' })
    ])

    mountAt('candidates', '7')
    await flushPromises()

    expect(bodyText()).toContain('演示内容')
    expect(bodyText()).not.toContain('demo')

    document.body.innerHTML = ''
    vi.mocked(briefGenerationApi.progress).mockResolvedValue([])
    mountAt('candidates', '7')
    await flushPromises()
    // 两处都借不到才露原码：宁可露码，也不在前端抄第二份词表
    expect(bodyText()).toContain('demo')
  })

  it('第 5 步：客户留痕摊在这一格里，选定了也只说「还等人按」，这一屏不代转正', async () => {
    vi.mocked(siteBriefsApi.list).mockResolvedValue([brief({ siteId: null })])
    vi.mocked(vocabularyApi.adminVocabulary).mockResolvedValue({} as any)
    vi.mocked(siteSpecApi.read).mockResolvedValue(specDoc({ status: 'CONFIRMED' }))
    vi.mocked(briefGenerationApi.candidates).mockResolvedValue([candidate()])
    vi.mocked(briefGenerationApi.progress).mockResolvedValue([])
    vi.mocked(siteBriefDeliveryApi.decisions).mockResolvedValue([
      { id: 3, sessionId: 9, chosenSiteId: 52, chosenSiteName: '候选 A', candidateNo: 1, clientNote: '就要第一套，谢谢', createdAt: '2026-10-10T09:00:00' }
    ] as any)

    mountAt('deliver', '7')
    await flushPromises()

    expect(bodyText()).toContain('客户在这条预览链接上答过什么')
    expect(bodyText()).toContain('就要第一套，谢谢')
    expect(bodyText()).toContain('客户已经选定了某一套，转正那一发还等人按')
    // 转正与重跑收口都在各自那一页，由人按：这一屏一口都没发
    expect(siteBriefDeliveryApi.promote).not.toHaveBeenCalled()
    expect(siteBriefDeliveryApi.regenerate).not.toHaveBeenCalled()
    const http = (await import('../../../api/http')).default as Record<string, any>
    expect(http.post).not.toHaveBeenCalled()
  })

  it('第 5 步留痕读挂了：报那一发的原话，不许念成「客户没答复」', async () => {
    vi.mocked(siteBriefsApi.list).mockResolvedValue([brief()])
    vi.mocked(vocabularyApi.adminVocabulary).mockResolvedValue({} as any)
    vi.mocked(siteSpecApi.read).mockResolvedValue(specDoc())
    vi.mocked(briefGenerationApi.candidates).mockResolvedValue([candidate()])
    vi.mocked(briefGenerationApi.progress).mockResolvedValue([])
    vi.mocked(siteBriefDeliveryApi.decisions).mockRejectedValue(new Error('接口 500'))

    mountAt('deliver', '7')
    await flushPromises()

    expect(bodyText()).toContain('客户答复留痕没读到')
    expect(bodyText()).toContain('不是「客户没答复」')
    expect(bodyText()).not.toContain('一条留痕都没有')
  })

  it('换到别的一步不替人把别步的读数也发了：逐套进度只在前两步读，留痕只在第 5 步读', async () => {
    vi.mocked(siteBriefsApi.list).mockResolvedValue([brief()])
    vi.mocked(vocabularyApi.adminVocabulary).mockResolvedValue({} as any)
    vi.mocked(siteSpecApi.read).mockResolvedValue(specDoc())
    vi.mocked(briefGenerationApi.candidates).mockResolvedValue([candidate()])
    vi.mocked(briefGenerationApi.progress).mockResolvedValue([])
    vi.mocked(siteBriefDeliveryApi.decisions).mockResolvedValue([])

    mountAt('spec', '7')
    await flushPromises()
    // 第 2 步：说明书那一发读的是顶那条步序条，进度与留痕这两发一步都不该发
    expect(briefGenerationApi.progress).not.toHaveBeenCalled()
    expect(siteBriefDeliveryApi.decisions).not.toHaveBeenCalled()

    // 第 4 步：进度要读（这一屏摆的就是这几本账），留痕仍不读
    routeState.query = { step: 'candidates', briefId: '7' }
    document.body.innerHTML = ''
    mounted()
    await flushPromises()
    expect(briefGenerationApi.progress).toHaveBeenCalled()
    expect(siteBriefDeliveryApi.decisions).not.toHaveBeenCalled()
  })

  it('第 1 步读不到说明书时不许把「读挂了」念成「还没有说明书」（同族纪律，第 2 步也守）', async () => {
    vi.mocked(siteBriefsApi.list).mockResolvedValue([brief()])
    vi.mocked(vocabularyApi.adminVocabulary).mockResolvedValue({} as any)
    vi.mocked(siteSpecApi.read).mockRejectedValue(new Error('403 没这一单的权限'))
    vi.mocked(briefGenerationApi.candidates).mockResolvedValue([])

    mountAt('spec', '7')
    await flushPromises()

    expect(bodyText()).toContain('说明书没读到')
    expect(bodyText()).toContain('403 没这一单的权限')
    expect(bodyText()).not.toContain('这一单还没有说明书')
    // 段清单在这一屏因此一格都不摆：没有后端那份清单，界面不抄第二份
    expect(bodyText()).not.toContain('1 项目概述')
  })

  /**
   * M-P33 拍板 6：价签说「这一趟要花多少」，旁边那一份说「到这一刻已经花了多少」。
   * 两份并排、不合成一句；句子全来自后端 `WorkbenchBurnLedger`，界面只负责摆。
   */
  it('第 3 步把「这一家已经烧了多少」与价签并排摆着，两份数字各说各的口径', async () => {
    vi.mocked(siteBriefsApi.list).mockResolvedValue([brief()])
    vi.mocked(vocabularyApi.adminVocabulary).mockResolvedValue({} as any)
    vi.mocked(siteSpecApi.read).mockResolvedValue(specDoc({ status: 'CONFIRMED' }))
    vi.mocked(briefGenerationApi.candidates).mockResolvedValue([])
    vi.mocked(briefGenerationApi.progress).mockResolvedValue([])
    vi.mocked(briefGenerationApi.estimate).mockResolvedValue({
      briefId: 7,
      estimateId: 'est-burn',
      estimate: {
        candidateCount: 3,
        pagesPerCandidate: 5,
        estimatedTokens: 120000,
        aiEnabled: true,
        tenantBearsCost: false,
        breakdown: ['3 套 × 每套 5 页'],
        missingSwitches: [],
        notice: '这是预估，不是账单'
      },
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
          '这些钱没有一分进过他的额度：交付没确定之前，这条链由平台承担，系统不设硬闸。',
          '口径：只认 ai_call_log 里建站那一族 purpose 的行。'
        ],
        tokenBasis: '这一份是 ai_call_log 那把字数尺（提示词字数 ÷ 4）'
      }
    } as any)

    mountAt('generate', '7')
    await flushPromises()
    await click(buttonThat('在这一屏算一次价'))

    expect(bodyText()).toContain('已经跑过 5 发外呼')
    expect(bodyText()).toContain('失败那 1 发没有 token 数')
    expect(bodyText()).toContain('未配价')
    expect(bodyText()).toContain('系统不设硬闸')
    expect(bodyText()).toContain('口径：只认 ai_call_log')
    expect(bodyText()).toContain('这一份是 ai_call_log 那把字数尺')
    // 两份数字各说各的：价签那一句仍然单独在，已烧量不吞进价格里
    expect(bodyText()).toContain('预估 120000 token')
  })

  /** 后端没下发这一份读数时念「没回读数」，不替它编 0（0 说的是「一次都没跑过」，那是另一档真话） */
  it('第 3 步：后端没回已烧读数时念「没回读数」，不念成 0 发', async () => {
    vi.mocked(siteBriefsApi.list).mockResolvedValue([brief()])
    vi.mocked(vocabularyApi.adminVocabulary).mockResolvedValue({} as any)
    vi.mocked(siteSpecApi.read).mockResolvedValue(specDoc({ status: 'CONFIRMED' }))
    vi.mocked(briefGenerationApi.candidates).mockResolvedValue([])
    vi.mocked(briefGenerationApi.progress).mockResolvedValue([])
    vi.mocked(briefGenerationApi.estimate).mockResolvedValue({
      briefId: 7,
      estimateId: 'est-noburn',
      estimate: {
        candidateCount: 1,
        pagesPerCandidate: 2,
        estimatedTokens: 3000,
        aiEnabled: true,
        tenantBearsCost: true,
        breakdown: [],
        missingSwitches: [],
        notice: '这是预估，不是账单'
      }
      // 故意不给 platformBurn：老后端、或后端那一发读挂了都长这样
    } as any)

    mountAt('generate', '7')
    await flushPromises()
    await click(buttonThat('在这一屏算一次价'))

    expect(bodyText()).toContain('后端这一发没回读数')
    expect(bodyText()).not.toContain('0 发外呼')
    expect(bodyText()).not.toContain('跑过 0 发')
    // 只读数不设闸：这一格读不到，确认与报价那两句照旧摆着
    expect(bodyText()).toContain('est-noburn')
  })

  /**
   * 拍板 4 那一串的两头：先（M-P33-B）那句「重跑只补失败的那一套」被源码证伪 ⇒ 界面改成说整轮；
   * 后（M-P34）单套补跑真的落了口 ⇒ 这一句再改回来，并摆出<b>两条路各自的价格与后果</b>。
   *
   * <p>所以这一条同时判三件事：旧的「今天还没有」不许留着（那是已经交付了的东西说没有），
   * 「重来就是整轮」也不许留着（那会让人多烧两趟的钱），而两条路的差别必须由
   * 「成功那几套不动 + 价签只数真跑的那几套」这句真话撑着。</p>
   */
  it('重来那一句摆的是两条路：补跑已经有了，整轮仍然要再烧一趟整轮的钱', async () => {
    vi.mocked(siteBriefsApi.list).mockResolvedValue([brief()])
    vi.mocked(vocabularyApi.adminVocabulary).mockResolvedValue({} as any)
    vi.mocked(siteSpecApi.read).mockResolvedValue(specDoc())
    vi.mocked(briefGenerationApi.candidates).mockResolvedValue([
      candidate({ candidateNo: 1 }),
      candidate({ candidateId: 12, candidateNo: 2, siteId: 53, siteName: '候选 B' })
    ])
    // 只有第 1 套回实耗：第 2 套那一行整个没回，也要算进「没回实耗」的套数，不能从合计里悄悄消失
    vi.mocked(briefGenerationApi.progress).mockResolvedValue([
      progressRow({ promptTokens: 900, completionTokens: 4000 })
    ])

    mountAt('generate', '7')
    await flushPromises()

    expect(bodyText()).not.toContain('重跑只补失败的那一套')
    // 补跑落了口，那句「今天还没有」必须一起消失（留着它，超管就照着这句话去烧整轮的钱）
    expect(bodyText()).not.toContain('今天还没有')
    expect(bodyText()).toContain('要重来有')
    expect(bodyText()).toContain('两条路')
    expect(bodyText()).toContain('只补这一轮里失败的那几套')
    expect(bodyText()).toContain('成功的那几套')
    expect(bodyText()).toContain('预览链接原样保留')
    expect(bodyText()).toContain('价签也只数这一趟真会跑的那几套')
    expect(bodyText()).toContain('整轮')
    expect(bodyText()).toContain('会再烧一趟')
    expect(bodyText()).toContain('这一轮实测：900 + 4000 = 4900 token')
    expect(bodyText()).toContain('另有 1 套这一发没回实耗')
    // 套数只认价签那一格：第 4 步没人点过算价，界面不许拿进度行数冒充配置
    expect(bodyText()).toContain('后端这一发没回套数')
  })

  // ---- M-P33 批 C（#340）：等待面那两条腿在向导这一屏的样子 ----

  /**
   * 推送接上时这一屏的三句实话：进度是后端推的、这一套等了多久是后端算的、
   * 那一格历史区间只报区间。推来的新读数要直接换上屏，且**不许**因此多发一眼进度 GET
   * （M-P16 #248：同一趟只许一份真相，两条腿都读的是同一个出口）。
   */
  it('第 3 步接上后端推送：推来的读数当场换上屏，等的时间与历史区间一并摆出来', async () => {
    vi.mocked(siteBriefsApi.list).mockResolvedValue([brief()])
    vi.mocked(vocabularyApi.adminVocabulary).mockResolvedValue({} as any)
    vi.mocked(siteSpecApi.read).mockResolvedValue(specDoc())
    vi.mocked(briefGenerationApi.candidates).mockResolvedValue([candidate()])
    vi.mocked(briefGenerationApi.progress).mockResolvedValue([runningRow()])
    followWithFakeStream()

    const wrapper = mountAt('generate', '7')
    await flushPromises()

    expect(briefGenerationApi.streamProgress).toHaveBeenCalledTimes(1)
    expect(briefGenerationApi.streamProgress).toHaveBeenCalledWith(7)
    const stream = WizardStreamStub.instances[0]
    expect(stream.listening.sort()).toEqual(['complete', 'error', 'progress'])
    expect(bodyText()).toContain('进度是后端推过来的')
    // 那一列的表头真在（桩不渲 column.title，读的是传下去的那一份列定义）：
    // 「约 1 分 35 秒」孤零零摆着没人知道它是什么的计时
    const titles = wrapper.findAllComponents({ name: 'a-table' })
      .flatMap(node => (node.props('columns') as any[]) ?? [])
      .map(column => column?.title)
    expect(titles).toContain('这一步已经等了')
    expect(bodyText()).toContain('约 1 分 35 秒')
    expect(bodyText()).toContain('这一步以往成功回答实测在 1 分 ~ 9 分之间')

    stream.emit('progress', [runningRow({ stageLabel: '演示内容', stageWaitMs: 3_900_000 })])
    await flushPromises()

    expect(bodyText()).toContain('演示内容')
    expect(bodyText()).toContain('约 1 小时 5 分')
    // 腿已经换到推送上了：进度那一条 GET 只进门读过这一眼
    expect(briefGenerationApi.progress).toHaveBeenCalledTimes(1)
  })

  /**
   * 「演示内容」那一格里面的分批读数进了向导这一屏（M-P35-2）。
   *
   * 两条都要钉：① 推送换上一批时这一句<b>跟着换</b>，不许停在上一批那一句（那等于界面在念一件
   * 已经过去了的事）；② 不在那一步（这一形后端四格回 null）时那一行整行不摆——向导上凭空多出一句
   * 「第 ? 批」就是把没在分批写的那一趟演成在写。
   */
  it('推送里的批号跟着换屏：这一格里写到第几类看得见，不在那一步就不摆那一行', async () => {
    vi.mocked(siteBriefsApi.list).mockResolvedValue([brief()])
    vi.mocked(vocabularyApi.adminVocabulary).mockResolvedValue({} as any)
    vi.mocked(siteSpecApi.read).mockResolvedValue(specDoc())
    vi.mocked(briefGenerationApi.candidates).mockResolvedValue([candidate()])
    vi.mocked(briefGenerationApi.progress).mockResolvedValue(
      [runningRow({ stage: 'demo', stageLabel: '演示内容' })])
    followWithFakeStream()

    mountAt('generate', '7')
    await flushPromises()

    // 进门这一眼：阶段是「演示内容」，但后端还没回批号（那一发还没发问）——这一行不摆
    expect(bodyText()).not.toContain('分批在写')

    const stream = WizardStreamStub.instances[0]
    stream.emit('progress', [runningRow({
      stage: 'demo',
      stageLabel: '演示内容',
      showcaseBatchIndex: 4,
      showcaseBatchTotal: 7,
      showcaseBatchLabel: '服务客户',
      showcaseBatchWaitMs: 65_000
    })])
    await flushPromises()
    expect(bodyText()).toContain('这一格里分批在写：第 4/7 批 · 服务客户 · 这一批已经等了 约 1 分 5 秒')

    stream.emit('progress', [runningRow({
      stage: 'demo',
      stageLabel: '演示内容',
      showcaseBatchIndex: 5,
      showcaseBatchTotal: 7,
      showcaseBatchLabel: '经营指标',
      showcaseBatchWaitMs: 12_000
    })])
    await flushPromises()
    expect(bodyText()).toContain('第 5/7 批 · 经营指标 · 这一批已经等了 约 12 秒')
    expect(bodyText()).not.toContain('第 4/7 批')
  })

  /**
   * `complete` 一到：流关掉（不留一条挂着已结束的流），外围读数重读一发（否则人看见的是一条不动的步序条），
   * 绿只给后端的 `succeeded`，等待那一格明说不再念了。
   */
  it('流里的 complete 一到就收流并重读外围读数，终态那一格不再念等了', async () => {
    vi.mocked(siteBriefsApi.list).mockResolvedValue([brief()])
    vi.mocked(vocabularyApi.adminVocabulary).mockResolvedValue({} as any)
    vi.mocked(siteSpecApi.read).mockResolvedValue(specDoc())
    vi.mocked(briefGenerationApi.candidates).mockResolvedValue([candidate()])
    vi.mocked(briefGenerationApi.progress).mockResolvedValue([runningRow()])
    followWithFakeStream()

    const wrapper = mountAt('generate', '7')
    await flushPromises()
    const stream = WizardStreamStub.instances[0]
    const readBefore = vi.mocked(siteSpecApi.read).mock.calls.length
    const candidatesBefore = vi.mocked(briefGenerationApi.candidates).mock.calls.length

    stream.emit('complete', [runningRow({ status: 'succeeded', statusLabel: '已产出', stageLabel: '建完了', stageWaitMs: null, roundElapsedMs: null })])
    await flushPromises()

    expect(stream.closed).toBe(1)
    expect(bodyText()).toContain('这一套已进终态，不再念等了')
    // 后端终态回的是 null：这一格念「没回时长读数」，念 0 秒就是编出来的
    expect(bodyText()).not.toContain('约 0 秒')
    expect(vi.mocked(siteSpecApi.read).mock.calls.length).toBe(readBefore + 1)
    expect(vi.mocked(briefGenerationApi.candidates).mock.calls.length).toBe(candidatesBefore + 1)
    // 绿只认后端那一份终态码（桩不渲 color，颜色只能从组件 props 取）
    expect(wrapper.findAllComponents({ name: 'a-tag' }).map(node => node.props('color'))).toContain('green')
  })

  /**
   * `success` 这种码后端不发（`ProposalStages` 里只有 `succeeded`）。
   * 界面要是认它当终态，真回包来了就永远不绿；反过来这里也钉住：它不算跑完了，流照旧开。
   */
  it('`success` 那种码既判不成绿也不算跑完：界面只认后端的 `succeeded`', async () => {
    vi.mocked(siteBriefsApi.list).mockResolvedValue([brief()])
    vi.mocked(vocabularyApi.adminVocabulary).mockResolvedValue({} as any)
    vi.mocked(siteSpecApi.read).mockResolvedValue(specDoc())
    vi.mocked(briefGenerationApi.candidates).mockResolvedValue([candidate()])
    vi.mocked(briefGenerationApi.progress).mockResolvedValue([runningRow({ status: 'success', statusLabel: '成功' })])
    followWithFakeStream()

    const wrapper = mountAt('generate', '7')
    await flushPromises()

    expect(wrapper.findAllComponents({ name: 'a-tag' }).map(node => node.props('color'))).not.toContain('green')
    expect(briefGenerationApi.streamProgress).toHaveBeenCalledTimes(1)
    expect(bodyText()).toContain('约 1 分 35 秒')
  })

  /** 这一条腿接不上就当众换腿：不许写着「推送」而其实在轮询，也不许闷着不吭声 */
  it('浏览器没有推送时当众换腿：走轮询并把那一行话术换成轮询那句', async () => {
    vi.mocked(siteBriefsApi.list).mockResolvedValue([brief()])
    vi.mocked(vocabularyApi.adminVocabulary).mockResolvedValue({} as any)
    vi.mocked(siteSpecApi.read).mockResolvedValue(specDoc())
    vi.mocked(briefGenerationApi.candidates).mockResolvedValue([candidate()])
    vi.mocked(briefGenerationApi.progress).mockResolvedValue([runningRow()])
    vi.stubGlobal('EventSource', undefined)

    mountAt('generate', '7')
    await flushPromises()

    expect(briefGenerationApi.streamProgress).not.toHaveBeenCalled()
    expect(bodyText()).toContain('每 5 秒自己读一眼')
    expect(bodyText()).not.toContain('进度是后端推过来的')
    expect(bodyText()).toContain('约 1 分 35 秒')
  })

  /** 人不在这一步了，那条流就得关掉：第 5 步读的是留痕，不该还挂着一条听第 3 步那趟的流 */
  it('从第 3 步走到第 5 步：中途换步不收流，落到不等的那一步才收', async () => {
    vi.mocked(siteBriefsApi.list).mockResolvedValue([brief()])
    vi.mocked(vocabularyApi.adminVocabulary).mockResolvedValue({} as any)
    vi.mocked(siteSpecApi.read).mockResolvedValue(specDoc())
    vi.mocked(briefGenerationApi.candidates).mockResolvedValue([candidate()])
    vi.mocked(briefGenerationApi.progress).mockResolvedValue([runningRow()])
    vi.mocked(siteBriefDeliveryApi.decisions).mockResolvedValue([])
    followWithFakeStream()

    mountAt('generate', '7')
    await flushPromises()
    const stream = WizardStreamStub.instances[0]
    expect(stream.closed).toBe(0)

    // 第 3 步 → 第 4 步：还在等同一趟，流照旧开着，也不许为测试另开一条
    await click(buttonThat('下一步'))
    expect(WizardStreamStub.instances).toHaveLength(1)
    expect(stream.closed).toBe(0)

    // 第 4 步 → 第 5 步：这一屏等的是客户的答复，那条流当场收掉
    await click(buttonThat('下一步'))
    expect(stream.closed).toBe(1)
    expect(siteBriefDeliveryApi.decisions).toHaveBeenCalled()
  })

  /** 人直接走了（关页、切路由）也一样收：留着就是一边占后端那条 SSE 工作线程，一边对着没了的页面空转 */
  it('离开这一页要收流', async () => {
    vi.mocked(siteBriefsApi.list).mockResolvedValue([brief()])
    vi.mocked(vocabularyApi.adminVocabulary).mockResolvedValue({} as any)
    vi.mocked(siteSpecApi.read).mockResolvedValue(specDoc())
    vi.mocked(briefGenerationApi.candidates).mockResolvedValue([candidate()])
    vi.mocked(briefGenerationApi.progress).mockResolvedValue([runningRow()])
    followWithFakeStream()

    const wrapper = mountAt('generate', '7')
    await flushPromises()
    const stream = WizardStreamStub.instances[0]

    wrapper.unmount()
    expect(stream.closed).toBe(1)
  })
})

