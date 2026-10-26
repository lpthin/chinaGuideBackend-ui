import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { h } from 'vue'
import { Button, Col, Form, FormItem, Row, Tabs, message } from 'ant-design-vue'
import PublishCenterView from '../PublishCenterView.vue'
import { articleApi, publishApi, publishQueueApi } from '../../../api/workspace'
import { JUMP_BACK_NOTICE } from '../../../utils/emptyPage'

/**
 * 发布中心这一屏的空态：「发布记录」页签是 M-P74，「发布候选」页签与顶部那几张统计卡是 M-P79。
 *
 * 这一屏的空会被读成「这一家没发过东西 / 这家没有审核过的文章」，所以「读不到」与「真的没有」
 * 必须念后端那一句，界面不许改写。候选那一格以前钉死一句「没有审核通过的文章，请先在「审核管理」
 * 通过文章」，于是后端答「这一档读不到」「这一发读失败」时界面照样念「没有」。
 *
 * 钉这几件：
 * 1. 三种空各念各的，逐字比后端原文，页面上不许出现那句硬编码；
 * 2. 后端没答成因时界面不替它猜；
 * 3. 读失败说的是读失败，不是「这一档没有」；
 * 4. 后端回「这一页翻过了头」时界面自己翻回第一页再读一遍；
 * 5. 「真的没有」那一档摆那颗「去审核管理通过文章」，另外两种空不许摆；
 * 6. 统计那一发没答回来时那几张卡摆 `—`，不摆 0。
 *
 * 那张表格在 a-tabs 的页签里，所以切页签走的是真实页签控件，不是直接改 activeKey。
 */

/**
 * 真实 Tabs 内部用 ResizeObserver 量页签宽度；全局 setup 里那个 `vi.fn()` 桩在 `new` 之下会炸
 * （vitest 的 mock 实现是箭头函数，构造调用直接被拒）。而 resize-observer-polyfill 是在
 * 「模块加载那一刻」就把全局那一个抓走的，所以这一份必须靠 vi.hoisted 顶到 import 之前。
 *
 * routerPush 也一起顶上去：要断言那颗「去审核管理通过文章」跳的是哪条路由，就得拿到这一屏
 * 真正调用的那一个函数（在工厂里每次现造一个 vi.fn() 就断言不到）。
 */
const routerPush = vi.hoisted(() => vi.fn())

vi.hoisted(() => {
  ;(globalThis as any).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
})

vi.mock('ant-design-vue', async () => {
  const actual = await vi.importActual<Record<string, any>>('ant-design-vue')
  return {
    ...actual,
    message: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() }
  }
})

// 挂这一屏时四处都要回东西：统计两口 + 候选 / 队列 / 记录三读口
vi.mock('../../../api/workspace', () => ({
  articleApi: {
    list: vi.fn(),
    batchPublish: vi.fn()
  },
  publishApi: {
    publish: vi.fn(),
    records: vi.fn(),
    recordStats: vi.fn()
  },
  publishQueueApi: {
    list: vi.fn(),
    getStats: vi.fn(),
    publishNow: vi.fn(),
    cancel: vi.fn(),
    remove: vi.fn(),
    adjustPriority: vi.fn()
  }
}))

vi.mock('../../../stores/auth', () => ({
  useAuthStore: () => ({
    selectedTenantId: null,
    user: { id: 1 },
    isSuperAdmin: true,
    hasPermission: () => true
  })
}))

vi.mock('vue-router', async importOriginal => {
  const actual = await importOriginal<Record<string, any>>()
  return { ...actual, useRouter: () => ({ push: routerPush }) }
})

const TABLE_STUB = {
  name: 'ATable',
  props: {
    dataSource: { type: Array, default: () => [] },
    columns: { type: Array, default: () => [] },
    loading: { type: Boolean, default: false },
    pagination: { type: Object, default: () => ({}) }
  },
  emits: ['change'],
  setup(props: any, { slots, emit }: any) {
    return () => {
      const rows = props.dataSource as any[]
      return h('div', { class: 'table-stub' }, [
        // 真实控件替身：翻页走的是表格自己的 change 事件，不是直接改 pagination
        h('button', { class: 'go-page', onClick: () => emit('change', { current: 3, pageSize: 10 }) }, '到第 3 页'),
        rows.length === 0
          ? h('div', { class: 'empty' }, slots.emptyText ? slots.emptyText({}) : '暂无数据')
          : rows.map((record) =>
              h('div', { class: 'row', 'data-row': record.id }, [
                h('span', { class: 'cell-id' }, String(record.id))
              ])
            )
      ])
    }
  }
}

const PASS_THROUGH = (name: string, tag = 'div') => ({
  name,
  template: `<${tag} class="${name.toLowerCase()}-stub"><slot /><slot name="overlay" /></${tag}>`
})

/**
 * 挂这一屏用的替身表，三个页签的用例共用一份（这一屏一挂就四处都读）。
 * 统计那一格要把 title 与 value 都念出来，才测得了「那一发没答回来时摆 `—` 不摆 0」。
 */
function makeStubs(): Record<string, any> {
  return {
    // 页签走真实控件：切到「发布记录」必须点真页签，页签里的内容才是真被渲染出来的
    'a-tabs': Tabs,
    'a-tab-pane': (Tabs as any).TabPane,
    'a-card': PASS_THROUGH('ACard'),
    'a-space': PASS_THROUGH('ASpace'),
    'a-table': TABLE_STUB,
    'a-statistic': {
      name: 'AStatistic',
      props: ['title', 'value', 'suffix', 'precision'],
      template: '<div class="statistic-stub">{{ title }}|{{ value }}|{{ suffix }}</div>'
    },
    // 替身自己认下 options/value 这些属性，不然它们会落到原生 select 上（happy-dom 的 options 只读）
    'a-select': {
      name: 'ASelect',
      props: ['value', 'options', 'placeholder', 'allowClear'],
      emits: ['update:value', 'change'],
      template: '<select class="select-stub"></select>'
    },
    'a-select-option': {
      name: 'ASelectOption',
      props: ['value'],
      template: '<option :value="value"><slot /></option>'
    },
    'a-input': { name: 'AInput', template: '<input class="input-stub" />' },
    'a-input-number': { name: 'AInputNumber', template: '<input class="input-number-stub" />' },
    'a-date-picker': { name: 'ADatePicker', template: '<input class="date-picker-stub" />' },
    'a-rate': { name: 'ARate', template: '<span class="rate-stub"><slot /></span>' },
    'a-slider': { name: 'ASlider', template: '<div class="slider-stub"></div>' },
    'a-button': Button,
    'a-tag': { name: 'ATag', template: '<span class="tag-stub"><slot /></span>' },
    'a-tooltip': PASS_THROUGH('ATooltip'),
    'a-popconfirm': { name: 'APopconfirm', template: '<span class="popconfirm-stub"><slot /></span>' },
    'a-modal': PASS_THROUGH('AModal'),
    'a-form': Form,
    'a-form-item': FormItem,
    'a-row': Row,
    'a-col': Col,
    'a-alert': { name: 'AAlert', template: '<div class="alert-stub"><slot name="message" /><slot name="description" /></div>' },
    'a-empty': { name: 'AEmpty', props: ['description'], template: '<div class="a-empty-stub">{{ description }}</div>' }
  }
}

type PageShape = { records: any[]; total: number; emptyReason?: string | null; emptyLine?: string | null }

const RECORD_ROW = {
  id: 88,
  articleId: 12,
  title: '第一篇',
  status: 'success',
  dryRun: false,
  outputPath: '/data/out/12.html',
  createdAt: '2026-10-24T00:10:00',
  finishedAt: '2026-10-24T00:11:00'
}

const CANDIDATE_ROW = {
  id: 41,
  title: 'M-P79 探针：可发布的一篇',
  status: 'approved',
  wordCount: 1200,
  aiModel: '某模型',
  createdAt: '2026-10-25T00:10:00'
}

/** 这一屏一挂就四读两统计全发；用例只改自己那两支，其余给一发能过的 */
function armOtherReads() {
  vi.mocked(publishQueueApi.list).mockResolvedValue({ records: [], total: 0 } as any)
  vi.mocked(publishQueueApi.getStats).mockResolvedValue({ pending: 0, publishing: 0, todayPublished: 0, failed: 0 } as any)
  vi.mocked(publishApi.recordStats).mockResolvedValue({ total: 0, successCount: 0, successRate: 0 } as any)
}

function mountCenter() {
  return mount(PublishCenterView, {
    attachTo: document.body,
    global: { stubs: makeStubs() }
  })
}

async function mountView(
  rows: any[],
  pageExtras: Omit<PageShape, 'records' | 'total'> = {},
  failWith?: Error
) {
  const records = vi.mocked(publishApi.records)
  if (failWith) {
    records.mockRejectedValue(failWith)
  } else {
    records.mockResolvedValue({ records: rows, total: rows.length, ...pageExtras } as any)
  }
  vi.mocked(articleApi.list).mockResolvedValue({ records: [], total: 0 } as any)
  armOtherReads()

  const wrapper = mountCenter()
  await flushPromises()
  await clickTab(wrapper, '发布记录')
  return wrapper
}

/** 挂这一屏，停在默认的「发布候选」页签（那一个就是 activeTab 的初值，不必切页签） */
async function mountCandidates(
  rows: any[],
  pageExtras: Omit<PageShape, 'records' | 'total'> = {},
  failWith?: Error
) {
  const list = vi.mocked(articleApi.list)
  if (failWith) {
    list.mockRejectedValue(failWith)
  } else {
    list.mockResolvedValue({ records: rows, total: rows.length, ...pageExtras } as any)
  }
  vi.mocked(publishApi.records).mockResolvedValue({ records: [RECORD_ROW], total: 1 } as any)
  armOtherReads()

  const wrapper = mountCenter()
  await flushPromises()
  return wrapper
}

/** 点真实页签：切页签这一步不许绕过控件 */
async function clickTab(wrapper: any, label: string) {
  const tab = wrapper.findAll('[role="tab"]').find((node: any) => node.text() === label)
  if (!tab) {
    throw new Error(`找不到文案为「${label}」的页签按钮`)
  }
  await tab.trigger('click')
  await flushPromises()
}

/** 三个页签的表都在 DOM 里（切走的只是被藏起来），所以比稿只比要测的那一格 */
function paneOf(wrapper: any, key: string) {
  const pane = wrapper
    .findAll('[role="tabpanel"]')
    .find((node: any) => String(node.attributes('id') || '').endsWith(`-panel-${key}`))
  if (!pane) {
    throw new Error(`找不到「${key}」那一格面板`)
  }
  return pane
}

const recordsPane = (wrapper: any) => paneOf(wrapper, 'records')
const candidatesPane = (wrapper: any) => paneOf(wrapper, 'candidates')

/** 那一格里念的句子（把可能摆出来的那颗按钮摘掉，只比句子） */
function hintOf(pane: any) {
  const node = pane.find('.empty-line').element.cloneNode(true) as HTMLElement
  node.querySelectorAll('.create-on-empty').forEach((button) => button.remove())
  return (node.textContent || '').trim()
}

const THREE_EMPTIES: Array<[string, string]> = [
  ['NONE', '发布记录：这一档查过了，一条都没有。'],
  ['NOT_VISIBLE', '发布记录：这一档读不到（选中的那个身份在这张表里没有行），所以这里不能说「没有」。'],
  ['OUT_OF_RANGE', '发布记录：这一页翻过了头，往前面的页翻回来就有；这里没行不等于这一档没有。']
]

/** 主语的唯一出处是后端 `WorkspaceController.PUBLISHABLE_ARTICLES_EMPTY_WHAT`；这里抄的是它的原文 */
const THREE_CANDIDATE_EMPTIES: Array<[string, string]> = [
  ['NONE', '可发布的文章：这一档查过了，一条都没有。'],
  ['NOT_VISIBLE', '可发布的文章：这一档读不到（选中的那个身份在这张表里没有行），所以这里不能说「没有」。'],
  ['OUT_OF_RANGE', '可发布的文章：这一页翻过了头，往前面的页翻回来就有；这里没行不等于这一档没有。']
]

describe('PublishCenterView 发布记录页签的空态成因', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // 翻过头那一档会排两发 mockResolvedValueOnce，用剩的别留给下一条用例
    vi.mocked(publishApi.records).mockReset()
    document.body.innerHTML = ''
  })

  it.each(THREE_EMPTIES)('后端回 %s 那一档时逐字念那一句，页面上没有旧的「暂无发布记录」与「暂无数据」', async (reason, line) => {
    const wrapper = await mountView([], { emptyReason: reason, emptyLine: line })

    expect(hintOf(recordsPane(wrapper))).toBe(line)
    expect(wrapper.html()).not.toContain('暂无发布记录')
    expect(wrapper.html()).not.toContain('暂无数据')
  })

  it('后端没回是哪一种空时念「界面不替它猜」，不蒙成「一条都没有」', async () => {
    const wrapper = await mountView([], { emptyReason: null, emptyLine: null })

    expect(hintOf(recordsPane(wrapper))).toContain('后端没回是哪一种空')
    expect(wrapper.html()).not.toContain('暂无发布记录')
    expect(wrapper.html()).not.toContain('一条都没有')
  })

  it('读失败那一发说的是读失败，不是「这一档没有」', async () => {
    const wrapper = await mountView([], {}, new Error('读口断了'))

    const said = hintOf(recordsPane(wrapper))
    expect(said).toContain('这一发读失败：读口断了')
    expect(said).toContain('读失败不是「这一档没有」')
    expect(said).not.toContain('一条都没有')
  })

  it('后端回「这一页翻过了头」时界面自己翻回第一页再读一遍', async () => {
    const records = vi.mocked(publishApi.records)
    const wrapper = await mountView([RECORD_ROW], { emptyReason: null, emptyLine: null })
    records
      .mockResolvedValueOnce({ records: [], total: 25, emptyReason: 'OUT_OF_RANGE', emptyLine: THREE_EMPTIES[2][1] } as any)
      .mockResolvedValueOnce({ records: [], total: 0, emptyReason: 'NONE', emptyLine: THREE_EMPTIES[0][1] } as any)

    await recordsPane(wrapper).find('.go-page').trigger('click')
    await flushPromises()

    expect(records).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1 }))
    expect(message.info).toHaveBeenCalledWith(JUMP_BACK_NOTICE)
    expect(hintOf(recordsPane(wrapper))).toBe(THREE_EMPTIES[0][1])
  })

  it('「真的没有」那一档也不摆新建按钮：这一屏没有「新建发布记录」这个动作', async () => {
    const wrapper = await mountView([], { emptyReason: 'NONE', emptyLine: THREE_EMPTIES[0][1] })

    expect(hintOf(recordsPane(wrapper))).toBe(THREE_EMPTIES[0][1])
    expect(recordsPane(wrapper).find('.create-on-empty').exists()).toBe(false)
  })

  it('有行的时候根本不渲空态那一句', async () => {
    const wrapper = await mountView([RECORD_ROW], { emptyReason: null, emptyLine: null })

    expect(recordsPane(wrapper).find('.empty').exists()).toBe(false)
    expect(wrapper.html()).not.toContain('一条都没有')
  })
})

describe('PublishCenterView 发布候选页签的空态成因', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(articleApi.list).mockReset()
    document.body.innerHTML = ''
  })

  it.each(THREE_CANDIDATE_EMPTIES)('后端回 %s 那一档时逐字念那一句，硬编码的「没有审核通过的文章」不再出现', async (reason, line) => {
    const wrapper = await mountCandidates([], { emptyReason: reason, emptyLine: line })

    expect(hintOf(candidatesPane(wrapper))).toBe(line)
    expect(wrapper.html()).not.toContain('没有审核通过的文章')
    expect(wrapper.html()).not.toContain('暂无数据')
  })

  it('后端没回是哪一种空时念「界面不替它猜」，不蒙成「一条都没有」', async () => {
    const wrapper = await mountCandidates([], { emptyReason: null, emptyLine: null })

    const said = hintOf(candidatesPane(wrapper))
    expect(said).toContain('后端没回是哪一种空')
    expect(said).not.toContain('一条都没有')
    expect(wrapper.html()).not.toContain('没有审核通过的文章')
  })

  it('读失败那一发说的是读失败：以前 catch 里把行与总数都清空，界面看着就是「查过了，没有」', async () => {
    const wrapper = await mountCandidates([], {}, new Error('候选读口断了'))

    const said = hintOf(candidatesPane(wrapper))
    expect(said).toContain('这一发读失败：候选读口断了')
    expect(said).toContain('读失败不是「这一档没有」')
    expect(said).not.toContain('一条都没有')
    expect(wrapper.html()).not.toContain('没有审核通过的文章')
  })

  it('后端回「这一页翻过了头」时界面自己翻回第一页再读一遍', async () => {
    const list = vi.mocked(articleApi.list)
    const wrapper = await mountCandidates([CANDIDATE_ROW], { emptyReason: null, emptyLine: null })
    list
      .mockResolvedValueOnce({ records: [], total: 47, emptyReason: 'OUT_OF_RANGE', emptyLine: THREE_CANDIDATE_EMPTIES[2][1] } as any)
      .mockResolvedValueOnce({ records: [], total: 0, emptyReason: 'NONE', emptyLine: THREE_CANDIDATE_EMPTIES[0][1] } as any)

    await candidatesPane(wrapper).find('.go-page').trigger('click')
    await flushPromises()

    expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, size: 10, status: 'approved' }))
    expect(message.info).toHaveBeenCalledWith(JUMP_BACK_NOTICE)
    expect(hintOf(candidatesPane(wrapper))).toBe(THREE_CANDIDATE_EMPTIES[0][1])
  })

  it('「真的没有」那一档摆那颗「去审核管理通过文章」，点了走的是审核管理那条路由', async () => {
    const wrapper = await mountCandidates([], { emptyReason: 'NONE', emptyLine: THREE_CANDIDATE_EMPTIES[0][1] })

    const button = candidatesPane(wrapper).find('.create-on-empty')
    expect(button.exists()).toBe(true)
    expect(button.text()).toBe('去审核管理通过文章')

    await button.trigger('click')
    expect(routerPush).toHaveBeenCalledWith({ name: 'workspace-review' })
  })

  it.each(['NOT_VISIBLE', 'OUT_OF_RANGE'])('「%s」那一档下面不摆那颗按钮：那两种空不是说「这一档还空着」', async (reason) => {
    const line = (THREE_CANDIDATE_EMPTIES.find(([value]) => value === reason) as [string, string])[1]
    const wrapper = await mountCandidates([], { emptyReason: reason, emptyLine: line })

    expect(hintOf(candidatesPane(wrapper))).toBe(line)
    expect(candidatesPane(wrapper).find('.create-on-empty').exists()).toBe(false)
  })

  it('有行的时候根本不渲空态那一句', async () => {
    const wrapper = await mountCandidates([CANDIDATE_ROW], { emptyReason: null, emptyLine: null })

    expect(candidatesPane(wrapper).find('.empty').exists()).toBe(false)
    expect(wrapper.html()).not.toContain('一条都没有')
  })
})

/** 主语的唯一出处是后端 `PublishQueueController.PUBLISH_QUEUE_EMPTY_WHAT`；这里抄的是它的原文 */
const THREE_QUEUE_EMPTIES: Array<[string, string]> = [
  ['NONE', '发布队列任务：这一档查过了，一条都没有。'],
  ['NOT_VISIBLE', '发布队列任务：这一档读不到（选中的那个身份在这张表里没有行），所以这里不能说「没有」。'],
  ['OUT_OF_RANGE', '发布队列任务：这一页翻过了头，往前面的页翻回来就有；这里没行不等于这一档没有。']
]

const QUEUE_ROW = {
  id: 71,
  articleId: 41,
  title: 'M-P80 探针：排着的一条',
  status: 'pending',
  priority: 5,
  scheduledTime: '2026-10-27T09:00:00'
}

describe('PublishCenterView 待发布队列页签的空态成因', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(publishQueueApi.list).mockReset()
    document.body.innerHTML = ''
  })

  /** 队列那一屏：切到「待发布队列」页签，队列读口按用例给，其余两读口一发能过的 */
  async function mountQueue(
    rows: any[],
    pageExtras: Omit<PageShape, 'records' | 'total'> = {},
    failWith?: Error
  ) {
    const list = vi.mocked(publishQueueApi.list)
    if (failWith) {
      list.mockRejectedValue(failWith)
    } else {
      list.mockResolvedValue({ records: rows, total: rows.length, ...pageExtras } as any)
    }
    vi.mocked(articleApi.list).mockResolvedValue({ records: [CANDIDATE_ROW], total: 1 } as any)
    vi.mocked(publishApi.records).mockResolvedValue({ records: [RECORD_ROW], total: 1 } as any)
    vi.mocked(publishQueueApi.getStats).mockResolvedValue({ pending: 1, publishing: 0, todayPublished: 0, failed: 0 } as any)
    vi.mocked(publishApi.recordStats).mockResolvedValue({ total: 1, successCount: 1, successRate: 100 } as any)

    const wrapper = mountCenter()
    await flushPromises()
    await clickTab(wrapper, '待发布队列')
    return wrapper
  }

  const queuePane = (wrapper: any) => paneOf(wrapper, 'queue')

  it.each(THREE_QUEUE_EMPTIES)('后端回 %s 那一档时逐字念那一句，硬编码的「队列中暂无任务」不再出现', async (reason, line) => {
    const wrapper = await mountQueue([], { emptyReason: reason, emptyLine: line })

    expect(hintOf(queuePane(wrapper))).toBe(line)
    expect(wrapper.html()).not.toContain('队列中暂无任务')
    expect(wrapper.html()).not.toContain('暂无数据')
  })

  it('后端没回是哪一种空时念「界面不替它猜」，不蒙成「一条都没有」', async () => {
    const wrapper = await mountQueue([], { emptyReason: null, emptyLine: null })

    const said = hintOf(queuePane(wrapper))
    expect(said).toContain('后端没回是哪一种空')
    expect(said).not.toContain('一条都没有')
    expect(wrapper.html()).not.toContain('队列中暂无任务')
  })

  it('读失败那一发说的是读失败，不是「队列是空的」', async () => {
    const wrapper = await mountQueue([], {}, new Error('队列读口断了'))

    const said = hintOf(queuePane(wrapper))
    expect(said).toContain('这一发读失败：队列读口断了')
    expect(said).toContain('读失败不是「这一档没有」')
    expect(said).not.toContain('一条都没有')
    expect(wrapper.html()).not.toContain('队列中暂无任务')
  })

  it('后端回「这一页翻过了头」时界面自己翻回第一页再读一遍', async () => {
    const list = vi.mocked(publishQueueApi.list)
    const wrapper = await mountQueue([QUEUE_ROW], { emptyReason: null, emptyLine: null })
    list
      .mockResolvedValueOnce({ records: [], total: 23, emptyReason: 'OUT_OF_RANGE', emptyLine: THREE_QUEUE_EMPTIES[2][1] } as any)
      .mockResolvedValueOnce({ records: [], total: 0, emptyReason: 'NONE', emptyLine: THREE_QUEUE_EMPTIES[0][1] } as any)

    await queuePane(wrapper).find('.go-page').trigger('click')
    await flushPromises()

    expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, size: 10 }))
    expect(message.info).toHaveBeenCalledWith(JUMP_BACK_NOTICE)
    expect(hintOf(queuePane(wrapper))).toBe(THREE_QUEUE_EMPTIES[0][1])
  })

  it('「真的没有」那一档也不摆新建按钮：队列任务是「发布候选」那一屏排进来的，这一屏没有这个动作', async () => {
    const wrapper = await mountQueue([], { emptyReason: 'NONE', emptyLine: THREE_QUEUE_EMPTIES[0][1] })

    expect(hintOf(queuePane(wrapper))).toBe(THREE_QUEUE_EMPTIES[0][1])
    expect(queuePane(wrapper).find('.create-on-empty').exists()).toBe(false)
  })

  it('有行的时候根本不渲空态那一句', async () => {
    const wrapper = await mountQueue([QUEUE_ROW], { emptyReason: null, emptyLine: null })

    expect(queuePane(wrapper).find('.empty').exists()).toBe(false)
    expect(wrapper.html()).not.toContain('一条都没有')
  })
})

describe('PublishCenterView 顶部统计卡：那一发没答回来时摆 — 不摆 0', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(articleApi.list).mockReset()
    document.body.innerHTML = ''
  })

  /** 三读口都给一行（不掺入空态），统计两口按用例指定哪一支读失败 */
  async function mountWithStats(queueFails: boolean, recordFails: boolean) {
    vi.mocked(articleApi.list).mockResolvedValue({ records: [CANDIDATE_ROW], total: 1 } as any)
    vi.mocked(publishApi.records).mockResolvedValue({ records: [RECORD_ROW], total: 1 } as any)
    vi.mocked(publishQueueApi.list).mockResolvedValue({ records: [], total: 0 } as any)
    if (queueFails) {
      vi.mocked(publishQueueApi.getStats).mockRejectedValue(new Error('队列统计没答'))
    } else {
      vi.mocked(publishQueueApi.getStats).mockResolvedValue({ pending: 7, publishing: 2, todayPublished: 3, failed: 1 } as any)
    }
    if (recordFails) {
      vi.mocked(publishApi.recordStats).mockRejectedValue(new Error('记录统计没答'))
    } else {
      vi.mocked(publishApi.recordStats).mockResolvedValue({ total: 20, successCount: 18, successRate: 90 } as any)
    }
    const wrapper = mountCenter()
    await flushPromises()
    return wrapper
  }

  const statOf = (wrapper: any, title: string) => {
    const node = wrapper.findAll('.statistic-stub').find((n: any) => n.text().startsWith(`${title}|`))
    if (!node) {
      throw new Error(`找不到标题为「${title}」的统计卡`)
    }
    return node.text()
  }

  it('两口都答回来时按后端给的数念', async () => {
    const wrapper = await mountWithStats(false, false)

    expect(statOf(wrapper, '队列待发布')).toBe('队列待发布|7|')
    expect(statOf(wrapper, '发布记录成功')).toBe('发布记录成功|18|')
    expect(statOf(wrapper, '成功率')).toBe('成功率|90|%')
  })

  it('队列统计那一发读失败时那四张卡摆 —，不摆「查过了，一条都没有」的那个 0', async () => {
    const wrapper = await mountWithStats(true, false)

    for (const title of ['队列待发布', '发布中', '发布失败', '今日队列完成']) {
      expect(statOf(wrapper, title)).toBe(`${title}|—|`)
    }
    // 另一支统计答回来了，不许被连着一起摆 —
    expect(statOf(wrapper, '发布记录成功')).toBe('发布记录成功|18|')
  })

  it('记录统计那一发读失败时只有那两张卡摆 —，成功率连 % 都不摆', async () => {
    const wrapper = await mountWithStats(false, true)

    expect(statOf(wrapper, '发布记录成功')).toBe('发布记录成功|—|')
    expect(statOf(wrapper, '成功率')).toBe('成功率|—|')
    expect(statOf(wrapper, '队列待发布')).toBe('队列待发布|7|')
  })

  /**
   * 现场撞到的第二种：选中那个身份在这张表里读不到（候选那一回答 NOT_VISIBLE）。
   * 统计两口自己答回来了，可它们数的也是那一个读不到的身份，所以六张卡都得摆 `—`。
   */
  async function mountWithCandidateCause(emptyReason: string | null, rows: any[]) {
    vi.mocked(articleApi.list).mockResolvedValue({
      records: rows,
      total: rows.length,
      emptyReason,
      emptyLine: emptyReason ? `可发布的文章：成因 ${emptyReason}` : null,
    } as any)
    vi.mocked(publishApi.records).mockResolvedValue({ records: rows, total: rows.length } as any)
    vi.mocked(publishQueueApi.list).mockResolvedValue({ records: [], total: 0 } as any)
    vi.mocked(publishQueueApi.getStats).mockResolvedValue({ pending: 7, publishing: 2, todayPublished: 3, failed: 1 } as any)
    vi.mocked(publishApi.recordStats).mockResolvedValue({ total: 20, successCount: 18, successRate: 90 } as any)
    const wrapper = mountCenter()
    await flushPromises()
    return wrapper
  }

  it('候选那一回答「读不到」时六张统计卡全摆 —，不许停在 0 上', async () => {
    const wrapper = await mountWithCandidateCause('NOT_VISIBLE', [])

    for (const title of ['队列待发布', '发布中', '发布失败', '今日队列完成', '发布记录成功', '成功率']) {
      expect(statOf(wrapper, title)).toContain('|—|')
    }
  })

  it('候选那一回答「真的没有」时统计照旧摆数：只有读不到才摆 —', async () => {
    const wrapper = await mountWithCandidateCause('NONE', [])

    expect(statOf(wrapper, '队列待发布')).toBe('队列待发布|7|')
    expect(statOf(wrapper, '成功率')).toBe('成功率|90|%')
  })
})
