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

/**
 * 前采需求单录入页的交互契约（Spec §4.1 / §7，任务 P1）。
 *
 * 这一页最容易翻车的三处，用例就钉三件：
 * 1. **右侧那段话只能来自 summary-preview**——前端自己拼一句就等于抄了第二份词表（I-1），
 *    所以「进页面不发」「勾选后 debounce 到了才发一次」「失败保留上一版并原话标还没刷新」；
 * 2. **候选套数封顶在词表的 candidateMaxCount**——上限是后端配置，界面不许让人超；
 * 3. **PUT 被拒时后端那句中文一个字不许改**——锁单理由只有后端知道，前端复述就是编。
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
  // 视图现在会用 siteBriefs 里的纯映射函数（intakeLoopQuestions / buildBriefForm / readBriefSelections）：
  // 这几份是真实适配逻辑，必须走真实现（顺带让 payload 断言真的经过题目 key→平铺字段的映射）；
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
    {
      key: 'q_cascade', label: '题目级联', select: 'cascade', required: true,
      options: [{ code: 'cat-1', label: '大类一', children: [{ code: 'cat-1-a', label: '子类一' }] }]
    },
    { key: 'q_color', label: '题目颜色', select: 'color', required: false, options: [] },
    { key: 'q_text', label: '题目文本', evidence: '这题自己打字', select: 'text', required: false, options: [] },
    // 词表今天没有的新形态：界面必须退化成输入框，而不是猜语义
    { key: 'q_odd', label: '题目新形态', evidence: '不认识就退回输入框', select: 'slider', required: false, options: [] }
  ],
  candidateMaxCount: 3,
  demoContentModes: [
    { value: 'full', label: '整套演示', articleCount: 8, caseCount: 4 },
    { value: 'lite', label: '少量演示', articleCount: 3, caseCount: 1 },
    { value: 'none', label: '不带演示', articleCount: 0, caseCount: 0 }
  ]
}

const CASCADER_STUB = {
  name: 'ACascader',
  props: ['value', 'options'],
  emits: ['update:value'],
  template: '<div class="cascader-stub" />'
}

const COLOR_STUB = {
  name: 'AColorPicker',
  props: ['value', 'disabled'],
  emits: ['update:value'],
  template: '<div class="color-stub" />'
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
    ...overrides
  }
}

interface Options {
  vocab?: any
  vocabError?: string
  brief?: any
}

async function mountView(options: Options = {}) {
  vi.mocked(tenantApi.list).mockResolvedValue([{ id: 15, code: 't-a', name: '甲租户' }] as any)
  vi.mocked(siteApi.list).mockResolvedValue([{ id: 3, name: '甲站', tenantId: 15 }] as any)
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
        'a-cascader': CASCADER_STUB,
        'a-color-picker': COLOR_STUB
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
 * debounce 是视图里的真实 setTimeout：这里只接管 setTimeout/clearTimeout，
 * flushPromises 用的 setImmediate 保持原样。假定时器同时解决另一个坑——
 * 上一条用例没等完的 300ms 窗口会漏进下一条用例的 mock 调用计数里。
 */
async function afterDebounce() {
  await vi.advanceTimersByTimeAsync(360)
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
    expect(wrapper.findAll('.color-stub')).toHaveLength(1)
    const placeholders = wrapper.findAllComponents(Input).map(node => node.props('placeholder'))
    expect(placeholders).toContain('这题自己打字')
    expect(placeholders).toContain('不认识就退回输入框')
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

  it('color 题的「AI 决定」落哨兵值 ai 并锁住取色器；notes 纯空白落 null，参考行 trim 后过滤', async () => {
    const wrapper = await mountView()
    wrapper.findAllComponents(Select)[0].vm.$emit('update:value', 15)
    wrapper.findAllComponents(Switch)[0].vm.$emit('update:checked', true)
    await flushPromises()
    expect(wrapper.findAllComponents({ name: 'AColorPicker' })[0].props('disabled')).toBe(true)

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
  it('全部按钮只有导航、词表重试、参考站增删和保存：没有任何生成/预估/出方案入口', async () => {
    const wrapper = await mountView()
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
