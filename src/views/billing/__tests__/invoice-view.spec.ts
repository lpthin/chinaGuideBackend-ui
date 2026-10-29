import { describe, it, expect, beforeEach, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { Button, message } from 'ant-design-vue'
import InvoiceView from '../InvoiceView.vue'
import { invoiceApi } from '../../../api/billing'

/**
 * 超管计费「账单」那一屏（M-P91 第五十五批）。
 *
 * 这一屏改之前有六处会被人看错：
 * 1. 详情弹窗按 amount/type/taxNumber/email 去读，而后端详情那一口回的是实体自己的键
 *    （totalAmount/invoiceType/taxNo/contactEmail）——四个键一个也对不上，
 *    金额那一格让一个 undefined 把整张弹窗的渲染炸掉；
 * 2. 列表「类型」那一格不看库里那一列，每行硬念「个人」；「税号」那一格根本没有出处；
 * 3. 账单状态界面念中英两套（ISSUED / pending），库里其实是 status + payment_status 两列；
 * 4. 上面四张卡：「已开票 0 / 已驳回 0」是系统里根本没有这两个词的死卡，
 *    「账单总额」是拿眼前这一页十条求出来的和；
 * 5. 「申请开票」那一发发的是 {type, taxNumber, amount, email}，后端写口一个键都不认，
 *    人填的金额、税号、类型、邮箱整段丢掉，库里落一条空账单；
 * 6. 「导出」少了载荷形状判断，后端回 JSON 错误壳时界面照样下出一个假文件并念「导出成功」。
 */

vi.mock('ant-design-vue', async () => {
  const actual = await vi.importActual<Record<string, any>>('ant-design-vue')
  return {
    ...actual,
    message: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() }
  }
})

vi.mock('../../../api/billing', () => ({
  invoiceApi: { list: vi.fn(), getDetail: vi.fn(), create: vi.fn(), export: vi.fn(), statistics: vi.fn() }
}))

vi.mock('../../../stores/auth', () => ({
  useAuthStore: () => ({ selectedTenantId: 15, tenantId: 15 })
}))

const PASS_THROUGH = (name: string) => ({
  name,
  props: ['title', 'bordered', 'gutter', 'span', 'value', 'modelValue', 'placeholder', 'allowClear', 'enterButton', 'min', 'max', 'rows', 'column'],
  template: `<div class="${name}-stub"><slot /></div>`
})

/** 真弹窗：把默认槽渲出来，并给一个「确定」把手，点了就发 ok（与 antd 的 onOk 同形） */
const MODAL_STUB = {
  name: 'AModal',
  props: {
    open: { type: Boolean, default: false },
    title: { type: String, default: '' },
    footer: { default: undefined }
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

/** 详情那一张表：把 label 也念出来，不然测不到「哪一格摆了什么」 */
const DESCRIPTIONS_ITEM_STUB = {
  name: 'ADescriptionsItem',
  props: { label: { type: String, default: '' }, span: { type: [Number, String], default: 1 } },
  template: `<div class="desc-item"><span class="desc-label">{{ label }}</span><span class="desc-body"><slot /></span></div>`
}

/** 后端详情那一口回的真形状：实体自己的键 + 库里那两列原始大写代码（现场 60-detail.json） */
function invoiceEntity(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    tenantId: 15,
    invoiceNo: 'INVMP91LIVE7',
    title: '探针抬头（本批已删）',
    invoiceType: 'ENTERPRISE',
    taxNo: '91330100MA27XXXX88',
    contactEmail: 'finance@example.com',
    totalAmount: 1200,
    paidAmount: 0,
    unpaidAmount: 1200,
    status: 'ISSUED',
    paymentStatus: 'UNPAID',
    paymentMethod: 'ALIPAY',
    billingDate: '2026-10-01',
    dueDate: '2026-10-31',
    createdAt: '2026-10-20T09:00:00',
    ...overrides
  }
}

/** 列表那一口的形状：读口投影过的键 + 已折过小写档的状态 */
function invoiceRow(id: number, overrides: Record<string, unknown> = {}) {
  return {
    id,
    tenantId: 15,
    invoiceNo: `INV-MP91-${id}`,
    title: '内容管理服务',
    invoiceType: 'ENTERPRISE',
    taxNo: `91330100000000${id}`,
    amount: 999,
    status: 'pending',
    createdAt: '2026-10-20T09:00:00',
    ...overrides
  }
}

async function mountView(options: {
  rows?: any[]
  detail?: any
  stats?: any
  statsError?: string
  exportPayload?: { type: string; text: () => Promise<string> }
} = {}) {
  const { rows = [invoiceRow(7)], detail, stats, statsError, exportPayload } = options

  vi.mocked(invoiceApi.list).mockResolvedValue({ records: rows, total: rows.length } as any)
  vi.mocked(invoiceApi.getDetail).mockResolvedValue({
    invoice: detail === undefined ? invoiceEntity() : detail,
    items: [],
  } as any)
  vi.mocked(invoiceApi.create).mockResolvedValue({} as any)
  if (statsError) {
    vi.mocked(invoiceApi.statistics).mockRejectedValue(new Error(statsError))
  } else {
    vi.mocked(invoiceApi.statistics).mockResolvedValue(
      stats ?? { totalCount: 12, paidCount: 3, unpaidCount: 9, totalAmount: 36000 } as any
    )
  }
  vi.mocked(invoiceApi.export).mockResolvedValue(
    (exportPayload ?? { type: 'application/json', text: async () => '{"success":false,"message":"导出条件有问题"}' }) as any
  )

  const wrapper = mount(InvoiceView, {
    attachTo: document.body,
    global: {
      stubs: {
        'a-spin': PASS_THROUGH('ASpin'),
        'a-row': PASS_THROUGH('ARow'),
        'a-col': PASS_THROUGH('ACol'),
        'a-card': PASS_THROUGH('ACard'),
        'a-space': PASS_THROUGH('ASpace'),
        'a-tag': PASS_THROUGH('ATag'),
        'a-input': PASS_THROUGH('AInput'),
        'a-input-search': PASS_THROUGH('AInputSearch'),
        'a-input-number': PASS_THROUGH('AInputNumber'),
        'a-textarea': PASS_THROUGH('ATextarea'),
        'a-radio-group': PASS_THROUGH('ARadioGroup'),
        'a-radio': PASS_THROUGH('ARadio'),
        'a-form': PASS_THROUGH('AForm'),
        'a-form-item': PASS_THROUGH('AFormItem'),
        'a-descriptions': PASS_THROUGH('ADescriptions'),
        'a-descriptions-item': DESCRIPTIONS_ITEM_STUB,
        'a-button': Button,
        'a-modal': MODAL_STUB,
        'a-table': TABLE_STUB,
      }
    }
  })
  await flushPromises()
  return wrapper
}

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

/** 按标题认弹窗（这一屏有两个：申请开票 / 账单详情） */
function modalByTitle(wrapper: any, title: string) {
  const modal = wrapper.findAll('.modal-stub').find((node: any) => node.find('.modal-title').text() === title)
  if (!modal) {
    throw new Error(`没有开着「${title}」这个弹窗，开着的：${wrapper.findAll('.modal-title').map((node: any) => node.text()).join('|') || '（一个都没开）'}`)
  }
  return modal
}

function detailField(wrapper: any, label: string): string {
  const item = wrapper
    .findAll('.desc-item')
    .find((node: any) => node.find('.desc-label').text() === label)
  if (!item) throw new Error(`详情里没有写着「${label}」的那一格`)
  return item.find('.desc-body').text()
}

function modalInput(wrapper: any, placeholder: string) {
  const target = wrapper
    .findAllComponents(PASS_THROUGH('AInput'))
    .find((node: any) => node.props('placeholder') === placeholder)
  if (!target) throw new Error(`界面上没有 placeholder 为「${placeholder}」的输入框`)
  return target
}

async function typeInto(wrapper: any, placeholder: string, value: unknown) {
  modalInput(wrapper, placeholder).vm.$emit('update:value', value)
  await flushPromises()
}

async function typeAmount(wrapper: any, value: unknown) {
  wrapper.findAllComponents(PASS_THROUGH('AInputNumber'))[0].vm.$emit('update:value', value)
  await flushPromises()
}

function confirmModal(wrapper: any, title: string) {
  modalByTitle(wrapper, title).findAll('.modal-ok')[0].element.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  return flushPromises()
}

beforeEach(() => {
  document.body.innerHTML = ''
  vi.clearAllMocks()
  window.URL.createObjectURL = vi.fn(() => 'blob:mp91')
  window.URL.revokeObjectURL = vi.fn()
})

describe('账单详情弹窗：读的是实体自己那几个键', () => {
  it('金额 ¥1,200.00、类型「企业」、状态「待支付」、支付方式「支付宝」、税号摆真值', async () => {
    const wrapper = await mountView()
    clickButton(wrapper, '详情')
    await flushPromises()

    expect(modalByTitle(wrapper, '账单详情').text()).toContain('INVMP91LIVE7')
    expect(detailField(wrapper, '账单金额')).toBe('¥1,200.00')
    expect(detailField(wrapper, '发票类型')).toBe('企业')
    expect(detailField(wrapper, '账单状态')).toBe('待支付')
    expect(detailField(wrapper, '税号')).toBe('91330100MA27XXXX88')
    expect(detailField(wrapper, '支付方式')).toBe('支付宝')
    expect(detailField(wrapper, '未收金额')).toBe('¥1,200.00')
    // 上一版：读不到键就整张弹窗炸掉，界面连一句话都念不出来
    expect(wrapper.find('.desc-body').exists()).toBe(true)
  })

  it('抬头没填就摆「—」，界面上不许出现后端编出来的那个「账单」', async () => {
    const wrapper = await mountView({ detail: invoiceEntity({ title: null, taxNo: null, invoiceType: null }) })
    clickButton(wrapper, '详情')
    await flushPromises()

    expect(detailField(wrapper, '发票抬头')).toBe('—')
    expect(detailField(wrapper, '税号')).toBe('—')
    expect(detailField(wrapper, '发票类型')).toBe('—')
    expect(modalByTitle(wrapper, '账单详情').text()).not.toContain('账单¥')
  })

  it('列表那一格跟着库里那一列念：企业行念「企业」、个人行念「个人」，税号各摆各的', async () => {
    const wrapper = await mountView({
      rows: [invoiceRow(11, { invoiceType: 'ENTERPRISE', taxNo: '91330111AAAA' }), invoiceRow(12, { invoiceType: 'PERSONAL', taxNo: null })]
    })
    const first = wrapper.findAll('.row')[0].text()
    const second = wrapper.findAll('.row')[1].text()

    expect(first).toContain('企业')
    expect(first).toContain('91330111AAAA')
    expect(second).toContain('个人')
    expect(second).toContain('—')
    expect(second).not.toContain('91330111AAAA')
  })
})

describe('申请开票那一发：发的是库里那四列的键名', () => {
  it('企业发票：totalAmount / invoiceType / taxNo / contactEmail 一个都不丢', async () => {
    const wrapper = await mountView()
    clickButton(wrapper, '申请开票')
    await flushPromises()

    await typeInto(wrapper, '请输入发票抬头', '杭州示例科技有限公司')
    await typeInto(wrapper, '请输入税号', '91330100MA27XXXX88')
    await typeInto(wrapper, '请输入接收发票的邮箱', 'finance@example.com')
    await typeAmount(wrapper, 1200)
    await confirmModal(wrapper, '申请开票')

    expect(invoiceApi.create).toHaveBeenCalledTimes(1)
    const payload = vi.mocked(invoiceApi.create).mock.calls[0][0] as any
    expect(payload).toMatchObject({
      tenantId: 15,
      title: '杭州示例科技有限公司',
      invoiceType: 'ENTERPRISE',
      taxNo: '91330100MA27XXXX88',
      totalAmount: 1200,
      contactEmail: 'finance@example.com',
    })
    // 上一版发的是这四个键，后端一个都不认，库里因此落一条金额税号全空的账单
    expect(payload).not.toHaveProperty('amount')
    expect(payload).not.toHaveProperty('type')
    expect(payload).not.toHaveProperty('taxNumber')
    expect(payload).not.toHaveProperty('email')
  })

  it('个人发票：界面上根本没有税号那一格，也就不要人填税号', async () => {
    const wrapper = await mountView()
    clickButton(wrapper, '申请开票')
    await flushPromises()

    // 企业那一档：抬头 + 税号 + 邮箱三格
    expect(wrapper.findAllComponents(PASS_THROUGH('AInput')).length).toBe(3)

    wrapper.findAllComponents(PASS_THROUGH('ARadioGroup'))[0].vm.$emit('update:value', 'PERSONAL')
    await flushPromises()
    // 换成个人：税号那一格整个撤掉，界面上不留一个「必填但其实不该要」的空
    expect(wrapper.findAllComponents(PASS_THROUGH('AInput')).length).toBe(2)

    await typeInto(wrapper, '请输入发票抬头', '张三')
    await typeAmount(wrapper, 300)
    await confirmModal(wrapper, '申请开票')

    const payload = vi.mocked(invoiceApi.create).mock.calls[0][0] as any
    expect(payload.invoiceType).toBe('PERSONAL')
    expect(payload.taxNo).toBeUndefined()
    expect(message.error).not.toHaveBeenCalledWith('请输入税号')
  })

  it('金额没填正数就点确定：先把人拦住，不发那一发', async () => {
    const wrapper = await mountView()
    clickButton(wrapper, '申请开票')
    await flushPromises()
    await typeInto(wrapper, '请输入发票抬头', '杭州示例科技有限公司')
    await typeInto(wrapper, '请输入税号', '91330100MA27XXXX88')
    await confirmModal(wrapper, '申请开票')

    expect(invoiceApi.create).not.toHaveBeenCalled()
    expect(message.error).toHaveBeenCalledWith('请输入正确的开票金额')
  })
})

describe('上面四张卡读 /billing/invoices/statistics', () => {
  it('念账单总数 / 已收款 / 未收款 / 账单总额的真数，不是这一页十条的和', async () => {
    const wrapper = await mountView({ rows: [invoiceRow(7, { amount: 999 })] })

    expect(stats(wrapper)).toEqual(['12', '3', '9', '¥36,000.00'])
    expect(invoiceApi.statistics).toHaveBeenCalledWith({ tenantId: 15 })
  })

  it('那一发读失败：四张卡全摆「—」，不摆 0 也不摆上一轮的旧数', async () => {
    const wrapper = await mountView({ statsError: 'network down' })
    expect(stats(wrapper)).toEqual(['—', '—', '—', '—'])
  })

  it('那两格死卡（已开票 / 已驳回）没了——系统里没有这两个词的出处', async () => {
    const wrapper = await mountView()
    const titles = wrapper.findAll('.stat-title').map((node: any) => node.text())
    expect(titles).toEqual(['账单总数', '已收款', '未收款', '账单总额'])
  })
})

describe('导出那一发：认载荷形状，也把人填的条件带上', () => {
  it('后端回的是 JSON 错误壳：念「导出没拿到文件」，不许下出一个假文件', async () => {
    const wrapper = await mountView()
    clickButton(wrapper, '导出列表')
    await flushPromises()

    expect(message.error).toHaveBeenCalledWith(expect.stringContaining('导出没拿到文件'))
    expect(window.URL.createObjectURL).not.toHaveBeenCalled()
    expect(message.success).not.toHaveBeenCalled()
  })

  it('后端回 CSV：按行数说话，并把搜索框那个 keyword 一起带过去', async () => {
    const wrapper = await mountView({
      exportPayload: { type: 'text/csv;charset=utf-8', text: async () => '账单号,抬头\nINV-1,甲\nINV-2,乙\n' }
    })
    wrapper
      .findAllComponents(PASS_THROUGH('AInputSearch'))
      .find((node: any) => node.props('placeholder') === '搜索账单号/抬头/税号')!
      .vm.$emit('update:value', '甲')
    await flushPromises()
    clickButton(wrapper, '导出列表')
    await flushPromises()

    expect(invoiceApi.export).toHaveBeenCalledWith({ tenantId: 15, keyword: '甲' })
    expect(message.success).toHaveBeenCalledWith('已导出 2 条账单')
  })

  it('界面上那句「搜账单号/抬头/税号」不是空话：点搜索真的把 keyword 发到后端', async () => {
    const wrapper = await mountView()
    const search = wrapper
      .findAllComponents(PASS_THROUGH('AInputSearch'))
      .find((node: any) => node.props('placeholder')?.includes('税号'))
    expect(search).toBeTruthy()

    search!.vm.$emit('update:value', '91330100')
    await flushPromises()
    search!.vm.$emit('search', '91330100')
    await flushPromises()

    const calls = vi.mocked(invoiceApi.list).mock.calls
    expect(calls[calls.length - 1]?.[0]).toMatchObject({ keyword: '91330100' })
  })
})
