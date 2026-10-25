import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { h } from 'vue'
import { Button, message } from 'ant-design-vue'
import KeywordLibraryView from '../KeywordLibraryView.vue'
import { keywordApi } from '../../../api'
import { JUMP_BACK_NOTICE } from '../../../utils/emptyPage'

/**
 * 关键词库这一屏的空态（M-P76）。
 *
 * 这一屏以前有两个谎：
 * 1. 表格里没行时，`DataTable` 摆的是自己那块固定话术（「调整筛选条件，或新建一条记录」），
 *    而「这一家读不到」和「真的没有」是两回事——那句「新建一条」对前者是让人去补一份根本不缺的东西；
 * 2. `loadKeywords()` 只有 `finally` 没有 `catch`：这一发读失败时表格还留着上一批行，
 *    人既看不出它失败了，也可能把旧数当新数。
 *
 * 钉七件：
 * 1. 三种空各念各的，逐字比后端原文，页面上不许出现「暂无数据」，也不许出现那块固定话术；
 * 2. 后端没答成因时界面不替它猜；
 * 3. 读失败说的是读失败，旧行不许留着；
 * 4. 后端回「这一页翻过了头」时界面自己翻回第一页再读一遍，并给一句动作说明；
 * 5. 「真的没有」才摆「导入关键词」那颗按钮，读不到不摆；点它真的打得开导入框（不是个装饰）；
 * 6. 有行的时候不渲空态那一句；
 * 7. 点「查询」重读时句子仍然只来自后端那一格（重读不许留旧句、也不许自己补一档）。
 */

vi.mock('ant-design-vue', async () => {
  const actual = await vi.importActual<Record<string, any>>('ant-design-vue')
  return {
    ...actual,
    message: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() }
  }
})

vi.mock('vue-router', async () => {
  const actual = await vi.importActual<Record<string, any>>('vue-router')
  return { ...actual, useRouter: () => ({ push: vi.fn() }) }
})

// 这一屏有两张 echarts 图，jsdom 里 init 会炸；图不是这一份用例要钉的东西
vi.mock('echarts', () => ({
  init: () => ({ setOption: vi.fn(), resize: vi.fn(), dispose: vi.fn() })
}))

vi.mock('../../../api', () => ({
  keywordApi: {
    list: vi.fn(),
    getLibraryStats: vi.fn(),
    getExpandConfig: vi.fn(),
    expand: vi.fn(),
    updateExpandConfig: vi.fn(),
    importKeywords: vi.fn(),
    batchUpdatePriority: vi.fn(),
    batchDelete: vi.fn()
  }
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

// 真实挂载 DataTable，只把最里层的 a-table 换成替身：
// 空态那一句到底是谁摆的（DataTable 那块 StateBlock 还是页面传进去的 #emptyText）就钉在这一层
const TABLE_STUB = {
  name: 'ATable',
  props: {
    dataSource: { type: Array, default: () => [] },
    pagination: { type: [Object, Boolean], default: false }
  },
  setup(props: any, { slots }: any) {
    return () => {
      const rows = props.dataSource as any[]
      const children: any[] = []
      if (rows.length > 0) {
        children.push(...rows.map((record) =>
          h('div', { class: 'row', 'data-row': record.id }, [String(record.rawKeyword ?? record.id)])))
      } else if (slots.emptyText) {
        children.push(h('div', { class: 'empty' }, slots.emptyText({})))
      } else {
        children.push(h('div', { class: 'empty' }, '暂无数据'))
      }
      const pagination = props.pagination
      if (pagination && typeof pagination === 'object' && typeof pagination.onChange === 'function') {
        // 翻页走屏上那一份配置自己的 onChange（服务器端分页），不直接改视图里的 currentPage
        children.push(h('button', {
          class: 'go-page',
          onClick: () => pagination.onChange(9, pagination.pageSize ?? 20)
        }, '到第 9 页'))
      }
      return h('div', { class: 'table-stub' }, children)
    }
  }
}

const PASS_THROUGH = (name: string, tag = 'div') => ({
  name,
  template: `<${tag} class="${name.toLowerCase()}-stub"><slot /><slot name="actions" /><slot name="title" /><slot name="message" /></${tag}>`
})

const ROW = {
  id: 7,
  tenantId: 1,
  rawKeyword: '种植牙集采后价格降了多少',
  normalizedKeyword: '种植牙 价格',
  category: '基础',
  suggestionCount: 3,
  articleCount: 0,
  status: 'pending',
  sourceCodes: 'A',
  priority: 0,
  createdAt: '2026-10-25T09:00:00'
}

type PageShape = { records: any[]; total: number; emptyReason?: string | null; emptyLine?: string | null }

async function mountView(
  rows: any[],
  pageExtras: Omit<PageShape, 'records' | 'total'> = {},
  failWith?: Error
) {
  const list = vi.mocked(keywordApi.list)
  if (failWith) {
    list.mockRejectedValue(failWith)
  } else {
    list.mockResolvedValue({ records: rows, total: rows.length, ...pageExtras } as any)
  }
  vi.mocked(keywordApi.getLibraryStats).mockResolvedValue({} as any)
  vi.mocked(keywordApi.getExpandConfig).mockResolvedValue({} as any)

  const wrapper = mount(KeywordLibraryView, {
    attachTo: document.body,
    global: {
      stubs: {
        'filter-bar': { name: 'FilterBar', template: '<div class="filter-bar-stub"><slot /><slot name="actions" /></div>' },
        'a-card': PASS_THROUGH('ACard'),
        'a-spin': PASS_THROUGH('ASpin'),
        'a-table': TABLE_STUB,
        'a-tooltip': PASS_THROUGH('ATooltip'),
        'a-select': { name: 'ASelect', template: '<select class="select-stub"></select>' },
        'a-select-option': { name: 'ASelectOption', props: ['value'], template: '<option :value="value"><slot /></option>' },
        'a-input': { name: 'AInput', template: '<input class="input-stub" />' },
        'a-input-search': { name: 'AInputSearch', template: '<input class="search-stub" />' },
        'a-textarea': { name: 'ATextarea', template: '<textarea class="textarea-stub"></textarea>' },
        'a-button': Button,
        'a-tag': { name: 'ATag', template: '<span class="tag-stub"><slot /></span>' },
        'a-checkbox': { name: 'ACheckbox', template: '<input class="checkbox-stub" type="checkbox" />' },
        'a-switch': { name: 'ASwitch', template: '<input class="switch-stub" type="checkbox" />' },
        'a-alert': PASS_THROUGH('AAlert'),
        'a-space': PASS_THROUGH('ASpace'),
        'a-modal': {
          name: 'AModal',
          props: { open: { type: Boolean, default: false }, title: { type: String, default: '' } },
          template: '<div v-if="open" class="modal-open-stub" :data-title="title"><slot /><slot name="footer" /></div>'
        },
        'a-form': { name: 'AForm', template: '<form><slot /></form>' },
        'a-form-item': { name: 'AFormItem', template: '<div><slot /></div>' }
      }
    }
  })
  await flushPromises()
  return wrapper
}

/** 屏上那颗真的「查询」按钮：重读走它，不直接调 loadKeywords */
async function clickQuery(wrapper: any) {
  const button = wrapper.findAll('button').filter((b: any) => b.text().includes('查询'))[0]
  expect(button).toBeDefined()
  await button.trigger('click')
  await flushPromises()
}

/** 后端那一句（「真的没有」那一档下面多摆的那颗按钮比句子时摘掉） */
const hintText = (wrapper: any) => {
  const node = wrapper.find('.empty-line').element.cloneNode(true) as HTMLElement
  node.querySelectorAll('.create-on-empty').forEach((button) => button.remove())
  return (node.textContent || '').trim()
}

const THREE_EMPTIES: Array<[string, string]> = [
  ['NONE', '关键词：这一档查过了，一条都没有。'],
  ['NOT_VISIBLE', '关键词：这一档读不到（选中的那个身份在这张表里没有行），所以这里不能说「没有」。'],
  ['OUT_OF_RANGE', '关键词：这一页翻过了头，往前面的页翻回来就有；这里没行不等于这一档没有。']
]

describe('KeywordLibraryView 的空态成因', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it.each(THREE_EMPTIES)('后端回 %s 那一档时逐字念那一句，页面上没有「暂无数据」也没有那块固定话术', async (reason, line) => {
    const wrapper = await mountView([], { emptyReason: reason, emptyLine: line })

    expect(hintText(wrapper)).toBe(line)
    expect(wrapper.html()).not.toContain('暂无数据')
    expect(wrapper.html()).not.toContain('调整筛选条件，或新建一条记录')
  })

  it('后端没回是哪一种空时念「界面不替它猜」，不蒙成「真的没有」', async () => {
    const wrapper = await mountView([], { emptyReason: null, emptyLine: null })

    expect(hintText(wrapper)).toContain('后端没回是哪一种空')
    expect(wrapper.html()).not.toContain('暂无数据')
    expect(wrapper.html()).not.toContain('一条都没有')
  })

  it('读失败那一发说的是读失败，且把上一批行清掉（旧行留着当新数是第二个谎）', async () => {
    const list = vi.mocked(keywordApi.list)
    const wrapper = await mountView([ROW], { emptyReason: null, emptyLine: null })
    expect(wrapper.find('.row').exists()).toBe(true)

    list.mockRejectedValue(new Error('读口断了'))
    await clickQuery(wrapper)

    const said = hintText(wrapper)
    expect(said).toContain('这一发读失败：读口断了')
    expect(said).toContain('读失败不是「这一档没有」')
    expect(said).not.toContain('一条都没有')
    expect(message.error).toHaveBeenCalledWith('加载关键词列表失败：读口断了')
    expect(wrapper.find('.row').exists()).toBe(false)
  })

  it('后端回「这一页翻过了头」时界面自己翻回第一页再读一遍', async () => {
    const list = vi.mocked(keywordApi.list)
    const wrapper = await mountView([ROW], { emptyReason: null, emptyLine: null })
    // 点第 9 页那一发后端答「翻过了头」，界面跟着翻回第一页再读一发，第二发才是「真的没有」
    list
      .mockResolvedValueOnce({ records: [], total: 175, page: 9, emptyReason: 'OUT_OF_RANGE', emptyLine: THREE_EMPTIES[2][1] } as any)
      .mockResolvedValueOnce({ records: [], total: 0, page: 1, emptyReason: 'NONE', emptyLine: THREE_EMPTIES[0][1] } as any)

    await wrapper.find('.go-page').trigger('click')
    await flushPromises()

    expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1 }))
    expect(message.info).toHaveBeenCalledWith(JUMP_BACK_NOTICE)
    expect(hintText(wrapper)).toBe(THREE_EMPTIES[0][1])
  })

  it('「真的没有」才摆「导入关键词」，点它真的打得开导入框；读不到不摆', async () => {
    const none = await mountView([], { emptyReason: 'NONE', emptyLine: THREE_EMPTIES[0][1] })
    const create = none.find('.create-on-empty')
    expect(create.exists()).toBe(true)
    expect(create.text()).toBe('导入关键词')
    expect(none.find('.modal-open-stub').exists()).toBe(false)
    await create.trigger('click')
    await flushPromises()
    expect(none.find('.modal-open-stub').attributes('data-title')).toBe('手动导入关键词（一行一个）')

    const invisible = await mountView([], { emptyReason: 'NOT_VISIBLE', emptyLine: THREE_EMPTIES[1][1] })
    expect(invisible.find('.create-on-empty').exists()).toBe(false)
  })

  it('有行的时候不渲空态那一句', async () => {
    const wrapper = await mountView([ROW], { emptyReason: null, emptyLine: null })

    expect(wrapper.find('.empty-line').exists()).toBe(false)
    expect(wrapper.html()).not.toContain('一条都没有')
    expect(wrapper.find('.row').text()).toContain('种植牙集采后价格降了多少')
  })

  it('点「查询」重读时念的还是后端那一格（界面不自己补一档，也不留旧句）', async () => {
    const list = vi.mocked(keywordApi.list)
    const wrapper = await mountView([], { emptyReason: 'NOT_VISIBLE', emptyLine: THREE_EMPTIES[1][1] })

    expect(hintText(wrapper)).toBe(THREE_EMPTIES[1][1])
    expect(list).toHaveBeenCalledTimes(1)

    await clickQuery(wrapper)

    expect(list).toHaveBeenCalledTimes(2)
    expect(hintText(wrapper)).toBe(THREE_EMPTIES[1][1])
  })
})
