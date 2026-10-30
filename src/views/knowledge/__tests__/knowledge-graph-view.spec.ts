import { beforeEach, describe, expect, it, vi } from 'vitest'
import { h } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { Button, message } from 'ant-design-vue'
import KnowledgeGraphView from '../KnowledgeGraphView.vue'
import { knowledgeGraphApi } from '../../../api/knowledge'
import * as echarts from 'echarts'

/**
 * 知识图谱那一屏（M-P96）。
 *
 * 改前这一屏读的是另一套键名：节点读 `label`（后端回 `name`）、连线读 `edges`（后端回 `links`）、
 * 三张卡读 `stats.totalEntities`（后端回 `nodeCount/totalEntities` 且总数被 limit 截断）、
 * 「最近提取」两块读 `entities/relations`（后端从来没回）。现场读数：库里有 3 个实体、2 条关系，
 * 界面上三张卡全是 0、两块「最近」全是「暂无数据」、画布上一个点都没有。
 * 另外三个筛选只有一个（恰好选一个实体类型时）会发出去，另外两个从来没发过，
 * 而「应用筛选」不管有没有真筛都念一句「筛选已应用」。
 *
 * 用例钉：① 节点名/连线/连线标签取后端真字段；② 三张卡摆后端真总数；③ 读失败摆 — 且念读失败；
 * ④ 空图念后端那一句；⑤ 画布截断要说清楚；⑥ 首屏三个筛选参数都在（置信度默认不过滤）；
 * ⑦ 读失败时不许念「已应用」。
 */

vi.mock('ant-design-vue', async () => {
  const actual = await vi.importActual<Record<string, any>>('ant-design-vue')
  return {
    ...actual,
    message: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn(), loading: vi.fn() }
  }
})

vi.mock('../../../api/knowledge', () => ({
  knowledgeGraphApi: {
    getGraph: vi.fn(),
    getNeighbors: vi.fn(),
    search: vi.fn(),
    rebuild: vi.fn(),
    getRebuildStatus: vi.fn()
  },
  knowledgeEntityApi: { extractFromDocument: vi.fn(), confirmExtraction: vi.fn() },
  knowledgeDocumentApi: { list: vi.fn() }
}))

vi.mock('../../../stores/auth', () => ({
  useAuthStore: () => ({ selectedTenantId: 1, tenantId: 1, user: { id: 1 } })
}))

// echarts 在这间屋子里画不出东西，但「喂给它的 option」正是要钉的东西
vi.mock('echarts', () => {
  const instance = {
    setOption: vi.fn(),
    on: vi.fn(),
    resize: vi.fn(),
    dispose: vi.fn(),
    dispatchAction: vi.fn()
  }
  return { init: vi.fn(() => instance) }
})

const PASS = (name: string) => ({
  name,
  props: ['title', 'open', 'activeKey', 'value', 'dataSource', 'layout', 'checked'],
  template: '<div class="stub"><slot /><slot name="extra" /><slot name="prefix" /><slot name="description" /></div>'
})

// 两处「最近提取」走 a-list 的 #renderItem，替身必须真把那一段逐行画出来，否则测的只是替身
const LIST_STUB = {
  name: 'AList',
  props: {
    dataSource: { type: Array, default: () => [] as unknown[] },
    // 真 antd 的 a-list 空着时念的就是 locale.emptyText（见 node_modules/ant-design-vue/es/list/index.js），替身照这个形状来
    locale: { type: Object, default: undefined }
  },
  setup(props: any, { slots }: any) {
    return () => {
      const rows = props.dataSource as any[]
      if (rows.length > 0) return rows.map((item) => slots.renderItem?.({ item }))
      return h('div', { class: 'list-empty-stub' }, props.locale?.emptyText ?? '')
    }
  }
}
const LIST_ITEM_META_STUB = {
  name: 'AListItemMeta',
  template: '<div class="list-item-meta"><slot name="avatar" /><slot name="title" /><slot name="description" /></div>'
}

const STATISTIC_STUB = {
  name: 'AStatistic',
  props: { title: String, value: [String, Number] },
  template: '<div class="stat"><div class="stat-title">{{ title }}</div><div class="stat-value">{{ value }}</div></div>'
}
const ALERT_STUB = {
  name: 'AAlert',
  props: { message: String },
  template: '<div class="alert-stub">{{ message }}</div>'
}
const EMPTY_STUB = {
  name: 'AEmpty',
  props: { description: String },
  template: '<div class="empty-stub">{{ description }}</div>'
}

const NODE_A = {
  id: 1,
  name: 'MP96-Alpha',
  type: 'CONCEPT',
  description: '甲',
  confidence: 0.9,
  degree: 2,
  createdAt: '2026-10-30T01:00:00'
}
const NODE_B = { id: 2, name: 'MP96-Beta', type: 'CONCEPT', description: '乙', confidence: 0.8, degree: 1 }
const NODE_C = { id: 3, name: 'MP96-Gamma', type: 'ORG', description: '丙', confidence: 0.6, degree: 1 }
const LINK_1 = {
  id: 1,
  source: 1,
  target: 2,
  sourceName: 'MP96-Alpha',
  targetName: 'MP96-Beta',
  relationType: 'RELATED_TO',
  confidence: 0.9
}
const LINK_2 = {
  id: 2,
  source: 1,
  target: 3,
  sourceName: 'MP96-Alpha',
  targetName: 'MP96-Gamma',
  relationType: 'BELONGS_TO',
  confidence: 0.6
}

function graphRead(overrides: Record<string, unknown> = {}) {
  return {
    nodes: [NODE_A, NODE_B, NODE_C],
    links: [LINK_1, LINK_2],
    nodeCount: 3,
    linkCount: 2,
    totalEntities: 3,
    totalRelations: 2,
    matchedEntities: 3,
    entityTypes: [
      { type: 'CONCEPT', count: 2 },
      { type: 'ORG', count: 1 }
    ],
    relationTypes: [{ type: 'RELATED_TO', count: 1 }],
    recentEntities: [NODE_A, NODE_B],
    recentRelations: [LINK_1],
    nodeLimit: 150,
    truncated: false,
    appliedTypes: [],
    appliedRelationTypes: [],
    appliedMinConfidence: 0,
    emptyReason: null,
    emptyLine: null,
    ...overrides
  }
}

async function mountView(
  payload: Record<string, unknown> = graphRead(),
  failWith?: Error
) {
  const getGraph = vi.mocked(knowledgeGraphApi.getGraph)
  if (failWith) {
    getGraph.mockRejectedValueOnce(failWith)
  } else {
    getGraph.mockResolvedValueOnce(payload as any)
  }

  const wrapper = mount(KnowledgeGraphView, {
    attachTo: document.body,
    global: {
      stubs: {
        'a-page-header': PASS('APageHeader'),
        'a-card': {
          name: 'ACard',
          props: ['title'],
          template: '<div class="card-stub"><div class="card-title">{{ title }}</div><slot /></div>'
        },
        'a-statistic': STATISTIC_STUB,
        'a-alert': ALERT_STUB,
        'a-empty': EMPTY_STUB,
        'a-divider': PASS('ADivider'),
        'a-row': PASS('ARow'),
        'a-col': PASS('ACol'),
        'a-space': PASS('ASpace'),
        'a-form': PASS('AForm'),
        'a-form-item': PASS('AFormItem'),
        'a-select': PASS('ASelect'),
        'a-select-option': PASS('ASelectOption'),
        'a-slider': PASS('ASlider'),
        'a-button': Button,
        'a-radio-group': PASS('ARadioGroup'),
        'a-radio-button': PASS('ARadioButton'),
        'a-input-search': PASS('AInputSearch'),
        'a-tag': PASS('ATag'),
        'a-list': LIST_STUB,
        'a-list-item': PASS('AListItem'),
        'a-list-item-meta': LIST_ITEM_META_STUB,
        'a-avatar': PASS('AAvatar'),
        'a-button-group': PASS('AButtonGroup'),
        'a-spin': PASS('ASpin'),
        'a-modal': PASS('AModal'),
        'a-drawer': PASS('ADrawer'),
        'a-descriptions': PASS('ADescriptions'),
        'a-descriptions-item': PASS('ADescriptionsItem'),
        'a-timeline': PASS('ATimeline'),
        'a-timeline-item': PASS('ATimelineItem'),
        'a-tabs': PASS('ATabs'),
        'a-tab-pane': PASS('ATabPane'),
        'a-table': PASS('ATable'),
        'a-table-column': PASS('ATableColumn'),
        'a-checkbox': PASS('ACheckbox')
      }
    }
  })
  await flushPromises()
  return wrapper
}

function lastOption(): any {
  const init = vi.mocked(echarts.init)
  const instance = init.mock.results[init.mock.results.length - 1].value as any
  return instance.setOption.mock.calls[instance.setOption.mock.calls.length - 1][0]
}

function cardValues(wrapper: any): string[] {
  return wrapper.findAll('.stat-value').map((node: any) => node.text())
}

function findButton(wrapper: any, text: string) {
  return wrapper.findAll('button').find((button: any) => button.text().includes(text))
}

beforeEach(() => {
  document.body.innerHTML = ''
  vi.clearAllMocks()
})

describe('知识图谱屏', () => {
  it('画布上的点用后端的 name、线用后端的 links，线标签是关系类型', async () => {
    const wrapper = await mountView()

    const option = lastOption()
    expect(option.series[0].data.map((n: any) => n.name)).toEqual([
      'MP96-Alpha',
      'MP96-Beta',
      'MP96-Gamma'
    ])
    expect(option.series[0].links).toHaveLength(2)
    expect(option.series[0].links[0].source).toBe(1)
    expect(option.series[0].links[0].target).toBe(2)
    expect(option.series[0].links[0].label.formatter).toBe('RELATED_TO')
    // 点的大小按关联条数来：枢纽比孤点大
    expect(option.series[0].data[0].symbolSize).toBeGreaterThan(option.series[0].data[1].symbolSize)
    expect(wrapper.html()).not.toContain('undefined')
  })


  it('实体总数/关系总数/实体类型这三格读后端真数（不是被 limit 截断的那个数）', async () => {
    const wrapper = await mountView(graphRead({ totalEntities: 99, totalRelations: 88 }))

    expect(cardValues(wrapper)).toEqual(['99', '88', '2'])
  })

  it('读失败时三张卡摆 —，并念读失败，不摆 0 也不说「这一家没有图谱」', async () => {
    const wrapper = await mountView(graphRead(), new Error('读口断了'))

    expect(cardValues(wrapper)).toEqual(['—', '—', '—'])
    expect(wrapper.text()).toContain('读口断了')
    expect(wrapper.text()).toContain('不摆 0')
    expect(wrapper.text()).not.toContain('一条都没有')
    // 两块「最近」空着时也得说清是「读不到」，不许让 a-list 自己念「暂无数据」
    expect(wrapper.text()).toContain('读不到这一家的实体')
    expect(wrapper.text()).toContain('读不到这一家的关系')
    expect(wrapper.text()).not.toContain('暂无数据')
  })

  it('空图念后端给的那一句（筛光了与真没有各说各的）', async () => {
    const line = '知识图谱：当前筛选条件下没有实体；这一家共有 3 个实体、共 2 条关系，把筛选放宽再看。'
    const wrapper = await mountView(
      graphRead({ nodes: [], links: [], nodeCount: 0, linkCount: 0, emptyReason: 'NONE', emptyLine: line })
    )

    expect(wrapper.find('.empty-stub').text()).toBe(line)
  })

  it('画布被节点数量截断时要说明只画了多少、一共命中多少', async () => {
    const wrapper = await mountView(graphRead({ matchedEntities: 120, truncated: true }))

    const alert = wrapper.find('.alert-stub').text()
    expect(alert).toContain('只画了最新的 3 个实体')
    expect(alert).toContain('一共命中 120 个')
    expect(alert).toContain('最多 500 个')
  })

  it('首屏把三个筛选参数都带上，置信度默认不过滤（0）', async () => {
    await mountView()

    expect(knowledgeGraphApi.getGraph).toHaveBeenCalledWith({
      limit: 150,
      types: [],
      relationTypes: [],
      minConfidence: 0
    })
  })

  it('「应用筛选」拿到数据才念已应用，并说清念的是哪几个条件与画布上的数', async () => {
    const wrapper = await mountView()
    // 点一下要再发一发；这一发也得真回数据，否则产品按设计不许念「已应用」
    vi.mocked(knowledgeGraphApi.getGraph).mockResolvedValueOnce(graphRead() as any)

    await findButton(wrapper, '应用筛选').trigger('click')
    await flushPromises()

    expect(messageSuccess()).toContain('不限条件')
    expect(messageSuccess()).toContain('画布 3 个实体、2 条关系')
  })

  it('第二发读失败时不许再念「筛选已应用」', async () => {
    const wrapper = await mountView()
    vi.mocked(knowledgeGraphApi.getGraph).mockRejectedValueOnce(new Error('又断了'))

    await findButton(wrapper, '应用筛选').trigger('click')
    await flushPromises()

    expect(messageSuccess()).not.toContain('已按')
  })

  it('「最近提取」两块读的是后端 recentEntities/recentRelations', async () => {
    const wrapper = await mountView()

    const text = wrapper.text()
    expect(text).toContain('MP96-Alpha')
    expect(text).toContain('关联 2 条')
    expect(text).toContain('RELATED_TO')
    expect(text).toContain('置信度 90%')
  })
})

function messageSuccess(): string {
  return vi.mocked(message.success).mock.calls.flat().join(' ')
}
