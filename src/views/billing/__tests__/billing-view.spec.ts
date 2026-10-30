import { describe, it, expect, beforeEach, vi } from 'vitest'
import { reactive } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { Button, message } from 'ant-design-vue'
import BillingView from '../BillingView.vue'
import { walletApi, packageApi, statsApi, invoiceApi, balanceApi } from '../../../api/billing'
import { JUMP_BACK_NOTICE } from '../../../utils/emptyPage'

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
 *
 * M-P94 又钉四处（同一屏）：
 * 4. 这一屏的账以前算给谁是人猜的——`selectedTenantId || tenantId || 1`：超管还没点租户切换时，
 *    屏上摆的是别家客户的余额、账单和消费，界面一个字不提。现在没选定客户就一发都不发；
 * 5. 「本月消费」那一张卡把读不到摆成 ¥0.00，环比在接口回 null（没有分母）时又被抹成 0 说成持平；
 * 6. 列表按关键词筛剩 1 张、点导出下载下来的却是全部 3 张（导出那一发漏带 keyword）；
 * 7. 日期区间以前根本不发出去（界面选了区间，请求里没有那一格）。
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

/**
 * 登录态里跟这一屏有关的四格（与 `stores/auth.ts` 同形，`reactive` 是为了「中途换客户」那一例：
 * 真 store 是响应式的，普通对象拧不动界面）。
 * 改前这一份 mock 只有 `selectedTenantId`／`tenantId`：那时候界面拿的就是 `tenantId`，
 * 现在界面只认「有没有选定客户」，所以 `isSuperAdmin` 与 `user` 都得摆上，用例才拧得动。
 */
const authMock = reactive<{
  isSuperAdmin: boolean
  selectedTenantId: number | null
  selectedTenantCode: string | null
  user: { tenantId: number } | null
}>({
  isSuperAdmin: true,
  selectedTenantId: 15,
  selectedTenantCode: 'demo-corp',
  user: { tenantId: 15 },
})

vi.mock('../../../stores/auth', () => ({
  useAuthStore: () => authMock
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
      <div v-if="!dataSource.length" class="empty-slot"><slot name="emptyText" /></div>
    </div>`
}

const DRAWER_STUB = {
  name: 'InvoiceDetailDrawer',
  props: ['open', 'invoiceId'],
  template: '<div class="drawer-stub" />'
}

/** 后端 `EmptyResultReasons` 那一句话（`/stats/overview` 现测形状），界面原样念，不抄第二份 */
const OVERVIEW_LINE =
  '费用总览：这一档读不到（选中的那个身份在这张表里没有行），所以这里不能说「没有」。'

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

/**
 * `GET /api/billing/stats/overview` 那一发的形状（`types/billing.ts` 的 `OverviewStats`）。
 * 默认给的是现场实测过的那一形：上月 0.00、本月 1200，后端没有分母所以 `growthRate` 回 null
 * （改前它在这一发里写死 100，界面拿 `|| 0` 又抹成 0，两头都不是真话）。
 */
function overviewRead(overrides: Record<string, unknown> = {}) {
  return {
    todayConsume: 40,
    thisMonthConsume: 1200,
    lastMonthConsume: 0,
    monthAmount: 1200,
    balance: 380,
    growthRate: null,
    tenantUnreadable: false,
    ...overrides,
  }
}

interface Options {
  wallet?: ReturnType<typeof walletRead>
  walletError?: string
  rows?: Array<ReturnType<typeof invoiceRow>>
  /** 账单列表那一发返回的整包（M-P97 起还要带空态那两格：emptyReason / emptyLine） */
  invoice?: Record<string, unknown>
  invoiceError?: string
  overview?: ReturnType<typeof overviewRead>
  overviewError?: string
}

async function mountView(options: Options = {}) {
  const {
    wallet = walletRead(),
    walletError = '',
    rows = [invoiceRow(1)],
    invoice,
    invoiceError = '',
    overview = overviewRead(),
    overviewError = '',
  } = options

  if (walletError) {
    vi.mocked(walletApi.getInfo).mockRejectedValue(new Error(walletError))
  } else {
    vi.mocked(walletApi.getInfo).mockResolvedValue(wallet as any)
  }
  if (overviewError) {
    vi.mocked(statsApi.overview).mockRejectedValue(new Error(overviewError))
  } else {
    vi.mocked(statsApi.overview).mockResolvedValue(overview as any)
  }
  vi.mocked(packageApi.list).mockResolvedValue([
    { id: 11, name: '基础档', originalAmount: 100, discountAmount: 90, bonusAmount: 10, totalAmount: 100, isPopular: false, isRecommended: true },
  ] as any)
  vi.mocked(invoiceApi.list).mockResolvedValue(
    (invoice ?? { records: rows, total: rows.length }) as any
  )
  if (invoiceError) {
    vi.mocked(invoiceApi.list).mockRejectedValue(new Error(invoiceError))
  }
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

/** 按 placeholder 找那个搜索框（`a-input-search`） */
function searchByPlaceholder(wrapper: any, placeholder: string) {
  const node = wrapper.findAllComponents(PASS_THROUGH('AInputSearch')).find((c: any) => c.props('placeholder') === placeholder)
  if (!node) throw new Error(`界面上没有 placeholder 为「${placeholder}」的搜索框`)
  return node
}

/** 日期区间那一格：v-model 走 update:value，@change 才真去取数，两下都要发 */
function pickDateRange(wrapper: any, range: [string, string]) {
  const picker = wrapper.findComponent(PASS_THROUGH('ARangePicker'))
  picker.vm.$emit('update:value', range)
  picker.vm.$emit('change', range, '')
}

beforeEach(() => {
  document.body.innerHTML = ''
  vi.clearAllMocks()
  window.URL.createObjectURL = vi.fn(() => 'blob:mp91')
  window.URL.revokeObjectURL = vi.fn()
  authMock.isSuperAdmin = true
  authMock.selectedTenantId = 15
  authMock.selectedTenantCode = 'demo-corp'
  authMock.user = { tenantId: 15 }
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

  it('筛了关键词再点导出：那一发要带上关键词，不许列表筛完 1 张、文件里给全部 3 张', async () => {
    const wrapper = await mountView()
    searchByPlaceholder(wrapper, '搜索账单号').vm.$emit('update:value', 'MP94')
    await flushPromises()
    clickButton(wrapper, '导出')
    await flushPromises()
    expect(invoiceApi.export).toHaveBeenCalledWith(expect.objectContaining({ keyword: 'MP94' }))
  })
})

describe('这一屏的账算给谁（M-P94）', () => {
  it('屏上写清在看哪一家的账，编号与代码都摆出来', async () => {
    const wrapper = await mountView()
    const line = wrapper.find('[data-testid="scope-line"]').text()
    expect(line).toContain('客户「demo-corp」')
    expect(line).toContain('编号 #15')
    expect(line).toContain('按这一家分开记')
  })

  it('超管还没选定客户：余额、套餐、消费、账单四发一次都不发，屏上也不摆任何一家的数', async () => {
    authMock.selectedTenantId = null

    const wrapper = await mountView()

    expect(wrapper.text()).toContain('还没有选定客户')
    expect(wrapper.find('[data-testid="scope-line"]').text()).toContain('当前没有选定客户')
    expect(walletApi.getInfo).not.toHaveBeenCalled()
    expect(packageApi.list).not.toHaveBeenCalled()
    expect(statsApi.overview).not.toHaveBeenCalled()
    expect(invoiceApi.list).not.toHaveBeenCalled()
    expect(wrapper.findAll('.stat-value')).toHaveLength(0)
  })

  it('租户管理员看登录态里那一家：屏上说「你所在客户」，取数用的就是那一家编号', async () => {
    authMock.isSuperAdmin = false
    authMock.selectedTenantId = null
    authMock.user = { tenantId: 611 }

    const wrapper = await mountView()

    expect(wrapper.find('[data-testid="scope-line"]').text()).toContain('你所在客户（编号 #611）')
    expect(walletApi.getInfo).toHaveBeenCalledWith(611)
    expect(statsApi.overview).toHaveBeenCalledWith(611)
    expect(invoiceApi.list).toHaveBeenCalledWith(expect.objectContaining({ tenantId: 611 }))
  })

  it('中途换客户：重新按那一家取数，屏上摆的不是上一家的数', async () => {
    const wrapper = await mountView()
    expect(statsApi.overview).toHaveBeenCalledWith(15)

    authMock.selectedTenantId = 16
    authMock.selectedTenantCode = 'other-corp'
    await flushPromises()

    expect(statsApi.overview).toHaveBeenCalledWith(16)
    expect(wrapper.find('[data-testid="scope-line"]').text()).toContain('客户「other-corp」')
  })
})

describe('「本月消费」那一格：读不到就说读不到（M-P94）', () => {
  function monthCard(wrapper: any): string {
    return wrapper.find('[data-testid="card-month"]').text()
  }

  function backendReason(wrapper: any): string {
    const node = wrapper.find('[data-testid="backend-reason"]')
    return node.exists() ? node.text() : ''
  }

  it('上月没花钱所以没有分母：念「上月没有消费，比不出涨跌」，不摆 0% 也不摆 +100%', async () => {
    const wrapper = await mountView({ overview: overviewRead({ growthRate: null, lastMonthConsume: 0 }) })
    expect(monthCard(wrapper)).toBe('¥1,200.00')
    expect(wrapper.find('[data-testid="growth-arrow"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="growth-line"]').text()).toBe('上月没有消费，比不出涨跌')
    expect(wrapper.text()).not.toContain('+100%')
    expect(wrapper.text()).not.toContain('0.0%')
  })

  it('后端真给了百分比就照旧画箭头，不藏', async () => {
    const wrapper = await mountView({ overview: overviewRead({ lastMonthConsume: 1000, growthRate: 20 }) })
    expect(wrapper.find('[data-testid="growth-line"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="growth-arrow"]').text()).toBe('+20.0%')
  })

  it('这一家在这库里没有身份：摆 —，成因原样念后端那一句，不说成「这家没花钱」', async () => {
    const wrapper = await mountView({
      overview: overviewRead({
        tenantUnreadable: true,
        thisMonthConsume: 0,
        monthAmount: 0,
        growthRate: null,
        emptyReason: 'NOT_VISIBLE',
        emptyLine: OVERVIEW_LINE,
      })
    })
    expect(monthCard(wrapper)).toBe('—')
    expect(backendReason(wrapper)).toBe(OVERVIEW_LINE)
    expect(wrapper.find('[data-testid="growth-line"]').text()).toBe('这一家读不到，比不出涨跌')
  })

  it('这一发没读到：念「没取到」并带上原因，上一轮的旧数不留着', async () => {
    const wrapper = await mountView({ overviewError: '网关超时' })
    expect(monthCard(wrapper)).toBe('没取到')
    expect(backendReason(wrapper)).toContain('本月消费没取到：网关超时')
    expect(wrapper.find('[data-testid="growth-line"]').text()).toBe('这次没取到，比不出涨跌')
  })

  it('后端回空包（一个字没回）：不许把「没数」读成「这个月没花钱」', async () => {
    const wrapper = await mountView({ overview: null as any })
    expect(monthCard(wrapper)).toBe('没取到')
    expect(backendReason(wrapper)).toContain('后端一个字没回')
  })
})

describe('日期区间以前选了也不发（M-P94）', () => {
  it('挑了区间，列表那一发就带上 startDate/endDate', async () => {
    const wrapper = await mountView()
    vi.mocked(invoiceApi.list).mockClear()

    pickDateRange(wrapper, ['2026-10-01', '2026-10-31'])
    await flushPromises()

    expect(invoiceApi.list).toHaveBeenCalledWith(
      expect.objectContaining({ startDate: '2026-10-01', endDate: '2026-10-31' })
    )
  })

  it('导出的区间跟列表是同一份条件', async () => {
    const wrapper = await mountView()
    pickDateRange(wrapper, ['2026-10-01', '2026-10-31'])
    await flushPromises()
    clickButton(wrapper, '导出')
    await flushPromises()
    expect(invoiceApi.export).toHaveBeenCalledWith(
      expect.objectContaining({ startDate: '2026-10-01', endDate: '2026-10-31' })
    )
  })
})

/**
 * M-P97：账单表以前三种空回的是同一个四格包（没有成因），读失败时「账单总数」那张卡还被清成 0。
 * 这一组钉的是：四种情形各念各的，卡上的 0 只说「查过了真的没有」。
 */
describe('账单表的四种空各说各的（M-P97）', () => {
  function totalCard(wrapper: any): string {
    return wrapper.find('[data-testid="card-invoice-total"]').text()
  }

  function emptySlot(wrapper: any): string {
    return wrapper.find('.empty-slot').text()
  }

  const NONE_LINE = '账单：这一档查过了，一条都没有。'
  const NOT_VISIBLE_LINE =
    '账单：这一档读不到（选中的那个身份在这张表里没有行），所以这里不能说「没有」。'
  const OUT_OF_RANGE_LINE =
    '账单：这一页翻过了头，往前面的页翻回来就有；这里没行不等于这一档没有。'

  it('整档真没有：卡念 0，空态念后端那句「查过了，一条都没有」', async () => {
    const wrapper = await mountView({
      invoice: { records: [], total: 0, page: 1, size: 10, pages: 0, emptyReason: 'NONE', emptyLine: NONE_LINE }
    })
    expect(totalCard(wrapper)).toBe('0')
    expect(emptySlot(wrapper)).toContain(NONE_LINE)
    expect(emptySlot(wrapper)).not.toContain('读失败')
  })

  it('选中的那一家读不到：卡摆 —，原话照念，不摆 0 也不说成「没有」', async () => {
    const wrapper = await mountView({
      invoice: {
        records: [], total: 0, page: 1, size: 10, pages: 0,
        emptyReason: 'NOT_VISIBLE', emptyLine: NOT_VISIBLE_LINE
      }
    })
    expect(totalCard(wrapper)).toBe('—')
    expect(emptySlot(wrapper)).toContain(NOT_VISIBLE_LINE)
  })

  it('这一页翻过了头：自动翻回第一页再读一发，屏上不把「翻过头」当空态念', async () => {
    const wrapper = await mountView()

    vi.mocked(invoiceApi.list).mockResolvedValueOnce({
      records: [], total: 47, page: 2, size: 10, pages: 5,
      emptyReason: 'OUT_OF_RANGE', emptyLine: OUT_OF_RANGE_LINE
    } as any)
    vi.mocked(invoiceApi.list).mockResolvedValueOnce({
      records: [invoiceRow(2)], total: 47, page: 1, size: 10, pages: 5,
      emptyReason: null, emptyLine: ''
    } as any)

    const pager = wrapper.findComponent(TABLE_STUB).props('pagination') as any
    pager.onChange(2, 10)
    await flushPromises()
    await flushPromises()

    const pages = vi.mocked(invoiceApi.list).mock.calls.map(([params]) => (params as any).page)
    expect(pages).toEqual([1, 2, 1])
    expect(message.info).toHaveBeenCalledWith(JUMP_BACK_NOTICE)
    expect(wrapper.findAll('.row')).toHaveLength(1)
    expect(totalCard(wrapper)).toBe('47')
    expect(wrapper.text()).not.toContain('翻过了头')
  })

  it('读失败：卡念「没取到」，空态说清读失败不是「这一档没有」', async () => {
    const wrapper = await mountView({ invoiceError: '网关超时' })
    expect(totalCard(wrapper)).toBe('没取到')
    expect(emptySlot(wrapper)).toContain('这一发读失败：网关超时')
    expect(emptySlot(wrapper)).toContain('读失败不是「这一档没有」')
  })

  it('后端只回了旧四格（没答成因）：兜底那句不替它挑一种空', async () => {
    const wrapper = await mountView({
      invoice: { records: [], total: 0, page: 1, size: 10 }
    })
    expect(totalCard(wrapper)).toBe('0')
    expect(emptySlot(wrapper)).toContain('后端没回是哪一种空，界面不替它猜')
  })
})
