import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { h } from 'vue'
import { Button, Col, Form, FormItem, Row, Tabs, message } from 'ant-design-vue'
import PublishCenterView from '../PublishCenterView.vue'
import { articleApi, publishApi, publishQueueApi } from '../../../api/workspace'
import { JUMP_BACK_NOTICE } from '../../../utils/emptyPage'

/**
 * 发布中心「发布记录」页签的空态（M-P74）：这一屏的空会被读成「这一家没发过东西」，
 * 所以「读不到」与「真的没有」必须念后端那一句；这一屏没有新建发布记录这个动作
 * （记录是发布动作产生的），所以「真的没有」那一档也不许摆新建按钮。
 *
 * 钉五件：
 * 1. 三种空各念各的，逐字比后端原文，页面上不许出现「暂无发布记录」「暂无数据」；
 * 2. 后端没答成因时界面不替它猜；
 * 3. 读失败说的是读失败，不是「这一档没有」；
 * 4. 后端回「这一页翻过了头」时界面自己翻回第一页再读一遍；
 * 5. 「真的没有」那一档下面不摆新建按钮（这一屏本来就没这个动作）。
 *
 * 那张表格在 a-tabs 的页签里，所以切页签走的是真实页签控件，不是直接改 activeKey。
 */

/**
 * 真实 Tabs 内部用 ResizeObserver 量页签宽度；全局 setup 里那个 `vi.fn()` 桩在 `new` 之下会炸
 * （vitest 的 mock 实现是箭头函数，构造调用直接被拒）。而 resize-observer-polyfill 是在
 * 「模块加载那一刻」就把全局那一个抓走的，所以这一份必须靠 vi.hoisted 顶到 import 之前。
 */
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
  return { ...actual, useRouter: () => ({ push: vi.fn() }) }
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
  vi.mocked(publishQueueApi.list).mockResolvedValue({ records: [], total: 0 } as any)
  vi.mocked(publishQueueApi.getStats).mockResolvedValue({ pending: 0, publishing: 0, todayPublished: 0, failed: 0 } as any)
  vi.mocked(publishApi.recordStats).mockResolvedValue({ total: 0, successCount: 0, successRate: 0 } as any)

  const wrapper = mount(PublishCenterView, {
    attachTo: document.body,
    global: {
      stubs: {
        // 页签走真实控件：切到「发布记录」必须点真页签，页签里的内容才是真被渲染出来的
        'a-tabs': Tabs,
        'a-tab-pane': (Tabs as any).TabPane,
        'a-card': PASS_THROUGH('ACard'),
        'a-space': PASS_THROUGH('ASpace'),
        'a-table': TABLE_STUB,
        'a-statistic': { name: 'AStatistic', template: '<div class="statistic-stub"></div>' },
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
        'a-rate': { name: 'ARate', template: '<span class="rate-stub"></span>' },
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
  })
  await flushPromises()
  await clickRecordsTab(wrapper)
  return wrapper
}

/** 点真实的「发布记录」页签：切页签这一步不许绕过控件 */
async function clickRecordsTab(wrapper: any) {
  const tab = wrapper.findAll('[role="tab"]').find((node: any) => node.text() === '发布记录')
  if (!tab) {
    throw new Error('找不到文案为「发布记录」的页签按钮')
  }
  await tab.trigger('click')
  await flushPromises()
}

/** 三个页签的表都在 DOM 里（切走的只是被藏起来），所以比稿只比「发布记录」那一格 */
const recordsPane = (wrapper: any) => {
  const pane = wrapper
    .findAll('[role="tabpanel"]')
    .find((node: any) => String(node.attributes('id') || '').endsWith('-panel-records'))
  if (!pane) {
    throw new Error('找不到「发布记录」那一格面板')
  }
  return pane
}

/** 后端那一句（这一屏没有新建动作，那一句下面本来就不该多摆按钮，摘掉只是防手滑） */
const hintText = (wrapper: any) => {
  const node = recordsPane(wrapper).find('.empty-line').element.cloneNode(true) as HTMLElement
  node.querySelectorAll('.create-on-empty').forEach((button) => button.remove())
  return (node.textContent || '').trim()
}

const THREE_EMPTIES: Array<[string, string]> = [
  ['NONE', '发布记录：这一档查过了，一条都没有。'],
  ['NOT_VISIBLE', '发布记录：这一档读不到（选中的那个身份在这张表里没有行），所以这里不能说「没有」。'],
  ['OUT_OF_RANGE', '发布记录：这一页翻过了头，往前面的页翻回来就有；这里没行不等于这一档没有。']
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

    expect(hintText(wrapper)).toBe(line)
    expect(wrapper.html()).not.toContain('暂无发布记录')
    expect(wrapper.html()).not.toContain('暂无数据')
  })

  it('后端没回是哪一种空时念「界面不替它猜」，不蒙成「一条都没有」', async () => {
    const wrapper = await mountView([], { emptyReason: null, emptyLine: null })

    expect(hintText(wrapper)).toContain('后端没回是哪一种空')
    expect(wrapper.html()).not.toContain('暂无发布记录')
    expect(wrapper.html()).not.toContain('一条都没有')
  })

  it('读失败那一发说的是读失败，不是「这一档没有」', async () => {
    const wrapper = await mountView([], {}, new Error('读口断了'))

    const said = hintText(wrapper)
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
    expect(hintText(wrapper)).toBe(THREE_EMPTIES[0][1])
  })

  it('「真的没有」那一档也不摆新建按钮：这一屏没有「新建发布记录」这个动作', async () => {
    const wrapper = await mountView([], { emptyReason: 'NONE', emptyLine: THREE_EMPTIES[0][1] })

    expect(hintText(wrapper)).toBe(THREE_EMPTIES[0][1])
    expect(wrapper.find('.create-on-empty').exists()).toBe(false)
  })

  it('有行的时候根本不渲空态那一句', async () => {
    const wrapper = await mountView([RECORD_ROW], { emptyReason: null, emptyLine: null })

    expect(recordsPane(wrapper).find('.empty').exists()).toBe(false)
    expect(wrapper.html()).not.toContain('一条都没有')
  })
})
