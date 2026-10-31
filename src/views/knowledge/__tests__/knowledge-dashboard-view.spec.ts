import { describe, it, expect, beforeEach, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { message } from 'ant-design-vue'
import KnowledgeDashboardView from '../KnowledgeDashboardView.vue'
import {
  knowledgeStatsApi,
  knowledgeCategoryApi,
  knowledgeDocumentApi,
  smartQAApi
} from '../../../api/knowledge'

/**
 * 知识库仪表板（M-P99）。
 *
 * 改前这一屏有六件事嘴上说做了、实际没做：
 * 1. 取数用 `auth.selectedTenantId || 1`：超管没选客户时偷偷去问 1 号客户，
 *    租户管理员则永远拿 1（自己的客户编号根本不参与）；
 * 2. 后端「这一家读不到」和「这一家真没有」回的都是全 0，界面把 0 当真的摆；
 * 3. 读失败只 toast 一句，四张卡照旧摆 0；
 * 4. 页头挂着一个日期区间控件，后端两个口都不认日期；
 * 5. 刷新不管成没成都说「数据已刷新」；
 * 6. 问答不看出租户状态，读不到这一家也照样能发。
 *
 * 用例钉这六处，外加「读不到这一家就不再去问另外三口」。
 */

vi.mock('ant-design-vue', async () => {
  const actual = await vi.importActual<Record<string, any>>('ant-design-vue')
  return {
    ...actual,
    message: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn(), loading: vi.fn() }
  }
})

vi.mock('../../../api/knowledge', () => ({
  knowledgeStatsApi: { getStats: vi.fn(), getTrend: vi.fn() },
  knowledgeCategoryApi: { stats: vi.fn() },
  knowledgeDocumentApi: { list: vi.fn() },
  smartQAApi: { streamQA: vi.fn() }
}))

const authMock: Record<string, any> = {
  isSuperAdmin: true,
  selectedTenantId: 15 as number | null,
  selectedTenantCode: 'demo' as string | null,
  user: { tenantId: 15 as number | null }
}

vi.mock('../../../stores/auth', () => ({
  useAuthStore: () => authMock
}))

// echarts 在这间屋子里画不出东西，但「喂给它的数据」不是这里要钉的东西
vi.mock('echarts', () => {
  const instance = {
    setOption: vi.fn(),
    on: vi.fn(),
    resize: vi.fn(),
    dispose: vi.fn()
  }
  class LinearGradient {
    constructor(..._args: unknown[]) {}
  }
  return { init: vi.fn(() => instance), graphic: { LinearGradient } }
})

const PAGE_HEADER_STUB = {
  name: 'APageHeader',
  props: ['title', 'subTitle'],
  template: '<div class="page-header-stub"><slot name="extra" /><slot /></div>'
}

const PASS_THROUGH = (name: string) => ({
  name,
  props: ['gutter', 'span', 'xs', 'sm', 'md', 'align', 'direction', 'size'],
  template: `<div class="${name}-stub"><slot /></div>`
})

const CARD_STUB = {
  name: 'ACard',
  props: ['title', 'hoverable', 'bordered'],
  template: `<div class="card-stub"><slot name="title" /><slot name="extra" /><slot /></div>`
}

const ALERT_STUB = {
  name: 'AAlert',
  props: ['message', 'description', 'type', 'showIcon', 'class'],
  template: `<div class="alert-stub"><span class="alert-msg">{{ message }}</span></div>`
}

const EMPTY_STUB = {
  name: 'AEmpty',
  props: ['description'],
  template: `<div class="empty-stub">{{ description }}</div>`
}

const BUTTON_STUB = {
  name: 'AButton',
  props: ['type', 'block', 'size', 'loading', 'disabled'],
  emits: ['click'],
  template: `<button class="btn-stub" :disabled="disabled" @click="$emit('click')"><slot name="icon" /><slot /></button>`
}

const INPUT_SEARCH_STUB = {
  name: 'AInputSearch',
  props: ['value', 'modelValue', 'placeholder', 'enterButton', 'size', 'loading', 'disabled'],
  emits: ['update:value', 'search'],
  template: `<input class="qa-input-stub" :disabled="disabled" />`
}

const TIMELINE_STUB = {
  name: 'ATimeline',
  template: '<div class="timeline-stub"><slot /></div>'
}

const TIMELINE_ITEM_STUB = {
  name: 'ATimelineItem',
  props: ['color'],
  template: '<div class="timeline-item-stub"><slot /></div>'
}

function mountView() {
  return mount(KnowledgeDashboardView, {
    attachTo: document.body,
    global: {
      stubs: {
        'a-page-header': PAGE_HEADER_STUB,
        'a-row': PASS_THROUGH('ARow'),
        'a-col': PASS_THROUGH('ACol'),
        'a-space': PASS_THROUGH('ASpace'),
        'a-card': CARD_STUB,
        'a-alert': ALERT_STUB,
        'a-empty': EMPTY_STUB,
        'a-button': BUTTON_STUB,
        'a-input-search': INPUT_SEARCH_STUB,
        'a-timeline': TIMELINE_STUB,
        'a-timeline-item': TIMELINE_ITEM_STUB
      }
    }
  })
}

function statsOf(overrides: Record<string, any> = {}) {
  return {
    totalDocuments: 1234,
    parsedDocuments: 40,
    vectorizedDocuments: 30,
    totalChunks: 900,
    totalEntities: 7,
    totalRelations: 6,
    ...overrides
  }
}

function mockAllOk() {
  vi.mocked(knowledgeStatsApi.getStats).mockResolvedValue(statsOf() as any)
  vi.mocked(knowledgeStatsApi.getTrend).mockResolvedValue([
    { date: '2026-10-29', documents: 2, cards: 1 },
    { date: '2026-10-30', documents: 1, cards: 0 }
  ] as any)
  vi.mocked(knowledgeCategoryApi.stats).mockResolvedValue([
    { id: 1, name: '种牙', documentCount: 1, cardCount: 1, totalCount: 2 }
  ] as any)
  vi.mocked(knowledgeDocumentApi.list).mockResolvedValue({
    records: [
      {
        id: 9,
        fileName: '简介.txt',
        parseStatus: 'success',
        createdAt: new Date().toISOString(),
        uploadedByName: '张三'
      }
    ]
  } as any)
}

function cardValues(wrapper: ReturnType<typeof mountView>): string[] {
  return wrapper.findAll('.stat-value').map(node => node.text())
}

function refreshButton(wrapper: ReturnType<typeof mountView>) {
  const button = wrapper.findAll('.btn-stub').find(node => node.text().includes('刷新'))
  if (!button) throw new Error('没有找到刷新按钮')
  return button
}

beforeEach(() => {
  vi.clearAllMocks()
  authMock.isSuperAdmin = true
  authMock.selectedTenantId = 15
  authMock.selectedTenantCode = 'demo'
  authMock.user = { tenantId: 15 }
  mockAllOk()
})

describe('这一屏的数属于谁', () => {
  it('超管选定了客户：四口都按那一家取数，屏上写明看的是谁', async () => {
    const wrapper = mountView()
    await flushPromises()

    expect(knowledgeStatsApi.getStats).toHaveBeenCalledWith(15)
    expect(knowledgeStatsApi.getTrend).toHaveBeenCalledWith(15, 7)
    expect(knowledgeCategoryApi.stats).toHaveBeenCalledWith(15)
    expect(knowledgeDocumentApi.list).toHaveBeenCalledWith(expect.objectContaining({ tenantId: 15 }))
    expect(wrapper.find('.alert-msg').text()).toContain('客户「demo」（编号 #15）')
  })

  it('租户管理员没有「选中态」也按自己那一家取数，不再永远拿 1', async () => {
    authMock.isSuperAdmin = false
    authMock.selectedTenantId = null
    authMock.selectedTenantCode = null
    authMock.user = { tenantId: 558 }

    const wrapper = mountView()
    await flushPromises()

    expect(knowledgeStatsApi.getStats).toHaveBeenCalledWith(558)
    expect(knowledgeStatsApi.getTrend).toHaveBeenCalledWith(558, 7)
    expect(knowledgeCategoryApi.stats).toHaveBeenCalledWith(558)
    expect(knowledgeDocumentApi.list).toHaveBeenCalledWith(expect.objectContaining({ tenantId: 558 }))
    expect(wrapper.find('.alert-msg').text()).toContain('你所在客户（编号 #558）')
    expect(cardValues(wrapper)).toEqual(['1,234', '40', '30', '7'])
  })

  it('超管还没选定客户：一句话说清，一发请求都不发，卡摆「—」不摆 0', async () => {
    authMock.selectedTenantId = null
    authMock.selectedTenantCode = null

    const wrapper = mountView()
    await flushPromises()

    expect(knowledgeStatsApi.getStats).not.toHaveBeenCalled()
    expect(knowledgeStatsApi.getTrend).not.toHaveBeenCalled()
    expect(knowledgeCategoryApi.stats).not.toHaveBeenCalled()
    expect(knowledgeDocumentApi.list).not.toHaveBeenCalled()
    expect(wrapper.find('.alert-msg').text()).toContain('没有选定客户')
    expect(cardValues(wrapper)).toEqual(['—', '—', '—', '—'])
  })

  it('超管还没选定客户：增长趋势／分类分布／最近活动三段说「还没查过」，不念「查过了、没有」', async () => {
    authMock.selectedTenantId = null
    authMock.selectedTenantCode = null

    const wrapper = mountView()
    await flushPromises()

    const notices = [...wrapper.findAll('.chart-state'), ...wrapper.findAll('.activity-state')].map(
      node => node.text()
    )
    expect(notices).toHaveLength(3)
    notices.forEach(text => expect(text).toContain('没有选定客户，这一段还没查过。'))

    const screen = wrapper.text()
    expect(screen).not.toContain('近 7 天里没有新增文档或卡片')
    expect(screen).not.toContain('这一家还没有分过类的知识内容')
    expect(screen).not.toContain('这一家还没有上传过资料')
  })
})

describe('读不到这一家 ≠ 这一家没有内容', () => {
  it('后端说这一家读不到：卡摆「—」，原样念后端那句成因，也不再问另外三口', async () => {
    vi.mocked(knowledgeStatsApi.getStats).mockResolvedValue(
      statsOf({
        totalDocuments: 0,
        parsedDocuments: 0,
        vectorizedDocuments: 0,
        totalChunks: 0,
        totalEntities: 0,
        totalRelations: 0,
        tenantUnreadable: true,
        emptyReason: 'NOT_VISIBLE',
        emptyLine: '知识库仪表板：这一档读不到（选中的那个身份在这张表里没有行），所以这里不能说「没有」。'
      }) as any
    )

    const wrapper = mountView()
    await flushPromises()

    expect(cardValues(wrapper)).toEqual(['—', '—', '—', '—'])
    const alerts = wrapper.findAll('.alert-msg').map(node => node.text()).join(' | ')
    expect(alerts).toContain('知识库仪表板：这一档读不到')
    expect(knowledgeStatsApi.getTrend).not.toHaveBeenCalled()
    expect(knowledgeCategoryApi.stats).not.toHaveBeenCalled()
    expect(knowledgeDocumentApi.list).not.toHaveBeenCalled()
    expect(wrapper.findAll('.status-value').map(node => node.text())).toEqual(['—', '—', '—', '—'])
    const qa = wrapper.findComponent({ name: 'AInputSearch' })
    expect(qa.props('disabled')).toBe(true)
    expect(wrapper.find('.qa-empty').text()).toContain('这一家读不到，问答不发请求')
  })

  it('统计口整个读失败：卡摆「—」，念出原因，不摆一屏 0', async () => {
    vi.mocked(knowledgeStatsApi.getStats).mockRejectedValue(new Error('网关 502'))

    const wrapper = mountView()
    await flushPromises()

    expect(cardValues(wrapper)).toEqual(['—', '—', '—', '—'])
    const alerts = wrapper.findAll('.alert-msg').map(node => node.text()).join(' | ')
    expect(alerts).toContain('这一屏没读上来：网关 502')
    expect(knowledgeStatsApi.getTrend).not.toHaveBeenCalled()
  })

  it('趋势与分类各自读失败时分开念，不和「真没有」同一句', async () => {
    vi.mocked(knowledgeStatsApi.getTrend).mockRejectedValue(new Error('请求超时'))
    vi.mocked(knowledgeCategoryApi.stats).mockRejectedValue(new Error('服务暂时不可用'))

    const wrapper = mountView()
    await flushPromises()

    const says = wrapper.findAll('.chart-state').map(node => node.text())
    expect(says[0]).toContain('增长趋势没读上来：请求超时')
    expect(says[1]).toContain('分类分布没读上来：服务暂时不可用')
    expect(wrapper.findAll('.empty-stub')).toHaveLength(0)
  })

  it('最近活动读失败时念读失败，不念「还没上传过资料」', async () => {
    vi.mocked(knowledgeDocumentApi.list).mockRejectedValue(new Error('网关 503'))

    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.find('.activity-state').text()).toContain('最近活动没读上来：网关 503')
    expect(wrapper.find('.activity-card').text()).not.toContain('还没有上传过资料')
  })

  it('真没有数据时各块念自己的空态；资料库那段空态原样念后端那一句', async () => {
    vi.mocked(knowledgeStatsApi.getStats).mockResolvedValue(statsOf({
      totalDocuments: 0,
      parsedDocuments: 0,
      vectorizedDocuments: 0,
      totalChunks: 0,
      totalEntities: 0,
      totalRelations: 0
    }) as any)
    vi.mocked(knowledgeStatsApi.getTrend).mockResolvedValue([] as any)
    vi.mocked(knowledgeCategoryApi.stats).mockResolvedValue([] as any)
    vi.mocked(knowledgeDocumentApi.list).mockResolvedValue({
      records: [],
      emptyReason: 'NOT_VISIBLE',
      emptyLine: '资料库：这一档读不到（选中的那个身份在这张表里没有行），所以这里不能说「没有」。'
    } as any)

    const wrapper = mountView()
    await flushPromises()

    expect(cardValues(wrapper)).toEqual(['0', '0', '0', '0'])
    const says = wrapper.findAll('.empty-stub').map(node => node.text())
    expect(says).toContain('近 7 天里没有新增文档或卡片')
    expect(says).toContain('这一家还没有分过类的知识内容')
    expect(wrapper.find('.activity-state').text()).toContain('资料库：这一档读不到')
  })
})

describe('刷新只说真话，日期控件不再挂着', () => {
  it('四口都读成：才说「数据已刷新」', async () => {
    const wrapper = mountView()
    await flushPromises()

    await refreshButton(wrapper).trigger('click')
    await flushPromises()

    expect(message.success).toHaveBeenCalledWith({ content: '数据已刷新', key: 'refresh' })
  })

  it('有一口没读上来：把名字念出来，不许说「已刷新」', async () => {
    vi.mocked(knowledgeStatsApi.getTrend).mockResolvedValue([] as any)
    const wrapper = mountView()
    await flushPromises()

    vi.mocked(knowledgeStatsApi.getTrend).mockRejectedValue(new Error('请求超时'))
    await refreshButton(wrapper).trigger('click')
    await flushPromises()

    expect(message.success).not.toHaveBeenCalledWith({ content: '数据已刷新', key: 'refresh' })
    const warn = vi.mocked(message.warning).mock.calls.map(call => String((call[0] as any)?.content ?? call[0])).join(' | ')
    expect(warn).toContain('没读上来：增长趋势')
  })

  it('整屏一口都没读上来：不许说「其余部分照旧」', async () => {
    const wrapper = mountView()
    await flushPromises()

    vi.mocked(knowledgeStatsApi.getStats).mockRejectedValue(new Error('网关 502'))
    await refreshButton(wrapper).trigger('click')
    await flushPromises()

    const warn = vi.mocked(message.warning).mock.calls.map(call => String((call[0] as any)?.content ?? call[0])).join(' | ')
    expect(warn).toContain('这一屏一个数都没读到：网关 502')
    expect(warn).not.toContain('其余部分照旧')
    // 统计失败时后三口本来就没发，界面不能暗示它们还挂着旧数
    expect(knowledgeStatsApi.getTrend).toHaveBeenCalledTimes(1)
    expect(knowledgeCategoryApi.stats).toHaveBeenCalledTimes(1)
  })

  it('这一家读不到时刷新不改口说成功', async () => {
    vi.mocked(knowledgeStatsApi.getStats).mockResolvedValue(
      statsOf({ tenantUnreadable: true, emptyLine: '读不到这一家' }) as any
    )
    const wrapper = mountView()
    await flushPromises()

    await refreshButton(wrapper).trigger('click')
    await flushPromises()

    expect(message.success).not.toHaveBeenCalled()
    const warn = vi.mocked(message.warning).mock.calls.map(call => String((call[0] as any)?.content ?? call[0])).join(' | ')
    expect(warn).toContain('这一家读不到')
  })

  it('没选客户时点刷新：提示先选客户，不发请求', async () => {
    authMock.selectedTenantId = null
    authMock.selectedTenantCode = null
    const wrapper = mountView()
    await flushPromises()

    await refreshButton(wrapper).trigger('click')
    await flushPromises()

    expect(knowledgeStatsApi.getStats).not.toHaveBeenCalled()
    expect(vi.mocked(message.warning).mock.calls.map(call => String(call[0])).join(' | ')).toContain('先在右上角选定客户')
  })

  it('页头不再挂日期区间控件', async () => {
    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.html()).not.toContain('range-picker')
  })
})

describe('问答入口跟着租户状态开合', () => {
  it('四口都读成时问答可以发', async () => {
    const wrapper = mountView()
    await flushPromises()

    const qa = wrapper.findComponent({ name: 'AInputSearch' })
    expect(qa.props('disabled')).toBe(false)
    expect(wrapper.find('.qa-empty').text()).toContain('开始提问')
  })

  it('统计没读上时问答禁用并说明原因', async () => {
    vi.mocked(knowledgeStatsApi.getStats).mockRejectedValue(new Error('网关 502'))
    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.findComponent({ name: 'AInputSearch' }).props('disabled')).toBe(true)
    expect(wrapper.find('.qa-empty').text()).toContain('问答先不发请求')
  })
})
