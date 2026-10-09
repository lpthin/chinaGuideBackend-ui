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
 * 7. 步号与单号写在地址里：带着 ?step=candidates&briefId=7 进来就在那一步，切步会 replace 回去。
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
    siteBriefsApi: { list: vi.fn() },
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
  props: ['title', 'label', 'message', 'type', 'dataSource', 'columns', 'pagination', 'options', 'value', 'disabled', 'steps', 'modelValue'],
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
        'a-button': Button
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
  return [...document.body.querySelectorAll('button')].find(node => (node.textContent || '').includes(text)) as
    | HTMLButtonElement
    | undefined
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
    expect(vocabularyApi.adminVocabulary).toHaveBeenCalledTimes(1)
    expect(siteSpecApi.read).toHaveBeenCalledWith(7)
    expect(briefGenerationApi.candidates).toHaveBeenCalledWith(7)
    const http = (await import('../../../api/http')).default as Record<string, any>
    expect(http.post).not.toHaveBeenCalled()
    expect(http.put).not.toHaveBeenCalled()
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
})
