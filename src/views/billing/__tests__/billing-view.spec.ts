import { describe, it, expect, beforeEach, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { Button, message } from 'ant-design-vue'
import BillingView from '../BillingView.vue'
import { walletApi, packageApi, statsApi, invoiceApi, balanceApi } from '../../../api/billing'

/**
 * 超管计费「费用」页（M-P91 拍板 2 与 4）。
 *
 * 这一屏原来有三处会被人看错：
 * 1. 第四张卡摆「可用额度 ¥50,000.00」——后端那一格是写死的，库里 `billing_wallet` 没有 credit_limit 这一列；
 *    库里真有的 `frozen_balance`、`available_balance` 反倒没人读，读失败时还把上一轮的旧数字继续摆着；
 * 2. 充值弹窗一打开就默认选中「支付宝」，点的人容易看都没看就提交；
 *    支付方式在库里是大写代码（ALIPAY），界面拿小写去比，列表那一格念不出来；
 * 3. 「导出」那一发后端要是回了 JSON（错误包），界面照样念「导出成功」。
 * 用例钉这三处，外加「这家还没有钱包」与「这一发没读到」分两句说、提现不许在余额没读到时硬提。
 */

vi.mock('ant-design-vue', async () => {
  const actual = await vi.importActual<Record<string, any>>('ant-design-vue')
  return {
    ...actual,
    message: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() }
  }
})

vi.mock('../../../api/billing', () => ({
  walletApi: { getInfo: vi.fn(), recharge: vi.fn() },
  packageApi: { list: vi.fn() },
  statsApi: { overview: vi.fn() },
  invoiceApi: { list: vi.fn(), export: vi.fn(), pay: vi.fn() },
  balanceApi: { withdraw: vi.fn() }
}))

vi.mock('../../../stores/auth', () => ({
  useAuthStore: () => ({ selectedTenantId: 15, tenantId: 15 })
}))

const PASS_THROUGH = (name: string) => ({
  name,
  props: ['title', 'bordered', 'gutter', 'span', 'value', 'placeholder', 'allowClear', 'enterButton', 'modelValue', 'max', 'min'],
  template: `<div class="${name}-stub"><slot /></div>`
})

/** 真弹窗：把默认槽渲出来，并给一个「确定」把手，点了就发 ok（与 antd 的 onOk 同形） */
const MODAL_STUB = {
  name: 'AModal',
  props: {
    open: { type: Boolean, default: false },
    title: { type: String, default: '' }
  },
  emits: ['ok', 'update:open'],
  template: `<div class="modal-stub" v-if="open"><span class="modal-title">{{ title }}</span><slot /><button class="modal-ok" @click="$emit('ok')">确定</button></div>`
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

const DRAWER_STUB = {
  name: 'InvoiceDetailDrawer',
  props: ['open', 'invoiceId'],
  template: '<div class="drawer-stub" />'
}

function walletRead(overrides: Record<string, unknown> = {}) {
  return {
    walletState: 'ACTIVE',
    balance: 380,
    availableBalance: 300,
    frozenBalance: 80,
    totalRecharge: 1000,
    // 上一版后端把这一格写死成 50000.00，库里没有这一列；留着是为了钉「界面不念它」
    creditLimit: 50000,
    ...overrides
  }
}

function invoiceRow(id: number, overrides: Record<string, unknown> = {}) {
  return {
    id,
    tenantId: 15,
    invoiceNo: `INV-MP91-${id}`,
    title: '内容管理服务',
    amount: 999,
    // 后端 BillingInvoiceController 读口把库里状态折成小写回给界面，这里照现场形状写
    status: 'pending',
    billingCycle: 'month',
    dueDate: '2026-11-30',
    paymentMethod: 'ALIPAY',
    createdAt: '2026-10-20T09:00:00',
    ...overrides
  }
}

interface Options {
  wallet?: ReturnType<typeof walletRead>
  walletError?: string
  rows?: Array<ReturnType<typeof invoiceRow>>
}

async function mountView(options: Options = {}) {
  const { wallet = walletRead(), walletError = '', rows = [invoiceRow(1)] } = options

  if (walletError) {
    vi.mocked(walletApi.getInfo).mockRejectedValue(new Error(walletError))
  } else {
    vi.mocked(walletApi.getInfo).mockResolvedValue(wallet as any)
  }
  vi.mocked(packageApi.list).mockResolvedValue([
    { id: 11, name: '基础档', originalAmount: 100, discountAmount: 90, bonusAmount: 10, totalAmount: 100, isPopular: false, isRecommended: true },
  ] as any)
  vi.mocked(statsApi.overview).mockResolvedValue({ thisMonthConsume: 1200, lastMonthConsume: 0 } as any)
  vi.mocked(invoiceApi.list).mockResolvedValue({ records: rows, total: rows.length } as any)
  vi.mocked(invoiceApi.export).mockResolvedValue({ type: 'application/json', text: async () => '{"success":true}' } as any)
  vi.mocked(invoiceApi.pay).mockResolvedValue({} as any)
  vi.mocked(balanceApi.withdraw).mockResolvedValue({} as any)
  vi.mocked(walletApi.recharge).mockResolvedValue({} as any)

  const wrapper = mount(BillingView, {
    attachTo: document.body,
    global: {
      stubs: {
        'a-spin': PASS_THROUGH('ASpin'),
        'a-row': PASS_THROUGH('ARow'),
        'a-col': PASS_THROUGH('ACol'),
        'a-card': PASS_THROUGH('ACard'),
        'a-space': PASS_THROUGH('ASpace'),
        'a-tag': PASS_THROUGH('ATag'),
        'a-input-search': PASS_THROUGH('AInputSearch'),
        'a-select': PASS_THROUGH('ASelect'),
        'a-select-option': PASS_THROUGH('ASelectOption'),
        'a-range-picker': PASS_THROUGH('ARangePicker'),
        'a-input-number': PASS_THROUGH('AInputNumber'),
        'a-radio-group': PASS_THROUGH('ARadioGroup'),
        'a-radio': PASS_THROUGH('ARadio'),
        'a-form': PASS_THROUGH('AForm'),
        'a-form-item': PASS_THROUGH('AFormItem'),
        'a-alert': PASS_THROUGH('AAlert'),
        'a-button': Button,
        'a-modal': MODAL_STUB,
        'a-table': TABLE_STUB,
        InvoiceDetailDrawer: DRAWER_STUB,
      }
    }
  })
  await flushPromises()
  return wrapper
}

/**
 * 按标签找按钮。
 * antd 的默认按钮会把两个中文字中间插一个空格（「导出」在 DOM 里念作「导 出」），
 * 比对前先把空白抹掉，不然点不到。
 */
function findButton(wrapper: any, label: string) {
  return wrapper
    .findAll('button')
    .find((node: any) => node.text().replace(/\s+/g, '').includes(label))
}

function clickButton(wrapper: any, label: string) {
  const button = findButton(wrapper, label)
  if (!button) {
    throw new Error(
      `界面上没有写着「${label}」的按钮，现有的：${wrapper.findAll('button').map((node: any) => node.text()).join('|')}`
    )
  }
  button.element.dispatchEvent(new MouseEvent('click', { bubbles: true }))
}

function stats(wrapper: any): string[] {
  return wrapper.findAll('.stat-value').map((node: any) => node.text())
}

function statTitles(wrapper: any): string[] {
  return wrapper.findAll('.stat-title').map((node: any) => node.text())
}

function notice(wrapper: any): string {
  return wrapper.find('.AAlert-stub').attributes('message') ?? ''
}

function selectByPlaceholder(wrapper: any, placeholder: string) {
  const select = wrapper.findAllComponents(PASS_THROUGH('ASelect')).find((node: any) => node.props('placeholder') === placeholder)
  if (!select) throw new Error(`界面上没有 placeholder 为「${placeholder}」的下拉`)
  return select
}

beforeEach(() => {
  document.body.innerHTML = ''
  vi.clearAllMocks()
  window.URL.createObjectURL = vi.fn(() => 'blob:mp91')
  window.URL.revokeObjectURL = vi.fn()
})

describe('那两张钱卡读的是库里真有的列', () => {
  it('第一张读 available_balance、第四张读 frozen_balance，页面上再没有那个写死的 50,000.00', async () => {
    const wrapper = await mountView({ wallet: walletRead({ availableBalance: 300, frozenBalance: 80, creditLimit: 50000 }) })
    expect(stats(wrapper)).toEqual(['¥300.00', '1', '¥1,200.00', '¥80.00'])
    expect(wrapper.text()).not.toContain('50,000.00')
    expect(wrapper.text()).not.toContain('信用额度')
  })

  it('这家还没有钱包（后端回 walletState=NONE）：两张卡摆 —，那句说的是「还没有」', async () => {
    const wrapper = await mountView({
      wallet: walletRead({ walletState: 'NONE', balance: null, availableBalance: null, frozenBalance: null })
    })
    expect(stats(wrapper)[0]).toBe('—')
    expect(stats(wrapper)[3]).toBe('—')
    expect(notice(wrapper)).toContain('这家还没有钱包')
    expect(notice(wrapper)).not.toContain('没读到')
  })

  it('钱包那一发读失败：两张卡念「没取到」并带上原因，不把上一轮的旧数字继续摆着', async () => {
    const wrapper = await mountView({ walletError: '网关超时' })
    expect(stats(wrapper)[0]).toBe('没取到')
    expect(stats(wrapper)[3]).toBe('没取到')
    expect(notice(wrapper)).toContain('钱包没读到：网关超时')
  })

  it('余额没读到时点提现：先把人拦住，不发那一发', async () => {
    const wrapper = await mountView({ walletError: '网关超时' })
    clickButton(wrapper, '提现')
    await flushPromises()
    selectByPlaceholder(wrapper, '请选择提现账户').vm.$emit('update:value', '1')
    clickButton(wrapper, '确定')
    await flushPromises()
    expect(message.warning).toHaveBeenCalledWith('可用余额还没读到，请刷新页面后再提现')
    expect(balanceApi.withdraw).not.toHaveBeenCalled()
  })
})

describe('第二张卡的标题跟着筛选走', () => {
  it('没筛选时念「账单总数」，一筛选就改口成「筛选命中条数」，不把筛出来的数说成总数', async () => {
    const wrapper = await mountView({ rows: [invoiceRow(1), invoiceRow(2)] })
    expect(statTitles(wrapper)[1]).toBe('账单总数')

    const statusSelect = selectByPlaceholder(wrapper, '状态')
    statusSelect.vm.$emit('update:value', 'paid')
    statusSelect.vm.$emit('change', 'paid')
    await flushPromises()

    expect(statTitles(wrapper)[1]).toBe('筛选命中条数')
  })
})

describe('支付方式：库里那一格是大写代码，界面念中文', () => {
  it('列表那一格念「支付宝」，不摆英文代码', async () => {
    const wrapper = await mountView()
    const row = wrapper.find('.row').text()
    expect(row).toContain('支付宝')
    expect(row).not.toContain('ALIPAY')
  })

  it('充值弹窗打开时一种都没选中，没选就点确定不发请求', async () => {
    const wrapper = await mountView()
    clickButton(wrapper, '充值')
    await flushPromises()

    const group = wrapper.findComponent(PASS_THROUGH('ARadioGroup'))
    expect(group.props('value')).toBe('')
    expect(wrapper.findAll('.ARadio-stub').map((node: any) => node.text())).toEqual(['支付宝', '微信支付', '银行转账'])

    clickButton(wrapper, '确定')
    await flushPromises()
    expect(message.error).toHaveBeenCalledWith('请选择支付方式')
    expect(walletApi.recharge).not.toHaveBeenCalled()
  })

  it('点了「银行转账」再确定：发给后端的是库里那种大写代码', async () => {
    const wrapper = await mountView()
    clickButton(wrapper, '充值')
    await flushPromises()
    wrapper.findComponent(PASS_THROUGH('ARadioGroup')).vm.$emit('update:value', 'BANK_TRANSFER')
    clickButton(wrapper, '确定')
    await flushPromises()
    await flushPromises()
    expect(walletApi.recharge).toHaveBeenCalledWith(15, 100, 'BANK_TRANSFER')
    expect(message.success).toHaveBeenCalledWith('充值成功')
  })

  it('账单行上点「支付」：这一发的支付方式是余额支付（BALANCE），不是上一版那句没人认的小写 balance', async () => {
    const wrapper = await mountView()
    clickButton(wrapper, '支付')
    await flushPromises()
    expect(invoiceApi.pay).toHaveBeenCalledWith(1, { paymentMethod: 'BALANCE' })
  })
})

describe('导出那一发：回的不是文件就不许念成功', () => {
  it('后端回 JSON（错误包）时念失败，不许念「导出成功」', async () => {
    const wrapper = await mountView()
    clickButton(wrapper, '导出')
    await flushPromises()
    expect(message.success).not.toHaveBeenCalled()
    expect(message.error).toHaveBeenCalledWith(expect.stringContaining('导出没拿到文件'))
  })

  it('后端回 CSV 时按行数说话', async () => {
    const wrapper = await mountView()
    vi.mocked(invoiceApi.export).mockResolvedValue({
      type: 'text/csv; charset=UTF-8',
      text: async () => '账单号,金额\nINV-1,999\nINV-2,1000\n'
    } as any)
    clickButton(wrapper, '导出')
    await flushPromises()
    await flushPromises()
    expect(message.success).toHaveBeenCalledWith('已导出 2 张账单')
  })

  it('CSV 里只有表头时说明「按这些条件一张都没导出」，不念成导出了两张', async () => {
    const wrapper = await mountView()
    vi.mocked(invoiceApi.export).mockResolvedValue({
      type: 'text/csv',
      text: async () => '账单号,金额\n'
    } as any)
    clickButton(wrapper, '导出')
    await flushPromises()
    await flushPromises()
    expect(message.success).toHaveBeenCalledWith('按这些筛选条件一张都没导出，文件里只有表头')
  })
})
