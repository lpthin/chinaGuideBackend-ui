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
              // 逐列走真实的 bodyCell 插槽：这一屏要看的是「显示出来的是哪一句」，不是 columns 里写了什么
              h(
                'div',
                { class: 'row', 'data-row': record.id },
                (props.columns as any[]).map((column) =>
                  h(
                    'span',
                    { class: ['cell', `cell-${column.key}`] },
                    slots.bodyCell ? slots.bodyCell({ column, record }) : String(record[column.dataIndex] ?? '')
                  )
                )
              )
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
  // 这一格念的是后端算好的那四档，界面不许拿裸号自己猜名字
  tenantLabel: '安鼎建设',
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

/** 归属为空的行：后端念「平台」（FR-P4-2），界面照念 */
const UNATTRIBUTED_ROW = {
  ...ROW,
  id: 42,
  tenantId: null,
  tenantLabel: '平台'
} as unknown as AuditLog

type PageShape = { records: AuditLog[]; total: number; emptyReason?: string | null; emptyLine?: string | null }

async function mountView(
  rows: AuditLog[],
  pageExtras: Omit<PageShape, 'records' | 'total'> = {},
  failWith?: Error,
  selectedTenantId: number | null = null,
  statsFail?: Error
) {
  authState.selectedTenantId = selectedTenantId
  const list = vi.mocked(adminApi.auditLogs.list)
  if (failWith) {
    list.mockRejectedValue(failWith)
  } else {
    list.mockResolvedValue({ records: rows, total: rows.length, ...pageExtras } as any)
  }
  if (statsFail) {
    vi.mocked(adminApi.auditLogs.getStats).mockRejectedValue(statsFail)
  } else {
    vi.mocked(adminApi.auditLogs.getStats).mockResolvedValue({
      total: rows.length,
      todayTotal: 0,
      errorCount: 0
    } as any)
  }

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
        'a-select': {
          name: 'ASelect',
          props: ['value', 'placeholder'],
          emits: ['update:value'],
          template: '<select class="select-stub"></select>'
        },
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

    // M2：审计页把读失败交给表内错误块（保留旧行 + 顶部提示的那一档），空态不再替它说话
    const said = wrapper.text()
    expect(said).toContain('读口断了')
    expect(said).toContain('重试')
    expect(said).not.toContain('一条都没有')
    expect(wrapper.html()).not.toContain('暂无数据')
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

/**
 * 客户归属那一列与「只看归属未知」那一档（M-P110 拍板 Q-3/Q-4）。
 *
 * 钉五件：
 * 1. 列上念的是后端算好的那四档原文，界面上不再出现裸的客户号，也不出现「客户编号」那一格；
 * 2. 详情抽屉里同一格也念 label，编号只作附注；
 * 3. 选了「只看归属未知」⇒ 那一发只带 `tenantScope=unknown`，不带右上角那个客户号
 *    （两个条件都拼上必然是空集，界面上就成了「明明有一千多行，筛一下就没了」）；
 * 4. 同一档下三格统计摆「—」并说一句为什么——那一口（/stats）认不了这一档；
 * 5. 导出与屏幕同一份筛法。
 */
describe('AuditLogView 的客户归属', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  /** 第一颗下拉＝本批新加的「客户归属」；第二颗才是原有的「操作类型」 */
  const scopeSelect = (wrapper: any) => wrapper.findAllComponents({ name: 'ASelect' })[0]

  const buttonByText = (wrapper: any, text: string) =>
    wrapper.findAll('button').find((node: any) => node.text().includes(text))

  async function pickUnknownScope(wrapper: any) {
    scopeSelect(wrapper).vm.$emit('update:value', 'unknown')
    await flushPromises()
  }

  it('这一列念后端算好的那四档，界面上不摆裸客户号', async () => {
    const wrapper = await mountView([ROW, UNATTRIBUTED_ROW], { emptyReason: null, emptyLine: null })

    const cells = wrapper.findAll('.cell-tenantLabel').map((node) => node.text().trim())
    expect(cells).toEqual(['安鼎建设', '平台'])
    expect(wrapper.html()).not.toContain('客户编号')
  })

  it('详情抽屉里同一格也念那一句，编号只作附注', async () => {
    const wrapper = await mountView([ROW], { emptyReason: null, emptyLine: null })

    await buttonByText(wrapper, '详情')!.trigger('click')
    await flushPromises()

    const drawer = wrapper.find('.ADrawer-stub').text()
    expect(drawer).toContain('客户归属')
    expect(drawer).toContain('安鼎建设（编号 2）')
  })

  it('默认那一档照旧只带右上角选中的客户号', async () => {
    const list = vi.mocked(adminApi.auditLogs.list)

    await mountView([ROW], { emptyReason: null, emptyLine: null }, undefined, 558)

    expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ tenantId: 558 }))
    expect(list.mock.calls[0][0]).not.toHaveProperty('tenantScope')
  })

  it('选了「只看归属未知」⇒ 那一发只带这一档，不再带右上角的客户号', async () => {
    const list = vi.mocked(adminApi.auditLogs.list)
    const wrapper = await mountView([UNATTRIBUTED_ROW], { emptyReason: null, emptyLine: null }, undefined, 558)

    await pickUnknownScope(wrapper)

    const sent = list.mock.calls[list.mock.calls.length - 1][0]
    expect(sent).toMatchObject({ tenantScope: 'unknown', page: 1 })
    expect(sent).not.toHaveProperty('tenantId')
  })

  it('选了「只看归属未知」⇒ 三格统计摆「—」并说一句为什么不摆数', async () => {
    const wrapper = await mountView([UNATTRIBUTED_ROW], { emptyReason: null, emptyLine: null }, undefined, 558)

    await pickUnknownScope(wrapper)

    for (const line of wrapper.findAll('.stat-stub').map((node) => node.text())) {
      expect(line).toContain('—')
      expect(line).not.toContain('0')
    }
    expect(wrapper.find('.stats-note').text()).toContain('认不了「只看归属未知」这一档')
  })

  it('导出认屏幕上这一档，不另拼一份参数', async () => {
    const exportAsCsv = vi.mocked(adminApi.auditLogs.export)
    const wrapper = await mountView([UNATTRIBUTED_ROW], { emptyReason: null, emptyLine: null }, undefined, 558)

    await pickUnknownScope(wrapper)
    await buttonByText(wrapper, '导出')!.trigger('click')

    expect(exportAsCsv).toHaveBeenLastCalledWith(expect.objectContaining({ tenantScope: 'unknown' }))
    expect(exportAsCsv.mock.calls[0][0]).not.toHaveProperty('tenantId')
  })

  it('统计那一口读失败时不摆上一次的数，也不摆 0', async () => {
    const wrapper = await mountView(
      [ROW],
      { emptyReason: null, emptyLine: null },
      undefined,
      null,
      new Error('统计口断了')
    )

    for (const line of wrapper.findAll('.stat-stub').map((node) => node.text())) {
      expect(line).toContain('—')
    }
    expect(wrapper.find('.stats-note').text()).toContain('这一发读失败：统计口断了')
  })
})
