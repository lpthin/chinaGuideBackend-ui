import { describe, it, expect, beforeEach, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { Button, message } from 'ant-design-vue'
import CustomerManageView from '../CustomerManageView.vue'
import { customerApi } from '../../../api/billing'
import { JUMP_BACK_NOTICE } from '../../../utils/emptyPage'

/**
 * 客户管理页（M-P89）。
 *
 * 这一页原来四种「空」长成一个样：表格里只有 antd 的默认「暂无数据」，四张统计卡在读失败时
 * 一起掉成 0——「读不到」在界面上被念成「一个客户都没有」。用例钉五件：
 * 1. 读失败：空态逐字说这一发读失败，统计卡念「没取到」，不许念 0；
 * 2. 真的没有 / 读不到：逐字念后端那句；只有「真的没有」摆新建入口；
 * 3. 翻过了头：界面自己翻回第一页再读一遍，并说一句刚做了什么；
 * 4. 「客户总数」用后端 total（不是这一页的行数），另三张标题写明「本页」；
 * 5. 空态那颗新建按钮点了真打开新建表单（这一页原本连新建入口都没有）。
 */

vi.mock('ant-design-vue', async () => {
  const actual = await vi.importActual<Record<string, any>>('ant-design-vue')
  return {
    ...actual,
    message: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() }
  }
})

vi.mock('../../../api/billing', () => ({
  customerApi: {
    list: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    toggleStatus: vi.fn()
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

function customer(id: number, overrides: Record<string, unknown> = {}) {
  return {
    id,
    tenantId: 15,
    companyName: `MP89 公司 ${id}`,
    contactPerson: '李经理',
    phone: '13900000001',
    email: '',
    level: 'normal',
    status: 'active',
    registeredAt: '2026-10-01T10:00:00',
    ...overrides
  }
}

interface Options {
  records?: Array<ReturnType<typeof customer>>
  total?: number
  listError?: string
  emptyReason?: string
  emptyLine?: string
}

async function mountView(options: Options = {}) {
  const { records = [customer(1)], total = records.length, listError = '', emptyReason, emptyLine } = options
  if (listError) {
    vi.mocked(customerApi.list).mockRejectedValueOnce(new Error(listError))
  } else {
    vi.mocked(customerApi.list).mockResolvedValue({
      records, total, page: 1, size: 10, pages: Math.ceil(total / 10), emptyReason, emptyLine
    } as any)
  }
  const wrapper = mount(CustomerManageView, {
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
        'a-input': PASS_THROUGH('AInput'),
        'a-textarea': PASS_THROUGH('ATextarea'),
        'a-form': PASS_THROUGH('AForm'),
        'a-form-item': PASS_THROUGH('AFormItem'),
        'a-descriptions': PASS_THROUGH('ADescriptions'),
        'a-descriptions-item': PASS_THROUGH('ADescriptionsItem'),
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

function rows(wrapper: any) {
  return wrapper.findAll('.row')
}

beforeEach(() => {
  document.body.innerHTML = ''
  vi.clearAllMocks()
})

describe('四种空各念各的', () => {
  it('打开这一页按登录态的租户取第一页', async () => {
    await mountView()
    expect(customerApi.list).toHaveBeenLastCalledWith({ tenantId: 15, page: 1, size: 10 })
  })

  it('读失败：这一格说这一发读失败，统计卡念「没取到」而不是 0', async () => {
    const wrapper = await mountView({ listError: '这个账号没有登录' })
    const empty = wrapper.find('.empty-slot')
    expect(empty.text()).toContain('这一发读失败：这个账号没有登录')
    expect(empty.text()).toContain('读失败不是「这一档没有」')
    // 四张卡一起掉成 0 正是这一屏原来最误导人的地方
    expect(stats(wrapper)).toEqual(['没取到', '没取到', '没取到', '没取到'])
    expect(rows(wrapper)).toHaveLength(0)
  })

  it('真的没有：逐字念后端那一句，并摆一颗新建按钮', async () => {
    const line = '计费客户：这一档查过了，一条都没有。'
    const wrapper = await mountView({ records: [], total: 0, emptyReason: 'NONE', emptyLine: line })
    expect(wrapper.find('.empty-slot').text()).toContain(line)
    expect(wrapper.find('.empty-slot').find('.create-on-empty').exists()).toBe(true)
    expect(stats(wrapper)).toEqual(['0', '0', '0', '0'])
  })

  it('选中的那一家读不到：念「读不到」，不摆新建入口，统计卡也不念 0', async () => {
    const line = '计费客户：这一档读不到（选中的那个身份在这张表里没有行），所以这里不能说「没有」。'
    const wrapper = await mountView({ records: [], total: 0, emptyReason: 'NOT_VISIBLE', emptyLine: line })
    expect(wrapper.find('.empty-slot').text()).toContain(line)
    expect(wrapper.find('.empty-slot').text()).not.toContain('一条都没有')
    expect(wrapper.find('.empty-slot').find('.create-on-empty').exists()).toBe(false)
    expect(stats(wrapper)).toEqual(['读不到', '读不到', '读不到', '读不到'])
  })

  it('这一页翻过了头：界面自己翻回第一页再读一遍，并说一句刚做了什么', async () => {
    const wrapper = await mountView({ records: [customer(1)], total: 47 })
    // 先在第二页上：后端答「翻过了头」
    vi.mocked(customerApi.list).mockResolvedValueOnce({
      records: [], total: 47, page: 2, size: 10, pages: 5,
      emptyReason: 'OUT_OF_RANGE',
      emptyLine: '计费客户：这一页翻过了头，往前面的页翻回来就有；这里没行不等于这一档没有。'
    } as any)
    // 翻回第一页之后那一发：这一页有行
    vi.mocked(customerApi.list).mockResolvedValueOnce({
      records: [customer(2)], total: 47, page: 1, size: 10, pages: 5,
      emptyReason: null, emptyLine: ''
    } as any)

    const pager = wrapper.findComponent(TABLE_STUB).props('pagination') as any
    pager.onChange(2, 10)
    await flushPromises()
    await flushPromises()

    const calls = vi.mocked(customerApi.list).mock.calls.map(([params]) => (params as any).page)
    expect(calls).toEqual([1, 2, 1])
    expect(message.info).toHaveBeenCalledWith(JUMP_BACK_NOTICE)
    expect(rows(wrapper)).toHaveLength(1)
    expect(wrapper.text()).not.toContain('翻过了头')
    expect(wrapper.findComponent(TABLE_STUB).props('pagination')).toMatchObject({ current: 1, total: 47 })
  })
})

describe('统计卡说的是什么口径', () => {
  it('客户总数用后端 total，不是这一页的行数', async () => {
    const wrapper = await mountView({ records: [customer(1), customer(2)], total: 37 })
    expect(stats(wrapper)[0]).toBe('37')
  })

  it('另三张说的是「本页」，标题里写着，不让人当成全档', async () => {
    const wrapper = await mountView({
      records: [
        customer(1, { status: 'active' }),
        customer(2, { status: 'inactive', registeredAt: '2025-03-01T10:00:00' })
      ],
      total: 37
    })
    const titles = wrapper.findAll('.stat-title').map((node: any) => node.text())
    expect(titles).toEqual(['客户总数', '本页活跃', '本页本月新增', '本页未激活'])
    expect(stats(wrapper)).toEqual(['37', '1', '1', '1'])
  })
})

describe('新建客户的那条路真的能走到', () => {
  it('空态那颗新建按钮点了会打开新建表单', async () => {
    const wrapper = await mountView({ records: [], total: 0, emptyReason: 'NONE', emptyLine: '计费客户：这一档查过了，一条都没有。' })
    expect(wrapper.find('.modal-stub').exists()).toBe(false)
    const create = wrapper.find('.create-on-empty')
    create.element.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()
    expect(wrapper.find('.modal-stub').exists()).toBe(true)
    expect(wrapper.find('.modal-title').text()).toBe('新建客户')
  })

  it('筛选栏右侧也有一颗新建客户', async () => {
    const wrapper = await mountView()
    const toolbar = wrapper.findAll('button').filter(node => node.text().replace(/\s+/g, '') === '新建客户')
    expect(toolbar.length).toBeGreaterThanOrEqual(1)
    toolbar[0].element.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()
    expect(wrapper.find('.modal-title').text()).toBe('新建客户')
  })
})
