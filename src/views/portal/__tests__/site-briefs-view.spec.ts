import { describe, it, expect, beforeEach, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { Button, Input, Select, Tag, message } from 'ant-design-vue'
import SiteBriefsView from '../SiteBriefsView.vue'
import { siteBriefsApi, vocabularyApi } from '../../../api/siteBriefs'
import { tenantApi } from '../../../api/workspace'

/**
 * 前采需求单列表（任务 P1）。用例钉四点：
 * 1. 行的每一格只报接口给的东西——状态中文读后端词表的 statusLabels（唯一真相），
 *    词表取不到该码时显示「状态未知（原码 xxx）」把码带出来，绝不前端自己编第二份映射（I-1）；
 *    租户名去租户列表查，演示档位中文只取词表 demoContentModes.label；
 * 2. 词表取不到只影响档位/状态那两格：露码或「状态未知」，不自己编一套中文；
 * 3. 过滤参数与列表接口一一对应（切租户、选状态都是选完立刻重拉）；
 *    状态那一格是后端词表 statusLabels 那份中文下拉，界面上不出现 draft/ready 这类码；
 * 4. 空态那句话只承诺今天真存在的一步（录前采），不摆 P3/P4 的死按钮；
 * 5. 一行有两个去处（详情 / 录入），而「绑定站点」这一格只有字没有控件——
 *    这一页写不了 siteId（回填在流水线里），摆了下拉就是骗人。
 *
 * 真 a-table 在这环境里渲不出表体（内部还要 Spin 与测量那一层），换成按
 * columns × dataSource 逐格走 bodyCell 插槽的壳——格子里的判断仍是视图自己的代码。
 */

const pushSpy = vi.fn()

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: pushSpy })
}))

vi.mock('ant-design-vue', async () => {
  const actual = await vi.importActual<Record<string, any>>('ant-design-vue')
  return {
    ...actual,
    message: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() }
  }
})

// 列表页现在直接用适配层的纯函数（briefStatusLabel 那一类）：这里只替换 http 与两个 api 对象，
// 纯函数走真实实现——把「状态中文只来自词表」那条判断在测试里再抄一遍，测的就不是视图了。
vi.mock('../../../api/http', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() }
}))

vi.mock('../../../api/siteBriefs', async importOriginal => {
  const actual = await importOriginal<Record<string, any>>()
  return {
    ...actual,
    siteBriefsApi: { list: vi.fn(), get: vi.fn(), create: vi.fn(), update: vi.fn(), summaryPreview: vi.fn() },
    vocabularyApi: { adminVocabulary: vi.fn(), portalVocabulary: vi.fn() }
  }
})

vi.mock('../../../api/workspace', () => ({
  tenantApi: { list: vi.fn() }
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
  props: ['title', 'message', 'type', 'description'],
  template: `<div class="${name}-stub"><slot /><slot name="message" /><slot name="description" /></div>`
})

function brief(overrides: Record<string, unknown> = {}) {
  return {
    id: 5,
    tenantId: 15,
    siteId: null,
    status: 'draft',
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
    requirementsSummary: null,
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
  demoContentModes: [
    { value: 'full', label: '整套演示', articleCount: 8, caseCount: 4 },
    { value: 'lite', label: '少量演示', articleCount: 3, caseCount: 1 }
  ],
  statusLabels: { draft: '草稿', ready: '待出方案' }
}

async function mountView(options: {
  briefs?: any[]
  listError?: string
  vocabError?: string
  /** 后端跟着列表回来的那两格：这一页没行时是哪一种空 */
  emptyReason?: string | null
  emptyLine?: string | null
  /** 自己接管列表那一发（要盯「还在飞」那一档时把 resolve 留在用例手里） */
  list?: () => Promise<any>
} = {}) {
  vi.mocked(tenantApi.list).mockResolvedValue([{ id: 15, code: 't-a', name: '甲租户' }] as any)
  if (options.vocabError) {
    vi.mocked(vocabularyApi.adminVocabulary).mockRejectedValueOnce(new Error(options.vocabError))
  } else {
    vi.mocked(vocabularyApi.adminVocabulary).mockResolvedValue(VOCAB as any)
  }
  const rows = options.briefs ?? []
  const page = {
    records: rows,
    total: rows.length,
    page: 1,
    size: Math.max(rows.length, 1),
    pages: rows.length ? 1 : 0,
    emptyReason: options.emptyReason ?? null,
    emptyLine: options.emptyLine ?? null
  }
  if (options.list) {
    vi.mocked(siteBriefsApi.list).mockImplementation(options.list)
  } else if (options.listError) {
    vi.mocked(siteBriefsApi.list).mockRejectedValueOnce(new Error(options.listError))
  } else {
    vi.mocked(siteBriefsApi.list).mockResolvedValue(page as any)
  }
  const wrapper = mount(SiteBriefsView, {
    attachTo: document.body,
    global: {
      stubs: {
        'a-button': Button,
        'a-select': Select,
        'a-input': Input,
        'a-tag': Tag,
        'a-table': TABLE_STUB,
        'a-form': PASS_THROUGH('AForm'),
        'a-form-item': PASS_THROUGH('AFormItem'),
        'a-space': PASS_THROUGH('ASpace'),
        'a-alert': PASS_THROUGH('AAlert'),
        'a-empty': PASS_THROUGH('AEmpty')
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

/** 后端那一句本体：「真的没有」那一档下面多摆的那颗按钮不属于这句话，比原文时先摘掉 */
function emptySentence(wrapper: any) {
  const node = wrapper.find('.empty-line').element.cloneNode(true) as HTMLElement
  node.querySelectorAll('.create-on-empty').forEach(button => button.remove())
  return (node.textContent || '').trim()
}

beforeEach(() => {
  document.body.innerHTML = ''
  vi.clearAllMocks()
})

describe('列表行只报接口给的东西', () => {
  it('一进来按无过滤拉一次：状态读词表 statusLabels 的中文，租户名与档位中文各取各的源', async () => {
    const wrapper = await mountView({ briefs: [brief()] })
    expect(siteBriefsApi.list).toHaveBeenCalledWith({ tenantId: null, status: null })
    const text = wrapper.text()
    // 状态中文只来自后端词表 statusLabels：draft→草稿，前端不写第二份映射（I-1）
    expect(text).toContain('草稿')
    expect(text).toContain('甲租户')
    // 档位中文只来自词表 demoContentModes.label
    expect(text).toContain('整套演示')
    expect(text).toContain('2')
    click(byText('录入/编辑')[0])
    expect(pushSpy).toHaveBeenCalledWith({ name: 'workspace-portal-brief-intake', params: { id: '5' } })
    wrapper.unmount()
  })

  it('statusLabels 里没有这个码：显示「状态未知（原码 xxx）」，不猜一个中文', async () => {
    const wrapper = await mountView({ briefs: [brief({ status: 'promoted_x' })] })
    expect(wrapper.text()).toContain('状态未知（原码 promoted_x）')
    wrapper.unmount()
  })

  it('词表取不到只影响档位那一格：露 code，不编中文，也不跟着报错', async () => {
    const wrapper = await mountView({ briefs: [brief()], vocabError: '词表接口 500' })
    const text = wrapper.text()
    expect(text).toContain('full')
    expect(text).not.toContain('整套演示')
    expect(wrapper.find('.empty-line').exists()).toBe(false)
    wrapper.unmount()
  })

  it('租户列表查不到这个 id：报「租户 #n」而不是消失', async () => {
    const wrapper = await mountView({ briefs: [brief({ tenantId: 99 })] })
    expect(wrapper.text()).toContain('租户 #99')
    wrapper.unmount()
  })
})

describe('过滤与错误各说各的', () => {
  it('切租户、选状态都选完立刻重拉：状态那一格是词表中文下拉，界面不许念 draft / ready', async () => {
    const wrapper = await mountView({ briefs: [brief()] })
    wrapper.findAllComponents(Select)[0].vm.$emit('update:value', 15)
    await flushPromises()
    expect(siteBriefsApi.list).toHaveBeenLastCalledWith({ tenantId: 15, status: null })

    const statusFilter = wrapper.findAllComponents(Select)[1]
    // 选项就是后端 statusLabels 那一份（中文标签、码只当 value）；以前这里是文本框，
    // 要求录单的人先知道英文码——同一页列表显示中文、筛选框背码，是同一件事的两种说法
    expect(statusFilter.props('options')).toEqual([
      { value: 'draft', label: '草稿' },
      { value: 'ready', label: '待出方案' }
    ])
    statusFilter.vm.$emit('update:value', 'ready')
    await flushPromises()
    expect(siteBriefsApi.list).toHaveBeenLastCalledWith({ tenantId: 15, status: 'ready' })
    statusFilter.vm.$emit('update:value', undefined) // 清空 = 回到全部状态
    await flushPromises()
    expect(siteBriefsApi.list).toHaveBeenLastCalledWith({ tenantId: 15, status: null })
    expect(wrapper.text()).not.toMatch(/draft|ready/)
    wrapper.unmount()
  })

  it('词表没取到：状态筛选宁可乐空，也不摆一份前端自己编的中文清单', async () => {
    const wrapper = await mountView({ briefs: [brief()], vocabError: '词表读失败了' })
    const statusFilter = wrapper.findAllComponents(Select)[1]
    expect(statusFilter.props('options')).toEqual([])
    expect(String(statusFilter.props('placeholder'))).toContain('还没取到')
    wrapper.unmount()
  })

  it('列表读失败：说的那句是「这一发读失败」，不冒充「一单都没有」', async () => {
    const wrapper = await mountView({ listError: '这个账号没有看需求单的资格' })
    const said = wrapper.find('.empty-line').text()
    expect(said).toContain('这一发读失败：这个账号没有看需求单的资格')
    expect(said).toContain('读失败不是「这一档没有」')
    expect(wrapper.text()).not.toContain('下一步是录一份前采需求单') // 失败不等于空
    expect(wrapper.text()).not.toContain('draft')
    expect(vi.mocked(message.error).mock.calls.flat().join()).toContain('这个账号没有看需求单的资格')
    wrapper.unmount()
  })

  it.each([
    ['NONE', '需求单：这一档查过了，一条都没有。'],
    ['NOT_VISIBLE', '需求单：这一档读不到（选中的那个身份在这张表里没有行），所以这里不能说「没有」。'],
    ['OUT_OF_RANGE', '需求单：这一页翻过了头，往前面的页翻回来就有；这里没行不等于这一档没有。']
  ])('后端回 %s 那一档时逐字念后端那一句，页面上没有「暂无数据」', async (reason, line) => {
    const wrapper = await mountView({ briefs: [], emptyReason: reason, emptyLine: line })
    expect(emptySentence(wrapper)).toBe(line)
    expect(wrapper.html()).not.toContain('暂无数据')
    wrapper.unmount()
  })

  it('后端没回是哪一种空时念「界面不替它猜」，不蒙成「真的没有」', async () => {
    const wrapper = await mountView({ briefs: [] })
    const text = wrapper.find('.empty-line').text()
    expect(text).toContain('后端没回是哪一种空')
    expect(wrapper.text()).not.toContain('一条都没有')
    wrapper.unmount()
  })
})

describe('详情入口与绑定站点那一格', () => {
  it('一行有两个去处：单号与「详情」都进详情页，「录入/编辑」仍进表单', async () => {
    const wrapper = await mountView({ briefs: [brief()] })
    click(byText('详情')[0])
    expect(pushSpy).toHaveBeenLastCalledWith({ name: 'workspace-portal-brief-detail', params: { id: '5' } })
    // 单号本身就是入口：不用为了看这单走到哪了先扑进表单
    click(byText('#5')[0])
    expect(pushSpy).toHaveBeenLastCalledWith({ name: 'workspace-portal-brief-detail', params: { id: '5' } })
    click(byText('录入/编辑')[0])
    expect(pushSpy).toHaveBeenLastCalledWith({ name: 'workspace-portal-brief-intake', params: { id: '5' } })
    wrapper.unmount()
  })

  it('绑定站点那一格只有字没有控件：回填前写「还没有站点」，回填后写站号', async () => {
    const none = await mountView({ briefs: [brief()] })
    expect(none.text()).toContain('还没有站点（后链路回填）')
    none.unmount()

    document.body.innerHTML = ''
    const bound = await mountView({ briefs: [brief({ siteId: 31 })] })
    expect(bound.text()).toContain('站点 #31')
    // 这一页没有任何写 siteId 的能力：给了下拉/输入框就是摆了个不生效的控件
    // （整页只有两个下拉：租户筛选与状态筛选；状态那一格刚从文本框换成下拉，所以输入框是 0）
    expect(bound.findAllComponents(Select)).toHaveLength(2)
    expect(bound.findAllComponents(Input)).toHaveLength(0)
    expect(bound.text()).not.toContain('选择站点')
  })
})

describe('空态与新入口', () => {
  it('一单都没有：先念后端那句「真的没有」，再说今天真存在的下一步「录前采」', async () => {
    const wrapper = await mountView({
      briefs: [],
      emptyReason: 'NONE',
      emptyLine: '需求单：这一档查过了，一条都没有。'
    })
    expect(emptySentence(wrapper)).toBe('需求单：这一档查过了，一条都没有。')
    const text = wrapper.text()
    expect(text).toContain('下一步是录一份前采需求单')
    expect(text).toContain('今天这里不摆点了没反应的按钮')
    const labels = [...document.querySelectorAll('button')].map(node => (node.textContent || '').replace(/\s+/g, ''))
    expect(labels.filter(label => /生成|出方案|预估|估算/.test(label))).toEqual([])
    click(byText('现在就去录一份')[0])
    expect(pushSpy).toHaveBeenCalledWith({ name: 'workspace-portal-brief-new' })
    wrapper.unmount()
  })

  it('读不到与翻过头都不摆「现在就去录一份」：那两种空不是「这一档还空着」', async () => {
    for (const [reason, line] of [
      ['NOT_VISIBLE', '需求单：这一档读不到。'],
      ['OUT_OF_RANGE', '需求单：这一页翻过了头。']
    ]) {
      const wrapper = await mountView({ briefs: [], emptyReason: reason, emptyLine: line })
      expect(byText('现在就去录一份')).toHaveLength(0)
      expect(wrapper.text()).not.toContain('下一步是录一份前采需求单')
      wrapper.unmount()
      document.body.innerHTML = ''
    }
  })

  it('「新建需求单」与空态按钮去同一个录入页', async () => {
    const wrapper = await mountView({ briefs: [brief()] })
    click(byText('新建需求单')[0])
    expect(pushSpy).toHaveBeenCalledWith({ name: 'workspace-portal-brief-new' })
    wrapper.unmount()
  })

  it('第一次加载还在飞：列表天然是空的，这时候也不摆「还没有需求单」', async () => {
    // 2026-10-16 走查现场：明明有 20 单的机器，进这一页会闪一句「还没有需求单」。
    // 读失败那一档有上面那条用例守着，「还没取回来」这一档只在真浏览器里闪一下、手工点抓不稳，
    // 所以把 resolve 留在用例手里钉在这里：空态那句话只留给「真的取回来了、真的没有单」。
    let resolveList: (value: any) => void = () => {}
    const wrapper = await mountView({
      list: () => new Promise(resolve => {
        resolveList = resolve
      })
    })

    expect(siteBriefsApi.list).toHaveBeenCalled()
    expect(wrapper.text()).not.toContain('还没有需求单')
    expect(wrapper.find('.empty-line').exists()).toBe(false)

    resolveList({
      records: [brief({ status: 'ready' })],
      total: 1,
      page: 1,
      size: 1,
      pages: 1,
      emptyReason: null,
      emptyLine: null
    })
    await flushPromises()
    expect(wrapper.text()).toContain('待出方案')
    expect(wrapper.text()).not.toContain('还没有需求单')
    wrapper.unmount()
  })
})
