import { describe, it, expect, beforeEach, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { Button } from 'ant-design-vue'
import OrdersView from '../OrdersView.vue'
import { orderApi } from '../../../api/billing'

/**
 * 计费「充值订单」页（M-P91 现场走查量出来的三处）。
 *
 * 1. 详情弹窗「实付金额」读的是 `paidAmount`，后端那一列叫 `actualAmount`，这个键根本不存在，
 *    于是库里实付 200 的行在界面上念「¥0.00」；
 * 2. 「商品名称」这一格没有任何出处（库里这张表没有商品列），每一行都是空白，
 *    看不出是「充值单本来就没有商品」还是「数据没读到」；
 * 3. 四张统计卡以前拿小写去比库里的大写状态代码，比不中，恒为 0。
 * 用例钉这三处，外加「关键词筛选项真发到后端」和「状态按钮发的是库里那一个大写代码」。
 */

vi.mock('../../../api/billing', () => ({
  orderApi: {
    list: vi.fn(),
    get: vi.fn(),
    export: vi.fn()
  }
}))

vi.mock('../../../stores/auth', () => ({
  useAuthStore: () => ({ selectedTenantId: 558, tenantId: 558 })
}))

const PASS_THROUGH = (name: string) => ({
  name,
  props: ['title', 'bordered', 'gutter', 'span', 'label', 'value', 'placeholder', 'size', 'type', 'loading'],
  template: `<div class="${name}-stub"><slot /></div>`
})

const MODAL_STUB = {
  name: 'AModal',
  props: {
    open: { type: Boolean, default: false },
    title: { type: String, default: '' }
  },
  template: `<div class="modal-stub" v-if="open"><span class="modal-title">{{ title }}</span><slot /></div>`
}

const DESCRIPTIONS_ITEM_STUB = {
  name: 'ADescriptionsItem',
  props: {
    label: { type: String, default: '' },
    span: { type: [Number, String], default: 1 }
  },
  template: `<div class="desc-item"><span class="desc-label">{{ label }}</span><span class="desc-value"><slot /></span></div>`
}

const TABLE_STUB = {
  name: 'ATable',
  props: {
    dataSource: { type: Array, default: () => [] },
    columns: { type: Array, default: () => [] },
    pagination: { type: [Object, Boolean], default: false },
    loading: { type: Boolean, default: false },
    scroll: { type: [Object, Boolean], default: false },
    rowKey: { type: Function, default: undefined }
  },
  template: `
    <div class="table-stub">
      <div v-for="record in dataSource" :key="record.id" class="row" :data-id="record.id">
        <template v-for="column in columns" :key="column.key">
          <slot name="bodyCell" :column="column" :record="record" />
        </template>
      </div>
    </div>`
}

/** 后端 GET /api/billing/orders 真回的那一行（键名逐字照抄现场回包） */
function order(id: number, overrides: Record<string, unknown> = {}) {
  return {
    id,
    tenantId: 558,
    orderNo: `RECHARGE179324500${id}`,
    amount: 200,
    actualAmount: 200,
    paymentMethod: 'ALIPAY',
    status: 'PAID',
    paidAt: '2026-10-29T11:36:47',
    transactionId: `TXN2026102911364${id}`,
    remark: null,
    createdAt: '2026-10-29T11:36:47',
    updatedAt: '2026-10-29T11:36:47',
    delFlag: '0',
    ...overrides
  }
}

async function mountView(records: any[] = [order(4)]) {
  vi.mocked(orderApi.list).mockResolvedValue({ records, total: records.length, page: 1, size: 10 } as any)
  const wrapper = mount(OrdersView, {
    attachTo: document.body,
    global: {
      stubs: {
        'a-spin': PASS_THROUGH('ASpin'),
        'a-row': PASS_THROUGH('ARow'),
        'a-col': PASS_THROUGH('ACol'),
        'a-card': PASS_THROUGH('ACard'),
        'a-space': PASS_THROUGH('ASpace'),
        'a-tag': PASS_THROUGH('ATag'),
        'a-radio-group': PASS_THROUGH('ARadioGroup'),
        'a-radio-button': PASS_THROUGH('ARadioButton'),
        'a-input-search': PASS_THROUGH('AInputSearch'),
        'a-descriptions': PASS_THROUGH('ADescriptions'),
        'a-descriptions-item': DESCRIPTIONS_ITEM_STUB,
        'a-button': Button,
        'a-modal': MODAL_STUB,
        'a-table': TABLE_STUB,
        FilterBar: PASS_THROUGH('FilterBar')
      }
    }
  })
  await flushPromises()
  return wrapper
}

function rows(wrapper: any) {
  return wrapper.findAll('.row')
}

function statValues(wrapper: any): string[] {
  return wrapper.findAll('.stat-value').map((node: any) => node.text())
}

function statTitles(wrapper: any): string[] {
  return wrapper.findAll('.stat-title').map((node: any) => node.text())
}

function lastListParams() {
  return vi.mocked(orderApi.list).mock.calls[vi.mocked(orderApi.list).mock.calls.length - 1][0] as any
}

/** 打开详情弹窗：点行尾那个「详情」按钮，让真实的点击走到 showOrderDetail */
async function openDetail(wrapper: any, detail: any) {
  vi.mocked(orderApi.get).mockResolvedValue(detail as any)
  const buttons = wrapper.findAll('button')
  const detailButton = buttons.find((node: any) => node.text() === '详情')
  expect(detailButton, '这一行要有「详情」按钮').toBeTruthy()
  await detailButton!.trigger('click')
  await flushPromises()
  return wrapper.find('.modal-stub')
}

function describedBy(modal: any, label: string): string {
  const item = modal.findAll('.desc-item').find((node: any) => node.find('.desc-label').text() === label)
  return item ? item.find('.desc-value').text() : '<没有这一格>'
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('详情弹窗那几格念的是后端真回的键', () => {
  it('实付金额读 actualAmount：库里实付 180 就念 ¥180.00，不念 ¥0.00', async () => {
    const wrapper = await mountView([order(4, { amount: 200, actualAmount: 180 })])
    const modal = await openDetail(wrapper, order(4, { amount: 200, actualAmount: 180 }))
    expect(describedBy(modal, '实付金额')).toBe('¥180.00')
    expect(describedBy(modal, '订单金额')).toBe('¥200.00')
  })

  it('商品名称没有出处就摆「—」，不许留一格空白让人猜是不是没读到', async () => {
    const wrapper = await mountView([order(4)])
    const modal = await openDetail(wrapper, order(4))
    expect(describedBy(modal, '商品名称')).toBe('—')
    expect(describedBy(modal, '交易流水号')).toBe('TXN20261029113644')
  })

  it('将来后端真带上商品名，这一格照旧念出来', async () => {
    const wrapper = await mountView([order(4)])
    const modal = await openDetail(wrapper, order(4, { productName: '年度套餐' }))
    expect(describedBy(modal, '商品名称')).toBe('年度套餐')
  })
})

describe('列表那一格与四张统计卡', () => {
  it('商品名称列在表里也摆「—」，不再是一片空白', async () => {
    const wrapper = await mountView([order(4)])
    expect(rows(wrapper)[0].text()).toContain('—')
  })

  it('四张卡按库里大写状态真计数（上一版拿小写比对，三张恒为 0）', async () => {
    const wrapper = await mountView([
      order(1, { status: 'PAID' }),
      order(2, { status: 'PENDING' }),
      order(3, { status: 'REFUNDED' })
    ])
    expect(statTitles(wrapper)).toEqual(['全部订单', '待支付', '已支付', '已退款'])
    expect(statValues(wrapper)).toEqual(['3', '1', '1', '1'])
  })
})

describe('筛选栏真落到请求上', () => {
  it('关键词发 keyword，状态按钮发的是库里那一个大写代码', async () => {
    const wrapper = await mountView()
    const search = wrapper.findComponent(PASS_THROUGH('AInputSearch'))
    search.vm.$emit('update:value', 'TXN2026')
    search.vm.$emit('search', 'TXN2026')
    await flushPromises()
    expect(lastListParams()).toMatchObject({ keyword: 'TXN2026', tenantId: 558, page: 1 })

    const group = wrapper.findComponent(PASS_THROUGH('ARadioGroup'))
    group.vm.$emit('update:value', 'PAID')
    group.vm.$emit('change', { target: { value: 'PAID' } })
    await flushPromises()
    expect(lastListParams()).toMatchObject({ status: 'PAID' })
  })

  it('搜索框那句提示说的是后端真搜的两列，不再承诺搜「商品名称」', async () => {
    const wrapper = await mountView()
    const search = wrapper.findComponent(PASS_THROUGH('AInputSearch'))
    expect(search.props('placeholder')).toBe('搜索订单号/流水号')
  })
})
