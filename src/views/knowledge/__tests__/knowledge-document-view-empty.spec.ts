import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { h } from 'vue'
import { Button, Col, Empty, RadioButton, RadioGroup, Row, message } from 'ant-design-vue'
import KnowledgeDocumentView from '../KnowledgeDocumentView.vue'
import { knowledgeCategoryApi, knowledgeDocumentApi, knowledgeTagApi } from '../../../api/knowledge'
import { JUMP_BACK_NOTICE } from '../../../utils/emptyPage'

/**
 * 资料库那一屏的空态（M-P74）：这一屏的空会被读成「这个项目没资料」，
 * 而它其实有三种完全不同的成因，所以「读不到」「翻过头」与「真的没有」必须念后端那一句。
 *
 * 钉六件：
 * 1. 进了项目之后，三种空各念各的，逐字比后端原文，表格空槽里不许出现「暂无数据」；
 * 2. 后端没答成因时界面不替它猜，也不能蒙成「一条都没有」；
 * 3. 读失败说的是这一发读失败，不是「这一档没有」；
 * 4. 后端回「这一页翻过了头」时界面自己翻回第一页再读一遍（最多多发一发），并 toast 一句；
 * 5. 这一屏会在服务端回的那一份上面再按 searchText/标签 在界面这边滤一遍：
 *    后端那一发是有行的（2 份），只是被搜索筛掉了——这时不许念后端那句「一条都没有」；
 * 6. 有行又没筛的时候根本不渲空态那一句。
 *
 * 手法照 users-panel-empty.spec.ts：真挂载、真点控件。进项目这一步不能偷改组件状态——
 * loadDocuments() 在没选中项目（也不是「未归类」那一档）时是直接 return 的，
 * 所以只能点项目网格里那张真卡（或「未归类」卡）。切列表视图走的也是界面自己那组单选按钮。
 */

vi.mock('ant-design-vue', async () => {
  const actual = await vi.importActual<Record<string, any>>('ant-design-vue')
  return {
    ...actual,
    message: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() }
  }
})

vi.mock('../../../api/knowledge', () => ({
  knowledgeDocumentApi: {
    list: vi.fn(),
    get: vi.fn(),
    upload: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    batchDelete: vi.fn(),
    batchSetCategory: vi.fn(),
    batchSetTags: vi.fn(),
    vectorize: vi.fn(),
    preview: vi.fn(),
    getCards: vi.fn(),
    generateCards: vi.fn()
  },
  knowledgeCategoryApi: { all: vi.fn(), create: vi.fn(), list: vi.fn(), stats: vi.fn() },
  knowledgeTagApi: { list: vi.fn() },
  knowledgeCardApi: { list: vi.fn() },
  flattenCategories: (list: any[]) => list
}))

vi.mock('../../../stores/auth', () => ({
  useAuthStore: () => ({
    selectedTenantId: 7,
    accessToken: 'token-for-test',
    user: { id: 1 },
    isSuperAdmin: false,
    hasPermission: () => true
  })
}))

const TABLE_STUB = {
  name: 'ATable',
  props: {
    dataSource: { type: Array, default: () => [] },
    columns: { type: Array, default: () => [] },
    loading: { type: Boolean, default: false },
    pagination: { type: Object, default: () => ({}) }
  },
  emits: ['change'],
  setup(props: any, { slots, emit }: any) {
    return () => {
      const rows = props.dataSource as any[]
      return h('div', { class: 'table-stub' }, [
        // 真实控件替身：翻页走的是表格自己的 change 事件，不是直接改 pagination
        h('button', { class: 'go-page', onClick: () => emit('change', { current: 3, pageSize: 20 }) }, '到第 3 页'),
        rows.length === 0
          ? h('div', { class: 'empty' }, slots.emptyText ? slots.emptyText({}) : '暂无数据')
          : rows.map((record) =>
              h('div', { class: 'row', 'data-row': record.id }, [
                h('span', { class: 'cell-name' }, String(record.originalName || record.fileName))
              ])
            )
      ])
    }
  }
}

const PASS_THROUGH = (name: string, tag = 'div') => ({
  name,
  template: `<${tag} class="${name.toLowerCase()}-stub"><slot /><slot name="cover" /><slot name="title" /><slot name="description" /><slot name="actions" /><slot name="extra" /></${tag}>`
})

/** 搜索框：输入即 v-model 落到 searchText，界面这边就再滤一遍 */
const SEARCH_STUB = {
  name: 'AInputSearch',
  props: { value: { type: String, default: '' } },
  emits: ['update:value', 'search'],
  template: `<input class="search-stub" :value="value" @input="$emit('update:value', $event.target.value)" />`
}

const DOC_ROW = {
  id: 21,
  fileName: 'intro.pdf',
  originalName: '企业介绍.pdf',
  fileSize: 2048,
  tags: [],
  parseStatus: 'SUCCESS',
  vectorStatus: 'COMPLETED',
  createdAt: '2026-10-24T00:10:00'
}

const DOC_ROW_2 = { ...DOC_ROW, id: 22, originalName: '团队照片.png' }

const THREE_EMPTIES: Array<[string, string]> = [
  ['NONE', '资料库：这一档查过了，一条都没有。'],
  ['NOT_VISIBLE', '资料库：这一档读不到（选中的那个身份在这张表里没有行），所以这里不能说「没有」。'],
  ['OUT_OF_RANGE', '资料库：这一页翻过了头，往前面的页翻回来就有；这里没行不等于这一档没有。']
]

type PageShape = { records: any[]; total: number; emptyReason?: string | null; emptyLine?: string | null }

/**
 * 项目那一头的每一发读回收到的应答，按顺序取（用完就重复最后一份）。
 * 「未归类」那张卡上摆的数是另一发（unclassified=true，size 1），跟这一屏的空态无关，固定回 0。
 */
function listHandler(responses: Array<PageShape | Error>) {
  let sent = 0
  return async (params: any) => {
    if (params?.unclassified) return { records: [], total: 0 }
    const res = responses[Math.min(sent, responses.length - 1)]
    sent += 1
    if (res instanceof Error) throw res
    return res
  }
}

const STUBS = {
  'a-card': PASS_THROUGH('ACard'),
  'a-card-meta': {
    name: 'ACardMeta',
    props: ['title'],
    template: '<div class="card-meta-stub"><span class="meta-title">{{ title }}</span><slot name="description" /></div>'
  },
  'a-space': PASS_THROUGH('ASpace'),
  'a-table': TABLE_STUB,
  'a-input-search': SEARCH_STUB,
  'a-input': { name: 'AInput', template: '<input class="input-stub" />' },
  'a-select': { name: 'ASelect', template: '<select class="select-stub"></select>' },
  'a-select-option': { name: 'ASelectOption', props: ['value'], template: '<option :value="value"><slot /></option>' },
  'a-button': Button,
  'a-tag': { name: 'ATag', template: '<span class="tag-stub"><slot /></span>' },
  'a-checkbox': { name: 'ACheckbox', template: '<input class="checkbox-stub" type="checkbox" />' },
  'a-popconfirm': PASS_THROUGH('APopconfirm'),
  'a-tooltip': PASS_THROUGH('ATooltip'),
  'a-modal': PASS_THROUGH('AModal'),
  'a-form': PASS_THROUGH('AForm'),
  'a-form-item': PASS_THROUGH('AFormItem'),
  'a-spin': PASS_THROUGH('ASpin'),
  'a-upload': PASS_THROUGH('AUpload'),
  'a-row': Row,
  'a-col': Col,
  'a-empty': Empty,
  'a-radio-group': RadioGroup,
  'a-radio-button': RadioButton,
  'a-typography-paragraph': {
    name: 'ATypographyParagraph',
    props: ['content'],
    template: '<p class="typography-stub">{{ content }}<slot /></p>'
  },
  'a-alert': { name: 'AAlert', template: '<div class="alert-stub"><slot name="message" /><slot name="description" /></div>' }
}

/** 挂好并真的走进项目里（点项目卡 → 切列表视图），返回界面 */
async function mountInProject(responses: Array<PageShape | Error>, { list = true } = {}) {
  vi.mocked(knowledgeDocumentApi.list).mockImplementation(listHandler(responses) as any)
  vi.mocked(knowledgeCategoryApi.all).mockResolvedValue({ records: [{ id: 7, name: '企业资料' }], total: 1, page: 1, size: 1, pages: 1 } as any)
  vi.mocked(knowledgeTagApi.list).mockResolvedValue([] as any)

  const wrapper = mount(KnowledgeDocumentView, {
    attachTo: document.body,
    global: { stubs: STUBS }
  })
  await flushPromises()

  // 进项目只走真控件：loadDocuments() 那一头的守卫认的是 currentCategoryId / unclassifiedMode
  await wrapper.find('.project-card').trigger('click')
  await flushPromises()

  if (list) {
    // 空槽那一格在列表视图的表格里；切视图点的是界面自己那组「网格/列表」单选按钮
    const radios = wrapper.findAll('input[type="radio"]')
    await radios[1].setValue()
    await flushPromises()
  }
  return wrapper
}

/** 后端那一句（「真的没有」那一档下面若多摆新建按钮，比那一句时先把它摘掉） */
const hintText = (wrapper: any) => {
  const node = wrapper.find('.empty-line').element.cloneNode(true) as HTMLElement
  node.querySelectorAll('.create-on-empty').forEach((button) => button.remove())
  return (node.textContent || '').trim()
}

/** 发给后端的、按项目滤的那几发（「未归类」那一发是数孤儿行的，不算） */
const categoryCalls = () =>
  vi.mocked(knowledgeDocumentApi.list).mock.calls
    .map((call: any[]) => call[0] as any)
    .filter((params) => params?.categoryId != null)

describe('KnowledgeDocumentView 的空态成因（资料库，M-P74）', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it.each(THREE_EMPTIES)('进了项目，后端回 %s 那一档时表格空槽里逐字念那一句，页面上没有「暂无数据」', async (reason, line) => {
    const wrapper = await mountInProject([{ records: [], total: reason === 'NONE' ? 0 : 25, emptyReason: reason, emptyLine: line }])

    expect(wrapper.find('.table-stub .empty .empty-line').exists()).toBe(true)
    expect(hintText(wrapper)).toBe(line)
    expect(wrapper.html()).not.toContain('暂无数据')
  })

  it('网格视图那一个空位也念后端那一句，不再自己写「暂无文件」', async () => {
    const wrapper = await mountInProject(
      [{ records: [], total: 0, emptyReason: 'NONE', emptyLine: THREE_EMPTIES[0][1] }],
      { list: false }
    )

    expect(hintText(wrapper)).toBe(THREE_EMPTIES[0][1])
    expect(wrapper.html()).not.toContain('暂无文件')
    expect(wrapper.html()).not.toContain('暂无数据')
  })

  it('后端没回是哪一种空时念「界面不替它猜」，不蒙成「一条都没有」', async () => {
    const wrapper = await mountInProject([{ records: [], total: 0, emptyReason: null, emptyLine: null }])

    expect(hintText(wrapper)).toContain('后端没回是哪一种空')
    expect(wrapper.html()).not.toContain('暂无数据')
    expect(wrapper.html()).not.toContain('一条都没有')
  })

  it('读失败那一发说的是读失败，不是「这一档没有」', async () => {
    const wrapper = await mountInProject([new Error('读口断了')])

    const said = hintText(wrapper)
    expect(said).toContain('这一发读失败：读口断了')
    expect(said).toContain('读失败不是「这一档没有」')
    expect(said).not.toContain('一条都没有')
    expect(wrapper.html()).not.toContain('暂无数据')
  })

  it('后端回「这一页翻过了头」时界面自己翻回第一页再读一遍，并 toast 一句动作说明', async () => {
    const wrapper = await mountInProject([
      { records: [DOC_ROW], total: 2, emptyReason: null, emptyLine: null },
      { records: [], total: 25, emptyReason: 'OUT_OF_RANGE', emptyLine: THREE_EMPTIES[2][1] },
      { records: [], total: 0, emptyReason: 'NONE', emptyLine: THREE_EMPTIES[0][1] }
    ])

    await wrapper.find('.go-page').trigger('click')
    await flushPromises()

    expect(categoryCalls()).toHaveLength(3)
    expect(categoryCalls()[1]).toEqual(expect.objectContaining({ page: 3 }))
    expect(knowledgeDocumentApi.list).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, categoryId: 7 }))
    expect(message.info).toHaveBeenCalledWith(JUMP_BACK_NOTICE)
    expect(hintText(wrapper)).toBe(THREE_EMPTIES[0][1])
  })

  it('后端回了 2 份、只是被界面这边的搜索筛掉时，说的是「被筛掉的」，不念后端那句「一条都没有」', async () => {
    const wrapper = await mountInProject(
      // 后端这一发是有行的：把它当「真的没有」念就是谎报
      [{ records: [DOC_ROW, DOC_ROW_2], total: 2, emptyReason: 'NONE', emptyLine: THREE_EMPTIES[0][1] }]
    )
    await wrapper.find('.search-stub').setValue('根本搜不到的关键字')
    await flushPromises()

    expect(wrapper.html()).toContain('这一页读了 2 份，是被上面的搜索或标签筛掉的，不是「这个项目没资料」')
    expect(wrapper.find('.empty-line').exists()).toBe(false)
    expect(wrapper.html()).not.toContain('一条都没有')
    expect(wrapper.html()).not.toContain('暂无数据')
  })

  it('有行又没筛的时候根本不渲空态那一句', async () => {
    const wrapper = await mountInProject([{ records: [DOC_ROW, DOC_ROW_2], total: 2, emptyReason: null, emptyLine: null }])

    expect(wrapper.find('.empty').exists()).toBe(false)
    expect(wrapper.find('.empty-line').exists()).toBe(false)
    expect(wrapper.findAll('.row')).toHaveLength(2)
    expect(wrapper.html()).not.toContain('一条都没有')
  })
})
