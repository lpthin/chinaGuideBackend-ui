import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { h } from 'vue'
import { Button, message } from 'ant-design-vue'
import CaseListView from '../CaseListView.vue'
import { caseApi } from '../../../api/case'
import { JUMP_BACK_NOTICE } from '../../../utils/emptyPage'

/**
 * 内容案例屏的空态（M-P74）：这一屏的空会被读成「这一家没有案例」，
 * 所以「读不到」与「真的没有」必须念后端那一句，界面不改写。
 *
 * 钉六件：
 * 1. 三种空各念各的，逐字比后端原文，页面上不许出现「暂无数据」；
 * 2. 后端没答成因时界面不替它猜；
 * 3. 读失败说的是读失败，不是「这一档没有」；
 * 4. 后端回「这一页翻过了头」时界面自己翻回第一页再读一遍，并提示一次；
 * 5. 「真的没有」才摆新增按钮，读不到不摆；
 * 6. 有行的时候根本不渲空态那一句。
 */

vi.mock('ant-design-vue', async () => {
  const actual = await vi.importActual<Record<string, any>>('ant-design-vue')
  return {
    ...actual,
    message: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() }
  }
})

vi.mock('../../../api/case', () => ({
  caseApi: {
    list: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    batchDelete: vi.fn(),
    publish: vi.fn(),
    unpublish: vi.fn(),
    statistics: vi.fn()
  },
  caseCategoryApi: {
    list: vi.fn()
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

// 真实控件替身：这一屏翻页走的是 pagination 里的 onChange（不是表格 @change），
// 所以 .go-page 那颗按钮替用户点「翻到第 3 页」时，调的是 props.pagination.onChange。
const TABLE_STUB = {
  name: 'ATable',
  props: {
    dataSource: { type: Array, default: () => [] },
    columns: { type: Array, default: () => [] },
    loading: { type: Boolean, default: false },
    pagination: { type: Object, default: () => ({}) },
    rowSelection: { type: Object, default: null },
    scroll: { type: Object, default: null },
    rowKey: { type: [String, Function], default: 'id' }
  },
  setup(props: any, { slots }: any) {
    return () => {
      const rows = props.dataSource as any[]
      return h('div', { class: 'table-stub' }, [
        h(
          'button',
          {
            class: 'go-page',
            onClick: () => props.pagination.onChange?.(3, 10)
          },
          '到第 3 页'
        ),
        rows.length === 0
          ? h('div', { class: 'empty' }, slots.emptyText ? slots.emptyText({}) : '暂无数据')
          : rows.map((record) =>
              h('div', { class: 'row', 'data-row': record.id }, [
                h('span', { class: 'cell-id' }, String(record.id))
              ])
            )
      ])
    }
  }
}

const PASS_THROUGH = (name: string, tag = 'div') => ({
  name,
  template: `<${tag} class="${name.toLowerCase()}-stub"><slot /><slot name="overlay" /></${tag}>`
})

const ROW = {
  id: 7,
  tenantId: 2,
  title: '某客户案例',
  customerName: '某客户',
  type: 'CUSTOMER_SUCCESS',
  priority: 'MEDIUM',
  status: 'DRAFT',
  viewCount: 0,
  likeCount: 0,
  updatedAt: '2026-10-24T00:10:00'
}

type PageShape = { records: any[]; total: number; emptyReason?: string | null; emptyLine?: string | null }

async function mountView(
  rows: any[],
  pageExtras: Omit<PageShape, 'records' | 'total'> = {},
  failWith?: Error
) {
  const list = vi.mocked(caseApi.list)
  if (failWith) {
    list.mockRejectedValue(failWith)
  } else {
    list.mockResolvedValue({ records: rows, total: rows.length, ...pageExtras } as any)
  }
  vi.mocked(caseApi.statistics).mockResolvedValue({ total: 0, published: 0, draft: 0, pendingReview: 0 } as any)
  vi.mocked((await import('../../../api/case')).caseCategoryApi.list).mockResolvedValue([] as any)

  const wrapper = mount(CaseListView, {
    attachTo: document.body,
    global: {
      stubs: {
        'a-spin': PASS_THROUGH('ASpin'),
        'a-card': PASS_THROUGH('ACard'),
        'a-space': PASS_THROUGH('ASpace'),
        'a-row': PASS_THROUGH('ARow'),
        'a-col': PASS_THROUGH('ACol'),
        'filter-bar': {
          name: 'FilterBar',
          template: '<div class="filter-bar-stub"><slot /><slot name="actions" /></div>'
        },
        'a-table': TABLE_STUB,
        'a-input-search': { name: 'AInputSearch', template: '<input class="search-stub" />' },
        'a-select': { name: 'ASelect', template: '<select class="select-stub"></select>' },
        'a-select-option': {
          name: 'ASelectOption',
          props: ['value'],
          template: '<option :value="value"><slot /></option>'
        },
        'a-button': Button,
        'a-tag': { name: 'ATag', template: '<span class="tag-stub"><slot /></span>' },
        'a-avatar': { name: 'AAvatar', template: '<span class="avatar-stub"><slot /></span>' },
        'a-dropdown': PASS_THROUGH('ADropdown'),
        'a-menu': PASS_THROUGH('AMenu'),
        'a-menu-item': PASS_THROUGH('AMenuItem'),
        'a-menu-divider': { name: 'AMenuDivider', template: '<hr class="menu-divider-stub" />' },
        CaseDetailDrawer: { name: 'CaseDetailDrawer', template: '<div class="drawer-stub" />' }
      }
    }
  })
  await flushPromises()
  return wrapper
}

/** 后端那一句（「真的没有」那一档下面还会多摆一颗新建按钮，比那一句时把它摘掉） */
const hintText = (wrapper: any) => {
  const node = wrapper.find('.empty-line').element.cloneNode(true) as HTMLElement
  node.querySelectorAll('.create-on-empty').forEach((button) => button.remove())
  return (node.textContent || '').trim()
}

const THREE_EMPTIES: Array<[string, string]> = [
  ['NONE', '案例列表：这一档查过了，一条都没有。'],
  ['NOT_VISIBLE', '案例列表：这一档读不到（选中的那个身份在这张表里没有行），所以这里不能说「没有」。'],
  ['OUT_OF_RANGE', '案例列表：这一页翻过了头，往前面的页翻回来就有；这里没行不等于这一档没有。']
]

describe('CaseListView 的空态成因', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it.each(THREE_EMPTIES)('后端回 %s 那一档时逐字念那一句，页面上没有「暂无数据」', async (reason, line) => {
    const wrapper = await mountView([], { emptyReason: reason, emptyLine: line })

    expect(hintText(wrapper)).toBe(line)
    expect(wrapper.html()).not.toContain('暂无数据')
  })

  it('后端没回是哪一种空时念「界面不替它猜」，不蒙成「真的没有」', async () => {
    const wrapper = await mountView([], { emptyReason: null, emptyLine: null })

    expect(hintText(wrapper)).toContain('后端没回是哪一种空')
    expect(wrapper.html()).not.toContain('暂无数据')
    expect(wrapper.html()).not.toContain('一条都没有')
  })

  it('读失败那一发说的是读失败，不是「这一档没有」', async () => {
    const wrapper = await mountView([], {}, new Error('读口断了'))

    const said = hintText(wrapper)
    expect(said).toContain('这一发读失败：读口断了')
    expect(said).toContain('读失败不是「这一档没有」')
    expect(said).not.toContain('一条都没有')
  })

  it('后端回「这一页翻过了头」时界面自己翻回第一页再读一遍并提示一次', async () => {
    const list = vi.mocked(caseApi.list)
    const wrapper = await mountView([ROW], { emptyReason: null, emptyLine: null })
    list
      .mockResolvedValueOnce({ records: [], total: 25, emptyReason: 'OUT_OF_RANGE', emptyLine: THREE_EMPTIES[2][1] } as any)
      .mockResolvedValueOnce({ records: [], total: 0, emptyReason: 'NONE', emptyLine: THREE_EMPTIES[0][1] } as any)

    await wrapper.find('.go-page').trigger('click')
    await flushPromises()

    expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1 }))
    expect(message.info).toHaveBeenCalledWith(JUMP_BACK_NOTICE)
    expect(hintText(wrapper)).toBe(THREE_EMPTIES[0][1])
  })

  it('「真的没有」才摆新建按钮，读不到不摆', async () => {
    const none = await mountView([], { emptyReason: 'NONE', emptyLine: THREE_EMPTIES[0][1] })
    expect(none.find('.create-on-empty').exists()).toBe(true)

    const invisible = await mountView([], { emptyReason: 'NOT_VISIBLE', emptyLine: THREE_EMPTIES[1][1] })
    expect(invisible.find('.create-on-empty').exists()).toBe(false)
  })

  it('有行的时候根本不渲空态那一句', async () => {
    const wrapper = await mountView([ROW], { emptyReason: null, emptyLine: null })

    expect(wrapper.find('.empty').exists()).toBe(false)
    expect(wrapper.html()).not.toContain('一条都没有')
  })
})
