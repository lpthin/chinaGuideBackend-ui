import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { Button, message } from 'ant-design-vue'
import DataReportView from '../DataReportView.vue'
import { operationApi } from '../../../api/operation'

/**
 * 运营「数据报表」这一屏（M-P92）。
 *
 * 改前这一屏有四件事嘴上说做了、实际没做：
 * 1. 日期区间发过去，后端一个字不消费（/stats、七个读口都只认 tenantId）；
 * 2. 四张统计卡读失败和「真的是 0」长得一模一样，恒 0；
 * 3. 每张图的空态都念「暂无数据」——「这段时间没有数据」和「这次没取到」同一个样；
 * 4. 导出：后端拒绝时回的也是 Blob（内容是 JSON），界面照样存成 .csv 还念「导出成功」；
 *    导出内容下拉里的「知识库文档」后端根本不认，被当成文章导了。
 * 用例钉这四处，外加「导出内容下拉只换档、不重新取数」「普通租户管理员没有选中态也能取数」。
 */

vi.mock('ant-design-vue', async () => {
  const actual = await vi.importActual<Record<string, any>>('ant-design-vue')
  return {
    ...actual,
    message: {
      success: vi.fn(),
      error: vi.fn(),
      warning: vi.fn(),
      info: vi.fn(),
      loading: vi.fn()
    }
  }
})

vi.mock('../../../api/operation', () => ({
  operationApi: {
    getStats: vi.fn(),
    getTrafficTrend: vi.fn(),
    getCategoryDistribution: vi.fn(),
    getUserStats: vi.fn(),
    getUserGrowth: vi.fn(),
    getUserActivity: vi.fn(),
    getTrafficSource: vi.fn(),
    getDeviceDistribution: vi.fn(),
    getDashboard: vi.fn(),
    exportStats: vi.fn()
  }
}))

const authMock = { selectedTenantId: 15 as number | null, tenantId: 15 as number | null }

vi.mock('../../../stores/auth', () => ({
  useAuthStore: () => authMock
}))

const PASS_THROUGH = (name: string) => ({
  name,
  props: ['title', 'bordered', 'gutter', 'span', 'size', 'dataSource', 'strokeColor', 'percent', 'showInfo'],
  template: `<div class="${name}-stub"><slot /></div>`
})

const PICKER_STUB = {
  name: 'ARangePicker',
  props: ['value', 'placeholder'],
  emits: ['update:value', 'change'],
  template: `<div class="range-stub"></div>`
}

const SELECT_STUB = {
  name: 'ASelect',
  props: ['value', 'modelValue'],
  emits: ['update:value', 'change'],
  template: `<div class="select-stub"><slot /></div>`
}

const EMPTY_STUB = {
  name: 'AEmpty',
  props: ['description', 'image'],
  template: `<div class="empty-stub">{{ description }}</div>`
}

const ALERT_STUB = {
  name: 'AAlert',
  props: ['message', 'description', 'type', 'showIcon'],
  template: `<div class="alert-stub"><span class="alert-msg">{{ message }}</span>{{ description }}</div>`
}

/** 真 a-tabs 只渲当前那一页；这里三页全渲出来，断言才能一次看全 */
const TABS_STUB = { name: 'ATabs', template: `<div class="tabs-stub"><slot /></div>` }
const TAB_PANE_STUB = { name: 'ATabPane', props: ['tab'], template: `<div class="tab-pane"><slot /></div>` }

function mountView() {
  return mount(DataReportView, {
    attachTo: document.body,
    global: {
      stubs: {
        'a-spin': PASS_THROUGH('ASpin'),
        'a-row': PASS_THROUGH('ARow'),
        'a-col': PASS_THROUGH('ACol'),
        'a-card': PASS_THROUGH('ACard'),
        'a-space': PASS_THROUGH('ASpace'),
        'a-list': PASS_THROUGH('AList'),
        'a-list-item': PASS_THROUGH('AListItem'),
        'a-progress': PASS_THROUGH('AProgress'),
        'a-page-header': PASS_THROUGH('APageHeader'),
        'a-range-picker': PICKER_STUB,
        'a-select': SELECT_STUB,
        'a-select-option': { name: 'ASelectOption', props: ['value'], template: `<div><slot /></div>` },
        'a-empty': EMPTY_STUB,
        'a-alert': ALERT_STUB,
        'a-tabs': TABS_STUB,
        'a-tab-pane': TAB_PANE_STUB,
        'a-button': Button
      }
    }
  })
}

function mockAllOk() {
  vi.mocked(operationApi.getStats).mockResolvedValue({
    totalArticles: 12,
    totalViews: 345,
    totalComments: 6,
    totalLikes: 7,
    totalUsers: 8
  } as any)
  vi.mocked(operationApi.getTrafficTrend).mockResolvedValue([] as any)
  vi.mocked(operationApi.getCategoryDistribution).mockResolvedValue([] as any)
  vi.mocked(operationApi.getUserGrowth).mockResolvedValue([] as any)
  vi.mocked(operationApi.getUserActivity).mockResolvedValue([] as any)
  vi.mocked(operationApi.getTrafficSource).mockResolvedValue([] as any)
  vi.mocked(operationApi.getDeviceDistribution).mockResolvedValue([] as any)
}

function clickExport(wrapper: ReturnType<typeof mountView>) {
  const button = wrapper.findAll('button').find(node => node.text().includes('导出报表'))
  expect(button, '「导出报表」按钮要在页面上').toBeTruthy()
  button!.element.dispatchEvent(new MouseEvent('click', { bubbles: true }))
}

beforeEach(() => {
  vi.clearAllMocks()
  authMock.selectedTenantId = 15
  authMock.tenantId = 15
  mockAllOk()
  // happy-dom 不实现对象 URL 的创建；下载那一步的副作用不是这组用例要看的
  ;(window.URL as any).createObjectURL = vi.fn(() => 'blob:mock')
  ;(window.URL as any).revokeObjectURL = vi.fn()
})

afterEach(() => {
  document.body.innerHTML = ''
})

describe('日期区间真的进查询', () => {
  it('选了区间以后七个读口都带 startDate/endDate，不是只发给第一个口', async () => {
    const wrapper = mountView()
    await flushPromises()

    const picker = wrapper.findComponent({ name: 'ARangePicker' })
    picker.vm.$emit('update:value', ['2026-10-01', '2026-10-29'])
    picker.vm.$emit('change', ['2026-10-01', '2026-10-29'])
    await flushPromises()

    expect(vi.mocked(operationApi.getStats)).toHaveBeenLastCalledWith(15, '2026-10-01', '2026-10-29')
    expect(vi.mocked(operationApi.getTrafficTrend)).toHaveBeenLastCalledWith(15, 7, '2026-10-01', '2026-10-29')
    expect(vi.mocked(operationApi.getCategoryDistribution)).toHaveBeenLastCalledWith(15, '2026-10-01', '2026-10-29')
    expect(vi.mocked(operationApi.getUserGrowth)).toHaveBeenLastCalledWith(15, 6, '2026-10-01', '2026-10-29')
    expect(vi.mocked(operationApi.getUserActivity)).toHaveBeenLastCalledWith(15, '2026-10-01', '2026-10-29')
    expect(vi.mocked(operationApi.getTrafficSource)).toHaveBeenLastCalledWith(15, '2026-10-01', '2026-10-29')
    expect(vi.mocked(operationApi.getDeviceDistribution)).toHaveBeenLastCalledWith(15, '2026-10-01', '2026-10-29')
    // 区间的形状是「年-月-日」字符串：日期对象发不出去，后端那一口也解析不了
    expect(wrapper.find('.range-stub').attributes('value-format')).toBe('YYYY-MM-DD')
  })

  it('把日期选反了：当面说清楚，页面留着上一份读数不动，也不发请求', async () => {
    const wrapper = mountView()
    await flushPromises()
    const callsBefore = vi.mocked(operationApi.getStats).mock.calls.length

    const picker = wrapper.findComponent({ name: 'ARangePicker' })
    picker.vm.$emit('update:value', ['2026-10-29', '2026-10-01'])
    picker.vm.$emit('change', ['2026-10-29', '2026-10-01'])
    await flushPromises()

    expect(message.warning).toHaveBeenCalledWith(expect.stringContaining('开始日期不能晚于结束日期'))
    expect(vi.mocked(operationApi.getStats).mock.calls.length).toBe(callsBefore)
  })
})

describe('读失败不许摆成 0，也不许和「这段时间没有数据」念同一句', () => {
  it('统计卡读失败四格都摆「—」', async () => {
    vi.mocked(operationApi.getStats).mockRejectedValue(new Error('网关 502'))
    const wrapper = mountView()
    await flushPromises()

    const values = wrapper.findAll('.stat-value').map(node => node.text())
    expect(values).toEqual(['—', '—', '—', '—'])
    expect(message.error).toHaveBeenCalledWith(expect.stringContaining('四张统计卡这次没取到'))
  })

  it('趋势读失败念「这次没取到」，分类真没数据念「这段时间没有数据」', async () => {
    vi.mocked(operationApi.getTrafficTrend).mockRejectedValue(new Error('请求超时'))
    const wrapper = mountView()
    await flushPromises()

    const says = wrapper.findAll('.empty-stub').map(node => node.text())
    expect(says[0]).toContain('流量趋势这次没取到')
    expect(says[1]).toContain('这段时间没有数据')
  })

  it('恢复成功后不再念「没取到」', async () => {
    vi.mocked(operationApi.getTrafficTrend).mockRejectedValueOnce(new Error('请求超时'))
    const wrapper = mountView()
    await flushPromises()
    expect(wrapper.findAll('.empty-stub')[0].text()).toContain('这次没取到')

    vi.mocked(operationApi.getTrafficTrend).mockResolvedValueOnce([
      { date: '2026-10-01', views: 9 }
    ] as any)
    const picker = wrapper.findComponent({ name: 'ARangePicker' })
    picker.vm.$emit('update:value', ['2026-10-01', '2026-10-01'])
    picker.vm.$emit('change', ['2026-10-01', '2026-10-01'])
    await flushPromises()

    expect(wrapper.find('.chart-bar-group').exists()).toBe(true)
    expect(wrapper.findAll('.empty-stub').map(node => node.text())).not.toContain('流量趋势这次没取到')
  })
})

describe('导出那一步：认载荷形状，不认「后端回了东西」', () => {
  it('后端拒绝时回的是 JSON：把原话念出来，不许存成 .csv 还说成功', async () => {
    vi.mocked(operationApi.exportStats).mockResolvedValue(
      new Blob(['{"success":false,"code":"EXPORT_TYPE_UNKNOWN","message":"不认识的导出内容「pdf」"}'], {
        type: 'application/json'
      }) as any
    )
    const wrapper = mountView()
    await flushPromises()
    clickExport(wrapper)
    await flushPromises()

    expect(message.success).not.toHaveBeenCalled()
    expect(message.error).toHaveBeenCalledWith({
      content: expect.stringContaining('不认识的导出内容「pdf」'),
      key: 'export'
    })
  })

  it('后端导出中途炸掉回的是纯文本 500：念出原因，不把报错存成 .csv', async () => {
    vi.mocked(operationApi.exportStats).mockResolvedValue(
      new Blob(['导出失败: null'], { type: 'application/octet-stream' }) as any
    )
    const wrapper = mountView()
    await flushPromises()
    clickExport(wrapper)
    await flushPromises()

    expect(message.success).not.toHaveBeenCalled()
    expect(message.error).toHaveBeenCalledWith({
      content: '没导出：导出失败: null',
      key: 'export'
    })
  })

  it('拿到空文件也不念成功', async () => {
    vi.mocked(operationApi.exportStats).mockResolvedValue(new Blob([], { type: 'text/csv' }) as any)
    const wrapper = mountView()
    await flushPromises()
    clickExport(wrapper)
    await flushPromises()

    expect(message.success).not.toHaveBeenCalled()
    expect(message.error).toHaveBeenCalledWith({ content: '没导出：拿到的是空文件', key: 'export' })
  })

  it('真文件按行报数，文件名带导出内容与日期区间', async () => {
    vi.mocked(operationApi.exportStats).mockResolvedValue(
      new Blob(['\uFEFFID,标题\n1,种牙\n2,正畸\n'], { type: 'text/csv;charset=UTF-8' }) as any
    )
    const wrapper = mountView()
    await flushPromises()

    const picker = wrapper.findComponent({ name: 'ARangePicker' })
    picker.vm.$emit('update:value', ['2026-10-01', '2026-10-29'])
    picker.vm.$emit('change', ['2026-10-01', '2026-10-29'])
    await flushPromises()

    clickExport(wrapper)
    await flushPromises()

    expect(message.success).toHaveBeenCalledWith({
      content: '已导出文章数据，共 2 行',
      key: 'export'
    })
    expect(vi.mocked(operationApi.exportStats)).toHaveBeenLastCalledWith(15, 'article', '2026-10-01', '2026-10-29')
  })

  it('导出内容下拉只换档：不重新拉页面上的图表', async () => {
    const wrapper = mountView()
    await flushPromises()
    const statsCalls = vi.mocked(operationApi.getStats).mock.calls.length
    const trendCalls = vi.mocked(operationApi.getTrafficTrend).mock.calls.length

    const select = wrapper.findComponent({ name: 'ASelect' })
    select.vm.$emit('update:value', 'knowledge')
    await flushPromises()

    vi.mocked(operationApi.exportStats).mockResolvedValue(
      new Blob(['ID,标题\n31,种植牙白皮书\n'], { type: 'text/csv' }) as any
    )
    clickExport(wrapper)
    await flushPromises()

    expect(vi.mocked(operationApi.getStats).mock.calls.length).toBe(statsCalls)
    expect(vi.mocked(operationApi.getTrafficTrend).mock.calls.length).toBe(trendCalls)
    expect(vi.mocked(operationApi.exportStats)).toHaveBeenLastCalledWith(15, 'knowledge', undefined, undefined)
    expect(message.success).toHaveBeenCalledWith({ content: '已导出知识库文档，共 1 行', key: 'export' })
  })

  it('后端请求本身失败时也念「没导出」并给出原因', async () => {
    vi.mocked(operationApi.exportStats).mockRejectedValue(new Error('服务暂时不可用'))
    const wrapper = mountView()
    await flushPromises()
    clickExport(wrapper)
    await flushPromises()

    expect(message.success).not.toHaveBeenCalled()
    expect(message.error).toHaveBeenCalledWith({
      content: '没导出：服务暂时不可用',
      key: 'export'
    })
  })
})

describe('谁的租户：普通管理员不许整屏空', () => {
  it('没有「选中态」但登录态里有租户：仍按自己那家取数', async () => {
    authMock.selectedTenantId = null
    authMock.tenantId = 15
    const wrapper = mountView()
    await flushPromises()

    expect(vi.mocked(operationApi.getStats)).toHaveBeenCalledWith(15, undefined, undefined)
    expect(wrapper.find('.alert-stub').exists()).toBe(false)
  })

  it('超管还没选租户：说清楚，不发请求，也不弹红', async () => {
    authMock.selectedTenantId = null
    authMock.tenantId = null
    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.find('.alert-msg').text()).toContain('还没选租户')
    expect(vi.mocked(operationApi.getStats)).not.toHaveBeenCalled()
    expect(message.error).not.toHaveBeenCalled()
  })
})
