import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { h } from 'vue'
import AlertRuleManageView from '../AlertRuleManageView.vue'
import { alertApi } from '../../../api/workspace'
import { message } from 'ant-design-vue'

/**
 * 报警规则屏的四张统计卡（M-P104）：每页只回 10 行，
 * 原来「规则总数」拿本页行数冒充，后端一共 37 条时也念 10（或这页几条就念几条）。
 *
 * 钉两件：
 * 1. 规则总数认后端 paged 回的 total，不数本页行；
 * 2. 另外三张只数本页摆出来的行，卡片标题写明「本页」。
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
    rules: {
      list: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      toggleActive: vi.fn()
    }
  }
}))

vi.mock('../../../stores/auth', () => ({
  useAuthStore: () => ({
    selectedTenantId: null,
    tenantId: null,
    user: { id: 1 },
    isSuperAdmin: true,
    hasPermission: () => true
  })
}))

const PASS_THROUGH = (name: string, tag = 'div') => ({
  name,
  template: `<${tag} class="${name.toLowerCase()}-stub"><slot /><slot name="title" /><slot name="actions" /><slot name="extra" /></${tag}>`
})

const FIELD_STUB = (name: string, tag = 'input') => ({
  name,
  template: `<${tag} class="${name.toLowerCase()}-stub"></${tag}>`
})

const STATISTIC_STUB = {
  name: 'AStatistic',
  props: {
    title: { type: String, default: '' },
    value: { type: [Number, String], default: '' }
  },
  setup(props: any) {
    return () => h('div', { class: 'statistic-stub', 'data-title': props.title }, String(props.value ?? ''))
  }
}

const TABLE_STUB = {
  name: 'ATable',
  props: {
    dataSource: { type: Array, default: () => [] },
    columns: { type: Array, default: () => [] },
    loading: { type: Boolean, default: false },
    pagination: { type: [Object, Boolean], default: () => ({}) },
    rowKey: { type: [String, Function], default: 'id' },
    scroll: { type: Object, default: null }
  },
  setup(props: any, { slots }: any) {
    return () => {
      const rows = (props.dataSource || []) as any[]
      return h('div', { class: 'table-stub' }, [
        rows.length === 0
          ? h('div', { class: 'table-empty' }, slots.emptyText ? slots.emptyText({}) : [])
          : rows.map((record) => h('div', { class: 'row', 'data-row': record.id }, String(record.id)))
      ])
    }
  }
}

const MODAL_STUB = {
  name: 'AModal',
  props: {
    open: { type: Boolean, default: false },
    title: { type: String, default: '' }
  },
  template: '<div class="amodal-stub" :data-open="String(open)"><slot /></div>'
}

const ROWS = [
  { id: 1, name: '严重且启用', triggerType: 'api_error', severity: 'critical', channels: 'in_app', receivers: '', isActive: 1, createdAt: '2026-10-20T00:00:00' },
  { id: 2, name: '中危且停用', triggerType: 'exception', severity: 'medium', channels: 'in_app', receivers: '', isActive: 0, createdAt: '2026-10-20T00:00:00' },
  { id: 3, name: '高危且启用', triggerType: 'custom', severity: 'high', channels: 'in_app', receivers: '', isActive: 1, createdAt: '2026-10-20T00:00:00' }
]

async function mountView(records: any[], total: number) {
  vi.mocked(alertApi.rules.list).mockResolvedValue({
    records,
    total,
    page: 1,
    size: 10,
    pages: Math.ceil(total / 10)
  } as any)

  const wrapper = mount(AlertRuleManageView, {
    global: {
      stubs: {
        'a-card': PASS_THROUGH('ACard'),
        'a-row': PASS_THROUGH('ARow'),
        'a-col': PASS_THROUGH('ACol'),
        'a-space': PASS_THROUGH('ASpace'),
        'a-form': PASS_THROUGH('AForm'),
        'a-form-item': PASS_THROUGH('AFormItem'),
        'a-modal': MODAL_STUB,
        'a-popconfirm': PASS_THROUGH('APopconfirm'),
        'a-switch': PASS_THROUGH('ASwitch'),
        'a-tag': { name: 'ATag', template: '<span class="tag-stub"><slot /></span>' },
        'a-alert': {
          name: 'AAlert',
          props: ['message', 'description', 'type', 'showIcon'],
          template: '<div class="alert-stub">{{ message }} {{ description }}</div>'
        },
        'a-select': PASS_THROUGH('ASelect'),
        'a-select-option': { name: 'ASelectOption', props: ['value'], template: '<option :value="value"><slot /></option>' },
        'a-input': FIELD_STUB('AInput'),
        'a-textarea': FIELD_STUB('ATextarea', 'textarea'),
        'a-button': { name: 'AButton', template: '<button class="button-stub"><slot /></button>' },
        'a-statistic': STATISTIC_STUB,
        'a-table': TABLE_STUB,
        'empty-list-hint': {
          name: 'EmptyListHint',
          props: ['loading', 'readFailed', 'emptyLine', 'emptyReason'],
          template: '<div class="empty-line-stub">{{ emptyLine }}</div>'
        }
      }
    }
  })
  await flushPromises()
  return wrapper
}

const statValues = (wrapper: any) =>
  Object.fromEntries(
    wrapper.findAll('.statistic-stub').map((node: any) => [node.attributes('data-title'), (node.text() || '').trim()])
  )

describe('AlertRuleManageView 的四张统计卡', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('规则总数认后端 total（37），不数本页这 3 行', async () => {
    const wrapper = await mountView(ROWS, 37)

    expect(statValues(wrapper)).toEqual({
      规则总数: '37',
      本页启用: '2',
      本页高危: '1',
      本页中危: '1'
    })
  })

  it('本页那三张只数摆出来的行，标题写明「本页」', async () => {
    const wrapper = await mountView(ROWS.slice(0, 1), 37)

    expect(statValues(wrapper)).toEqual({
      规则总数: '37',
      本页启用: '1',
      本页高危: '1',
      本页中危: '0'
    })
  })

  it('后端回 0 条时规则总数才是 0', async () => {
    const wrapper = await mountView([], 0)

    expect(statValues(wrapper)).toEqual({
      规则总数: '0',
      本页启用: '0',
      本页高危: '0',
      本页中危: '0'
    })
  })
})

/**
 * 平台档（超管没选客户）：这一页读得没问题，是所有客户的规则混在一起；
 * 但「新增」没有落脚的归属，后端会拒，界面得先拦住并说清去哪儿选客户。
 */
describe('平台档（超管没选客户）', () => {
  const PLATFORM_ROWS = [
    { ...ROWS[0], tenantLabel: '演示客户甲' },
    { ...ROWS[1], tenantLabel: '未知客户 #2' }
  ]

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('这一页照读，摆出常驻说明与每一行的归属', async () => {
    const wrapper = await mountView(PLATFORM_ROWS, 2)

    expect(wrapper.text()).toContain('当前没有选定客户')
    expect(wrapper.text()).toContain('新增规则要先在右上角选一家客户')
    expect(wrapper.findComponent({ name: 'ATable' }).props('columns')).toContainEqual(
      expect.objectContaining({ title: '归属', dataIndex: 'tenantLabel' })
    )
  })

  it('点新增先拦住：不弹窗、不发请求，并说清去哪儿选客户', async () => {
    const wrapper = await mountView(PLATFORM_ROWS, 2)

    const addButton = wrapper
      .findAll('button')
      .find((node: any) => node.text().replace(/\s/g, '').includes('新增规则'))
    expect(addButton).toBeTruthy()
    await addButton!.trigger('click')
    await flushPromises()

    expect(message.warning).toHaveBeenCalledWith('当前没有选定客户，新增规则没有归属：请先在右上角选一家客户')
    expect(wrapper.find('.amodal-stub').attributes('data-open')).toBe('false')
    expect(alertApi.rules.create).not.toHaveBeenCalled()
  })
})