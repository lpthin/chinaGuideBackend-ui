import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { reactive } from 'vue'
import PortalAnalyticsView from '../PortalAnalyticsView.vue'
import { analyticsApi } from '../../../api/analytics'

/**
 * 门户访问统计这一屏的两种档（M-P106 拍板 Q1 的 B 类）。
 *
 * 埋点数与抓取数都按客户分开记，所以：
 * 1. 平台档（超管没选客户）四个读口一个都不发，四张卡摆 `—`，屏上明说去哪儿选客户；
 *    也不许把「这一档没读」念成「该区间没有采到埋点数据」；
 * 2. 选了客户之后，四个读口带的都是那一家选中的编号，卡片念后端回的数。
 */

vi.mock('ant-design-vue', async () => {
  const actual = await vi.importActual<Record<string, any>>('ant-design-vue')
  return {
    ...actual,
    message: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() }
  }
})

vi.mock('../../../api/analytics', () => ({
  analyticsApi: {
    overview: vi.fn(),
    pages: vi.fn(),
    bot: vi.fn(),
    trend: vi.fn()
  },
  botCategoryLabel: (category: string) => category,
  pageTypeLabel: (pageType: string | null) => pageType ?? '未标注'
}))

vi.mock('../../../utils/errorLog', () => ({
  logError: vi.fn()
}))

vi.mock('echarts', () => ({
  init: vi.fn()
}))

const authState = reactive({
  selectedTenantId: null as number | null,
  tenantId: 1 as number | undefined,
  isSuperAdmin: true
})

vi.mock('../../../stores/auth', () => ({
  useAuthStore: () => authState
}))

const PASS_THROUGH = (name: string) => ({
  name,
  template: `<div class="${name.toLowerCase()}-stub"><slot /><slot name="extra" /><slot name="message" /><slot name="description" /></div>`
})

const STUBS = {
  PageTitle: { name: 'PageTitle', template: '<h1 class="page-title-stub"></h1>' },
  DataTable: {
    name: 'DataTable',
    props: ['dataSource'],
    template: '<div class="data-table-stub">{{ (dataSource || []).length }} 行</div>'
  },
  StateBlock: {
    name: 'StateBlock',
    props: ['state', 'title', 'detail'],
    template: '<div class="state-stub">{{ title }}{{ detail }}</div>'
  },
  'a-alert': {
    name: 'AAlert',
    props: ['type', 'showIcon'],
    template: '<div class="alert-stub"><slot /><slot name="message" /><slot name="description" /></div>'
  },
  'a-form': PASS_THROUGH('AForm'),
  'a-form-item': PASS_THROUGH('AFormItem'),
  'a-range-picker': { name: 'ARangePicker', template: '<input class="range-stub" />' },
  'a-select': { name: 'ASelect', props: ['value', 'options'], template: '<select class="select-stub"></select>' },
  'a-button': { name: 'AButton', template: '<button class="button-stub"><slot /></button>' },
  'a-spin': PASS_THROUGH('ASpin'),
  'a-card': PASS_THROUGH('ACard'),
  'a-row': PASS_THROUGH('ARow'),
  'a-col': PASS_THROUGH('ACol'),
  'a-statistic': {
    name: 'AStatistic',
    props: ['title', 'value', 'suffix'],
    template: '<div class="statistic-stub">{{ title }}|{{ value }}|{{ suffix }}</div>'
  }
}

function mountView() {
  return mount(PortalAnalyticsView, { global: { stubs: STUBS } })
}

function statsText(wrapper: any): string[] {
  return wrapper.findAll('.statistic-stub').map((node: any) => node.text())
}

beforeEach(() => {
  vi.clearAllMocks()
  authState.isSuperAdmin = true
  authState.selectedTenantId = null
  authState.tenantId = 1
  vi.mocked(analyticsApi.overview).mockResolvedValue({
    tenantId: 558, from: '', to: '', pageviews: 123, uniqueVisitors: 45,
    durationEvents: 6, avgDurationMs: 65000, empty: false
  })
  vi.mocked(analyticsApi.pages).mockResolvedValue({ from: '', to: '', pages: [], empty: false })
  vi.mocked(analyticsApi.bot).mockResolvedValue({ from: '', to: '', slices: [], empty: true })
  vi.mocked(analyticsApi.trend).mockResolvedValue({ from: '', to: '', points: [], empty: true })
})

describe('门户访问统计 · 平台档与选客户两档', () => {
  it('平台档：四个读口一个都不发，四张卡摆 `—`，屏上明说请先选客户，也不念成「该区间没有数据」', async () => {
    const wrapper = mountView()
    await flushPromises()

    expect(analyticsApi.overview).not.toHaveBeenCalled()
    expect(analyticsApi.pages).not.toHaveBeenCalled()
    expect(analyticsApi.bot).not.toHaveBeenCalled()
    expect(analyticsApi.trend).not.toHaveBeenCalled()

    const text = wrapper.text()
    expect(text).toContain('请先在右上角切到「客户」并选一家')
    expect(text).toContain('平台档这里不发业务请求')
    expect(text).not.toContain('该区间没有采到埋点数据')
    expect(text).not.toContain('该区间没有任何可绘制的数据')

    const stats = statsText(wrapper)
    expect(stats).toHaveLength(4)
    stats.forEach((line) => expect(line).toContain('|—|'))
  })

  it('选客户 558 后：四个读口都带 558，卡片念后端回的数', async () => {
    const wrapper = mountView()
    await flushPromises()
    expect(analyticsApi.overview).not.toHaveBeenCalled()

    authState.selectedTenantId = 558
    await flushPromises()
    await flushPromises()

    for (const api of [analyticsApi.overview, analyticsApi.pages, analyticsApi.bot, analyticsApi.trend]) {
      const calls = vi.mocked(api).mock.calls
      expect(calls.length).toBeGreaterThan(0)
      expect((calls[calls.length - 1][0] as any).tenantId).toBe(558)
    }

    const text = wrapper.text()
    expect(text).not.toContain('平台档这里不发业务请求')
    expect(statsText(wrapper)).toContain('页面浏览量 PV|123|')
    expect(statsText(wrapper)).toContain('独立访客 UV（按天去重）|45|')
    expect(statsText(wrapper)).toContain('平均停留时长|1 分 5 秒|')
    expect(statsText(wrapper)).toContain('有时长上报的页面数|6|')
  })
})
