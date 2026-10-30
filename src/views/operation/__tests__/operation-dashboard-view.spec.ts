import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import OperationDashboardView from '../OperationDashboardView.vue'
import { operationApi } from '../../../api/operation'

/**
 * 运营「概览」这一屏（M-P98）。
 *
 * 改前这一屏有六件事嘴上说做了、实际没做：
 * 1. 读的是 `auth.selectedTenantId || 0`，租户管理员永远拿 0，而且第一句 `if (!auth.selectedTenantId) return`
 *    把他挡在门外，屏幕照旧摆一屏 0；
 * 2. 「客户案例」卡是界面写死的 0，后台有 9 行也念 0；
 * 3. 四张卡上方那三个涨跌角标（+12.5% 之类）是模板里写死的假数；
 * 4. 本周/本月/本季只改标题、不重新取数，柱子永远是近 7 天；
 * 5. 读失败和「这一家真没有」长得一模一样，恒 0；
 * 6. 饼图画的是模板里写死的五段固定角度，跟这一家的分类无关。
 * 用例钉这六处，外加「读不到这一家就不再去问那两口」。
 */

vi.mock('../../../api/operation', () => ({
  operationApi: {
    getDashboard: vi.fn(),
    getTrafficTrend: vi.fn(),
    getCategoryDistribution: vi.fn()
  }
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

const PASS_THROUGH = (name: string) => ({
  name,
  props: ['gutter', 'span', 'bordered'],
  template: `<div class="${name}-stub"><slot /></div>`
})

const CARD_STUB = {
  name: 'ACard',
  props: ['title', 'bordered'],
  template: `<div class="card-stub"><slot name="title" /><slot name="extra" /><slot /></div>`
}

const RADIO_GROUP_STUB = {
  name: 'ARadioGroup',
  props: ['value', 'modelValue', 'buttonStyle', 'size'],
  emits: ['update:value', 'change'],
  template: `<div class="radio-group-stub"><slot /></div>`
}

const EMPTY_STUB = {
  name: 'AEmpty',
  props: ['description', 'image'],
  template: `<div class="empty-stub">{{ description }}</div>`
}

const ALERT_STUB = {
  name: 'AAlert',
  props: ['message', 'description', 'type', 'showIcon'],
  template: `<div class="alert-stub"><span class="alert-msg">{{ message }}</span></div>`
}

function mountView() {
  return mount(OperationDashboardView, {
    attachTo: document.body,
    global: {
      stubs: {
        'a-spin': PASS_THROUGH('ASpin'),
        'a-row': PASS_THROUGH('ARow'),
        'a-col': PASS_THROUGH('ACol'),
        'a-card': CARD_STUB,
        'a-radio-group': RADIO_GROUP_STUB,
        'a-radio-button': { name: 'ARadioButton', props: ['value'], template: `<label><slot /></label>` },
        'a-empty': EMPTY_STUB,
        'a-alert': ALERT_STUB
      }
    }
  })
}

function isoDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

function dashboardOf(overrides: Record<string, any> = {}) {
  return {
    today: { views: 12, articles: 2, activeUsers: 3 },
    weeklyTrend: [],
    keyMetrics: {
      totalArticles: 41,
      totalViews: 1234,
      totalComments: 5,
      totalLikes: 6,
      totalUsers: 7,
      totalCases: 9
    },
    ...overrides
  }
}

function mockAllOk() {
  vi.mocked(operationApi.getDashboard).mockResolvedValue(dashboardOf() as any)
  vi.mocked(operationApi.getTrafficTrend).mockResolvedValue([] as any)
  vi.mocked(operationApi.getCategoryDistribution).mockResolvedValue([] as any)
}

beforeEach(() => {
  vi.clearAllMocks()
  authMock.isSuperAdmin = true
  authMock.selectedTenantId = 15
  authMock.selectedTenantCode = 'demo'
  authMock.user = { tenantId: 15 }
  mockAllOk()
})

afterEach(() => {
  document.body.innerHTML = ''
})

describe('这一屏的数属于谁', () => {
  it('超管选定了客户：按那一家取数，屏上写明看的是谁', async () => {
    const wrapper = mountView()
    await flushPromises()

    expect(vi.mocked(operationApi.getDashboard)).toHaveBeenCalledWith(15)
    expect(vi.mocked(operationApi.getTrafficTrend)).toHaveBeenCalledTimes(1)
    expect(vi.mocked(operationApi.getTrafficTrend).mock.calls[0][0]).toBe(15)
    expect(vi.mocked(operationApi.getCategoryDistribution)).toHaveBeenCalledWith(15)
    expect(wrapper.find('.alert-msg').text()).toContain('客户「demo」（编号 #15）')
  })

  it('租户管理员没有「选中态」也按自己那一家取数，不再永远 0', async () => {
    authMock.isSuperAdmin = false
    authMock.selectedTenantId = null
    authMock.selectedTenantCode = null
    authMock.user = { tenantId: 558 }

    const wrapper = mountView()
    await flushPromises()

    expect(vi.mocked(operationApi.getDashboard)).toHaveBeenCalledWith(558)
    expect(vi.mocked(operationApi.getTrafficTrend).mock.calls[0][0]).toBe(558)
    expect(vi.mocked(operationApi.getCategoryDistribution)).toHaveBeenCalledWith(558)
    expect(wrapper.find('.alert-msg').text()).toContain('你所在客户（编号 #558）')
    expect(wrapper.findAll('.stat-value').map(node => node.text())).toEqual(['1,234', '41', '9', '3'])
  })

  it('超管还没选定客户：一句话说清，一发请求都不发，四张卡不摆 0 摆「—」', async () => {
    authMock.selectedTenantId = null
    authMock.selectedTenantCode = null

    const wrapper = mountView()
    await flushPromises()

    expect(vi.mocked(operationApi.getDashboard)).not.toHaveBeenCalled()
    expect(vi.mocked(operationApi.getTrafficTrend)).not.toHaveBeenCalled()
    expect(vi.mocked(operationApi.getCategoryDistribution)).not.toHaveBeenCalled()
    expect(wrapper.find('.alert-msg').text()).toContain('没有选定客户')
    expect(wrapper.findAll('.stat-value').map(node => node.text())).toEqual(['—', '—', '—', '—'])
  })
})

describe('读不到这一家 ≠ 这一家没有数据', () => {
  it('后端说这一家读不到：四张卡摆「—」，原样念后端那句成因，也不再去问那两口', async () => {
    vi.mocked(operationApi.getDashboard).mockResolvedValue(
      dashboardOf({
        tenantUnreadable: true,
        emptyReason: 'NOT_VISIBLE',
        emptyLine: '运营概览读不到这一家：这个编号不存在或已被删除。这不代表这一家「没有数据」。'
      }) as any
    )

    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.findAll('.stat-value').map(node => node.text())).toEqual(['—', '—', '—', '—'])
    const alerts = wrapper.findAll('.alert-msg').map(node => node.text()).join(' | ')
    expect(alerts).toContain('运营概览读不到这一家')
    expect(vi.mocked(operationApi.getTrafficTrend)).not.toHaveBeenCalled()
    expect(vi.mocked(operationApi.getCategoryDistribution)).not.toHaveBeenCalled()
  })

  it('整个概览没读上来：四张卡摆「—」，念出原因，不摆一屏 0', async () => {
    vi.mocked(operationApi.getDashboard).mockRejectedValue(new Error('网关 502'))

    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.findAll('.stat-value').map(node => node.text())).toEqual(['—', '—', '—', '—'])
    const alerts = wrapper.findAll('.alert-msg').map(node => node.text()).join(' | ')
    expect(alerts).toContain('这一屏没读上来：网关 502')
    expect(vi.mocked(operationApi.getTrafficTrend)).not.toHaveBeenCalled()
  })

  it('趋势与分类各自读失败时分开念，不和「真没有」同一句', async () => {
    vi.mocked(operationApi.getTrafficTrend).mockRejectedValue(new Error('请求超时'))
    vi.mocked(operationApi.getCategoryDistribution).mockRejectedValue(new Error('服务暂时不可用'))

    const wrapper = mountView()
    await flushPromises()

    const says = wrapper.findAll('.chart-state').map(node => node.text())
    expect(says[0]).toContain('浏览趋势没读上来：请求超时')
    expect(says[1]).toContain('分类分布没读上来：服务暂时不可用')
    expect(wrapper.findAll('.empty-stub')).toHaveLength(0)
  })

  it('真没有数据时念「这一段时间里一次浏览都没有」「还没有发布过带分类的文章」', async () => {
    const wrapper = mountView()
    await flushPromises()

    const says = wrapper.findAll('.empty-stub').map(node => node.text())
    expect(says).toContain('这一段时间里一次浏览都没有')
    expect(says).toContain('这一家还没有发布过带分类的文章')
  })
})

describe('摆出来的数是真的', () => {
  it('客户案例读后端那一格，不再是界面写死的 0', async () => {
    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.findAll('.stat-title')[2].text()).toBe('客户案例')
    expect(wrapper.findAll('.stat-value')[2].text()).toBe('9')
  })

  it('饼图按这一家的分类真比例画，不是模板写死的固定角度', async () => {
    vi.mocked(operationApi.getCategoryDistribution).mockResolvedValue([
      { categoryId: 1, categoryName: '种牙', count: 3 },
      { categoryId: 2, categoryName: '正畸', count: 1 }
    ] as any)

    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.find('.pie-total').text()).toBe('4')
    const style = wrapper.find('.pie-chart').attributes('style') || ''
    expect(style).toContain('conic-gradient')
    expect(style).toContain('270deg 360deg')
    expect(wrapper.findAll('.legend-value').map(node => node.text())).toEqual(['3', '1'])
  })

  it('趋势柱子按真实浏览量出高度：0 次的柱子是平的，不冒充有流量', async () => {
    vi.mocked(operationApi.getTrafficTrend).mockResolvedValue([
      { date: '2026-10-27', views: 0 },
      { date: '2026-10-28', views: 10 },
      { date: '2026-10-29', views: 5 }
    ] as any)

    const wrapper = mountView()
    await flushPromises()

    const bars = wrapper.findAll('.bar')
    expect(bars[0].attributes('style')).toContain('height: 0%')
    expect(bars[1].attributes('style')).toContain('height: 90%')
    expect(wrapper.findAll('.chart-bar')).toHaveLength(3)
  })
})

describe('本周 / 本月 / 本季是真区间，不是只改标题', () => {
  it('打开时按「本周」发真区间：起点是周一、终点是今天', async () => {
    mountView()
    await flushPromises()

    const call = vi.mocked(operationApi.getTrafficTrend).mock.calls[0]
    const startDate = call[2] as string
    const endDate = call[3] as string
    expect(startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(endDate).toBe(isoDate(new Date()))
    expect(new Date(`${startDate}T00:00:00`).getDay()).toBe(1)
  })

  it('切到「本月」：重新问一次，区间从本月一号起', async () => {
    const wrapper = mountView()
    await flushPromises()
    const before = vi.mocked(operationApi.getTrafficTrend).mock.calls.length

    const radio = wrapper.findComponent({ name: 'ARadioGroup' })
    radio.vm.$emit('update:value', 'month')
    await flushPromises()

    expect(vi.mocked(operationApi.getTrafficTrend).mock.calls.length).toBe(before + 1)
    const call = vi.mocked(operationApi.getTrafficTrend).mock.calls[before]
    expect(call[2] as string).toMatch(/^\d{4}-\d{2}-01$/)
  })

  it('切到「本季」：区间从这一季的第一个月的 1 号起', async () => {
    const wrapper = mountView()
    await flushPromises()
    const before = vi.mocked(operationApi.getTrafficTrend).mock.calls.length

    const radio = wrapper.findComponent({ name: 'ARadioGroup' })
    radio.vm.$emit('update:value', 'quarter')
    await flushPromises()

    const call = vi.mocked(operationApi.getTrafficTrend).mock.calls[before]
    const startDate = call[2] as string
    const month = Number(startDate.substring(5, 7))
    expect(startDate.endsWith('-01')).toBe(true)
    expect([1, 4, 7, 10]).toContain(month)
  })

  it('读不到这一家时切档不再发请求', async () => {
    vi.mocked(operationApi.getDashboard).mockResolvedValue(
      dashboardOf({ tenantUnreadable: true, emptyLine: '读不到' }) as any
    )
    const wrapper = mountView()
    await flushPromises()

    const radio = wrapper.findComponent({ name: 'ARadioGroup' })
    radio.vm.$emit('update:value', 'month')
    await flushPromises()

    expect(vi.mocked(operationApi.getTrafficTrend)).not.toHaveBeenCalled()
  })
})
