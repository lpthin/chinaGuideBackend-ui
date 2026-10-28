import { describe, it, expect, beforeEach, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { Button, Input, Select, message } from 'ant-design-vue'
import NotificationInboxView from '../NotificationInboxView.vue'
import { notificationsApi } from '../../../api/notifications'
import { JUMP_BACK_NOTICE } from '../../../utils/emptyPage'

/**
 * 待办通知页（Spec §13.3-6 的最后一公里）。
 *
 * 这一页唯一的风险是「把没取到显示成没有」：一张空的待办表读起来就像「这一轮巡检一切正常」，
 * 而那正是闭环要避免的错觉。所以用例钉四件：
 * 1. 这一格逐字念后端回的成因（M-P88）：真的没有 / 翻过了头 / 读不到 / 读失败，四种不许长成一个样；
 * 2. 「翻过了头」由界面自己翻回第一页再读一遍，并 message.info 一句动作说明；
 * 3. 「全部标为已读」显示的是后端回的那个数（改了几条），不是界面自己数的行数，也不是一句「已处理」；
 * 4. 类型码原样来自接口——前端没有第二份中文字典（挂一个从没见过的码，页面只能显出它本身）。
 */

vi.mock('ant-design-vue', async () => {
  const actual = await vi.importActual<Record<string, any>>('ant-design-vue')
  return {
    ...actual,
    message: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() }
  }
})

vi.mock('../../../api/notifications', () => ({
  notificationsApi: {
    list: vi.fn(),
    unreadCount: vi.fn(),
    read: vi.fn(),
    readAll: vi.fn()
  }
}))

const PASS_THROUGH = (name: string) => ({
  name,
  props: ['title', 'message', 'description', 'type', 'showIcon', 'size'],
  template: `<div class="${name}-stub"><span>{{ message }}</span><slot /></div>`
})

/** 真 a-table 在这一页不干活：只需要它把 bodyCell 逐行逐列渲出来，分页参数从 props 读 */
const TABLE_STUB = {
  name: 'ATable',
  props: {
    dataSource: { type: Array, default: () => [] },
    columns: { type: Array, default: () => [] },
    pagination: { type: [Object, Boolean], default: false },
    loading: { type: Boolean, default: false }
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

function record(id: number, status: string, overrides: Record<string, unknown> = {}) {
  return {
    id, tenantId: 15, siteId: 7, type: `some:type-${id}`, title: `标题 ${id}`,
    content: `本轮新发现 3 条待处理问题 ${id}`, status, readAt: null,
    createdAt: '2026-09-25T10:00:00', ...overrides
  }
}

interface Options {
  records?: Array<ReturnType<typeof record>>
  total?: number
  unread?: number | null
  listError?: string
  readAll?: number
  emptyReason?: string
  emptyLine?: string
}

async function mountView(options: Options = {}) {
  const {
    records = [record(1, 'unread')], total = records.length, unread = 4,
    listError = '', readAll = 2, emptyReason, emptyLine
  } = options
  if (listError) {
    vi.mocked(notificationsApi.list).mockRejectedValueOnce(new Error(listError))
  } else {
    vi.mocked(notificationsApi.list).mockResolvedValue({
      records, total, page: 1, size: 20, emptyReason, emptyLine
    } as any)
  }
  if (unread === null) {
    vi.mocked(notificationsApi.unreadCount).mockRejectedValue(new Error('未读数读不了'))
  } else {
    vi.mocked(notificationsApi.unreadCount).mockResolvedValue({ total: unread } as any)
  }
  vi.mocked(notificationsApi.readAll).mockResolvedValue(readAll as any)
  vi.mocked(notificationsApi.read).mockResolvedValue({} as any)
  const wrapper = mount(NotificationInboxView, {
    attachTo: document.body,
    global: {
      stubs: {
        'a-button': Button,
        'a-select': Select,
        'a-input': Input,
        'a-alert': PASS_THROUGH('AAlert'),
        'a-form': PASS_THROUGH('AForm'),
        'a-form-item': PASS_THROUGH('AFormItem'),
        'a-space': PASS_THROUGH('ASpace'),
        'a-table': TABLE_STUB
      }
    }
  })
  await flushPromises()
  return wrapper
}

function byText(text: string) {
  return [...document.querySelectorAll('button')].filter(
    node => (node.textContent || '').replace(/\s+/g, '') === text
  )
}

function click(node: Element) {
  node.dispatchEvent(new MouseEvent('click', { bubbles: true }))
}

function rows(wrapper: any) {
  return wrapper.findAll('.row')
}

beforeEach(() => {
  document.body.innerHTML = ''
  vi.clearAllMocks()
})

describe('取到的是接口那一份，取不到就说取不到', () => {
  it('打开这一页默认只看未读，分页与未读数各取各的', async () => {
    await mountView()
    expect(notificationsApi.list).toHaveBeenLastCalledWith({
      page: 1, size: 20, status: 'unread', type: ''
    })
    expect(notificationsApi.unreadCount).toHaveBeenCalledTimes(1)
  })

  it('未读数读失败只让它自己说没取到，列表照旧', async () => {
    const wrapper = await mountView({ unread: null, records: [record(1, 'unread'), record(2, 'unread')] })
    expect(wrapper.text()).toContain('未读 没取到')
    expect(rows(wrapper)).toHaveLength(2)
    expect(wrapper.text()).toContain('本轮新发现 3 条待处理问题 1')
  })

  it('列表读失败：不念成「没有待办」，那一格逐字说这一发读失败', async () => {
    const wrapper = await mountView({ listError: '这个账号没有登录' })
    expect(wrapper.find('.empty-slot').text()).toContain('这一发读失败：这个账号没有登录')
    expect(wrapper.find('.empty-slot').text()).toContain('读失败不是「这一档没有」')
    // 旧那句写死的结论一句都不许出现：读失败和「这一档没有」是两件事
    expect(wrapper.text()).not.toContain('按当前筛选没有待办')
    expect(wrapper.text()).not.toMatch(/一切正常|没有问题|都已处理/)
    // 读失败了也不能把总数念成 0 条
    expect(wrapper.findComponent(TABLE_STUB).props('pagination')).toMatchObject({ total: 0 })
    expect(rows(wrapper)).toHaveLength(0)
  })

  it('真的没有：逐字念后端那一句，不替后端宣布结论', async () => {
    const line = '待办通知：这一档查过了，一条都没有。'
    const wrapper = await mountView({ records: [], total: 0, unread: 0, emptyReason: 'NONE', emptyLine: line })
    expect(wrapper.find('.empty-slot').exists()).toBe(true)
    expect(wrapper.find('.empty-slot').text()).toContain(line)
    // 这一页没有新建待办这个动作，所以「真的没有」也不摆新建入口
    expect(wrapper.find('.create-on-empty').exists()).toBe(false)
    expect(wrapper.text()).not.toMatch(/一切正常|没有问题|都已处理/)
  })

  it('选中的那一家读不到：说的是读不到，不是「一条都没有」', async () => {
    // 这一句逐字来自后端 EmptyResultReasons；界面不改写
    const line = '待办通知：这一档读不到（选中的那个身份在这张表里没有行），所以这里不能说「没有」。'
    const wrapper = await mountView({
      records: [], total: 0, unread: 0, emptyReason: 'NOT_VISIBLE', emptyLine: line
    })
    expect(wrapper.find('.empty-slot').text()).toContain(line)
    expect(wrapper.find('.empty-slot').text()).toContain('读不到')
    expect(wrapper.find('.empty-slot').text()).not.toContain('一条都没有')
    expect(wrapper.find('.create-on-empty').exists()).toBe(false)
  })

  it('这一页翻过了头：界面自己翻回第一页再读一遍，并说一句刚做了什么', async () => {
    const wrapper = await mountView({
      records: [], total: 0, unread: 3, emptyReason: 'NONE', emptyLine: '待办通知：这一档查过了，一条都没有。'
    })
    // 第二页那一发：后端答「翻过了头」（总数 47，第二页早就不存在）
    vi.mocked(notificationsApi.list).mockResolvedValueOnce({
      records: [], total: 47, page: 2, size: 20,
      emptyReason: 'OUT_OF_RANGE',
      emptyLine: '待办通知：这一页翻过了头，往前面的页翻回来就有；这里没行不等于这一档没有。'
    } as any)
    // 界面自己翻回第一页之后那一发：这一页有行
    vi.mocked(notificationsApi.list).mockResolvedValueOnce({
      records: [record(5, 'unread')], total: 47, page: 1, size: 20,
      emptyReason: null, emptyLine: ''
    } as any)

    wrapper.findComponent(TABLE_STUB).vm.$emit('change', { current: 2, pageSize: 20 })
    await flushPromises()
    await flushPromises()

    const calls = vi.mocked(notificationsApi.list).mock.calls
    expect(calls.map(([params]) => (params as any).page)).toEqual([1, 2, 1])
    expect(calls[calls.length - 1][0]).toMatchObject({ page: 1, size: 20 })
    expect(message.info).toHaveBeenCalledWith(JUMP_BACK_NOTICE)
    // 跳回之后读到的是第一页那一行，不是停在「翻过了头」那句空话上
    expect(rows(wrapper)).toHaveLength(1)
    expect(wrapper.text()).not.toContain('翻过了头')
    expect(wrapper.findComponent(TABLE_STUB).props('pagination')).toMatchObject({ current: 1, total: 47 })
  })

  it('类型码原样来自接口：前端没有第二份中文字典', async () => {
    const wrapper = await mountView({ records: [record(9, 'unread', { type: 'never:seen-before' })] })
    expect(wrapper.text()).toContain('never:seen-before')
  })

  it('库里冒出第三种状态时原样写出来，不归成已读也不归成未读', async () => {
    const wrapper = await mountView({ records: [record(3, 'archived', { type: 't' })] })
    const statusCell = wrapper.findAll('.row')[0].text()
    expect(statusCell).toContain('archived')
    // 已读/未读都不许出现在这一行里（那会让人以为这条已经被处理过）
    expect(statusCell.replace(/标为已读/g, '')).not.toMatch(/已读|未读/)
  })

  it('分页控件上的总数来自接口的 total，不是当前页行数', async () => {
    const wrapper = await mountView({ records: [record(1, 'unread'), record(2, 'unread')], total: 37 })
    const table = wrapper.findComponent(TABLE_STUB)
    expect(table.props('pagination')).toMatchObject({ current: 1, pageSize: 20, total: 37 })
  })
})

describe('两条已读动作：一条按 id 打，一条报后端那个数', () => {
  it('未读那一行的按钮可点，点了打的是这条的 id 并重取两份', async () => {
    const wrapper = await mountView({ records: [record(21, 'unread')] })
    const before = vi.mocked(notificationsApi.list).mock.calls.length
    click(wrapper.findAll('.row button')[0].element)
    await flushPromises()
    expect(notificationsApi.read).toHaveBeenLastCalledWith(21)
    expect(vi.mocked(notificationsApi.list).mock.calls.length).toBe(before + 1)
    expect(notificationsApi.unreadCount).toHaveBeenCalledTimes(2)
  })

  it('已读那一行不再给一个只会重复写的按钮', async () => {
    const wrapper = await mountView({ records: [record(22, 'read')] })
    const button = wrapper.findAll('.row button')[0]
    expect((button.element as HTMLButtonElement).disabled).toBe(true)
  })

  it('全部标为已读：显示后端回的「改了几条」，不是界面自己数的行数', async () => {
    const wrapper = await mountView({ records: [record(1, 'unread'), record(2, 'unread')], total: 12, unread: 12, readAll: 9 })
    expect(byText('全部标为已读')).toHaveLength(1)
    expect((byText('全部标为已读')[0] as HTMLButtonElement).disabled).toBe(false)
    click(byText('全部标为已读')[0])
    await flushPromises()
    expect(notificationsApi.readAll).toHaveBeenCalledTimes(1)
    expect(wrapper.text()).toContain('刚把 9 条标为已读')
    // 后端给了 9 条，界面不许说 2 条（当前页只有两行）
    expect(wrapper.text()).not.toContain('刚把 2 条标为已读')
    expect(notificationsApi.unreadCount).toHaveBeenCalledTimes(2)
  })

  it('未读数为 0 或没取到时，那颗按钮点不动——不给人一个点了只会写 0 的动作', async () => {
    const zero = await mountView({ unread: 0 })
    expect((byText('全部标为已读')[0] as HTMLButtonElement).disabled).toBe(true)
    document.body.innerHTML = ''
    const unknown = await mountView({ unread: null })
    expect((byText('全部标为已读')[0] as HTMLButtonElement).disabled).toBe(true)
  })

  it('换筛选条件会把页码退回第一页再取', async () => {
    const wrapper = await mountView()
    const select = wrapper.findAllComponents(Select)[0]
    select.vm.$emit('update:value', 'read')
    select.vm.$emit('change', 'read')
    await flushPromises()
    expect(notificationsApi.list).toHaveBeenLastCalledWith({
      page: 1, size: 20, status: 'read', type: ''
    })
  })
})
