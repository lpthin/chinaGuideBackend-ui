import { beforeEach, describe, it, expect, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import dayjs from 'dayjs'
import ModelUsageView from '../ModelUsageView.vue'
import { aiModelApi } from '../../../api/ai-model'

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
