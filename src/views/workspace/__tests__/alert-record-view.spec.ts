import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { h } from 'vue'
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
 * 这个 stub 把两条渲染路都接上，否则断言只钉得住其中一条。
 */
const TABLE_STUB = {
  name: 'ATable',
  props: {
    dataSource: { type: Array, default: () => [] },
    columns: { type: Array, default: () => [] },
    loading: { type: Boolean, default: false }
  },
  setup(props: any, { slots }: any) {
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
          ...(props.dataSource as any[]).map((record) =>
            h(
              'div',
              { class: 'row', 'data-row': record.id },
              (props.columns as any[]).map((column) =>
                h('span', { class: `cell cell-${column.key}` }, [
                  slots.bodyCell?.({ column, record }),
                  column.customRender
                    ? String(column.customRender({ text: record[column.dataIndex] }) ?? '')
                    : ''
                ])
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

async function mountView(rows: AlertRecord[]) {
  authState.selectedTenantId = null
  vi.mocked(alertApi.records.list).mockResolvedValue({ records: rows, total: rows.length } as any)
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
