import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { h } from 'vue'
import { Button, message } from 'ant-design-vue'
import ArticleTemplateManageView from '../ArticleTemplateManageView.vue'
import { articleTemplateApi } from '../../../api/articleTemplate'
import { JUMP_BACK_NOTICE } from '../../../utils/emptyPage'

/**
 * 软文模板管理那一屏（M-P86）。三件事各钉一组：
 *
 * 1. 空态：这一屏的空从前只有一句写死的「暂无模板」，「真的没有」「这一页翻过了头」
 *    「这一发读失败」「上一批的行还挂着」四种念法长成一个样。接上后端成因后必须分开念，
 *    而且列表那一档与卡片那一档说的是同一发读数，两句必须一模一样。
 * 2. 「模板类型」那一格从前发的是参数 type，后端读的是 templateType ⇒ 点它等于没筛（实测过）。
 * 3. 两只下拉的选项与中文名的唯一出处是后端的 /types 与 /categories：
 *    从前界面硬编码两份，其中分类那六档在库里全是 0 行。
 */

vi.mock('ant-design-vue', async () => {
  const actual = await vi.importActual<Record<string, any>>('ant-design-vue')
  return {
    ...actual,
    message: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
  }
})

vi.mock('../../../api/articleTemplate', () => ({
  articleTemplateApi: {
    list: vi.fn(),
    stats: vi.fn(),
    types: vi.fn(),
    categories: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    clone: vi.fn(),
    versions: vi.fn(),
  },
}))

vi.mock('../../../stores/auth', () => ({
  useAuthStore: () => ({
    selectedTenantId: null,
    tenantId: 1,
    user: { id: 1 },
    isSuperAdmin: true,
    hasPermission: () => true,
  }),
}))

/** 词表替身：故意用界面上绝不可能自己编出来的名字，这样「选项从哪儿来的」一测就露底 */
const TYPES = [
  { value: 'hotword', label: 'W-热词' },
  { value: 'case', label: 'W-案例' },
]
const CATEGORIES = [{ value: 'news', label: 'X-新闻' }]

const ROW = {
  id: 6,
  name: '软文模板甲',
  type: 'hotword',
  category: 'news',
  description: '示例',
  content: '内容',
  variables: [],
  version: '4',
  useCount: 12,
  isSystem: false,
  status: 'active',
  createdAt: '2026-10-20T09:00:00',
  updatedAt: '2026-10-20T10:00:00',
}

const PAGE_BASE = { page: 1, size: 12, pages: 1 }

/**
 * 表格替身挂真实控件：翻页走表格自己的 change 事件；空的那一发渲 #emptyText 槽；
 * 有行的时候逐列调 #bodyCell，这样「类型/分类那一格念的是哪份词表」也测得到。
 */
const TABLE_STUB = {
  name: 'ATable',
  props: {
    dataSource: { type: Array, default: () => [] },
    columns: { type: Array, default: () => [] },
    pagination: { type: [Object, Boolean], default: () => ({}) },
  },
  emits: ['change'],
  setup(props: any, { slots, emit }: any) {
    return () => {
      const rows = props.dataSource as any[]
      return h('div', { class: 'table-stub' }, [
        h(
          'button',
          { class: 'go-page', onClick: () => emit('change', { current: 3, pageSize: 12 }) },
          '到第 3 页'
        ),
        rows.length === 0
          ? h('div', { class: 'empty' }, slots.emptyText ? slots.emptyText({}) : '暂无数据')
          : rows.map(record =>
              h('div', { class: 'row', 'data-row': record.id }, [
                ...(props.columns as any[]).map(column =>
                  h(
                    'span',
                    { class: `cell cell-${column.key}` },
                    slots.bodyCell
                      ? slots.bodyCell({ column, record, index: 0, text: record[column.dataIndex] })
                      : [String(record[column.dataIndex] ?? '')]
                  )
                ),
              ])
            ),
      ])
    }
  },
}

/** 真实下拉：change 时既回写 v-model 又触发 @change，与 a-select 的对外契约一致 */
const SELECT_STUB = {
  name: 'ASelect',
  props: {
    value: { type: [String, Number, Array], default: undefined },
    placeholder: { type: String, default: '' },
  },
  emits: ['update:value', 'change'],
  setup(props: any, { slots, emit }: any) {
    return () =>
      h(
        'select',
        {
          class: 'select-stub',
          'data-placeholder': props.placeholder,
          onChange: (event: Event) => {
            const next = (event.target as HTMLSelectElement).value
            emit('update:value', next)
            emit('change', next)
          },
        },
        slots.default ? slots.default({}) : []
      )
  },
}

const PASS_THROUGH = (name: string, tag = 'div') => ({
  name,
  template: `<${tag} class="${name.toLowerCase()}-stub"><slot /><slot name="overlay" /></${tag}>`,
})

async function mountView(options: {
  rows?: any[]
  total?: number
  emptyReason?: string | null
  emptyLine?: string | null
  failWith?: Error
} = {}) {
  const { rows = [], total = rows.length, emptyReason = null, emptyLine = null, failWith } = options
  vi.mocked(articleTemplateApi.types).mockResolvedValue(TYPES as any)
  vi.mocked(articleTemplateApi.categories).mockResolvedValue(CATEGORIES as any)
  vi.mocked(articleTemplateApi.stats).mockResolvedValue({
    totalCount: 4,
    systemCount: 4,
    hotKeywordCount: 0,
    caseCount: 0,
    customCount: 0,
  } as any)
  vi.mocked(articleTemplateApi.list).mockImplementation(() =>
    failWith
      ? Promise.reject(failWith)
      : Promise.resolve({ records: rows, total, emptyReason, emptyLine, ...PAGE_BASE } as any)
  )

  const wrapper = mount(ArticleTemplateManageView, {
    attachTo: document.body,
    global: {
      stubs: {
        'a-spin': PASS_THROUGH('ASpin'),
        'a-card': PASS_THROUGH('ACard', 'section'),
        'a-row': PASS_THROUGH('ARow'),
        'a-col': PASS_THROUGH('ACol'),
        'a-space': PASS_THROUGH('ASpace'),
        'filter-bar': PASS_THROUGH('FilterBar'),
        'a-table': TABLE_STUB,
        'a-select': SELECT_STUB,
        'a-select-option': {
          name: 'ASelectOption',
          props: ['value'],
          template: '<option :value="value"><slot /></option>',
        },
        'a-input-search': { name: 'AInputSearch', template: '<input class="search-stub" />' },
        'a-input': { name: 'AInput', template: '<input class="input-stub" />' },
        'a-textarea': { name: 'ATextarea', template: '<textarea class="textarea-stub"></textarea>' },
        'a-radio-group': PASS_THROUGH('ARadioGroup'),
        'a-radio-button': PASS_THROUGH('ARadioButton', 'span'),
        'a-tag': { name: 'ATag', template: '<span class="tag-stub"><slot /></span>' },
        'a-button': Button,
        'a-popconfirm': PASS_THROUGH('APopconfirm'),
        'a-dropdown': PASS_THROUGH('ADropdown'),
        'a-menu': PASS_THROUGH('AMenu', 'ul'),
        'a-menu-item': { name: 'AMenuItem', template: '<li class="menu-item-stub"><slot /></li>' },
        'a-menu-divider': { name: 'AMenuDivider', template: '<hr class="menu-divider-stub" />' },
        'a-modal': {
          name: 'AModal',
          props: ['open'],
          template: '<div class="modal-stub"><slot v-if="open" /></div>',
        },
        // 真实 a-empty 会把 description 那一格念出来，替身要跟着念，否则「换回写死那一句」的变异测不出来
        'a-empty': {
          name: 'AEmpty',
          props: { description: { type: String, default: '' } },
          template: '<div class="empty-stub">{{ description }}<slot /></div>'
        },
        'a-tabs': PASS_THROUGH('ATabs'),
        'a-tab-pane': { name: 'ATabPane', template: '<div class="tab-pane-stub"><slot /></div>' },
        'a-timeline': PASS_THROUGH('ATimeline'),
        'a-timeline-item': { name: 'ATimelineItem', template: '<li class="timeline-item-stub"><slot /></li>' },
      },
    },
  })
  await flushPromises()
  return wrapper
}

/** 空态那一格：列表与卡片两处都要念，摘掉「真的没有」下面那颗新建按钮后逐字比 */
function hintTexts(wrapper: any): string[] {
  return wrapper.findAll('.empty-line').map((node: any) => {
    const clone = node.element.cloneNode(true) as HTMLElement
    clone.querySelectorAll('.create-on-empty').forEach(button => button.remove())
    return (clone.textContent || '').trim()
  })
}

/** 最后一发列表请求带出去的查询参数（tsconfig 的 lib 没有 Array.prototype.at，这里按末位下标取） */
function lastListParams(): Record<string, any> {
  const calls = vi.mocked(articleTemplateApi.list).mock.calls
  return calls[calls.length - 1][0] as unknown as Record<string, any>
}

const NONE_LINE = '软文模板：这一档查过了，一条都没有。'
const NOT_VISIBLE_LINE = '软文模板：这一档读不到（选中的那个身份在这张表里没有行），所以这里不能说「没有」。'
const OUT_OF_RANGE_LINE = '软文模板：这一页翻过了头，往前面的页翻回来就有；这里没行不等于这一档没有。'

const THREE_EMPTIES: Array<[string, string]> = [
  ['NONE', NONE_LINE],
  ['NOT_VISIBLE', NOT_VISIBLE_LINE],
  ['OUT_OF_RANGE', OUT_OF_RANGE_LINE],
]

describe('软文模板管理屏的空态', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it.each(THREE_EMPTIES)('后端回 %s 那一档时列表与卡片两处都逐字念那一句', async (reason, line) => {
    const wrapper = await mountView({ emptyReason: reason, emptyLine: line })

    // 两处：a-table 的 #emptyText 与卡片那一档，说的是同一发读数
    expect(hintTexts(wrapper)).toEqual([line, line])
    expect(wrapper.html()).not.toContain('暂无模板')
  })

  it('后端没回是哪一种空时念「界面不替它猜」，不蒙成「真的没有」', async () => {
    const wrapper = await mountView({ emptyReason: null, emptyLine: null })

    expect(hintTexts(wrapper)[0]).toContain('后端没回是哪一种空')
    expect(wrapper.html()).not.toContain('暂无模板')
    expect(wrapper.html()).not.toContain('一条都没有')
  })

  it('读失败那一发说的是读失败，不是「这一档没有」', async () => {
    const wrapper = await mountView({ failWith: new Error('读口断了') })

    const said = hintTexts(wrapper)[0]
    expect(said).toContain('这一发读失败：读口断了')
    expect(said).toContain('读失败不是「这一档没有」')
    expect(said).not.toContain('一条都没有')
  })

  it('读失败那一发把上一批的行清掉，不许挂着旧行当这一发的读数', async () => {
    const wrapper = await mountView({ rows: [ROW] })
    expect(wrapper.findAll('.row')).toHaveLength(1)

    vi.mocked(articleTemplateApi.list).mockImplementation(() => Promise.reject(new Error('这一发断了')))
    await wrapper.find('.go-page').trigger('click')
    await flushPromises()

    expect(wrapper.findAll('.row')).toHaveLength(0)
    expect(hintTexts(wrapper)[0]).toContain('这一发读失败：这一发断了')
  })

  it('后端回「这一页翻过了头」时界面自己翻回第一页再读一遍', async () => {
    const list = vi.mocked(articleTemplateApi.list)
    const wrapper = await mountView({ rows: [ROW] })

    list
      .mockImplementationOnce(() =>
        Promise.resolve({ records: [], total: 25, emptyReason: 'OUT_OF_RANGE', emptyLine: OUT_OF_RANGE_LINE, page: 3, size: 12, pages: 2 } as any)
      )
      .mockImplementationOnce(() =>
        Promise.resolve({ records: [], total: 0, emptyReason: 'NONE', emptyLine: NONE_LINE, ...PAGE_BASE } as any)
      )

    await wrapper.find('.go-page').trigger('click')
    await flushPromises()

    expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1 }))
    expect(message.info).toHaveBeenCalledWith(JUMP_BACK_NOTICE)
    expect(hintTexts(wrapper)).toEqual([NONE_LINE, NONE_LINE])
  })

  it('「真的没有」才摆新建按钮，读不到不摆', async () => {
    const none = await mountView({ emptyReason: 'NONE', emptyLine: NONE_LINE })
    expect(none.findAll('.create-on-empty')).toHaveLength(2)

    const invisible = await mountView({ emptyReason: 'NOT_VISIBLE', emptyLine: NOT_VISIBLE_LINE })
    expect(invisible.find('.create-on-empty').exists()).toBe(false)
  })

  it('有行的时候根本不渲空态那一句', async () => {
    const wrapper = await mountView({ rows: [ROW] })

    expect(wrapper.find('.empty').exists()).toBe(false)
    expect(wrapper.findAll('.empty-line')).toHaveLength(0)
    expect(wrapper.html()).not.toContain('一条都没有')
  })
})

describe('软文模板管理屏的筛选参数名', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('点「模板类型」那一格发出去的是 templateType，不是没人读的 type', async () => {
    const wrapper = await mountView({ rows: [ROW] })
    const typeSelect = wrapper.find('select[data-placeholder="模板类型"]')

    await typeSelect.setValue('case')
    await flushPromises()

    const sent = lastListParams()
    expect(sent.templateType).toBe('case')
    expect(sent).not.toHaveProperty('type')
  })

  it('清空「模板类型」后那一格不再带上，回到不加筛的读数', async () => {
    const wrapper = await mountView({ rows: [ROW] })
    const typeSelect = wrapper.find('select[data-placeholder="模板类型"]')

    await typeSelect.setValue('case')
    await flushPromises()
    await typeSelect.setValue('')
    await flushPromises()

    const sent = lastListParams()
    expect(sent.templateType).toBeUndefined()
  })
})

describe('软文模板管理屏的词表', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('两只下拉的选项就是后端 /types 与 /categories 回的那几档', async () => {
    const wrapper = await mountView({ rows: [ROW] })

    const typeOptions = wrapper
      .find('select[data-placeholder="模板类型"]')
      .findAll('option')
      .map(option => option.text())
    const categoryOptions = wrapper
      .find('select[data-placeholder="分类筛选"]')
      .findAll('option')
      .map(option => option.text())

    expect(typeOptions).toEqual(['W-热词', 'W-案例'])
    expect(categoryOptions).toEqual(['X-新闻'])
    // 从前硬编码那六档分类在库里全是 0 行，这里必须一个字都不剩
    expect(wrapper.html()).not.toContain('科技')
    expect(wrapper.html()).not.toContain('财经')
    expect(wrapper.html()).not.toContain('hot_keyword')
  })

  it('类型与分类那两格念的也是同一份词表，不是库里那个英文原词', async () => {
    const wrapper = await mountView({ rows: [ROW] })

    expect(wrapper.find('.cell-type').text()).toBe('W-热词')
    expect(wrapper.find('.cell-category').text()).toBe('X-新闻')
    // 卡片那一档说的是同一行，念法不许和列表两样
    expect(wrapper.find('.card-type-tag').text()).toBe('W-热词')
  })
})
