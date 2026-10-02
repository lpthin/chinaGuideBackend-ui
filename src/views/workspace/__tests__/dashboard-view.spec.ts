import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { reactive } from 'vue'
import DashboardView from '../DashboardView.vue'
import { dashboardApi, keywordApi, publishApi } from '../../../api'
import { citationApi } from '../../../api/citation'
import { analyticsApi } from '../../../api/analytics'
import { geoCrawlabilityApi } from '../../../api/geoCrawlability'
import { geoCampaignApi } from '../../../api/geoCampaign'

/**
 * Spec-I 工作台的三条验收契约（AC-1 / AC-2 / AC-3 / AC-4）：
 * 1. **平台档不调租户口**：isSuperAdmin 且 selectedTenantId=null 时整页只出引导，
 *    citations/analytics/geoseo 那一排口一次都不许打（Q2a）；
 * 2. **每卡带口径标注、空态不许谎报成 0**：引用探测没跑过显示「未探测」而不是 0 次，
 *    GEO 没轮次显示后端那句 notice（Q5b、P6-B 纪律）；
 * 3. **轮询只打今日访问一个口，离页即停**（AC-4）。
 *
 * echarts 换成壳：happy-dom 没有 canvas，这里要钉的是「调了 setOption」而不是像素。
 */

const authState = reactive({
  isSuperAdmin: true,
  selectedTenantId: null as number | null,
  tenantId: 1,
  permissions: [] as string[],
  hasPermission(code: string) {
    return this.permissions.includes(code)
  },
})

vi.mock('../../../stores/auth', () => ({
  useAuthStore: () => authState,
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useRoute: () => ({ params: {}, query: {} }),
}))

vi.mock('../../../api', () => ({
  dashboardApi: { getStats: vi.fn() },
  keywordApi: { getLibraryStats: vi.fn() },
  publishApi: { recordStats: vi.fn() },
}))

vi.mock('../../../api/citation', () => ({
  citationApi: { summaryLatest: vi.fn() },
}))

vi.mock('../../../api/analytics', () => ({
  analyticsApi: { overview: vi.fn(), bot: vi.fn(), trend: vi.fn() },
}))

vi.mock('../../../api/geoCrawlability', () => ({
  geoCrawlabilityApi: { latest: vi.fn() },
}))

vi.mock('../../../api/geoCampaign', () => ({
  geoCampaignApi: { latestReport: vi.fn() },
}))

vi.mock('../../../api/http', () => ({
  default: { get: vi.fn(), post: vi.fn() },
  describeHttpError: (e: unknown) => String(e),
}))

const chartInstance = { setOption: vi.fn(), resize: vi.fn(), dispose: vi.fn() }
vi.mock('echarts', () => ({
  init: vi.fn(() => chartInstance),
  graphic: { LinearGradient: class {} },
}))

const CITATION_OK = {
  siteId: 3,
  siteName: '站A',
  siteCount: 2,
  notice: '该租户有 2 个站点，这里展示的是「站A」',
  summary: {
    siteId: 3, siteName: '站A', probeCount: 4, callCount: 40, citedCallCount: 17,
    distinctModels: 3, citedTargets: 5, totalTargets: 8, coveredTargets: 6,
    citedPageCount: 2, citedArticleCount: 3, citedCaseCount: 0,
    lastProbedAt: '2026-10-01T10:00:00', lastProbeStatus: 'done', lastProbeNotice: null,
  },
}

const BOT_OK = {
  from: '2026-09-03', to: '2026-10-02',
  slices: [{ botCategory: 'search-engine', hits: 23, topPages: [] }],
  empty: false,
}

const TODAY_OK = {
  tenantId: 1, from: '2026-10-02', to: '2026-10-02',
  pageviews: 42, uniqueVisitors: 18, durationEvents: 0, avgDurationMs: null, empty: false,
}

const SEO_OK = {
  items: [{ checkKey: 'robots-ai', label: 'AI 抓取', verdict: 'PASS', verdictLabel: '通过' }],
  measuredAt: '2026-10-02T08:00:00', siteId: 3, neverRun: false,
}

const GEO_OK = {
  runId: 9,
  report: { callCount: 20, failedCallCount: 1, generatedAt: '2026-10-01T12:00:00' },
  notice: null,
}

const STATS_OK = {
  totalArticles: 120, publishedCount: 90, draftCount: 30, totalViews: 278,
  todayCount: 5, monthCount: 30, pendingReview: 7, totalKeywords: 300, totalClusters: 12,
  articlesWeek: 4, keywordsWeek: 9, viewsWeek: 0, pendingWeek: 2,
}

function mockHappyApis() {
  ;(citationApi.summaryLatest as any).mockResolvedValue(CITATION_OK)
  ;(analyticsApi.bot as any).mockResolvedValue(BOT_OK)
  ;(analyticsApi.overview as any).mockResolvedValue(TODAY_OK)
  ;(geoCrawlabilityApi.latest as any).mockResolvedValue(SEO_OK)
  ;(geoCampaignApi.latestReport as any).mockResolvedValue(GEO_OK)
  ;(keywordApi.getLibraryStats as any).mockResolvedValue({ total: 300, stage_new: 10, stage_suggested: 5, stage_articled: 20 })
  ;(dashboardApi.getStats as any).mockResolvedValue(STATS_OK)
  ;(publishApi.recordStats as any).mockResolvedValue({ total: 60, successCount: 55, failedCount: 3, cancelledCount: 2, todayCount: 1, successRate: 92 })
  ;(analyticsApi.trend as any).mockResolvedValue({
    from: '2026-09-26', to: '2026-10-02',
    points: [{ date: '2026-10-01', pageviews: 3, uniqueVisitors: 2, botHits: 1, aiCrawlerHits: 0 }],
    empty: false,
  })
}

function mountDashboard() {
  return mount(DashboardView, {
    global: {
      stubs: {
        'a-button': { template: '<button><slot /><slot name="icon" /></button>' },
        'a-radio-group': { template: '<div><slot /></div>' },
        'a-radio-button': { template: '<span><slot /></span>' },
        // a-tooltip 真组件要点开才渲染；这里把 title 槽直接摊平，钉「口径标注在 DOM 里」
        'a-tooltip': { template: '<span class="tt-stub"><slot name="title" /><slot /></span>' },
      },
    },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  authState.isSuperAdmin = true
  authState.selectedTenantId = 1
  authState.permissions = []
  mockHappyApis()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('工作台 · 平台档（Q2a）', () => {
  it('平台档整页只出引导，一个租户效果口都不调', async () => {
    authState.selectedTenantId = null
    const wrapper = mountDashboard()
    await flushPromises()

    expect(wrapper.text()).toContain('工作台是租户视角')
    expect(citationApi.summaryLatest).not.toHaveBeenCalled()
    expect(analyticsApi.bot).not.toHaveBeenCalled()
    expect(analyticsApi.overview).not.toHaveBeenCalled()
    expect(analyticsApi.trend).not.toHaveBeenCalled()
    expect(geoCrawlabilityApi.latest).not.toHaveBeenCalled()
    expect(geoCampaignApi.latestReport).not.toHaveBeenCalled()
    expect(dashboardApi.getStats).not.toHaveBeenCalled()
    wrapper.unmount()
  })
})

describe('工作台 · 租户档（趋势图置顶 + 效果五块）', () => {
  it('趋势图是主视觉，窗口 KPI 直接嵌在图头部，数据来自 trend 口', async () => {
    const wrapper = mountDashboard()
    await flushPromises()

    const hero = wrapper.find('.hero-card')
    expect(hero.exists()).toBe(true)
    // 主视觉必须排在效果块前面
    const html = wrapper.html()
    expect(html.indexOf('hero-card')).toBeLessThan(html.indexOf('stat-row'))
    expect(wrapper.find('.hero-chart').exists()).toBe(true)
    expect(chartInstance.setOption).toHaveBeenCalled()

    const metrics = hero.findAll('.hero-metrics .hm').map(n => n.text())
    expect(metrics.length).toBe(4)
    // 今日浏览 42；窗口 1 天：PV 3 / bot 1 / AI 0（来自 trend mock 的那一个点）
    expect(metrics[0]).toContain('42')
    expect(metrics[1]).toContain('3')
    expect(metrics[2]).toContain('1')
    expect(metrics[3]).toContain('0')
    wrapper.unmount()
  })

  it('效果五块各就各位，数字来自真实口，口径标注收在悬浮里', async () => {
    const wrapper = mountDashboard()
    await flushPromises()

    const text = wrapper.text()
    expect(wrapper.findAll('.stat-tile').length).toBe(5)

    expect(text).toContain('被 AI 引用')
    expect(text).toContain('17')
    expect(text).toContain('数据来自平台引用探测轮次')
    expect(text).toContain('截至 2026-10-01 10:00')

    // Q1b：语义是「收录抓取」，界面上不许出现「被搜索引擎推荐」这种没有口的说法
    expect(text).toContain('搜索引擎收录抓取')
    expect(text).not.toContain('被搜索引擎推荐')
    expect(text).toContain('23')

    expect(text).toContain('今日访问')
    expect(text).toContain('42')
    expect(text).toContain('每分钟自动刷新')

    expect(text).toContain('GEO 诊断')
    expect(text).toContain('#9')
    expect(text).toContain('看报告')
    expect(text).toContain('SEO 体检')
    expect(text).toContain('体检于')
    expect(text).toContain('该租户有 2 个站点，这里展示的是「站A」')

    // Q7a：写死的「系统运行正常」必须绝迹
    expect(text).not.toContain('系统运行正常')
    wrapper.unmount()
  })

  it('引用一轮都没跑过时显示「未探测」而不是 0 次', async () => {
    ;(citationApi.summaryLatest as any).mockResolvedValue({
      ...CITATION_OK,
      notice: null,
      summary: { ...CITATION_OK.summary, probeCount: 0, citedCallCount: 0, lastProbedAt: null },
    })
    const wrapper = mountDashboard()
    await flushPromises()

    expect(wrapper.text()).toContain('未探测')
    expect(wrapper.text()).toContain('还没发起过任何一轮引用探测')
    wrapper.unmount()
  })

  it('租户还没有站点时引用卡念后端那句 notice，不显示 0', async () => {
    ;(citationApi.summaryLatest as any).mockResolvedValue({
      siteId: null, siteName: null, siteCount: 0, notice: '当前租户还没有可统计的站点', summary: null,
    })
    const wrapper = mountDashboard()
    await flushPromises()

    expect(wrapper.text()).toContain('当前租户还没有可统计的站点')
    expect(wrapper.find('.stat-tile--citation .st-num').exists()).toBe(false)
    wrapper.unmount()
  })

  it('GEO 没跑完过任何一轮时念后端 notice 并给「去跑一轮」出口', async () => {
    ;(geoCampaignApi.latestReport as any).mockResolvedValue({
      runId: null, report: null, notice: '该租户还没有跑完过任何一轮 GEO 诊断',
    })
    const wrapper = mountDashboard()
    await flushPromises()

    expect(wrapper.text()).toContain('该租户还没有跑完过任何一轮 GEO 诊断')
    expect(wrapper.text()).toContain('去跑一轮')
    wrapper.unmount()
  })

  it('SEO 体检没跑过时显示 neverRun 态而不是六条 0', async () => {
    ;(geoCrawlabilityApi.latest as any).mockResolvedValue({ items: [], measuredAt: null, siteId: null, neverRun: true })
    const wrapper = mountDashboard()
    await flushPromises()

    expect(wrapper.text()).toContain('没跑过体检')
    expect(wrapper.findAll('.seo-dot').length).toBe(0)
    wrapper.unmount()
  })

  it('SEO 出数时按判据上色，悬浮念得出是哪一项', async () => {
    const wrapper = mountDashboard()
    await flushPromises()

    const dots = wrapper.findAll('.seo-dot')
    expect(dots.length).toBe(1)
    expect(dots[0].classes()).toContain('seo-dot--pass')
    expect(dots[0].attributes('title')).toContain('AI 抓取')
    wrapper.unmount()
  })

  it('单卡读取失败只砸自己那一格，别的卡照常出数', async () => {
    ;(citationApi.summaryLatest as any).mockRejectedValue(new Error('boom'))
    const wrapper = mountDashboard()
    await flushPromises()

    expect(wrapper.text()).toContain('读取失败')
    expect(wrapper.text()).toContain('#9')
    expect(wrapper.text()).toContain('42')
    wrapper.unmount()
  })
})

describe('工作台 · 无权限的账号（CONTENT_EDITOR 实测档）', () => {
  it('没有那块权限就不发那个请求，格子里说「没有查看权限」而不是「读取失败」', async () => {
    // 真实账号的样子：非超管，只有 portal:siteinfo:manage（租户 15 的 tenant15_admin 实测）
    authState.isSuperAdmin = false
    authState.permissions = ['portal:siteinfo:manage']

    const wrapper = mountDashboard()
    await flushPromises()

    expect(citationApi.summaryLatest).not.toHaveBeenCalled()
    expect(analyticsApi.bot).not.toHaveBeenCalled()
    expect(analyticsApi.overview).not.toHaveBeenCalled()
    expect(analyticsApi.trend).not.toHaveBeenCalled()
    expect(geoCrawlabilityApi.latest).not.toHaveBeenCalled()
    expect(geoCampaignApi.latestReport).not.toHaveBeenCalled()

    const text = wrapper.text()
    expect(wrapper.findAll('.st-state--denied').length).toBe(5)
    expect(text).toContain('当前账号没有访问趋势的查看权限')
    // 一屏「读取失败」是这一版要修掉的谎：没权限不是系统坏了
    expect(text).not.toContain('读取失败')

    wrapper.unmount()
  })

  it('拦权限只拦效果那六格，生产指标条照旧出数', async () => {
    // 生产一行读的是内容/发布口，本来就在编辑者权限内，不该被这层判断顺手掐掉
    authState.isSuperAdmin = false
    authState.permissions = ['portal:siteinfo:manage']

    const wrapper = mountDashboard()
    await flushPromises()

    expect(dashboardApi.getStats).toHaveBeenCalledTimes(1)
    expect(keywordApi.getLibraryStats).toHaveBeenCalledTimes(1)
    expect(wrapper.findAll('.pb-seg').length).toBe(3)
    wrapper.unmount()
  })

  it('只给 analytics:view 一个码时，只放开这一个码管的卡', async () => {
    authState.isSuperAdmin = false
    authState.permissions = ['analytics:view']

    const wrapper = mountDashboard()
    await flushPromises()

    expect(analyticsApi.trend).toHaveBeenCalledTimes(1)
    expect(citationApi.summaryLatest).toHaveBeenCalledTimes(1)
    expect(wrapper.find('.hero-chart').exists()).toBe(true)
    // 其余两个码仍拦着
    expect(geoCrawlabilityApi.latest).not.toHaveBeenCalled()
    expect(geoCampaignApi.latestReport).not.toHaveBeenCalled()
    expect(wrapper.findAll('.st-state--denied').length).toBe(2)
    wrapper.unmount()
  })
})

describe('工作台 · 生产一行与轮询（AC-4）', () => {
  it('生产指标条出关键词/文章/发布三个数', async () => {
    const wrapper = mountDashboard()
    await flushPromises()

    const text = wrapper.text()
    expect(wrapper.findAll('.pb-seg').length).toBe(3)
    expect(text).toContain('关键词库')
    expect(text).toContain('300')
    expect(text).toContain('篇文章')
    expect(text).toContain('120')
    expect(text).toContain('平台发布')
    expect(text).toContain('55')
    expect(text).toContain('待审核')
    wrapper.unmount()
  })

  it('60 秒轮询只重打今日访问；离页即停', async () => {
    vi.useFakeTimers()
    const wrapper = mountDashboard()
    await flushPromises()
    expect(analyticsApi.overview).toHaveBeenCalledTimes(1)
    const callsAfterLoad = {
      citation: (citationApi.summaryLatest as any).mock.calls.length,
      trend: (analyticsApi.trend as any).mock.calls.length,
    }

    await vi.advanceTimersByTimeAsync(60_000)
    expect(analyticsApi.overview).toHaveBeenCalledTimes(2)
    expect((citationApi.summaryLatest as any).mock.calls.length).toBe(callsAfterLoad.citation)
    expect((analyticsApi.trend as any).mock.calls.length).toBe(callsAfterLoad.trend)

    wrapper.unmount()
    await vi.advanceTimersByTimeAsync(120_000)
    expect(analyticsApi.overview).toHaveBeenCalledTimes(2)
  })
})
