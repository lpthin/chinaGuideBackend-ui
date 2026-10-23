import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { h } from 'vue'
import { Button, Col, Descriptions, DescriptionsItem, Form, FormItem, Row, message } from 'ant-design-vue'
import AuditLogView from '../AuditLogView.vue'
import { adminApi } from '../../../api/workspace'
import { JUMP_BACK_NOTICE } from '../../../utils/emptyPage'
import type { AuditLog } from '../../../types/workspace'

/**
 * 审计日志屏的空态（M-P69）：这一屏的空会被读成「这一家没人操作过」，
 * 所以「读不到」与「真的没有」必须念后端那一句，三格统计也不许把 0 冒充成结果。
 *
 * 钉四件：
 * 1. 三种空各念各的，逐字比后端原文，页面上不许出现「暂无数据」；
 * 2. 后端没答成因时界面不替它猜；
 * 3. 读失败说的是读失败，不是「这一档没有」；
 * 4. 这一家读不到时，三格统计摆「—」——三个 0 不等于「没有操作」。
 */

vi.mock('ant-design-vue', async () => {
  const actual = await vi.importActual<Record<string, any>>('ant-design-vue')
  return {
    ...actual,
    message: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() }
  }
})

vi.mock('../../../api/workspace', () => ({
  adminApi: {
    auditLogs: {
      list: vi.fn(),
      getStats: vi.fn(),
      export: vi.fn()
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

const PASS_THROUGH = (name: string) => ({
  name,
  template: `<div class="${name}-stub"><slot /><slot name="overlay" /></div>`
})

const ROW = {
  id: 41,
  tenantId: 2,
  userId: 1,
  username: 'admin',
  action: 'create',
  resource: 'articles',
  method: 'POST',
  ipAddress: '127.0.0.1',
  responseStatus: '200',
  duration: 12,
  createdAt: '2026-10-24T00:10:00'
} as unknown as AuditLog

type PageShape = { records: AuditLog[]; total: number; emptyReason?: string | null; emptyLine?: string | null }

async function mountView(
  rows: AuditLog[],
  pageExtras: Omit<PageShape, 'records' | 'total'> = {},
  failWith?: Error
) {
  authState.selectedTenantId = null
  const list = vi.mocked(adminApi.auditLogs.list)
  if (failWith) {
    list.mockRejectedValue(failWith)
  } else {
    list.mockResolvedValue({ records: rows, total: rows.length, ...pageExtras } as any)
  }
  vi.mocked(adminApi.auditLogs.getStats).mockResolvedValue({
    total: rows.length,
    todayTotal: 0,
    errorCount: 0
  } as any)

  const wrapper = mount(AuditLogView, {
    attachTo: document.body,
    global: {
      stubs: {
        'a-card': PASS_THROUGH('ACard'),
        'a-space': PASS_THROUGH('ASpace'),
        'a-table': TABLE_STUB,
        'a-statistic': {
          name: 'AStatistic',
          props: ['title', 'value'],
          template: '<div class="stat-stub">{{ title }}{{ value }}</div>'
        },
        'a-range-picker': { name: 'ARangePicker', template: '<div class="range-stub" />' },
        'a-typography-text': { name: 'ATypographyText', template: '<span class="typography-stub"><slot /></span>' },
        'a-descriptions': Descriptions,
        'a-descriptions-item': DescriptionsItem,
        'a-form': Form,
        'a-form-item': FormItem,
        'a-button': Button,
        'a-select': { name: 'ASelect', template: '<select class="select-stub"></select>' },
        'a-select-option': { name: 'ASelectOption', props: ['value'], template: '<option :value="value"><slot /></option>' },
        'a-input': { name: 'AInput', template: '<input class="input-stub" />' },
        'a-tag': { name: 'ATag', template: '<span class="tag-stub"><slot /></span>' },
        'a-drawer': PASS_THROUGH('ADrawer'),
        'a-row': Row,
        'a-col': Col,
        'a-tooltip': PASS_THROUGH('ATooltip')
      }
    }
  })
  await flushPromises()
  return wrapper
}

const emptyText = (wrapper: any) => wrapper.find('.empty').text().trim()

const THREE_EMPTIES: Array<[string, string]> = [
  ['NONE', '审计日志：这一档查过了，一条都没有。'],
  ['NOT_VISIBLE', '审计日志：这一档读不到（选中的那个身份在这张表里没有行），所以这里不能说「没有」。'],
  ['OUT_OF_RANGE', '审计日志：这一页翻过了头，往前面的页翻回来就有；这里没行不等于这一档没有。']
]

describe('AuditLogView 的空态成因', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it.each(THREE_EMPTIES)('后端回 %s 那一档时逐字念那一句，页面上没有「暂无数据」', async (reason, line) => {
    const wrapper = await mountView([], { emptyReason: reason, emptyLine: line })

    expect(emptyText(wrapper)).toBe(line)
    expect(wrapper.html()).not.toContain('暂无数据')
  })

  it('后端没回是哪一种空时念「界面不替它猜」，不蒙成「真的没有」', async () => {
    const wrapper = await mountView([], { emptyReason: null, emptyLine: null })

    expect(emptyText(wrapper)).toContain('后端没回是哪一种空')
    expect(wrapper.html()).not.toContain('暂无数据')
    expect(wrapper.html()).not.toContain('一条都没有')
  })

  it('读失败那一发说的是读失败，不是「这一档没有」', async () => {
    const wrapper = await mountView([], {}, new Error('读口断了'))

    const said = emptyText(wrapper)
    expect(said).toContain('这一发读失败：读口断了')
    expect(said).toContain('读失败不是「这一档没有」')
    expect(said).not.toContain('一条都没有')
  })

  it('这一家读不到时三格统计摆「—」，不把三个 0 当成结果', async () => {
    const wrapper = await mountView([], {
      emptyReason: 'NOT_VISIBLE',
      emptyLine: THREE_EMPTIES[1][1]
    })

    const stats = wrapper.findAll('.stat-stub').map((node) => node.text())
    expect(stats).toHaveLength(3)
    for (const line of stats) {
      expect(line).toContain('—')
      expect(line).not.toContain('0')
    }
  })

  it('后端回「这一页翻过了头」时界面自己翻回第一页再读一遍', async () => {
    const list = vi.mocked(adminApi.auditLogs.list)
    const wrapper = await mountView([ROW], { emptyReason: null, emptyLine: null })
    list
      .mockResolvedValueOnce({ records: [], total: 122, emptyReason: 'OUT_OF_RANGE', emptyLine: THREE_EMPTIES[2][1] } as any)
      .mockResolvedValueOnce({ records: [], total: 0, emptyReason: 'NONE', emptyLine: THREE_EMPTIES[0][1] } as any)

    await wrapper.find('.go-page').trigger('click')
    await flushPromises()

    expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1 }))
    expect(message.info).toHaveBeenCalledWith(JUMP_BACK_NOTICE)
    expect(emptyText(wrapper)).toBe(THREE_EMPTIES[0][1])
  })

  it('有行的时候根本不渲空态那一句，统计照常念数字', async () => {
    const wrapper = await mountView([ROW], { emptyReason: null, emptyLine: null })

    expect(wrapper.find('.empty').exists()).toBe(false)
    expect(wrapper.html()).not.toContain('一条都没有')
    expect(wrapper.findAll('.stat-stub')[0].text()).toContain('1')
  })
})
