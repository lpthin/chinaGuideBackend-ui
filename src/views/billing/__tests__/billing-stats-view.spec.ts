import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import BillingStatsView from '../BillingStatsView.vue'
import { statsApi, topServicesApi } from '../../../api/billing'
import * as echarts from 'echarts'

/**
 * 超管「消费统计」这一屏（M-P93）。
 *
 * 改前这一屏有六件事会被人看错：
 * 1. 包装层往 `/billing/stats` 与 `/stats/breakdown` 发 `periodType`/`startDate`/`endDate`，
 *    后端口上只有 `tenantId`，一个字不消费（现测 2026-10-30：带区间与不带区间回包逐字节相同）；
 * 2. 四张卡的兜底是 `|| 0`，读失败与「这家一分钱没花」长成一个样；
 * 3. 「日均消费」与「预计月底」是前端自己拿本月已过天数除出来的，界面上却摆成账单数的样子，
 *    月底那一格还写死 30 天；
 * 4. 上月为 0 时后端回的是编出来的 100，界面念「比上月多 100.0%」；
 * 5. 超管没选客户时，五个加载函数都回落到 `authStore.tenantId`（那是 `user.tenantId || 1`），
 *    屏上摆的是 admin 账号名下那一家的账，一个字不说这是谁家的；
 * 6. 一个库里没有的租户号（`?tenantId=999999`）照样回一整屏 0，四块图一句空态都没有。
 * 用例钉这六处。
 */

vi.mock('ant-design-vue', async () => {
  const actual = await vi.importActual<Record<string, any>>('ant-design-vue')
  return {
    ...actual,
    message: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() }
  }
})

vi.mock('../../../api/billing', () => ({
  statsApi: {
    overview: vi.fn(),
    getStats: vi.fn(),
    getTrend: vi.fn(),
    getBreakdown: vi.fn(),
    getMonthlyCompare: vi.fn()
  },
  topServicesApi: { getTopServices: vi.fn() }
}))

/** echarts 在这间屋子里画不出东西，也不需要画——这一屏要钉的是「哪一格该摆什么话」 */
vi.mock('echarts', () => {
  const instance = { setOption: vi.fn(), resize: vi.fn(), dispose: vi.fn() }
  return {
    init: vi.fn(() => instance),
    graphic: { LinearGradient: class {} },
    __instance: instance
  }
})

const authMock = {
  isSuperAdmin: true,
  selectedTenantId: 15 as number | null,
  selectedTenantCode: 'demo-corp' as string | null,
  user: { tenantId: 1 } as { tenantId: number } | null
}

vi.mock('../../../stores/auth', () => ({
  useAuthStore: () => authMock
}))

const UNREADABLE_LINE =
  '消费统计：这一档读不到（选中的那个身份在这张表里没有行），所以这里不能说「没有」。'

function statsRead(overrides: Record<string, unknown> = {}) {
  return {
    balance: 0,
    totalIncome: 100,
    totalExpense: 22.5,
    thisMonthExpense: 12.5,
    lastMonthExpense: 10,
    monthOverMonthGrowth: 25,
    pendingInvoices: 2,
    pendingAmount: 7.5,
    lastMonthInvoices: 1,
    tenantUnreadable: false,
    ...overrides
  }
}

interface Options {
  stats?: ReturnType<typeof statsRead>
  statsError?: string
  trend?: unknown[]
  trendError?: string
  breakdown?: unknown[]
  compare?: { months: string[]; currentYear: number[]; lastYear: number[] }
  topServices?: unknown[]
}

async function mountView(options: Options = {}) {
  const {
    stats = statsRead(),
    statsError = '',
    trend = [
      { date: '10/14', amount: 6.5 },
      { date: '10/15', amount: 6 }
    ],
    trendError = '',
    breakdown = [{ productType: 'AI', productName: 'AI调用', amount: 12.5, percentage: 100 }],
    compare = { months: ['10月'], currentYear: [12.5], lastYear: [0] },
    topServices = [{ name: 'AI 生成', usage: 3, unit: '次', amount: 12.5, percent: 100 }]
  } = options

  if (statsError) {
    vi.mocked(statsApi.getStats).mockRejectedValueOnce(new Error(statsError))
  } else {
    vi.mocked(statsApi.getStats).mockResolvedValue(stats as never)
  }

  if (trendError) {
    vi.mocked(statsApi.getTrend).mockRejectedValueOnce(new Error(trendError))
  } else {
    vi.mocked(statsApi.getTrend).mockResolvedValue(trend as never)
  }
  vi.mocked(statsApi.getBreakdown).mockResolvedValue(breakdown as never)
  vi.mocked(statsApi.getMonthlyCompare).mockResolvedValue(compare as never)
  vi.mocked(topServicesApi.getTopServices).mockResolvedValue(topServices as never)

  const wrapper = mount(BillingStatsView, {
    attachTo: document.body,
    global: {
      stubs: {
        'a-spin': { name: 'ASpin', template: '<div class="spin-stub"><slot /></div>' },
        'a-row': { name: 'ARow', template: '<div class="row-stub"><slot /></div>' },
        'a-col': { name: 'ACol', template: '<div class="col-stub"><slot /></div>' },
        'a-card': {
          name: 'ACard',
          props: ['title'],
          template: `<div class="card-stub"><div class="card-title">{{ title }}</div><slot /></div>`
        },
        'a-radio-group': { name: 'ARadioGroup', template: '<div class="radio-stub"><slot /></div>' },
        'a-radio-button': { name: 'ARadioButton', template: '<div class="radio-btn-stub"><slot /></div>' },
        'a-list': {
          name: 'AList',
          props: { dataSource: { type: Array, default: () => [] as unknown[] } },
          template: `<div class="list-stub" :data-rows="dataSource.length"><slot /></div>`
        },
        'a-list-item': { name: 'AListItem', template: '<div class="list-item-stub"><slot /></div>' }
      }
    }
  })
  await flushPromises()
  return wrapper
}

function cardValues(wrapper: any): string[] {
  return wrapper.findAll('.stat-value').map((node: any) => node.text())
}

/** 四块图/列表各自的态：拿到每块卡里那个 StateBlock 的标题（一块都没有时是空数组） */
function stateTitles(wrapper: any): string[] {
  return wrapper.findAll('.admin-state-block__title').map((node: any) => node.text())
}

beforeEach(() => {
  document.body.innerHTML = ''
  vi.clearAllMocks()
  authMock.isSuperAdmin = true
  authMock.selectedTenantId = 15
  authMock.selectedTenantCode = 'demo-corp'
  authMock.user = { tenantId: 1 }
  // 本月已过 15 天、这一月有 31 天：日均与「照此到月底」这两笔推算的算法要能算死
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 9, 15))
})

afterEach(() => {
  vi.useRealTimers()
})

describe('消费统计屏', () => {
  it('超管没选客户时一发请求都不发，也不摆任何一家的数', async () => {
    authMock.selectedTenantId = null

    const wrapper = await mountView()

    expect(wrapper.text()).toContain('还没有选定客户')
    expect(wrapper.text()).toContain('当前没有选定客户')
    expect(statsApi.getStats).not.toHaveBeenCalled()
    expect(statsApi.getTrend).not.toHaveBeenCalled()
    expect(echarts.init).not.toHaveBeenCalled()
    expect(wrapper.findAll('.stat-value')).toHaveLength(0)
  })

  it('屏上写清这一屏是谁家的账，不再悄悄用登录账号那一家', async () => {
    const wrapper = await mountView()

    expect(wrapper.find('[data-testid="scope-line"]').text()).toContain('客户「demo-corp」')
    expect(wrapper.find('[data-testid="scope-line"]').text()).toContain('编号 #15')
    expect(wrapper.find('[data-testid="scope-line"]').text()).toContain('这一屏没有跨客户合计')
  })

  it('普通租户管理员看自己登录态里那一家，不再因为没选中而整屏空白', async () => {
    authMock.isSuperAdmin = false
    authMock.selectedTenantId = null
    authMock.user = { tenantId: 611 }

    const wrapper = await mountView()

    expect(statsApi.getStats).toHaveBeenCalledWith(611)
    expect(wrapper.find('[data-testid="scope-line"]').text()).toContain('编号 #611')
  })

  it('四张卡摆的是后端真回的那些数，日均与月底那两格标明是推算', async () => {
    const wrapper = await mountView()

    // 本月 12.50 / 上月 10.00 / 日均 12.5÷15=0.83 / 待付账单 2 张
    expect(cardValues(wrapper)).toEqual(['¥12.50', '¥10.00', '¥0.83', '2'])
    // 月底那一格以前写死 30 天（12.5×30/15=25.00），这个月有 31 天
    const projected = wrapper.find('[data-testid="card-projected"]').text()
    expect(projected).toContain('本月已过 15 天')
    expect(projected).toContain('¥25.83')
    expect(projected).toContain('推算，不是账单数')
  })

  it('上月一分钱没花时不许摆编出来的百分比', async () => {
    const wrapper = await mountView({
      stats: statsRead({ lastMonthExpense: 0, monthOverMonthGrowth: null })
    })

    expect(wrapper.find('[data-testid="growth-line"]').text()).toContain('上月没有消费，比不出涨跌')
    expect(wrapper.text()).not.toContain('100.0%')
    expect(wrapper.text()).not.toContain('0.0%')
  })

  it('有分母时才摆真涨跌', async () => {
    const wrapper = await mountView()

    expect(wrapper.find('[data-testid="growth-up"]').text()).toContain('25.0%')
    expect(wrapper.find('.stat-trend').text()).toContain('较上月')
  })

  it('这一家读不到：四张卡摆「—」，四块图谁也不许说「没有」', async () => {
    const wrapper = await mountView({
      stats: statsRead({
        thisMonthExpense: 0,
        lastMonthExpense: 0,
        monthOverMonthGrowth: null,
        pendingInvoices: 0,
        pendingAmount: 0,
        lastMonthInvoices: 0,
        tenantUnreadable: true,
        emptyReason: 'NOT_VISIBLE',
        emptyLine: UNREADABLE_LINE
      })
    })

    expect(cardValues(wrapper)).toEqual(['—', '—', '—', '—'])
    // 后端那一句成因原文只许有一份，界面不抄第二份
    expect(wrapper.find('[data-testid="backend-reason"]').text()).toContain(UNREADABLE_LINE)
    expect(stateTitles(wrapper)).toHaveLength(4)
    expect(wrapper.text()).toContain('这一家读不到，不是没有消费')
    expect(wrapper.text()).not.toContain('这个区间里没有消费记录')
    // 那些相加查询对一个不存在的租户照样回得出空数组，所以这四发根本不该发出去
    expect(statsApi.getTrend).not.toHaveBeenCalled()
    expect(statsApi.getBreakdown).not.toHaveBeenCalled()
    expect(statsApi.getMonthlyCompare).not.toHaveBeenCalled()
    expect(topServicesApi.getTopServices).not.toHaveBeenCalled()
  })

  it('统计头读失败只糊四张卡，四块图各自照取各自报失败', async () => {
    const wrapper = await mountView({ statsError: '无法连接服务器，请确认后端已启动' })

    expect(cardValues(wrapper)).toEqual(['—', '—', '—', '—'])
    expect(wrapper.find('[data-testid="growth-line"]').text()).toContain('这次没取到，比不出涨跌')
    expect(wrapper.find('[data-testid="backend-reason"]').text()).toContain('这次没取到')
    expect(statsApi.getTrend).toHaveBeenCalled()
    expect(stateTitles(wrapper)).toHaveLength(0)
  })

  it('只有趋势那一块没取到时，别的块不许跟着说空', async () => {
    const wrapper = await mountView({ trendError: '网关超时' })

    const trendCard = wrapper.findAll('.card-stub').find((node: any) => node.text().includes('消费趋势'))
    expect(trendCard!.find('.admin-state-block__title').text()).toContain('读取失败')
    expect(trendCard!.find('.admin-state-block__detail').text()).toContain('网关超时')
    expect(wrapper.findAll('.admin-state-block')).toHaveLength(1)
    expect(wrapper.findAll('.list-stub')[0]!.attributes('data-rows')).toBe('1')
  })

  it('取到了但是空的，念的是「这个区间里没有消费记录」', async () => {
    const wrapper = await mountView({ trend: [] })

    expect(stateTitles(wrapper)).toEqual(['这个区间里没有消费记录'])
    // 「真的没有」那一档要给出下一步，且不许把「—」摆到有数的卡上
    expect(wrapper.text()).toContain('想看这家花过什么')
    expect(cardValues(wrapper)).toEqual(['¥12.50', '¥10.00', '¥0.83', '2'])
  })

  it('发给后端的只有租户号，没人消费的周期与日期参数不再发', async () => {
    await mountView()

    expect(vi.mocked(statsApi.getStats).mock.calls[0]).toEqual([15])
    expect(vi.mocked(statsApi.getStats).mock.calls[0]).toHaveLength(1)
    expect(vi.mocked(statsApi.getBreakdown).mock.calls[0]).toEqual([15])
    expect(vi.mocked(statsApi.getBreakdown).mock.calls[0]).toHaveLength(1)
    // 趋势那一条区间是真的把手（近 7/30/90 天），它消费的是 days
    expect(vi.mocked(statsApi.getTrend).mock.calls[0]).toEqual([15, 30])
  })
})
