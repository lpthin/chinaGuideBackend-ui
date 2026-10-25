import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { h } from 'vue'
import {
  Button,
  Col,
  Form,
  FormItem,
  RadioGroup,
  RadioButton,
  Row,
  message
} from 'ant-design-vue'
import KnowledgeCardListView from '../KnowledgeCardListView.vue'
import { knowledgeCardApi, knowledgeCategoryApi, knowledgeTagApi } from '../../../api/knowledge'
import { JUMP_BACK_NOTICE } from '../../../utils/emptyPage'

/**
 * 知识卡片列表屏的空态（M-P74）：这一屏有卡片视图和列表视图两张脸，
 * 空态那一句两边都必须念后端原文；卡片视图以前没行时什么都不摆，
 * 看起来像这一屏坏了，这一份用例把它钉死。
 *
 * 钉七件：
 * 1. 列表视图：三种空各念各的，逐字比后端原文，页面上不许出现「暂无数据」；
 * 2. 后端没答成因时界面不替它猜，也不蒙成「真的没有」；
 * 3. 读失败说的是读失败，不是「这一档没有」；
 * 4. 后端回「这一页翻过了头」时界面自己翻回第一页再读一遍，并给一句动作说明；
 * 5. 「真的没有」才摆新增按钮，读不到不摆；
 * 6. 有行的时候两张脸都不渲空态那一句；
 * 7. 卡片视图（默认那张脸）没行时同样念后端那一句。
 */

vi.mock('ant-design-vue', async () => {
  const actual = await vi.importActual<Record<string, any>>('ant-design-vue')
  return {
    ...actual,
    message: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() }
  }
})

// api/http 会连带引入真实的 router 定义，所以只换掉 useRouter 这一个把手
vi.mock('vue-router', async () => {
  const actual = await vi.importActual<Record<string, any>>('vue-router')
  return { ...actual, useRouter: () => ({ push: vi.fn() }) }
})

vi.mock('../../../api/knowledge', () => ({
  knowledgeCardApi: {
    list: vi.fn(),
    get: vi.fn(),
    delete: vi.fn(),
    batchDelete: vi.fn(),
    batchSetCategory: vi.fn(),
    batchSetTags: vi.fn()
  },
  knowledgeCategoryApi: {
    all: vi.fn(),
    tree: vi.fn()
  },
  knowledgeTagApi: {
    list: vi.fn()
  },
  flattenCategories: vi.fn((list: any[]) => list)
}))

vi.mock('../../../stores/auth', () => ({
  useAuthStore: () => ({
    selectedTenantId: 1,
    tenantId: 1,
    user: { id: 1 },
    isSuperAdmin: true,
    hasPermission: () => true
  })
}))

const TABLE_STUB = {
  name: 'ATable',
  props: {
    dataSource: { type: Array, default: () => [] },
    columns: { type: Array, default: () => [] }
  },
  setup(props: any, { slots }: any) {
    return () => {
      const rows = props.dataSource as any[]
      return h('div', { class: 'table-stub' }, rows.length === 0
        ? [h('div', { class: 'empty' }, slots.emptyText ? slots.emptyText({}) : '暂无数据')]
        : rows.map((record) =>
            h('div', { class: 'row', 'data-row': record.id }, [
              h('span', { class: 'cell-id' }, String(record.id))
            ])
          ))
    }
  }
}

// 翻页是卡片下面那一发独立的分页条：真实控件替身，点它走 update:current + change
const PAGINATION_STUB = {
  name: 'APagination',
  props: {
    current: { type: Number, default: 1 },
    pageSize: { type: Number, default: 10 },
    total: { type: Number, default: 0 }
  },
  emits: ['update:current', 'update:pageSize', 'change', 'showSizeChange'],
  setup(props: any, { emit }: any) {
    return () =>
      h('div', { class: 'pagination-stub' }, [
        h('button', {
          class: 'go-page',
          onClick: () => {
            emit('update:current', 3)
            emit('change', 3, props.pageSize)
          }
        }, '到第 3 页')
      ])
  }
}

const PASS_THROUGH = (name: string, tag = 'div') => ({
  name,
  template: `<${tag} class="${name.toLowerCase()}-stub"><slot /><slot name="actions" /><slot name="cover" /><slot name="title" /><slot name="overlay" /><slot name="footer" /></${tag}>`
})

const ROW = {
  id: 7,
  title: '某张卡片',
  categoryId: 1,
  viewCount: 3,
  status: 'active',
  tagList: [],
  updatedAt: '2026-10-24T00:10:00'
}

type PageShape = { records: any[]; total: number; emptyReason?: string | null; emptyLine?: string | null }

async function mountView(
  rows: any[],
  pageExtras: Omit<PageShape, 'records' | 'total'> = {},
  failWith?: Error
) {
  const list = vi.mocked(knowledgeCardApi.list)
  if (failWith) {
    list.mockRejectedValue(failWith)
  } else {
    list.mockResolvedValue({ records: rows, total: rows.length, ...pageExtras } as any)
  }
  vi.mocked(knowledgeCategoryApi.all).mockResolvedValue({ records: [], total: 0, page: 1, size: 1, pages: 1 } as any)
  vi.mocked(knowledgeTagApi.list).mockResolvedValue([] as any)

  const wrapper = mount(KnowledgeCardListView, {
    attachTo: document.body,
    global: {
      stubs: {
        'filter-bar': {
          name: 'FilterBar',
          template: '<div class="filter-bar-stub"><slot /><slot name="actions" /></div>'
        },
        'a-spin': PASS_THROUGH('ASpin'),
        'a-card': PASS_THROUGH('ACard'),
        'a-card-meta': PASS_THROUGH('ACardMeta'),
        'a-space': PASS_THROUGH('ASpace'),
        'a-table': TABLE_STUB,
        'a-pagination': PAGINATION_STUB,
        'a-input-search': { name: 'AInputSearch', template: '<input class="search-stub" />' },
        'a-select': { name: 'ASelect', template: '<select class="select-stub"></select>' },
        'a-select-option': {
          name: 'ASelectOption',
          props: ['value'],
          template: '<option :value="value"><slot /></option>'
        },
        'a-button': Button,
        'a-tag': { name: 'ATag', template: '<span class="tag-stub"><slot /></span>' },
        'a-checkbox': { name: 'ACheckbox', template: '<input class="checkbox-stub" type="checkbox" />' },
        'a-dropdown': PASS_THROUGH('ADropdown'),
        'a-menu': PASS_THROUGH('AMenu'),
        'a-menu-item': PASS_THROUGH('AMenuItem'),
        'a-modal': PASS_THROUGH('AModal'),
        'a-form': Form,
        'a-form-item': FormItem,
        'a-row': Row,
        'a-col': Col,
        // 视图切换走屏上真实的切换按钮，不直接改 viewMode
        'a-radio-group': RadioGroup,
        'a-radio-button': RadioButton
      }
    }
  })
  await flushPromises()
  return wrapper
}

/** 切到列表视图：点屏上第二个单选按钮（卡片视图在前，列表视图在后） */
async function toListView(wrapper: any) {
  await wrapper.findAll('input[type="radio"]')[1].setChecked()
  await flushPromises()
}

/** 后端那一句（「真的没有」那一档下面还会多摆一颗新建按钮，比那一句时把它摘掉） */
const hintText = (wrapper: any) => {
  const node = wrapper.find('.empty-line').element.cloneNode(true) as HTMLElement
  node.querySelectorAll('.create-on-empty').forEach((button) => button.remove())
  return (node.textContent || '').trim()
}

const THREE_EMPTIES: Array<[string, string]> = [
  ['NONE', '知识卡片：这一档查过了，一条都没有。'],
  ['NOT_VISIBLE', '知识卡片：这一档读不到（选中的那个身份在这张表里没有行），所以这里不能说「没有」。'],
  ['OUT_OF_RANGE', '知识卡片：这一页翻过了头，往前面的页翻回来就有；这里没行不等于这一档没有。']
]

describe('KnowledgeCardListView 的空态成因', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it.each(THREE_EMPTIES)('列表视图：后端回 %s 那一档时逐字念那一句，页面上没有「暂无数据」', async (reason, line) => {
    const wrapper = await mountView([], { emptyReason: reason, emptyLine: line })
    await toListView(wrapper)

    expect(hintText(wrapper)).toBe(line)
    expect(wrapper.html()).not.toContain('暂无数据')
  })

  it('后端没回是哪一种空时念「界面不替它猜」，不蒙成「真的没有」', async () => {
    const wrapper = await mountView([], { emptyReason: null, emptyLine: null })
    await toListView(wrapper)

    expect(hintText(wrapper)).toContain('后端没回是哪一种空')
    expect(wrapper.html()).not.toContain('暂无数据')
    expect(wrapper.html()).not.toContain('一条都没有')
  })

  it('读失败那一发说的是读失败，不是「这一档没有」', async () => {
    const wrapper = await mountView([], {}, new Error('读口断了'))
    await toListView(wrapper)

    const said = hintText(wrapper)
    expect(said).toContain('这一发读失败：读口断了')
    expect(said).toContain('读失败不是「这一档没有」')
    expect(said).not.toContain('一条都没有')
  })

  it('后端回「这一页翻过了头」时界面自己翻回第一页再读一遍', async () => {
    const list = vi.mocked(knowledgeCardApi.list)
    const wrapper = await mountView([ROW], { emptyReason: null, emptyLine: null })
    await toListView(wrapper)
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
    await toListView(none)
    expect(none.find('.create-on-empty').exists()).toBe(true)

    const invisible = await mountView([], { emptyReason: 'NOT_VISIBLE', emptyLine: THREE_EMPTIES[1][1] })
    await toListView(invisible)
    expect(invisible.find('.create-on-empty').exists()).toBe(false)
  })

  it('有行的时候两张脸都不渲空态那一句', async () => {
    const wrapper = await mountView([ROW], { emptyReason: null, emptyLine: null })

    // 卡片视图（默认）
    expect(wrapper.find('.empty-line').exists()).toBe(false)
    await toListView(wrapper)
    // 列表视图
    expect(wrapper.find('.empty-line').exists()).toBe(false)
    expect(wrapper.html()).not.toContain('一条都没有')
  })

  it('卡片视图没行时同样念后端那一句（以前它什么都不摆）', async () => {
    const wrapper = await mountView([], { emptyReason: 'NONE', emptyLine: THREE_EMPTIES[0][1] })

    expect(hintText(wrapper)).toBe(THREE_EMPTIES[0][1])
    expect(wrapper.find('.create-on-empty').exists()).toBe(true)
    expect(wrapper.html()).not.toContain('暂无数据')
  })
})
