import { describe, it, expect, beforeEach, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { Button } from 'ant-design-vue'
import SiteWizardView from '../SiteWizardView.vue'
import { siteBriefsApi, briefGenerationApi, vocabularyApi, type SiteBrief } from '../../../api/siteBriefs'
import { siteSpecApi, type SpecDocumentView } from '../../../api/siteSpec'
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
    siteBriefsApi: { list: vi.fn(), get: vi.fn(), create: vi.fn(), update: vi.fn() },
    vocabularyApi: { adminVocabulary: vi.fn() },
    briefGenerationApi: { candidates: vi.fn() }
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

const PASS_THROUGH = (name: string) => ({
  name,
  props: ['title', 'label', 'message', 'type', 'dataSource', 'columns', 'pagination', 'options', 'value', 'disabled', 'steps', 'modelValue', 'placeholder', 'rows', 'checked'],
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
          template: '<div class="table-stub"><span v-for="row in dataSource" :key="row.candidateId" class="row">{{ row.siteName }}|{{ row.previewIssued ? \'issued\' : \'none\' }}</span></div>'
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
        'a-cascader': PASS_THROUGH('a-cascader')
      }
    }
  })
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
    expect(buttonThat('去写这一份说明书')?.disabled).toBe(true)
    // 没有单号时那一步只说「要先有需求单」，不许把说明书的空态承诺念出来
    expect(bodyText()).toContain('要先有需求单')
    expect(bodyText()).not.toContain('这一单还没有说明书')

    mountAt('generate')
    await flushPromises()
    expect(buttonThat('去需求单详情估价')?.disabled).toBe(true)

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
    expect(bodyText()).toContain('还有 1 段空着')
  })

  it('七段都填了字时不许念成「还有 0 段空着」，也不许提前说已确认', async () => {
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
    expect(bodyText()).not.toContain('还有 0 段空着')
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
    expect([...document.body.querySelectorAll('.row')].map(node => node.textContent)).toEqual(['候选 A|none', '候选 A|issued'])
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
    await click(buttonThat('去写这一份说明书'))
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

    // 题真的挂在这一格：段进度行说「第 1 / 2 段」，本段只渲属于本段的那一题
    expect(document.body.querySelector('.brief-intake__question')).toBeTruthy()
    expect(bodyText()).toContain('第 1 / 2 段')
    expect(bodyText()).not.toContain('页面清单')

    const brand = wrapper.findAllComponents({ name: 'a-input' })
      .find(node => node.props('placeholder') === '页脚用这一串字')
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
    expect(bodyText()).toContain('第 1 / 2 段')

    const brand = wrapper.findAllComponents({ name: 'a-input' })
      .find(node => node.props('placeholder') === '页脚用这一串字')
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
})
