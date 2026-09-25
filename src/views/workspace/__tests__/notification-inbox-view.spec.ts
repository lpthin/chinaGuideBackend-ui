import { describe, it, expect, beforeEach, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { Button, Input, Select } from 'ant-design-vue'
import NotificationInboxView from '../NotificationInboxView.vue'
import { notificationsApi } from '../../../api/notifications'

/**
 * 待办通知页（Spec §13.3-6 的最后一公里）。
 *
 * 这一页唯一的风险是「把没取到显示成没有」：一张空的待办表读起来就像「这一轮巡检一切正常」，
 * 而那正是闭环要避免的错觉。所以用例钉三件：
 * 1. 读失败时表格整块不渲染，页面说的是那句后端报错，不是「没有待办」；
 * 2. 「全部标为已读」显示的是后端回的那个数（改了几条），不是界面自己数的行数，也不是一句「已处理」；
 * 3. 类型码原样来自接口——前端没有第二份中文字典（挂一个从没见过的码，页面只能显出它本身）。
 */

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
}

async function mountView(options: Options = {}) {
  const { records = [record(1, 'unread')], total = records.length, unread = 4, listError = '', readAll = 2 } = options
  if (listError) {
    vi.mocked(notificationsApi.list).mockRejectedValueOnce(new Error(listError))
  } else {
    vi.mocked(notificationsApi.list).mockResolvedValue({ records, total, page: 1, size: 20 } as any)
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

  it('列表读失败：不渲染成一张空表，页面上是那句后端报错', async () => {
    const wrapper = await mountView({ listError: '这个账号没有登录' })
    expect(wrapper.text()).toContain('这个账号没有登录')
    expect(wrapper.find('.table-stub').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('按当前筛选没有待办')
  })

  it('真的没有：说的是「按当前筛选没有」，不替后端宣布结论', async () => {
    const wrapper = await mountView({ records: [], total: 0, unread: 0 })
    expect(wrapper.find('.empty-slot').exists()).toBe(true)
    expect(wrapper.text()).toContain('按当前筛选没有待办')
    expect(wrapper.text()).not.toMatch(/一切正常|没有问题|都已处理/)
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
