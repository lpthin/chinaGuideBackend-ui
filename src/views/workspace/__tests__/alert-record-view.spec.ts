import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { Comment, Fragment, h } from 'vue'
import { Button, Col, Descriptions, DescriptionsItem, Form, FormItem, Input, Row, Table, Tag } from 'ant-design-vue'
import AlertRecordView from '../AlertRecordView.vue'
import { alertApi } from '../../../api/workspace'
import type { AlertRecord } from '../../../types/workspace'

/**
 * 报警记录页的「归属」列（M-P11，2026-10-12 拍板「两组都不动，报警口念成平台级」）。
 *
 * 钉三件：
 * 1. **列要真的存在**——从前这一页压根没有归属列，平台级那 8 行和别家那 15 行长得一模一样，
 *    看着像漏了数据，其实一行都不属于任何一家。
 * 2. **名字取后端那一份**——一个租户号只该有一个读法，前端不许自己按 0 猜「平台级」。
 * 3. **后端没给名字时念「-」**——宁可承认不知道，也不许把空着的一格渲染成 undefined 或蒙成某一家。
 */

vi.mock('ant-design-vue', async () => {
  const actual = await vi.importActual<Record<string, any>>('ant-design-vue')
  return {
    ...actual,
    message: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() }
  }
})

vi.mock('../../../api/workspace', () => ({
  alertApi: {
    records: {
      list: vi.fn(),
      getStats: vi.fn(),
      updateStatus: vi.fn()
    }
  }
}))

const authState = {
  selectedTenantId: null as number | null
}

vi.mock('../../../stores/auth', () => ({
  useAuthStore: () => ({
    get selectedTenantId() {
      return authState.selectedTenantId
    },
    isSuperAdmin: true,
    hasPermission: () => true
  })
}))

/**
 * 真 a-table 在这里要的是「每列渲染一次」这件事，不是它的滚动/分页：
 * 归属与触发时间两列走 customRender，级别/状态/操作三列走 bodyCell 插槽，
 * 标题那一列两样都不走（念 dataIndex 原文），三条都接上才钉得住「有行时不渲空态」那一条。
 *
 * M-P50 又接上第三条渲染路：没行的那一格走 emptyText 插槽。
 * 这里刻意在没插槽时渲成 antd 默认那句「暂无数据」——被测页面要是没把这一格接管过来，
 * 下面那几条断言就会读到这句万能词而红。
 */
const TABLE_STUB = {
  name: 'ATable',
  props: {
    dataSource: { type: Array, default: () => [] },
    columns: { type: Array, default: () => [] },
    loading: { type: Boolean, default: false }
  },
  setup(props: any, { slots }: any) {
    /**
     * 真表里这三条路是「顶掉这一格的默认读法」，不是往后追加：
     * bodyCell 这一格真有内容就用它，其次走 customRender，两条都没走才念 dataIndex 原文。
     * 这里写成追加会把「后端没给归属名」那一格渲成 undefined-，测不出真形状；
     * 插槽在 v-if 全不命中时交回来的是三个空 Fragment（不是 undefined），所以要比内容不比长度。
     */
    const isBlank = (node: any): boolean => {
      if (!node) return true
      if (Array.isArray(node)) return node.every(isBlank)
      if (node.type === Comment) return true
      if (node.type === Fragment) return isBlank(node.children)
      return false
    }
    const cellContent = (column: any, record: any) => {
      const slotted = slots.bodyCell?.({ column, record, index: 0 })
      if (!isBlank(slotted)) return slotted
      if (column.customRender) {
        return String(column.customRender({ text: record[column.dataIndex], record, index: 0 }) ?? '')
      }
      return String(record[column.dataIndex] ?? '')
    }
    return () =>
      h(
        'div',
        { class: 'table-stub' },
        [
          h(
            'div',
            { class: 'head' },
            (props.columns as any[]).map((column) =>
              h('span', { class: `head-${column.key}` }, String(column.title ?? ''))
            )
          ),
          ...((props.dataSource as any[]).length === 0
            ? [h('div', { class: 'empty' }, slots.emptyText ? slots.emptyText({}) : '暂无数据')]
            : (props.dataSource as any[]).map((record) =>
              h(
                'div',
                { class: 'row', 'data-row': record.id },
                (props.columns as any[]).map((column) =>
                  h('span', { class: `cell cell-${column.key}` }, [cellContent(column, record)])
                )
              )
            )
          )
        ]
      )
  }
}

const DRAWER_STUB = {
  name: 'ADrawer',
  props: ['open', 'title'],
  template: `<div class="drawer-stub"><span class="drawer-title">{{ title }}</span><slot /></div>`
}

const PASS_THROUGH = (name: string) => ({
  name,
  template: `<div class="${name}-stub"><slot /><slot name="overlay" /></div>`
})

const PLATFORM_ROW = {
  id: 11,
  tenantId: 0,
  tenantLabel: '平台级',
  ruleId: 1,
  title: 'AI 模型外呼失败',
  content: 'embedding 调用连续失败',
  severity: 'critical',
  status: 'pending',
  triggerType: 'api_error',
  requestPath: '/api/admin/knowledge/documents/1/vectorize',
  triggeredAt: '2026-10-12T01:00:00',
  createdAt: '2026-10-12T01:00:00',
  updatedAt: '2026-10-12T01:00:00'
} as unknown as AlertRecord

const TENANT_ROW = {
  ...PLATFORM_ROW,
  id: 12,
  tenantId: 1,
  tenantLabel: 'China Guide'
} as unknown as AlertRecord

const NO_LABEL_ROW = {
  ...PLATFORM_ROW,
  id: 13,
  tenantId: 2,
  tenantLabel: undefined
} as unknown as AlertRecord

/** 后端分页读口的形状：`records`/`total` 之外那两格是 M-P50 接进界面的成因 */
type PageShape = { records: AlertRecord[]; total: number; emptyReason?: string | null; emptyLine?: string | null }

async function mountView(
  rows: AlertRecord[],
  pageExtras: Omit<PageShape, 'records' | 'total'> = {},
  failWith?: Error
) {
  authState.selectedTenantId = null
  const list = vi.mocked(alertApi.records.list)
  if (failWith) {
    list.mockRejectedValue(failWith)
  } else {
    list.mockResolvedValue({ records: rows, total: rows.length, ...pageExtras } as any)
  }
  vi.mocked(alertApi.records.getStats).mockResolvedValue({
    total: rows.length,
    todayCount: 0,
    pendingCount: 0,
    processingCount: 0,
    criticalCount: 0
  } as any)

  const wrapper = mount(AlertRecordView, {
    attachTo: document.body,
    global: {
      stubs: {
        'a-card': PASS_THROUGH('ACard'),
        'a-space': PASS_THROUGH('ASpace'),
        'a-drawer': DRAWER_STUB,
        'a-table': TABLE_STUB,
        'a-statistic': { name: 'AStatistic', props: ['title', 'value'], template: '<div class="stat-stub">{{ title }}{{ value }}</div>' },
        'a-range-picker': { name: 'ARangePicker', template: '<div class="range-stub" />' },
        'a-dropdown': PASS_THROUGH('ADropdown'),
        'a-menu': { name: 'AMenu', template: '<ul class="menu-stub"><slot /></ul>' },
        'a-menu-item': { name: 'AMenuItem', template: '<li class="menu-item-stub"><slot /></li>' },
        'a-typography-text': { name: 'ATypographyText', template: '<span class="typography-stub"><slot /></span>' },
        'a-descriptions': Descriptions,
        'a-descriptions-item': DescriptionsItem,
        'a-form': Form,
        'a-form-item': FormItem,
        'a-button': Button,
        'a-input': Input,
        'a-select': {
          name: 'ASelect',
          props: { value: { type: [String, Number], default: undefined } },
          emits: ['update:value'],
          template: '<select class="select-stub"></select>'
        },
        'a-select-option': { name: 'ASelectOption', props: ['value'], template: '<option :value="value"><slot /></option>' },
        'a-tag': Tag,
        // 全局档把 a-row/a-col 默认 stub 掉了，表单与统计卡都装在里面：不换回真组件会渲成一排空壳
        'a-row': Row,
        'a-col': Col
      }
    }
  })
  await flushPromises()
  return wrapper
}

const cellOf = (wrapper: any, rowId: number, columnKey: string) =>
  wrapper.find(`.row[data-row="${rowId}"] .cell-${columnKey}`).text().trim()

describe('AlertRecordView 的归属列', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('平台级那行念「平台级」而不是空着一格', async () => {
    const wrapper = await mountView([PLATFORM_ROW])

    expect(wrapper.html()).toContain('归属')
    expect(cellOf(wrapper, 11, 'tenantLabel')).toBe('平台级')
  })

  it('挂在某家名下的那行点名那一家，名字取自后端', async () => {
    const wrapper = await mountView([PLATFORM_ROW, TENANT_ROW])

    expect(cellOf(wrapper, 12, 'tenantLabel')).toBe('China Guide')
    expect(alertApi.records.list).toHaveBeenCalledTimes(1)
  })

  it('后端没给归属名时念「-」，不渲染成 undefined 也不蒙成平台级', async () => {
    const wrapper = await mountView([NO_LABEL_ROW])

    expect(cellOf(wrapper, 13, 'tenantLabel')).toBe('-')
  })

  it('详情抽屉第一行摆的就是归属', async () => {
    const wrapper = await mountView([PLATFORM_ROW])

    await wrapper.find('.row[data-row="11"] .cell-actions button').trigger('click')
    await flushPromises()

    const drawer = wrapper.find('.drawer-stub')
    expect(drawer.exists()).toBe(true)
    expect(drawer.text()).toContain('归属')
    expect(drawer.text()).toContain('平台级')
  })
})

/**
 * 空态那一句只认后端（M-P50 拍板 ④：这一屏接的是「哪一种空」，不只是「有没有行」）。
 *
 * 钉四件：
 * 1. **四种空各念各的**——后端那四句整句原文逐字比，界面不许改写，也不许合并成一句万能词
 *    （话术的唯一出处是 `EmptyResultReasons.sentence`，抄第二份就会漂）。
 * 2. **「暂无数据」一处都不许出现**——上面那个 stub 在页面没接管 emptyText 插槽时故意渲成这句，
 *    读到它就说明这一格还是 antd 默认那句。
 * 3. **后端没答这一发时不许蒙**——那两格都是 null 时念的是「界面不替它猜」，不是四句里的任何一句。
 * 4. **读失败不等于「这一档没有」**——失败那一发要说清是读失败了。
 */
const FOUR_EMPTIES: Array<[string, string]> = [
  ['NONE', '报警记录：这一档查过了，一条都没有。'],
  ['NOT_VISIBLE', '报警记录：这一档读不到（选中的那个身份在这张表里没有行），所以这里不能说「没有」。'],
  ['NOT_ANSWERED', '报警记录：后端这一发没回，不是 0，也不是没有。'],
  ['OUT_OF_RANGE', '报警记录：这一页翻过了头，往前面的页翻回来就有；这里没行不等于这一档没有。']
]

const emptyLineText = (wrapper: any) => wrapper.find('.empty').text().trim()

describe('AlertRecordView 的空态成因', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it.each(FOUR_EMPTIES)('后端回 %s 那一档时逐字念那一句，页面上没有「暂无数据」', async (reason, line) => {
    const wrapper = await mountView([], { emptyReason: reason, emptyLine: line })

    expect(emptyLineText(wrapper)).toBe(line)
    expect(wrapper.html()).not.toContain('暂无数据')
  })

  it('那四句是四句：任何一种空都不被另一句顶替', async () => {
    for (const [reason, line] of FOUR_EMPTIES) {
      const wrapper = await mountView([], { emptyReason: reason, emptyLine: line })
      const said = emptyLineText(wrapper)
      expect(said).toBe(line)
      for (const [, other] of FOUR_EMPTIES) {
        if (other !== line) expect(said).not.toBe(other)
      }
      await wrapper.unmount()
    }
  })

  it('后端没回是哪一种空时念「界面不替它猜」，不蒙成「真的没有」', async () => {
    const wrapper = await mountView([], { emptyReason: null, emptyLine: null })

    expect(emptyLineText(wrapper)).toContain('后端没回是哪一种空')
    expect(wrapper.html()).not.toContain('暂无数据')
    expect(wrapper.html()).not.toContain('一条都没有')
  })

  it('读失败那一发说的是读失败，不是「这一档没有」', async () => {
    const wrapper = await mountView([], {}, new Error('读口断了'))

    const said = emptyLineText(wrapper)
    expect(said).toContain('这一发读失败：读口断了')
    expect(said).toContain('读失败不是「这一档没有」')
    expect(said).not.toContain('一条都没有')
    expect(wrapper.html()).not.toContain('暂无数据')
  })

  it('有行的时候根本不渲空态那一句', async () => {
    const wrapper = await mountView([PLATFORM_ROW], { emptyReason: 'NONE', emptyLine: FOUR_EMPTIES[0][1] })

    expect(wrapper.find('.empty').exists()).toBe(false)
    expect(wrapper.html()).not.toContain('一条都没有')
    expect(cellOf(wrapper, 11, 'title')).toBe('AI 模型外呼失败')
  })

  it('每一发先擦掉上一轮的成因：先空后有行不留旧句子', async () => {
    const list = vi.mocked(alertApi.records.list)
    const wrapper = await mountView([], { emptyReason: 'NONE', emptyLine: FOUR_EMPTIES[0][1] })
    expect(emptyLineText(wrapper)).toBe(FOUR_EMPTIES[0][1])

    list.mockResolvedValue({ records: [PLATFORM_ROW], total: 1 } as any)
    // 真实把手：筛选栏那颗「搜索」按钮，不是直接调 fetchRecords
    const searchButton = wrapper.findAll('button').find((btn: any) => btn.text().includes('搜索'))
    expect(searchButton).toBeDefined()
    await searchButton!.trigger('click')
    await flushPromises()

    expect(wrapper.find('.empty').exists()).toBe(false)
    expect(wrapper.html()).not.toContain('一条都没有')
  })
})
