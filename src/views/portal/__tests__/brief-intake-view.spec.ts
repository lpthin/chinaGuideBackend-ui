import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import {
  Button,
  Checkbox,
  CheckboxGroup,
  Input,
  InputNumber,
  message,
  Radio,
  RadioGroup,
  Select,
  Switch,
  Tag,
  Textarea
} from 'ant-design-vue'
import BriefIntakeView from '../BriefIntakeView.vue'
import { siteBriefsApi, vocabularyApi } from '../../../api/siteBriefs'
import { siteApi, tenantApi } from '../../../api/workspace'
import { portalPagesApi } from '../../../api/portalPages'
import { portalSectionsApi } from '../../../api/portalSections'

/**
 * 前采录入页的交互契约（Spec-C §4.1 的老三条 + Spec-D D1 的新五条）。
 *
 * 老三条没挪窝：右侧那段话只能来自 summary-preview；候选套数封顶在词表 candidateMaxCount；
 * 后端拒单的中文一个字不许改。D1 新钉的是这一半：
 * 1. **四组分区与锚点**：段名与「哪题属哪段」只能来自词表 `groups`/`q.group`，页面一个字不抄；
 * 2. **必填只剩词表打星的题**（q.required），星号不是界面自造的名单；
 * 3. **没填的格子显式说「客户未提供」**，不许留一个看着像填好的空框；
 * 4. **page_plan 行编辑器挂真实控件**：加页/上下移/删除/栏目卡片/区块下拉都能点，
 *    本地提示只是提示，后端拒单的中文原样长在页面上；
 * 5. **区块与栏目的名字来自 /portal/blocks 与 /portal/sections**：未接线（notWired）的不进候选。
 *
 * setup.ts 把所有 a-* 桩成空壳且桩件不 emit，用它测出来的「点了没反应」是假的，
 * 所以这里挂真实控件；只有级联与取色器换成会 emit 的壳（真组件要弹层，测的是弹层本身）。
 */

const { pushSpy, replaceSpy, routeParams, routeQuery } = vi.hoisted(() => ({
  pushSpy: vi.fn(),
  replaceSpy: vi.fn(),
  routeParams: { current: {} as Record<string, string> },
  routeQuery: { current: {} as Record<string, string> }
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: pushSpy, replace: replaceSpy }),
  useRoute: () => ({ params: routeParams.current, query: routeQuery.current })
}))

vi.mock('ant-design-vue', async () => {
  const actual = await vi.importActual<Record<string, any>>('ant-design-vue')
  return {
    ...actual,
    message: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() }
  }
})

// siteBriefs 的纯映射函数会 `import http from './http'`（真实 http 又拉起 router）：
// 这里把 http 打桩，好让 importOriginal 能加载 siteBriefs 而不牵进路由依赖链。
vi.mock('../../../api/http', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn() }
}))

vi.mock('../../../api/siteBriefs', async (importOriginal) => {
  // 视图会用 siteBriefs 里的纯映射函数（intakeLoopQuestions / buildBriefForm / readBriefSelections /
  // pagePlanLocalHints 等）：这几份是真实适配逻辑，必须走真实现（顺带让 payload 断言真的经过映射）；
  // 只有网络口的 siteBriefsApi / vocabularyApi 换成 vi.fn。
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
    vocabularyApi: { adminVocabulary: vi.fn(), portalVocabulary: vi.fn() }
  }
})

vi.mock('../../../api/workspace', () => ({
  tenantApi: { list: vi.fn() },
  siteApi: { list: vi.fn() }
}))

vi.mock('../../../api/portalPages', () => ({
  portalPagesApi: { blocks: vi.fn() }
}))

vi.mock('../../../api/portalSections', () => ({
  portalSectionsApi: { list: vi.fn() }
}))

/** 题目名与选项 label 故意用「题目甲/选项乙」这种只在本文件出现的字：页面渲染它们只能来自词表回包 */
const VOCAB = {
  questions: [
    {
      key: 'q_single', label: '题目单选', select: 'single', required: true,
      options: [{ code: 'opt-a', label: '选项甲' }, { code: 'opt-b', label: '选项乙' }]
    },
    {
      key: 'q_multi', label: '题目多选', select: 'multi', required: false,
      options: [{ code: 'opt-c', label: '选项丙' }, { code: 'opt-d', label: '选项丁' }]
    },
    // 级联这题在 D1 里不再必填：必填只剩词表打星的题，用例里星号来自 required 而不是题目身份
    {
      key: 'q_cascade', label: '题目级联', select: 'cascade', required: false,
      options: [{ code: 'cat-1', label: '大类一', children: [{ code: 'cat-1-a', label: '子类一' }] }]
    },
    { key: 'q_color', label: '题目颜色', select: 'color', required: false, options: [] },
    { key: 'q_text', label: '题目文本', evidence: '这题自己打字', select: 'text', required: false, options: [] },
    // 词表出现不认识的新形态：界面必须退化成输入框，而不是猜语义
    { key: 'q_odd', label: '题目新形态', evidence: '不认识就退回输入框', select: 'slider', required: false, options: [] }
  ],
  candidateMaxCount: 3,
  demoContentModes: [
    { value: 'full', label: '整套演示', articleCount: 8, caseCount: 4 },
    { value: 'lite', label: '少量演示', articleCount: 3, caseCount: 1 },
    { value: 'none', label: '不带演示', articleCount: 0, caseCount: 0 }
  ]
}

/**
 * D1 的词表形状：每题带 group、顶层带 groups（后端 SiteBriefVocabulary 的真实下发形状）。
 * 题目 key 用后端真名（brand_name / page_plan / …）是为了让 payload 断言真的经过 camelCase 映射；
 * 段名故意写成「X段：…」，锚点上露的是冒号前的短名——全称长在段标题那一行。
 */
const VOCAB_D1 = {
  questions: [
    { key: 'brand_name', group: 'basic', label: '品牌全称', select: 'text', required: true, evidence: '页脚用这一串字', options: [] },
    {
      key: 'primary_goal', group: 'basic', label: '访客动作', select: 'single', required: true,
      options: [{ code: 'inquiry', label: '留联系方式' }, { code: 'phone', label: '打电话' }]
    },
    { key: 'audience_note', group: 'basic', label: '目标用户原话', select: 'textarea', required: false, options: [] },
    {
      key: 'trust_anchors', group: 'basic', label: '信任锚点', select: 'multi', required: false,
      options: [{ code: 'numbers', label: '数字' }, { code: 'full_cases', label: '完整案例' }]
    },
    { key: 'page_plan', group: 'structure', label: '页面清单', select: 'pages', required: false, evidence: '逐页点名', options: [] },
    { key: 'home_layout', group: 'structure', label: '首页区块顺序', select: 'block-order', required: false, options: [] },
    { key: 'color_secondary', group: 'structure', label: '辅助色', select: 'color', required: false, options: [{ code: 'ai', label: '交给 AI 定' }] },
    {
      key: 'font_hint', group: 'structure', label: '字体调性', select: 'single', required: false,
      options: [{ code: 'modern', label: '现代' }, { code: 'ai', label: '交给 AI 定' }]
    }
  ],
  groups: { basic: '基础段：这是谁、给谁看', structure: '结构段：要哪几页、首页怎么排' },
  candidateMaxCount: 3,
  demoContentModes: VOCAB.demoContentModes
}

/** /portal/blocks 的桩回包：logo-wall 带后端现算的 notWired 标志（判据不抄第二份） */
const BLOCKS = [
  { blockKey: 'hero', name: '主视觉', notWired: false },
  { blockKey: 'case-grid', name: '案例网格', notWired: false },
  { blockKey: 'logo-wall', name: '标志墙', notWired: true }
]

/** /portal/sections 的桩回包：栏目名与对外地址都来自接口 */
const SECTIONS = [
  { key: 'cases', displayName: '案例库', publicPath: '/cases' },
  { key: 'about', displayName: '关于我们', publicPath: '/about' }
]

const CASCADER_STUB = {
  name: 'ACascader',
  props: ['value', 'options'],
  emits: ['update:value'],
  template: '<div class="cascader-stub" />'
}

const PASS_THROUGH = (name: string) => ({
  name,
  props: ['title', 'message', 'type', 'description'],
  template: `<div class="${name}-stub"><slot /><slot name="message" /></div>`
})

function savedBrief(overrides: Record<string, unknown> = {}) {
  return {
    id: 55,
    tenantId: 15,
    siteId: null,
    status: 'draft',
    statusLabel: '草稿',
    candidateCount: 3,
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
    requirementsSummary: '落库的那段话',
    createdBy: 'admin',
    createdAt: '2026-09-28T10:00:00',
    updatedAt: '2026-09-28T10:00:00',
    brandName: null,
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
  }
}

interface Options {
  vocab?: any
  vocabError?: string
  brief?: any
  blocks?: any
  sections?: any
}

async function mountView(options: Options = {}) {
  vi.mocked(tenantApi.list).mockResolvedValue([{ id: 15, code: 't-a', name: '甲租户' }] as any)
  vi.mocked(siteApi.list).mockResolvedValue([{ id: 3, name: '甲站', tenantId: 15 }] as any)
  vi.mocked(portalPagesApi.blocks).mockResolvedValue(options.blocks ?? BLOCKS)
  vi.mocked(portalSectionsApi.list).mockResolvedValue(options.sections ?? SECTIONS)
  if (options.vocabError) {
    vi.mocked(vocabularyApi.adminVocabulary).mockRejectedValueOnce(new Error(options.vocabError))
  } else {
    vi.mocked(vocabularyApi.adminVocabulary).mockResolvedValue(options.vocab ?? VOCAB)
  }
  if (options.brief) vi.mocked(siteBriefsApi.get).mockResolvedValue(options.brief)
  vi.mocked(siteBriefsApi.summaryPreview).mockResolvedValue({ requirementsSummary: '后端渲染的话' } as any)
  vi.mocked(siteBriefsApi.create).mockImplementation(async (payload: any) => savedBrief({
    tenantId: payload.tenantId,
    candidateCount: payload.candidateCount,
    demoContentMode: payload.demoContentMode
  }) as any)
  const wrapper = mount(BriefIntakeView, {
    attachTo: document.body,
    global: {
      stubs: {
        'a-button': Button,
        'a-select': Select,
        'a-input': Input,
        'a-textarea': Textarea,
        'a-input-number': InputNumber,
        'a-radio-group': RadioGroup,
        'a-radio': Radio,
        'a-checkbox-group': CheckboxGroup,
        'a-checkbox': Checkbox,
        'a-switch': Switch,
        'a-tag': Tag,
        'a-space': PASS_THROUGH('ASpace'),
        'a-alert': PASS_THROUGH('AAlert'),
        'a-cascader': CASCADER_STUB
      }
    }
  })
  await flushPromises()
  return wrapper
}

/** 按钮文本比对前先抹掉空白：正好两个汉字的按钮会被 ant-design-vue 中间塞一个空格（「保 存」） */
function byText(text: string) {
  return [...document.querySelectorAll('button')].filter(
    node => (node.textContent || '').replace(/\s+/g, '') === text
  )
}

function click(node: Element) {
  node.dispatchEvent(new MouseEvent('click', { bubbles: true }))
}

/**
 * 分步后一次只渲当前那一段：要摸哪一段的控件，先点锚点条上的段按钮把表单翻过去。
 * 段名按冒号前的短名比——那正是界面上摆出来的那几个字，测试不抄词表里的全称。
 */
async function gotoSection(wrapper: any, shortName: string) {
  const target = wrapper.findAll('.brief-intake__anchors button')
    .find((node: any) => node.text().replace(/\s+/g, '').includes(shortName))
  expect(target, `锚点条里没有「${shortName}」这一段`).toBeTruthy()
  click(target!.element)
  await flushPromises()
}

/** 在指定容器内按文本找按钮：页面里「添加区块/上移」会出现多次，必须限定在哪一页/哪一栏 */
function buttonIn(scope: Element | undefined, text: string): HTMLElement | undefined {
  if (!scope) return undefined
  return [...scope.querySelectorAll('button')].find(
    node => (node.textContent || '').replace(/\s+/g, '') === text
  ) as HTMLElement | undefined
}

/** debounce 是视图里的真实 setTimeout：这里只接管 setTimeout/clearTimeout，
 * flushPromises 用的 setImmediate 保持原样。假定时器同时解决另一个坑——
 * 上一条用例没等完的 300ms 窗口会漏进下一条用例的 mock 调用计数里。 */
async function afterDebounce() {
  await vi.advanceTimersByTimeAsync(360)
}

/** 按题干定位输入格：证据句只在题目下面念一遍、不抄进 placeholder（Spec-M §10.8 末段那一处），
 *  所以测试的把手是「这一题的标签」而不是 placeholder —— 标签才是给人看的那一格。 */
function inputOfQuestion(wrapper: any, labelFragment: string, nodes?: any[]) {
  return (nodes ?? wrapper.findAllComponents(Input)).find((node: any) => String(
    node.element?.closest?.('.brief-intake__question')
      ?.querySelector('.brief-intake__q-label')?.textContent ?? ''
  ).includes(labelFragment))
}

/** 把 D1 词表里两题必填答掉：星号来自词表 q.required，界面保存闸只拦这两题 */
async function fillRequiredD1(wrapper: any) {
  const brand = inputOfQuestion(wrapper, '品牌全称')
  brand!.vm.$emit('update:value', '某某科技')
  wrapper.findAllComponents(RadioGroup)[0].vm.$emit('update:value', 'inquiry')
  await flushPromises()
}

async function clickSave(wrapper: any) {
  const save = byText('保存')[0]
  expect(save, '页面底部应有「保存」').toBeTruthy()
  click(save)
  await vi.advanceTimersByTimeAsync(0)
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  document.body.innerHTML = ''
  routeParams.current = {}
  routeQuery.current = {}
  vi.clearAllMocks()
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('题目按词表循环渲染', () => {
  it('词表回几道题就挂几块，题名与选项全是接口回来的字，页面自己一个字不加', async () => {
    const wrapper = await mountView()
    // 「固定说明」两块（参考站/补充说明）不算题目
    expect(wrapper.findAll('.brief-intake__question:not(.brief-intake__static)')).toHaveLength(6)
    const text = wrapper.text()
    expect(text).toContain('题目单选')
    expect(text).toContain('选项甲')
    expect(text).toContain('题目新形态')
    // 形态路由：single→radio 组、multi→checkbox 组、cascade/color→各自控件、text 与未知形态→输入框
    expect(wrapper.findAllComponents(RadioGroup)).toHaveLength(1)
    expect(wrapper.findAllComponents(CheckboxGroup)).toHaveLength(1)
    expect(wrapper.findAll('.cascader-stub')).toHaveLength(1)
    // color 走的是原生色块 + 十六进制格（这一版组件库没有 ColorPicker，桩件会把「控件根本没渲」藏住，所以这里摸真实节点）
    expect(wrapper.findAll('input[type=color]')).toHaveLength(1)
    const placeholders = wrapper.findAllComponents(Input).map(node => String(node.props('placeholder') ?? ''))
    expect(placeholders).toContain('#RRGGBB')
    // text 与未知形态两题退到同一个中性 placeholder：词表那句证据不抄进输入格，一句话不摆两遍
    expect(placeholders.filter(p => p === '按客户原话打这一行')).toHaveLength(2)
    expect(placeholders).not.toContain('这题自己打字')
    expect(placeholders).not.toContain('不认识就退回输入框')
    expect(wrapper.text().split('这题自己打字').length - 1).toBe(1)
    expect(wrapper.text().split('不认识就退回输入框').length - 1).toBe(1)
    wrapper.unmount()
  })

  it('词表取不到：明说没取到、题目区不留假象，给「重新取词表」重试；此时保存不发任何请求', async () => {
    const wrapper = await mountView({ vocabError: '词表接口 500' })
    expect(wrapper.text()).toContain('前采词表没取到')
    expect(wrapper.findAll('.brief-intake__question')).toHaveLength(2) // 只剩两块固定说明
    expect(vi.mocked(message.error).mock.calls.flat().join()).toContain('词表接口 500')

    clickSave(wrapper)
    expect(siteBriefsApi.create).not.toHaveBeenCalled()
    expect(vi.mocked(message.warning).mock.calls.flat().join()).toContain('词表还没取到')

    vi.mocked(vocabularyApi.adminVocabulary).mockResolvedValueOnce(VOCAB as any)
    click(byText('重新取词表')[0])
    await flushPromises()
    expect(vocabularyApi.adminVocabulary).toHaveBeenCalledTimes(2)
    expect(wrapper.findAll('.brief-intake__question:not(.brief-intake__static)')).toHaveLength(6)
    wrapper.unmount()
  })
})

describe('四组分区与锚点导航（段名只认词表 groups 那一份）', () => {
  it('词表带 groups：一次只渲当前那一段，锚点条露冒号前的短名，点了把表单翻到那一段', async () => {
    const wrapper = await mountView({ vocab: VOCAB_D1 })
    // 停在第一段：段标题只有基础段那一条，段名与题目都只可能是 groups 回包里的字
    const heads = wrapper.findAll('.brief-intake__section-head')
    expect(heads).toHaveLength(1)
    expect(heads[0].text()).toBe('基础段：这是谁、给谁看')
    expect(document.getElementById('brief-intake-section-basic')).toBeTruthy()
    expect(document.getElementById('brief-intake-section-structure')).toBeNull()
    const anchors = wrapper.findAll('.brief-intake__anchors button')
    expect(anchors.map(node => node.text().replace(/\s+/g, ''))).toEqual(['1.基础段', '2.结构段'])

    click(anchors[1].element)
    await flushPromises()
    // 翻过去之后：结构段的题渲出来，基础段那一节整段撤下（分步不是「滚动到位」，是一屏一段）
    const headsAfter = wrapper.findAll('.brief-intake__section-head')
    expect(headsAfter).toHaveLength(1)
    expect(headsAfter[0].text()).toBe('结构段：要哪几页、首页怎么排')
    expect(document.getElementById('brief-intake-section-structure')).toBeTruthy()
    expect(document.getElementById('brief-intake-section-basic')).toBeNull()
    wrapper.unmount()
  })

  it('词表没下发 groups（老回包/缺段名）：不硬造分段，题目照旧循环渲染', async () => {
    const wrapper = await mountView()
    expect(wrapper.find('.brief-intake__anchors').exists()).toBe(false)
    expect(wrapper.findAll('.brief-intake__section-head')).toHaveLength(0)
    expect(wrapper.findAll('.brief-intake__question:not(.brief-intake__static)')).toHaveLength(6)
    wrapper.unmount()
  })
})

describe('必填只剩词表打星的题 + 跳过要说人话', () => {
  it('星号来自 q.required：打星的空题显式说会被后端拒，可跳过的空题显式写「客户未提供」', async () => {
    const wrapper = await mountView({ vocab: VOCAB_D1 })
    const basic = VOCAB_D1.questions.filter(question => question.group === 'basic')
    const structure = VOCAB_D1.questions.filter(question => question.group === 'structure')
    expect(wrapper.findAll('.brief-intake__req')).toHaveLength(2) // brand_name + primary_goal，恰是词表打星的两题
    expect(wrapper.findAll('.brief-intake__opt')).toHaveLength(basic.length - 2)
    const skips = wrapper.findAll('.brief-intake__skip')
    // 本段每道还没答的题都挂一句：不留「看着像填好」的空框（必填那两句红色写法也算 skip 节点）
    expect(skips).toHaveLength(basic.length)
    expect(skips.filter(node => node.classes('brief-intake__skip--required'))).toHaveLength(2)
    expect(wrapper.text()).toContain('客户未提供')

    // 答完可跳过的多选：它那句「客户未提供」当场消失——提示跟着真实勾选走，不是死文案
    const trustGroup = wrapper.findAllComponents(CheckboxGroup)[0]
    trustGroup.vm.$emit('update:value', ['numbers'])
    await flushPromises()
    expect(wrapper.findAll('.brief-intake__skip')).toHaveLength(basic.length - 1)

    // 翻到结构段：一段的星与空格子只算这一段自己的题，页面上没有一处按总题数硬写
    await gotoSection(wrapper, '结构段')
    expect(wrapper.findAll('.brief-intake__req')).toHaveLength(0)
    expect(wrapper.findAll('.brief-intake__opt')).toHaveLength(structure.length)
    expect(wrapper.findAll('.brief-intake__skip')).toHaveLength(structure.length)
    wrapper.unmount()
  })

  it('必填还空着：保存被本地拦下并点名缺哪几题（星来自词表），create 一次都不发', async () => {
    const wrapper = await mountView({ vocab: VOCAB_D1 })
    wrapper.findAllComponents(Select)[0].vm.$emit('update:value', 15)
    await clickSave(wrapper)
    expect(siteBriefsApi.create).not.toHaveBeenCalled()
    const warning = vi.mocked(message.warning).mock.calls.flat().join()
    expect(warning).toContain('还有打星的必填题没填')
    expect(warning).toContain('品牌全称')
    expect(warning).toContain('访客动作')
    wrapper.unmount()
  })
})

describe('page_plan 行编辑器（提示只是提示，闸在服务端）', () => {
  it('加页/填字段/上下移/删除都挂真实控件；缺 home 与 contact 的即时提示逐条列出来', async () => {
    const wrapper = await mountView({ vocab: VOCAB_D1 })
    // 页面清单长在结构段：先翻过去（分步后本段的控件才挂得出来）
    await gotoSection(wrapper, '结构段')
    expect(wrapper.findAll('.brief-intake__page-row')).toHaveLength(0)

    click(byText('添加一页')[0])
    await flushPromises()
    expect(wrapper.findAll('.brief-intake__page-row')).toHaveLength(1)

    const title = wrapper.findAllComponents(Input).find(node => String(node.props('placeholder') ?? '').startsWith('页面标题'))
    title!.vm.$emit('update:value', '关于我们')
    const keyInput = wrapper.findAllComponents(Input).find(node => String(node.props('placeholder') ?? '').startsWith('标识 key'))
    keyInput!.vm.$emit('update:value', 'about')
    const slugInput = wrapper.findAllComponents(Input).find(node => String(node.props('placeholder') ?? '').startsWith('网址段 slug'))
    slugInput!.vm.$emit('update:value', 'About') // 故意大写：镜像判据要当场圈出来
    await flushPromises()

    const hints = wrapper.find('.brief-intake__page-hints').text()
    expect(hints).toContain('没有首页（key 为 home')
    expect(hints).toContain('没有联系页（key 为 contact')
    expect(hints).toContain('slug')

    // 预设两页补齐硬缺的两页，home/contact 那两行提示就消失（是提示跟着状态变，不是摆设）
    click(byText('加一页：首页（home）')[0])
    click(byText('加一页：联系页（contact）')[0])
    await flushPromises()
    const hintsAfter = wrapper.find('.brief-intake__page-hints').text()
    expect(hintsAfter).not.toContain('没有首页')
    expect(hintsAfter).not.toContain('没有联系页')

    // 上下移：第一页「上移」disabled，点「下移」真的换序
    const rows = wrapper.findAll('.brief-intake__page-row')
    expect(buttonIn(rows[0].element, '上移')!.hasAttribute('disabled')).toBe(true)
    click(buttonIn(rows[0].element, '下移')!)
    await flushPromises()
    const firstKey = wrapper.findAllComponents(Input).find(node => String(node.props('placeholder') ?? '').startsWith('标识 key'))
    // 第一行换成了 home（about 被挤到第二行）：行序是真的，不是只长个按钮
    const keys = wrapper.findAll('.brief-intake__page-key').map(node => (node.element as HTMLInputElement).value)
    expect(keys[0]).toBe('home')
    expect(keys).toHaveLength(3)
    void firstKey

    // 删除第二行（about 被下移后在第三行？不——先删掉现在第 2 行验证行数与顺序）
    const rows2 = wrapper.findAll('.brief-intake__page-row')
    click(buttonIn(rows2[1].element, '删除')!)
    await flushPromises()
    const keys2 = wrapper.findAll('.brief-intake__page-key').map(node => (node.element as HTMLInputElement).value)
    expect(keys2).toEqual(['home', 'contact'])
    wrapper.unmount()
  })

  it('栏目卡片来自 /portal/sections：点卡片即选，名字一个都不抄；区块候选挡掉 notWired 的与已加的', async () => {
    const wrapper = await mountView({ vocab: VOCAB_D1 })
    await gotoSection(wrapper, '结构段')
    click(byText('加一页：首页（home）')[0])
    await flushPromises()
    const row = wrapper.findAll('.brief-intake__page-row')[0]

    const cards = row.findAll('.brief-intake__section-card')
    // 「不属于任何栏目」首卡 + 接口回来的两栏：卡片名只可能来自 /portal/sections 回包
    expect(cards.map(node => node.text())).toEqual([
      expect.stringContaining('不属于任何栏目'),
      expect.stringContaining('案例库'),
      expect.stringContaining('关于我们')
    ])
    click(cards[1].element)
    await flushPromises()
    expect(cards[1].classes()).toContain('is-active')

    // 每页区块：候选来自 /portal/blocks，notWired 的标志墙不进候选
    const blockSelect = wrapper.findAllComponents(Select)
      .find(node => node.props('placeholder') === '从区块目录挑一个')!
    const optionLabels = (blockSelect.props('options') as { label: string }[]).map(option => option.label)
    expect(optionLabels.join()).toContain('主视觉')
    expect(optionLabels.join()).not.toContain('标志墙')
    blockSelect.vm.$emit('update:value', 'hero')
    await flushPromises()
    click(buttonIn(row.element, '添加区块')!)
    await flushPromises()
    const rows = wrapper.findAll('.brief-intake__page-row')
    expect(rows[0].text()).toContain('主视觉（hero）')
    // 加过的 hero 从候选里消失（同页重名后端中文拒，候选先排掉）
    const leftLabels = (wrapper.findAllComponents(Select)
      .find(node => node.props('placeholder') === '从区块目录挑一个')!.props('options') as { label: string }[])
      .map(option => option.label)
    expect(leftLabels.join()).not.toContain('主视觉')
    wrapper.unmount()
  })

  it('保存 payload：全空的行被丢掉、半空的照发（后端逐页点名的那一页不许悄悄消失）、字段拍平成 camelCase', async () => {
    const wrapper = await mountView({ vocab: VOCAB_D1 })
    await fillRequiredD1(wrapper)
    wrapper.findAllComponents(Select)[0].vm.$emit('update:value', 15)
    const audience = wrapper.findAllComponents(Textarea)[0] // D1 形态里第一块 textarea 就是 audience_note
    audience.vm.$emit('update:value', '给工厂做配套的采购助理')
    await gotoSection(wrapper, '结构段')
    click(byText('加一页：首页（home）')[0])
    click(byText('添加一页')[0]) // 故意留一行全空
    await flushPromises()
    const title = wrapper.findAllComponents(Input).filter(node => String(node.props('placeholder') ?? '').startsWith('页面标题'))
    title[0].vm.$emit('update:value', '首页')
    await clickSave(wrapper)
    expect(siteBriefsApi.create).toHaveBeenCalledTimes(1)
    const payload = vi.mocked(siteBriefsApi.create).mock.calls[0][0] as any
    expect(payload.brandName).toBe('某某科技')
    expect(payload.primaryGoal).toBe('inquiry')
    expect(payload.audienceNote).toBe('给工厂做配套的采购助理')
    // 全空行在提交前丢掉：发出去的清单与屏幕上填的条数一致（谎报就是这么发生的）
    expect(payload.pagePlan).toHaveLength(1)
    expect(payload.pagePlan[0].key).toBe('home')
    expect(payload.homeLayout).toEqual([])
    wrapper.unmount()
  })

  it('后端逐页点名的中文原因：一个字不改、一条不吞，原样长在保存错误那一格里', async () => {
    routeParams.current = { id: '12' }
    const wrapper = await mountView({
      vocab: VOCAB_D1,
      brief: savedBrief({ id: 12, status: 'draft', brandName: '某某科技', primaryGoal: 'inquiry' })
    })
    await fillRequiredD1(wrapper)
    const backendReason = '第 2 页（pricing）的页面标题「价目表超长超长」没填——界面上那一个字不能靠猜\n第 3 页的网址段 slug「Pricing」不合法：只能是小写字母、数字与连字符'
    vi.mocked(siteBriefsApi.update).mockRejectedValue(new Error(backendReason))
    await clickSave(wrapper)
    expect(wrapper.find('.brief-intake__save-error').text()).toBe(backendReason)
    wrapper.unmount()
  })
})

describe('home_layout 区块顺序编辑器（上下移动代替拖拽）', () => {
  it('从区块目录挑→加进来→上下移→删除；上限那句明说是后端判据不是本地闸', async () => {
    const wrapper = await mountView({ vocab: VOCAB_D1 })
    await gotoSection(wrapper, '结构段')
    const layout = wrapper.find('.brief-intake__layout')
    const picker = wrapper.findAllComponents(Select)
      .find(node => node.props('placeholder') === '从区块目录挑一个')!

    picker.vm.$emit('update:value', 'case-grid')
    await flushPromises()
    click(buttonIn(layout.element, '添加区块')!)
    await flushPromises()
    picker.vm.$emit('update:value', 'hero')
    await flushPromises()
    click(buttonIn(layout.element, '添加区块')!)
    await flushPromises()

    const rows = layout.findAll('.brief-intake__block-row')
    // 只比名字 span：行里还长着「上移/下移/删除」那三颗真按钮（ant 会把两字按钮塞空格，别拿整行文本比）
    expect(rows.map(row => row.find('span').text())).toEqual(['案例网格（case-grid）', '主视觉（hero）'])
    // 第一行没有「上移」可点（disabled），点「下移」真的换序
    expect(buttonIn(rows[0].element, '上移')!.hasAttribute('disabled')).toBe(true)
    click(buttonIn(rows[0].element, '下移')!)
    await flushPromises()
    const after = wrapper.find('.brief-intake__layout').findAll('.brief-intake__block-row')
    expect(after.map(row => row.find('span').text())).toEqual(['主视觉（hero）', '案例网格（case-grid）'])
    expect(wrapper.find('.brief-intake__layout').text()).toContain('已排 2 个')
    click(buttonIn(after[1].element, '删除')!)
    await flushPromises()
    expect(wrapper.find('.brief-intake__layout').findAll('.brief-intake__block-row')).toHaveLength(1)
    // 目录里剩下的候选：hero 已加过不再出现，notWired 的标志墙从头到尾不进候选
    const left = (picker.props('options') as { label: string }[]).map(option => option.label).join()
    expect(left).not.toContain('主视觉')
    expect(left).not.toContain('标志墙')
    wrapper.unmount()
  })
})

describe('右侧那段话只来自 summary-preview', () => {
  it('进页面不发 preview；勾选后 300ms 内不发、过了窗口才发一次', async () => {
    const wrapper = await mountView()
    expect(siteBriefsApi.summaryPreview).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('还没有这段话')

    wrapper.findAllComponents(RadioGroup)[0].vm.$emit('update:value', 'opt-a')
    expect(siteBriefsApi.summaryPreview).not.toHaveBeenCalled() // debounce 还没到
    await afterDebounce()
    expect(siteBriefsApi.summaryPreview).toHaveBeenCalledTimes(1)
    const payload = vi.mocked(siteBriefsApi.summaryPreview).mock.calls[0][0]
    // 后端 SiteBriefForm 平铺字段：题目 key q_single 拍平成 camelCase 的 qSingle
    expect((payload as any).qSingle).toBe('opt-a')
    expect(wrapper.find('.brief-intake__summary-text').text()).toBe('后端渲染的话')
    expect(wrapper.text()).not.toContain('这段话还没刷新')
    wrapper.unmount()
  })

  it('窗口内连改两题只发一次请求，带的是最后那一份勾选', async () => {
    const wrapper = await mountView()
    wrapper.findAllComponents(RadioGroup)[0].vm.$emit('update:value', 'opt-a')
    await vi.advanceTimersByTimeAsync(120)
    wrapper.findAllComponents(CheckboxGroup)[0].vm.$emit('update:value', ['opt-c', 'opt-d'])
    await afterDebounce()
    expect(siteBriefsApi.summaryPreview).toHaveBeenCalledTimes(1)
    const payload = vi.mocked(siteBriefsApi.summaryPreview).mock.calls[0][0]
    expect((payload as any).qSingle).toBe('opt-a')
    expect((payload as any).qMulti).toEqual(['opt-c', 'opt-d'])
    wrapper.unmount()
  })

  it('preview 失败不清屏：保留上一版，原话标「这段话还没刷新」', async () => {
    const wrapper = await mountView()
    wrapper.findAllComponents(RadioGroup)[0].vm.$emit('update:value', 'opt-a')
    await afterDebounce()
    expect(wrapper.find('.brief-intake__summary-text').text()).toBe('后端渲染的话')

    vi.mocked(siteBriefsApi.summaryPreview).mockRejectedValueOnce(new Error('summary-preview 挂了'))
    wrapper.findAllComponents(RadioGroup)[0].vm.$emit('update:value', 'opt-b')
    await afterDebounce()
    expect(wrapper.find('.brief-intake__summary-text').text()).toBe('后端渲染的话')
    expect(wrapper.find('.brief-intake__stale').text()).toBe('这段话还没刷新')
    // 下一轮成功就摘掉标记
    wrapper.findAllComponents(RadioGroup)[0].vm.$emit('update:value', 'opt-a')
    await afterDebounce()
    expect(wrapper.find('.brief-intake__stale').exists()).toBe(false)
    wrapper.unmount()
  })
})

describe('候选套数与头部三件事', () => {
  it('上限取词表的 candidateMaxCount：新建默认拉满，输 9 也被钳回 3，保存 payload 里就是 3', async () => {
    const wrapper = await mountView()
    const number = wrapper.findAllComponents(InputNumber)[0]
    expect(number.props('min')).toBe(1)
    expect(number.props('max')).toBe(3)
    expect(number.props('value')).toBe(3) // 默认 = 上限（拍板 7 的口径）
    expect(wrapper.text()).toContain('候选套数（上限 3）')

    number.vm.$emit('update:value', 2)
    await flushPromises()
    expect(wrapper.findAllComponents(InputNumber)[0].props('value')).toBe(2)
    number.vm.$emit('update:value', 9)
    await flushPromises()
    expect(wrapper.findAllComponents(InputNumber)[0].props('value')).toBe(3)

    wrapper.findAllComponents(Select)[0].vm.$emit('update:value', 15)
    wrapper.findAllComponents(RadioGroup)[0].vm.$emit('update:value', 'opt-a') // 必填（词表打星）先答上
    await clickSave(wrapper)
    expect(siteBriefsApi.create).toHaveBeenCalledTimes(1)
    const payload = vi.mocked(siteBriefsApi.create).mock.calls[0][0]
    expect(payload.tenantId).toBe(15)
    // 建单入参不带 siteId（转正是后链路回填）：payload 里就不该有这个字段
    expect((payload as any).siteId).toBeUndefined()
    expect(payload.candidateCount).toBe(3)
    // 演示档位默认 full（拍板 7），没人选过也带上
    expect(payload.demoContentMode).toBe('full')
    // 新建保存成功后换到编辑地址：id 来自后端回包，不是前端猜的
    expect(replaceSpy).toHaveBeenCalledWith({ name: 'workspace-portal-brief-intake', params: { id: '55' } })
    wrapper.unmount()
  })

  it('color 题：色块与十六进制格是同一份值；「AI 决定」落哨兵值 ai 并锁住色块；notes 纯空白落 null，参考行 trim 后过滤', async () => {
    const wrapper = await mountView()
    wrapper.findAllComponents(Select)[0].vm.$emit('update:value', 15)
    wrapper.findAllComponents(RadioGroup)[0].vm.$emit('update:value', 'opt-a') // 必填（词表打星）先答上
    await flushPromises()

    // 色块是原生 `<input type="color">`，不是组件库桩件：装在 node_modules 的 ant-design-vue 4.2.6 没有 ColorPicker，
    // 上一版这里写 `<a-color-picker>` 在浏览器里整块不渲，而打了桩的单测照样绿——所以这一条必须摸真实节点。
    const swatch = wrapper.find('input[type=color]')
    expect(swatch.exists(), 'color 题没有摆出色块').toBe(true)
    await swatch.setValue('#1a2b3c')
    const hexBox = wrapper.findAllComponents(Input).find(node => node.props('placeholder') === '#RRGGBB')
    expect(hexBox!.props('value')).toBe('#1a2b3c')

    wrapper.findAllComponents(Switch)[0].vm.$emit('update:checked', true)
    await flushPromises()
    expect((swatch.element as HTMLInputElement).disabled).toBe(true)
    expect((swatch.element as HTMLInputElement).value).toBe('#000000') // 哨兵值不是颜色：色块回落成黑，文字格也不再冒充有值
    expect(hexBox!.props('value')).toBe('')

    const refInput = wrapper.findAllComponents(Input).find(node => node.props('placeholder') === 'https://example.com')
    refInput!.vm.$emit('update:value', '  https://ref.example  ')
    wrapper.findAllComponents(Textarea)[0].vm.$emit('update:value', '   ')
    await clickSave(wrapper)
    const payload = vi.mocked(siteBriefsApi.create).mock.calls[0][0]
    // 「AI 决定」的哨兵值 = 后端词表里那条选项的码 ai（不是自造的 auto）；平铺进品牌主色字段
    expect((payload as any).qColor).toBe('ai')
    expect(payload.referenceUrls).toEqual(['https://ref.example'])
    expect(payload.notes).toBeNull()
    expect(wrapper.findAllComponents(Textarea)[0].props('maxlength')).toBe(500)
    wrapper.unmount()
  })
})

describe('编辑存量单与后端的拒绝原话', () => {
  it('按路由 id 取单回填：档位/套数/状态码都用库里那份；PUT 被拒时中文原样长在页面上', async () => {
    routeParams.current = { id: '12' }
    const wrapper = await mountView({
      brief: savedBrief({
        id: 12,
        status: 'generating',
        candidateCount: 2,
        demoContentMode: 'lite',
        qSingle: 'opt-b',
        qMulti: ['opt-d'],
        referenceUrls: ['https://old.example'],
        notes: '库里留下的话',
        requirementsSummary: '库里那段话'
      })
    })
    expect(siteBriefsApi.get).toHaveBeenCalledWith(12)
    // 状态中文没有词表口：露后端原码，前端不编映射
    expect(wrapper.text()).toContain('当前状态：generating')
    expect(wrapper.findAllComponents(InputNumber)[0].props('value')).toBe(2)
    // 演示内容档位那条下拉按**它自己的选项**认，不按位置认：工具条上加一个控件就会把位置串位
    const modeSelect = wrapper
      .findAllComponents(Select)
      .find(item => ((item.props('options') ?? []) as { value: unknown }[]).some(o => o.value === 'lite'))
    expect(modeSelect?.props('value')).toBe('lite')
    expect(wrapper.find('.brief-intake__summary-text').text()).toBe('库里那段话')
    expect(vi.mocked(siteBriefsApi.summaryPreview)).not.toHaveBeenCalled()

    vi.mocked(siteBriefsApi.update).mockRejectedValue(
      new Error('这份需求单已经在出方案了，锁住不能改了')
    )
    await clickSave(wrapper)
    expect(siteBriefsApi.create).not.toHaveBeenCalled()
    expect(siteBriefsApi.update).toHaveBeenCalledWith(12, expect.objectContaining({
      candidateCount: 2,
      demoContentMode: 'lite'
    }))
    expect(wrapper.find('.brief-intake__save-error').text()).toBe('这份需求单已经在出方案了，锁住不能改了')
    wrapper.unmount()
  })

  it('D1 新栏原样回填：pagePlan/homeLayout/trust_anchors 读回编辑袋，不要求重录', async () => {
    routeParams.current = { id: '12' }
    const wrapper = await mountView({
      vocab: VOCAB_D1,
      brief: savedBrief({
        id: 12,
        status: 'draft',
        brandName: '某某科技',
        primaryGoal: 'inquiry',
        trustAnchors: ['numbers'],
        pagePlan: [{ key: 'home', slug: 'home', title: '首页', purpose: '', sectionKey: null, blocks: ['hero'], priority: null }],
        homeLayout: ['hero', 'case-grid']
      })
    })
    // 答过的题不再挂「客户未提供」；没答的（audience_note）仍然挂——回填走的是勾选袋，不是重录
    expect(wrapper.text()).toContain('客户未提供')
    const trust = wrapper.findAllComponents(CheckboxGroup)[0]
    expect(trust.props('value')).toEqual(['numbers'])
    // 页面清单读回一行，标识格带着库里的值；区块顺序读回两行（这两题都在结构段）
    await gotoSection(wrapper, '结构段')
    expect(wrapper.findAll('.brief-intake__page-row')).toHaveLength(1)
    expect((wrapper.find('.brief-intake__page-key').element as HTMLInputElement).value).toBe('home')
    expect(wrapper.findAll('.brief-intake__layout .brief-intake__block-row')).toHaveLength(2)
    wrapper.unmount()
  })
})

describe('地址栏带进来的租户号（TenantPanel 的交棒出口）', () => {
  it('新建单时 ?tenantId=15 预填租户，并写明这个号是从租户管理那一行带来的', async () => {
    routeQuery.current = { tenantId: '15' }
    const wrapper = await mountView()
    const tenantSelect = wrapper.findAllComponents(Select)[0]
    expect(tenantSelect.props('value')).toBe(15)
    expect(wrapper.find('.brief-intake__alert').text()).toContain('租户是从「租户管理」那一行带过来的')
    expect(wrapper.find('.brief-intake__alert').text()).toContain('#15')
    // 预填只是省一次选择：保存时带的仍是这个号，不是前端偷偷再造一份默认值
    wrapper.findAllComponents(RadioGroup)[0].vm.$emit('update:value', 'opt-a') // 必填（词表打星）先答上
    await clickSave(wrapper)
    expect(vi.mocked(siteBriefsApi.create).mock.calls[0][0].tenantId).toBe(15)
    wrapper.unmount()
  })

  it('地址里的号在租户列表里查不到：下拉露出这一号并说没查到，不静默丢预填', async () => {
    routeQuery.current = { tenantId: '99' }
    const wrapper = await mountView()
    const options = (wrapper.findAllComponents(Select)[0].props('options') ?? []) as { value: unknown; label: string }[]
    const extra = options.find(option => option.value === 99)
    expect(extra, '预填的租户号必须还在下拉里').toBeTruthy()
    expect(extra!.label).toContain('这一页的租户列表里没查到')
    wrapper.unmount()
  })

  it('编辑存量单时地址里的租户号不许盖掉库里那一户', async () => {
    routeParams.current = { id: '12' }
    routeQuery.current = { tenantId: '99' }
    const wrapper = await mountView({ brief: savedBrief({ id: 12, tenantId: 15 }) })
    expect(wrapper.findAllComponents(Select)[0].props('value')).toBe(15)
    expect(wrapper.text()).not.toContain('租户是从「租户管理」那一行带过来的')
    wrapper.unmount()
  })

  it('非法的 tenantId（0 / 字母）当没带：不预填也不弹那句说明', async () => {
    routeQuery.current = { tenantId: 'abc' }
    const wrapper = await mountView()
    expect(wrapper.findAllComponents(Select)[0].props('value')).toBeFalsy()
    expect(wrapper.text()).not.toContain('租户是从「租户管理」那一行带过来的')
    wrapper.unmount()
  })
})

describe('锁了单的一单：编辑入口不撒谎', () => {
  it('状态不在可编辑里：先说清保存会被拒，并给回详情页的出口', async () => {
    routeParams.current = { id: '12' }
    const wrapper = await mountView({ brief: savedBrief({ id: 12, status: 'promoted' }) })
    // 词表 VOCAB 没有 statusLabels：这一格宁可露后端原码也不编中文（同上一条用例的口径）
    const alert = wrapper.find('.brief-intake__alert')
    expect(alert.text()).toContain('这一单现在是「promoted」')
    expect(alert.text()).toContain('后端只收')
    expect(alert.text()).toContain('保存一定会被拒')
    // 页头那一格同样只露码，且详情页入口在
    expect(wrapper.text()).toContain('当前状态：promoted')
    click(byText('看这一单的详情')[0])
    expect(pushSpy).toHaveBeenLastCalledWith({ name: 'workspace-portal-brief-detail', params: { id: '12' } })
    wrapper.unmount()
  })

  it('draft 这一单不给锁单提示，也不显示详情页按钮以外的怪东西', async () => {
    routeParams.current = { id: '12' }
    const wrapper = await mountView({ brief: savedBrief({ id: 12, status: 'draft' }) })
    expect(wrapper.text()).not.toContain('保存一定会被拒')
    expect(byText('看这一单的详情').length).toBe(1)
    wrapper.unmount()
  })
})

describe('这一页不许长出 P3 的按钮', () => {
  it('全部按钮只有导航、词表重试、参考站增删、行编辑器和保存：没有任何生成/预估/出方案入口', async () => {
    const wrapper = await mountView({ vocab: VOCAB_D1 })
    wrapper.findAllComponents(Select)[0].vm.$emit('update:value', 15)
    await flushPromises()
    const labels = [...document.querySelectorAll('button')].map(node => (node.textContent || '').replace(/\s+/g, ''))
    expect(labels.filter(label => /生成|预估|估算|出方案|预览/.test(label))).toEqual([])
    expect(labels).toContain('保存')
    expect(labels).toContain('返回列表')
    click(byText('返回列表')[0])
    expect(pushSpy).toHaveBeenCalledWith({ name: 'workspace-portal-briefs' })
    wrapper.unmount()
  })
})
