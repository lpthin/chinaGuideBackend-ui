import { describe, it, expect, beforeEach, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { Button, message } from 'ant-design-vue'
import WalletView from '../WalletView.vue'
import { walletApi } from '../../../api/billing'
import { JUMP_BACK_NOTICE } from '../../../utils/emptyPage'

/**
 * 计费「钱包 / 消费明细」页（M-P90）。
 *
 * 这一屏原来有四件事会被人看错：
 * 1. 表格里只有 antd 默认「暂无数据」——「这一档真的没消费过」「这一页翻过了头」「那一家读不到」
 *    「这一发读失败」四种念法长成一个样；
 * 2. 「可用额度」那张卡读的是后端写死的 50000.00（`creditLimit`），库里真有的 `available_balance` 没人读；
 * 3. 类型下拉发的是 recharge/charge/refund 三个小写值，而库里那一列存的是 RECHARGE/CONSUME/REFUND/TRANSFER，
 *    所以选「消费」永远筛不出行，还会被念成「这一档没有」；
 * 4. 「导出明细」后端回的是空 JSON，界面照样念「导出成功」。
 * 用例钉这四处，外加「读失败时四张卡不许念 0」「翻过头自动回第一页」「筛选一变就回第一页」。
 */

vi.mock('ant-design-vue', async () => {
  const actual = await vi.importActual<Record<string, any>>('ant-design-vue')
  return {
    ...actual,
    message: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() }
  }
})

vi.mock('../../../api/billing', () => ({
  walletApi: {
    getInfo: vi.fn(),
    getTransactions: vi.fn(),
    recharge: vi.fn(),
    exportTransactions: vi.fn()
  }
}))

vi.mock('../../../stores/auth', () => ({
  useAuthStore: () => ({ selectedTenantId: 15, tenantId: 15 })
}))

const PASS_THROUGH = (name: string) => ({
  name,
  props: ['title', 'bordered', 'gutter', 'span', 'value', 'placeholder', 'allowClear', 'enterButton', 'modelValue'],
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

/** 真 a-table 在这一页不干活：把 bodyCell 逐行逐列渲出来，emptyText 槽原样渲出来 */
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
      <div v-if="!dataSource.length" class="empty-slot"><slot name="emptyText" /></div>
      <div v-for="record in dataSource" :key="record.id" class="row" :data-id="record.id">
        <template v-for="column in columns" :key="column.key">
          <slot name="bodyCell" :column="column" :record="record" />
        </template>
      </div>
    </div>`
}

function walletRead(overrides: Record<string, unknown> = {}) {
  return {
    // ACTIVE 是后端 BillingWalletController 那一格的真值；这家还没钱包行时回 NONE
    walletState: 'ACTIVE',
    balance: 380,
    totalRecharge: 1000,
    availableBalance: 300,
    frozenBalance: 80,
    // 上一版后端把这一格写死成 50000.00，库里没有这一列；留着是为了钉「界面不念它」
    creditLimit: 50000,
    ...overrides
  }
}

function transaction(id: number, overrides: Record<string, unknown> = {}) {
  return {
    id,
    tenantId: 15,
    transactionNo: `TXN-MP90-${id}`,
    type: 'CONSUME',
    amount: 120,
    balanceAfter: 380,
    description: 'AI 生成文章 3 篇',
    createdAt: '2026-10-25T11:00:00',
    ...overrides
  }
}

interface Options {
  records?: Array<ReturnType<typeof transaction>>
  total?: number
  listError?: string
  walletError?: string
  emptyReason?: string
  emptyLine?: string
  wallet?: ReturnType<typeof walletRead>
}

async function mountView(options: Options = {}) {
  const {
    records = [transaction(1)],
    total = records.length,
    listError = '',
    walletError = '',
    emptyReason,
    emptyLine,
    wallet = walletRead()
  } = options

  if (walletError) {
    vi.mocked(walletApi.getInfo).mockRejectedValueOnce(new Error(walletError))
  } else {
    vi.mocked(walletApi.getInfo).mockResolvedValue(wallet as any)
  }

  if (listError) {
    vi.mocked(walletApi.getTransactions).mockRejectedValueOnce(new Error(listError))
  } else {
    vi.mocked(walletApi.getTransactions).mockResolvedValue({
      records, total, page: 1, size: 10, pages: Math.ceil(total / 10), emptyReason, emptyLine
    } as any)
  }

  const wrapper = mount(WalletView, {
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
        'a-textarea': PASS_THROUGH('ATextarea'),
        'a-alert': PASS_THROUGH('AAlert'),
        'a-form': PASS_THROUGH('AForm'),
        'a-form-item': PASS_THROUGH('AFormItem'),
        'a-button': Button,
        'a-modal': MODAL_STUB,
        'a-table': TABLE_STUB
      }
    }
  })
  await flushPromises()
  return wrapper
}

function stats(wrapper: any): string[] {
  return wrapper.findAll('.stat-value').map((node: any) => node.text())
}

function titles(wrapper: any): string[] {
  return wrapper.findAll('.stat-title').map((node: any) => node.text())
}

function rows(wrapper: any) {
  return wrapper.findAll('.row')
}

function lastListParams() {
  return vi.mocked(walletApi.getTransactions).mock
    .calls[vi.mocked(walletApi.getTransactions).mock.calls.length - 1][0] as any
}

beforeEach(() => {
  document.body.innerHTML = ''
  vi.clearAllMocks()
  // happy-dom 的 createObjectURL 不是这一屏要钉的东西
  window.URL.createObjectURL = vi.fn(() => 'blob:mp90')
  window.URL.revokeObjectURL = vi.fn()
})

describe('四种空各念各的', () => {
  it('打开这一页按登录态的租户取第一页', async () => {
    await mountView()
    expect(walletApi.getInfo).toHaveBeenCalledWith(15)
    expect(lastListParams()).toEqual({ tenantId: 15, page: 1, size: 10 })
  })

  it('读失败：这一格说这一发读失败，四张卡念「没取到」而不是 0', async () => {
    const wrapper = await mountView({ listError: '这个账号没有登录', walletError: '这个账号没有登录' })
    const empty = wrapper.find('.empty-slot')
    expect(empty.text()).toContain('这一发读失败：这个账号没有登录')
    expect(empty.text()).toContain('读失败不是「这一档没有」')
    expect(stats(wrapper)).toEqual(['没取到', '没取到', '没取到', '没取到'])
    expect(rows(wrapper)).toHaveLength(0)
  })

  it('真的没有：逐字念后端那一句，且不摆新建入口（这一屏没有能造出流水行的人手工）', async () => {
    const line = '消费明细：这一档查过了，一条都没有。'
    const wrapper = await mountView({ records: [], total: 0, emptyReason: 'NONE', emptyLine: line })
    expect(wrapper.find('.empty-slot').text()).toContain(line)
    expect(wrapper.find('.empty-slot').find('.create-on-empty').exists()).toBe(false)
  })

  it('选中的那一家读不到：念「读不到」，不念「一条都没有」', async () => {
    const line = '消费明细：这一档读不到（选中的那个身份在这张表里没有行），所以这里不能说「没有」。'
    const wrapper = await mountView({ records: [], total: 0, emptyReason: 'NOT_VISIBLE', emptyLine: line })
    expect(wrapper.find('.empty-slot').text()).toContain(line)
    expect(wrapper.find('.empty-slot').text()).not.toContain('一条都没有')
  })

  it('这一页翻过了头：界面自己翻回第一页再读一遍，并说一句刚做了什么', async () => {
    const wrapper = await mountView({ records: [transaction(1)], total: 47 })
    vi.mocked(walletApi.getTransactions).mockResolvedValueOnce({
      records: [], total: 47, page: 2, size: 10, pages: 5,
      emptyReason: 'OUT_OF_RANGE',
      emptyLine: '消费明细：这一页翻过了头，往前面的页翻回来就有；这里没行不等于这一档没有。'
    } as any)
    vi.mocked(walletApi.getTransactions).mockResolvedValueOnce({
      records: [transaction(2)], total: 47, page: 1, size: 10, pages: 5,
      emptyReason: null, emptyLine: ''
    } as any)

    const pager = wrapper.findComponent(TABLE_STUB).props('pagination') as any
    pager.onChange(2, 10)
    await flushPromises()
    await flushPromises()

    const calls = vi.mocked(walletApi.getTransactions).mock.calls.map(([params]) => (params as any).page)
    expect(calls).toEqual([1, 2, 1])
    expect(message.info).toHaveBeenCalledWith(JUMP_BACK_NOTICE)
    expect(rows(wrapper)).toHaveLength(1)
    expect(wrapper.text()).not.toContain('翻过了头')
  })
})

describe('四张卡读的是库里真有的那些列', () => {
  it('第三张卡读 availableBalance，标题写着「可用余额」，不读后端写死的 creditLimit', async () => {
    const wrapper = await mountView({ wallet: walletRead({ availableBalance: 300, creditLimit: 50000 }) })
    expect(titles(wrapper)).toEqual(['当前余额', '总充值', '可用余额', '冻结金额'])
    expect(stats(wrapper)).toEqual(['¥380.00', '¥1,000.00', '¥300.00', '¥80.00'])
    expect(wrapper.text()).not.toContain('50,000.00')
  })

  it('这家还没有钱包（后端回 walletState=NONE）：四张卡摆 —，下面那句说的是「还没有」', async () => {
    const wrapper = await mountView({
      wallet: walletRead({ walletState: 'NONE', balance: undefined, totalRecharge: undefined, availableBalance: undefined, frozenBalance: undefined })
    })
    expect(stats(wrapper)).toEqual(['—', '—', '—', '—'])
    expect(wrapper.find('.AAlert-stub').attributes('message')).toContain('这家还没有钱包')
    // 「还没有钱包」不等于「读失败」，那一发是打成功的
    expect(wrapper.find('.AAlert-stub').attributes('message')).not.toContain('没读到')
  })

  it('读失败与还没有钱包分两句说：读失败那句要带上失败原因', async () => {
    const wrapper = await mountView({ walletError: '网关超时' })
    const notice = wrapper.find('.AAlert-stub').attributes('message')
    expect(notice).toContain('钱包没读到')
    expect(notice).toContain('网关超时')
  })
})

describe('类型那一格：界面发的值、行里的标签、金额正负号读同一份词表', () => {
  it('下拉里摆的就是库里那四个真值，中文给人看', async () => {
    const wrapper = await mountView()
    const options = wrapper.findAll('.ASelectOption-stub').map((node: any) => node.text())
    expect(options).toEqual(['充值', '消费', '退款', '转账'])
  })

  it('选「消费」往下发的是 CONSUME（上一版发 charge，库里那一列永远对不上）', async () => {
    const wrapper = await mountView()
    const select = wrapper.findComponent(PASS_THROUGH('ASelect'))
    select.vm.$emit('update:value', 'CONSUME')
    select.vm.$emit('change', 'CONSUME')
    await flushPromises()
    expect(lastListParams()).toMatchObject({ type: 'CONSUME', page: 1 })
  })

  it('行里的标签与正负号按同一份词表：消费是红标负号，充值是正号', async () => {
    const wrapper = await mountView({
      records: [transaction(1, { type: 'CONSUME' }), transaction(2, { type: 'RECHARGE' })]
    })
    const text = rows(wrapper).map((node: any) => node.text())
    expect(text[0]).toContain('消费')
    expect(text[0]).toContain('-¥120.00')
    expect(text[1]).toContain('充值')
    expect(text[1]).toContain('+¥120.00')
  })

  it('提现那一行念负号：符号认这一行自己的余额链，不认类型猜的进账', async () => {
    // 现场跑出来的那一形：提现记成 TRANSFER，700 → 580。
    // 改前符号按类型猜（转账=进账），这一行在界面上念成「+¥120.00」，一笔往外走的钱看着像进账。
    const wrapper = await mountView({
      records: [
        transaction(33, { type: 'TRANSFER', balanceBefore: 700, balanceAfter: 580, description: '余额提现出账' }),
        transaction(34, { type: 'TRANSFER', amount: 50, balanceBefore: 580, balanceAfter: 630, description: '收到租户 558 的转账' })
      ]
    })
    const text = rows(wrapper).map((node: any) => node.text())
    expect(text[0]).toContain('-¥120.00')
    expect(text[1]).toContain('+¥50.00')
    const spans = wrapper.findAll('.amount-out, .amount-in')
    expect(spans[0].classes()).toContain('amount-out')
    expect(spans[1].classes()).toContain('amount-in')
  })
})

describe('筛选栏那三格真落到请求上，且一变就回第一页', () => {
  it('日期区间发 startDate/endDate（键名与后端那一口一致）', async () => {
    const wrapper = await mountView()
    const picker = wrapper.findComponent(PASS_THROUGH('ARangePicker'))
    picker.vm.$emit('change', ['2026-10-01', '2026-10-31'])
    await flushPromises()
    expect(lastListParams()).toMatchObject({ startDate: '2026-10-01', endDate: '2026-10-31' })
    // 区间给的是字符串而不是日期对象，否则后端那一口收不到
    expect(wrapper.find('.ARangePicker-stub').attributes('value-format')).toBe('YYYY-MM-DD')
  })

  it('关键词搜索发 keyword，并且先把页码回到第一页', async () => {
    const wrapper = await mountView({ records: [transaction(1)], total: 47 })
    const pager = wrapper.findComponent(TABLE_STUB).props('pagination') as any
    pager.onChange(5, 10)
    await flushPromises()

    const search = wrapper.findComponent(PASS_THROUGH('AInputSearch'))
    search.vm.$emit('update:value', '文章')
    search.vm.$emit('search', '文章')
    await flushPromises()

    expect(lastListParams()).toMatchObject({ keyword: '文章', page: 1 })
  })
})

describe('导出那一发：回的不是文件就不许念成功', () => {
  it('后端回 CSV 时按行说话', async () => {
    const wrapper = await mountView()
    vi.mocked(walletApi.exportTransactions).mockResolvedValue({
      type: 'text/csv;charset=UTF-8',
      text: async () => '﻿交易流水号,租户ID,类型\nTXN-1,15,消费\nTXN-2,15,充值\n'
    } as any)
    const button = wrapper.findAll('button').find(node => node.text().includes('导出明细'))!
    button.element.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()
    await flushPromises()
    expect(message.success).toHaveBeenCalledWith('已导出 2 行明细')
  })

  it('后端回的不是文件时念失败，不许念「导出成功」', async () => {
    const wrapper = await mountView()
    vi.mocked(walletApi.exportTransactions).mockResolvedValue({
      type: 'application/json',
      text: async () => '{"success":true,"data":""}'
    } as any)
    const button = wrapper.findAll('button').find(node => node.text().includes('导出明细'))!
    button.element.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()
    await flushPromises()
    expect(message.success).not.toHaveBeenCalled()
    expect(message.error).toHaveBeenCalledWith(expect.stringContaining('导出没拿到文件'))
  })

  it('导出发的是与列表同一套筛选条件', async () => {
    const wrapper = await mountView()
    const select = wrapper.findComponent(PASS_THROUGH('ASelect'))
    select.vm.$emit('update:value', 'CONSUME')
    select.vm.$emit('change', 'CONSUME')
    await flushPromises()

    vi.mocked(walletApi.exportTransactions).mockResolvedValue({
      type: 'text/csv',
      text: async () => '交易流水号\n'
    } as any)
    const button = wrapper.findAll('button').find(node => node.text().includes('导出明细'))!
    button.element.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()
    expect(vi.mocked(walletApi.exportTransactions).mock.calls[0][0]).toMatchObject({ type: 'CONSUME', tenantId: 15 })
  })
})
