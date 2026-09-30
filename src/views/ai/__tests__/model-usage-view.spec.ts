import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import dayjs from 'dayjs'
import ModelUsageView from '../ModelUsageView.vue'
import { aiModelApi } from '../../../api/ai-model'
import { statsApi } from '../../../api/billing'
import { useAuthStore } from '../../../stores/auth'

/**
 * 「模型用量」页的诚实性（Spec-G P2 界面那一半，§G5 前半 F5）。
 *
 * 这一页以前把 `result.xxx ?? 0` 写成一排：后端从来没回过的键被兜成 0，
 * 于是屏幕上稳定出现「今日 Token 0」「较上月 0%」「剩余 ¥0.00」「预计可使用 NaN 天」。
 * 0 是一个数，真相是「没有这个数」，两者不许互换（同 StateBlock 的三态纪律）。
 *
 * 用例钉的是这五处最容易说谎的地方：
 * 1. 接口没回的键 → 界面上数不出一个假 0，改成写明「没有数据源 / 未统计」；
 * 2. 接口回了的键 → 哪怕是 0 也照念 0，不许退化成「未统计」（那等于把「这个月一次没调用」藏起来）；
 * 3. 统计口整体失败 → 四张卡退化成一句「读取失败」，不是四格 0；
 * 4. 取数区间由后端随响应说回来，卡片标题那个限定词跟着筛选走（以前写死「本月」，而数是全时的）；
 * 5. 趋势那排按钮要真的重新取数（以前只是长得像控件：改了不重取，图永远是 7 天）。
 */

vi.mock('../../../api/ai-model', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../api/ai-model')>()
  return {
    ...actual,
    aiModelApi: {
      getStats: vi.fn(),
      getUsageByModel: vi.fn(),
      getUsageTrend: vi.fn(),
      getLogs: vi.fn(),
    },
  }
})

/**
 * 两池的本月额度走的是另一条口（/billing/stats/overview 的 pools），所以这一份也要替件：
 * 它回什么、界面就念什么，替件给的是后端 poolStats 真的在回的那几个键（一个不多）。
 */
vi.mock('../../../api/billing', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../api/billing')>()
  return {
    ...actual,
    statsApi: {
      ...actual.statsApi,
      overview: vi.fn(),
    },
  }
})

vi.mock('ant-design-vue', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('ant-design-vue')
  return { ...actual, message: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() } }
})

/** 卡片/栅格要连 #extra 一起放行，否则趋势按钮、日志筛选那排在替件里根本渲染不出来 */
const SLOT = (name: string) => ({
  name,
  props: ['title'],
  template: `<section class="${name}"><i v-if="title" class="st-title">{{ title }}</i><slot /><slot name="extra" /></section>`,
})

const ICON = { name: 'IconStub', template: '<i />' }

const BUTTON_STUB = {
  name: 'AButton',
  props: ['disabled', 'type', 'size', 'loading'],
  emits: ['click'],
  template: '<button class="btn" :disabled="disabled" @click="$emit(\'click\')"><slot /></button>',
}

/** 组里的按钮经 $parent 回写 v-model：这样点的还是页面上那颗按钮，不是绕过去改状态 */
const RADIO_GROUP_STUB = {
  name: 'ARadioGroup',
  props: ['value'],
  emits: ['update:value'],
  template: '<div class="radio-group"><slot /></div>',
}
const RADIO_BUTTON_STUB = {
  name: 'ARadioButton',
  props: ['value'],
  template: '<button class="radio-btn" @click="$parent.$emit(\'update:value\', value)"><slot /></button>',
}

const globalStubs = {
  'a-card': SLOT('ACard'),
  'a-row': SLOT('ARow'),
  'a-col': SLOT('ACol'),
  'a-spin': SLOT('ASpin'),
  // 全局替件把 a-space 收成空壳了，而快捷日期那一排按钮全在 a-space 里——不放行就等于没有控件
  'a-space': SLOT('ASpace'),
  'a-button': BUTTON_STUB,
  'a-radio-group': RADIO_GROUP_STUB,
  'a-radio-button': RADIO_BUTTON_STUB,
  'a-range-picker': { name: 'ARangePicker', props: ['value'], template: '<i class="range-picker" />' },
  'a-progress': { name: 'AProgress', props: ['percent'], template: '<i class="progress-stub" :data-percent="percent" />' },
  'a-select': SLOT('ASelect'),
  'a-select-option': SLOT('ASelectOption'),
  'a-input-search': { name: 'AInputSearch', props: ['value'], template: '<i class="input-search" />' },
  'a-table': { name: 'ATable', props: ['dataSource', 'columns'], template: '<div class="table-stub" />' },
  'a-pagination': { name: 'APagination', props: ['total'], template: '<i class="pagination-stub" />' },
  'a-tag': { name: 'ATag', props: ['color'], template: '<span class="tag-stub"><slot /></span>' },
  DollarOutlined: ICON,
  BlockOutlined: ICON,
  ApiOutlined: ICON,
  CheckCircleOutlined: ICON,
  ArrowUpOutlined: ICON,
  ArrowDownOutlined: ICON,
  DownloadOutlined: ICON,
  SearchOutlined: ICON,
  ReloadOutlined: ICON,
}

/** 后端 GET /api/ai/model/stats 现在真的回的这些键（AiStatsController#getModelStats），一个不多 */
const STATS = {
  totalCalls: 12,
  totalTokens: 345,
  totalCost: 1.5,
  successRate: 91.6666667,
  avgResponseTime: 1234.5,
  p50ResponseTime: 999,
  p90ResponseTime: 2500,
  windowFrom: '2026-01-01T00:00:00',
  windowTo: '2026-10-01T00:00:00',
}

async function mountView(stats: Record<string, unknown> = STATS) {
  vi.mocked(aiModelApi.getStats).mockResolvedValue(stats as never)
  vi.mocked(aiModelApi.getUsageByModel).mockResolvedValue([] as never)
  vi.mocked(aiModelApi.getUsageTrend).mockResolvedValue([] as never)
  vi.mocked(aiModelApi.getLogs).mockResolvedValue({ records: [], total: 0, page: 1, size: 20 } as never)
  const wrapper = mount(ModelUsageView, { global: { stubs: globalStubs } })
  await flushPromises()
  return wrapper
}

function buttonsByText(wrapper: ReturnType<typeof mount>, text: string) {
  const found = wrapper.findAllComponents(BUTTON_STUB).filter((node: any) => node.text() === text)
  if (!found.length) throw new Error(`找不到文案为「${text}」的按钮`)
  return found
}

function radiosByText(wrapper: ReturnType<typeof mount>, text: string) {
  const found = wrapper.findAll('.radio-btn').filter((node) => node.text() === text)
  if (!found.length) throw new Error(`找不到文案为「${text}」的趋势按钮`)
  return found
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('接口没回的那几项，界面上不许出现假 0', () => {
  it('今日那档没有数据源：整卡退化成一句说明，三格 0 一起消失', async () => {
    const wrapper = await mountView()
    const text = wrapper.text()
    expect(text).toContain('今日这一档没有数据源')
    expect(text).not.toContain('今日 Token')
    expect(text).not.toContain('今日调用')
    expect(text).not.toContain('今日费用')
  })

  it('预算那一格还没接上额度口径：没有 ¥0、剩余 ¥0.00、NaN 天', async () => {
    const wrapper = await mountView()
    const text = wrapper.text()
    expect(text).toContain('预算那一格还没有接上额度口径')
    expect(text).not.toContain('已使用')
    expect(text).not.toContain('剩余 ¥')
    expect(text).not.toContain('NaN')
    expect(text).not.toContain('Infinity')
  })

  it('环比与那两率后端没有口径：不念 0%，念「未统计」', async () => {
    const wrapper = await mountView()
    const text = wrapper.text()
    expect(text).not.toContain('较上月')
    expect(text).not.toContain('较昨日')
    // 失败重试率、限流触发率这两行后端从没统计过（P5 拆完额度池才有）
    expect(wrapper.findAll('.perf-value--none')).toHaveLength(2)
    expect(text).toContain('未统计')
  })

  it('读回来真是 0 也照样念：不许把「这个月一次没调用」藏成「未统计」', async () => {
    const wrapper = await mountView({
      ...STATS, totalCalls: 0, totalTokens: 0, totalCost: 0, successRate: 0,
      avgResponseTime: 0, p50ResponseTime: 0, p90ResponseTime: 0,
    })
    const text = wrapper.text()
    expect(text).toContain('¥0.00')
    expect(text).not.toContain('这屏的统计没读到')
    expect(wrapper.findAll('.perf-value--none')).toHaveLength(2)
    expect(text).toContain('0ms')
  })
})

describe('接口回了就照念，包括真 0', () => {
  it('补齐今日/预算/环比那几组键后，说明块让位给数字', async () => {
    const wrapper = await mountView({
      ...STATS,
      todayTokens: 40,
      todayCalls: 2,
      todayCost: 0.2,
      todayTokenGrowth: 12.5,
      budgetTotal: 500,
      budgetUsed: 120,
      costGrowth: 3.1,
      successRateGrowth: -0.5,
      retryRate: 0,
      limitRate: 0,
    })
    const text = wrapper.text()
    expect(text).not.toContain('今日这一档没有数据源')
    expect(text).toContain('今日 Token')
    expect(text).toContain('3.1% 较上月')
    expect(text).toContain('0.5% 较昨日')
    expect(text).toContain('剩余 ¥380.00')
    // 0% 是真测出来的 0%，这一回不许念「未统计」
    expect(wrapper.findAll('.perf-value--none')).toHaveLength(0)
  })

  it('预算有额度但一次没花：不算可用天数，免得念成 Infinity 天', async () => {
    const wrapper = await mountView({ ...STATS, budgetTotal: 500, budgetUsed: 0 })
    const text = wrapper.text()
    expect(text).toContain('剩余 ¥500.00')
    expect(text).toContain('这一段还没有消耗，不算可用天数')
    expect(text).not.toContain('Infinity')
    expect(text).not.toContain('预计可使用')
  })
})

describe('统计口整体失败时不摆四格 0', () => {
  it('接口 500：四张卡退化成一句「读取失败」+ 下一步', async () => {
    vi.mocked(aiModelApi.getStats).mockRejectedValue(new Error('500'))
    vi.mocked(aiModelApi.getUsageByModel).mockResolvedValue([] as never)
    vi.mocked(aiModelApi.getUsageTrend).mockResolvedValue([] as never)
    vi.mocked(aiModelApi.getLogs).mockResolvedValue({ records: [], total: 0 } as never)
    const wrapper = mount(ModelUsageView, { global: { stubs: globalStubs } })
    await flushPromises()
    const text = wrapper.text()
    expect(text).toContain('这屏的统计没读到')
    // 「下一步」得真的能走：查询按钮还在原位
    expect(buttonsByText(wrapper, '查询')).toHaveLength(1)
    expect(text).not.toContain('本月总费用')
    expect(text).not.toContain('剩余 ¥')
  })
})

describe('取数区间是后端说回来的，卡片标题不写死「本月」', () => {
  it('把响应里的 windowFrom/windowTo 念成一行', async () => {
    const wrapper = await mountView()
    expect(wrapper.find('.usage-window').text()).toBe('取数区间 2026-01-01 至 2026-10-01（含末日整天）')
  })

  it('老响应没有这两个键：这一行整条不出现，不念「取数区间 undefined」', async () => {
    const wrapper = await mountView({ ...STATS, windowFrom: undefined, windowTo: undefined })
    expect(wrapper.find('.usage-window').exists()).toBe(false)
  })

  it('切到「近30天」：标题跟着变，请求真的带上那一段', async () => {
    const wrapper = await mountView()
    expect(wrapper.text()).toContain('本月总费用')
    await buttonsByText(wrapper, '近30天')[0].trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('近 30 天总费用')
    const statCalls = vi.mocked(aiModelApi.getStats).mock.calls
    const params = statCalls[statCalls.length - 1][0] as Record<string, string>
    expect(params.startDate).toBe(dayjs().subtract(29, 'day').format('YYYY-MM-DD'))
    expect(params.endDate).toBe(dayjs().format('YYYY-MM-DD'))
  })

  it('自己拖日期：标题改成「所选区间」，不再冒充某一个固定档位', async () => {
    const wrapper = await mountView()
    // 走日期选择器那条回调（选择器本身是替件，但触发的是页面自己的 handleDateChange）
    const vm = wrapper.vm as any
    vm.handleDateChange([dayjs('2026-03-01'), dayjs('2026-03-31')])
    await flushPromises()
    expect(wrapper.text()).toContain('所选区间总费用')
    expect(wrapper.text()).not.toContain('本月总费用')
  })
})

describe('趋势那排按钮要真的重新取数', () => {
  it('默认近 7 天，点「近90天」就按 90 天重取', async () => {
    const wrapper = await mountView()
    const first = vi.mocked(aiModelApi.getUsageTrend).mock.calls[0]?.[0] as Record<string, string>
    expect(first.startDate).toBe(dayjs().subtract(6, 'day').format('YYYY-MM-DD'))
    await radiosByText(wrapper, '近90天')[0].trigger('click')
    await flushPromises()
    const trendCalls = vi.mocked(aiModelApi.getUsageTrend).mock.calls
    const last = trendCalls[trendCalls.length - 1][0] as Record<string, string>
    expect(last.startDate).toBe(dayjs().subtract(89, 'day').format('YYYY-MM-DD'))
  })

  it('一段全 0 的区间：柱子站平（0%），不是 NaN%', async () => {
    vi.mocked(aiModelApi.getStats).mockResolvedValue(STATS as never)
    vi.mocked(aiModelApi.getUsageByModel).mockResolvedValue([] as never)
    vi.mocked(aiModelApi.getLogs).mockResolvedValue({ records: [], total: 0 } as never)
    vi.mocked(aiModelApi.getUsageTrend).mockResolvedValue([
      { date: '10-01', tokens: 0, cost: 0, calls: 0 },
      { date: '10-02', tokens: 0, cost: 0, calls: 0 },
    ] as never)
    const wrapper = mount(ModelUsageView, { global: { stubs: globalStubs } })
    await flushPromises()
    const bars = wrapper.findAll('.bar-token')
    expect(bars).toHaveLength(2)
    for (const bar of bars) {
      expect(bar.attributes('style')).toContain('height: 0%')
    }
  })

  it('环中心的总数与图例同源：图例三行 100+200+300，中心念 600 而不是统计口那个 345', async () => {
    vi.mocked(aiModelApi.getStats).mockResolvedValue(STATS as never)
    vi.mocked(aiModelApi.getLogs).mockResolvedValue({ records: [], total: 0 } as never)
    vi.mocked(aiModelApi.getUsageTrend).mockResolvedValue([] as never)
    vi.mocked(aiModelApi.getUsageByModel).mockResolvedValue([
      { name: 'qwen-plus', tokens: 100, percent: 16.67, cost: 0.1 },
      { name: 'doubao-pro', tokens: 200, percent: 33.33, cost: 0.2 },
      { name: 'deepseek-chat', tokens: 300, percent: 50, cost: 0.3 },
    ] as never)
    const wrapper = mount(ModelUsageView, { global: { stubs: globalStubs } })
    await flushPromises()
    expect(wrapper.find('.pie-total').text()).toBe('600')
    expect(wrapper.findAll('.legend-row')).toHaveLength(3)
    // 现场挖出的第二处：图例直出过 98.47367719363453%，界面只该念一位小数
    expect(wrapper.findAll('.legend-percent').map(n => n.text())).toEqual(['16.7%', '33.3%', '50.0%'])
  })
})

/**
 * 本月额度那块：两池分账（Spec-G G4 / P5 界面那一半）。
 *
 * 拆池之前这一屏只有「¥预算」一格，而 GEO 诊断和文章生成扣的是同一个 token 池：
 * 「本月剩余」在两的产品线上是同一个数，于是「文章写多了还能不能跑诊断」这个问题在界面上
 * 根本没有答案（缺口 F2）。G4 之后后端在 /billing/stats/overview 里回 pools 两行，
 * 这一屏必须把它们念成两行，并且只在点名了租户的时候念——全租户视角把各家的水位相加
 * 是个假上限，那一格宁可整个不出现。
 */
const POOLS = [
  {
    usageType: 'AI_TOKEN',
    poolLabel: '通用 AI 额度池',
    monthTokenAmount: 7000,
    monthCount: 2,
    monthlyQuota: 1000000,
    usedTokens: 7000,
    remainingTokens: 993000,
  },
  {
    usageType: 'AI_GEO',
    poolLabel: 'GEO 诊断专用额度池',
    monthTokenAmount: 1500,
    monthCount: 1,
    monthlyQuota: 80000,
    usedTokens: 1500,
    remainingTokens: 78500,
  },
]

async function mountPools(pools: unknown, tenantId: number | null = 15) {
  useAuthStore().selectedTenantId = tenantId
  vi.mocked(statsApi.overview).mockResolvedValue({ pools } as never)
  vi.mocked(aiModelApi.getStats).mockResolvedValue(STATS as never)
  vi.mocked(aiModelApi.getUsageByModel).mockResolvedValue([] as never)
  vi.mocked(aiModelApi.getUsageTrend).mockResolvedValue([] as never)
  vi.mocked(aiModelApi.getLogs).mockResolvedValue({ records: [], total: 0 } as never)
  const wrapper = mount(ModelUsageView, { global: { stubs: globalStubs } })
  await flushPromises()
  return wrapper
}

describe('本月额度念的是两池，不是相加那一个数（G4）', () => {
  afterEach(() => {
    // 这一屏用的是那一份全局 store：选没选租户会串到后面的用例，用完必须放回「没选」
    useAuthStore().selectedTenantId = null
  })

  it('两池各念各的水位、各念各的剩余', async () => {
    const wrapper = await mountPools(POOLS)
    const text = wrapper.text()
    expect(text).toContain('本月额度（两池分账）')
    expect(text).toContain('通用 AI 额度池')
    expect(text).toContain('GEO 诊断专用额度池')
    expect(text).toContain('剩余 993,000')
    expect(text).toContain('剩余 78,500')
    expect(text).toContain('月度额度 1,000,000 token')
    expect(text).toContain('月度额度 80,000 token')
    // 两池各自的分母：7000/1000000 = 1%，1500/80000 = 2%
    expect(wrapper.findAll('.progress-stub').map(n => n.attributes('data-percent'))).toEqual(['1', '2'])
  })

  it('两池的流水各数各的：界面不念那个把两池加起来的总数', async () => {
    const wrapper = await mountPools(POOLS)
    const rows = wrapper.findAll('.pool-row')
    expect(rows).toHaveLength(2)
    expect(rows[0].text()).toContain('扣费流水 2 笔、合计 7,000 token')
    expect(rows[1].text()).toContain('扣费流水 1 笔、合计 1,500 token')
    // 「本月一共花了多少」这个数（7000+1500）是流水的口径，不是任何一池的剩余；
    // 把它念在这一屏里，等于把缺口 F2 又装回去——两池各数各的，相加那一句归账单页说。
    expect(wrapper.text()).not.toContain('合计 8,500')
  })

  it('拆池之前的 NULL 流水只挂在通用池那一行，GEO 行不认领', async () => {
    const wrapper = await mountPools(POOLS)
    const rows = wrapper.findAll('.pool-row')
    expect(rows[0].text()).toContain('拆池之前')
    expect(rows[1].text()).not.toContain('拆池之前')
  })

  it('GEO 那一池没设水位（月度额度 0）：百分比念 0，不念 NaN% / Infinity%', async () => {
    const wrapper = await mountPools([
      { ...POOLS[0], monthlyQuota: 0, usedTokens: 0, remainingTokens: 0 },
      { ...POOLS[1], monthlyQuota: 0, usedTokens: 1500, remainingTokens: 0 },
    ])
    expect(wrapper.findAll('.progress-stub').map(n => n.attributes('data-percent'))).toEqual(['0', '0'])
    const text = wrapper.text()
    expect(text).not.toContain('NaN')
    expect(text).not.toContain('Infinity')
  })

  it('后端只回了一行也要照念，不硬凑第二行的 0', async () => {
    const wrapper = await mountPools([POOLS[1]])
    expect(wrapper.findAll('.pool-row')).toHaveLength(1)
    expect(wrapper.text()).not.toContain('通用 AI 额度池')
    expect(wrapper.text()).toContain('剩余 78,500')
  })

  it('没点名租户：不请求额度口，也不念一个不知道是谁的上限', async () => {
    const wrapper = await mountPools(POOLS, null)
    expect(statsApi.overview).not.toHaveBeenCalled()
    expect(wrapper.findAll('.pool-row')).toHaveLength(0)
    expect(wrapper.text()).not.toContain('月度额度')
    // 退回那格说明：这一格要的是钱，而 token 口径需要点名租户才有归属
    expect(wrapper.text()).toContain('预算那一格还没有接上额度口径')
  })

  it('额度口读失败：整块消失而不是把「未取到」念成 0 剩余额度', async () => {
    useAuthStore().selectedTenantId = 15
    vi.mocked(statsApi.overview).mockRejectedValue(new Error('500'))
    vi.mocked(aiModelApi.getStats).mockResolvedValue(STATS as never)
    vi.mocked(aiModelApi.getUsageByModel).mockResolvedValue([] as never)
    vi.mocked(aiModelApi.getUsageTrend).mockResolvedValue([] as never)
    vi.mocked(aiModelApi.getLogs).mockResolvedValue({ records: [], total: 0 } as never)
    const wrapper = mount(ModelUsageView, { global: { stubs: globalStubs } })
    await flushPromises()
    expect(wrapper.findAll('.pool-row')).toHaveLength(0)
    // 认卡片标题，不认整页文案：那块说明里的「下一步」本来就要点名这块的名字，整页念会误判
    const titles = wrapper.findAll('.st-title').map(n => n.text())
    expect(titles).not.toContain('本月额度（两池分账）')
    expect(titles).toContain('本月预算')
    expect(wrapper.text()).toContain('预算那一格还没有接上额度口径')
    // 主统计那四格不受影响：两条口各读各的，一条失败不牵连另一条
    expect(wrapper.text()).not.toContain('这屏的统计没读到')
  })

  it('老响应没有 pools 这一键：这块整个不出现', async () => {
    const wrapper = await mountPools(undefined)
    expect(wrapper.findAll('.pool-row')).toHaveLength(0)
    expect(wrapper.text()).toContain('预算那一格还没有接上额度口径')
  })
})
