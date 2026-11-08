import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import DataTable from '../DataTable.vue'
import StateBlock from '../StateBlock.vue'
import { getErrorMetrics, resetErrorMetrics } from '../../utils/errorMetrics'

// 错误块里的 403/401 求助动作要读会话（有没有工单权限），先给一个空会话
beforeEach(() => {
  setActivePinia(createPinia())
})

afterEach(() => {
  vi.useRealTimers()
})

/**
 * DataTable 的分页单一口径（§7.3 列表一律分页、每页上限 100）与三态兜底。
 * a-table 桩成命名组件：要读它收到的 pagination 配置，true 桩会把 slot 咽掉。
 */
const TableStub = {
  name: 'ATable',
  props: ['dataSource', 'loading', 'rowKey', 'pagination', 'scroll'],
  template: '<div class="table-stub"><slot /></div>',
}

function mountTable(props: Record<string, unknown> = {}, slots: Record<string, string> = {}) {
  return mount(DataTable, {
    props: { dataSource: [{ id: 1 }], ...props },
    slots,
    global: {
      stubs: {
        'a-table': TableStub,
        StateBlock,
        'a-alert': { props: ['message'], template: '<div class="alert-stub">{{ message }}</div>' },
        'a-button': { template: '<button class="btn-stub" @click="$emit(\'click\')">x</button>' },
      },
    },
  })
}

describe('DataTable', () => {
  it('默认分页：20/页 + 可切 + 上限 100', () => {
    const w = mountTable()
    const pagination = w.findComponent(TableStub).props('pagination') as Record<string, unknown>
    expect(pagination.pageSize).toBe(20)
    expect(pagination.showSizeChanger).toBe(true)
    expect(pagination.pageSizeOptions).toEqual(['20', '50', '100'])
  })

  it('传进来的分页配置与默认合并；pageSize 超 100 按 100 收', () => {
    const w = mountTable({ pagination: { pageSize: 500, total: 1234 } })
    const pagination = w.findComponent(TableStub).props('pagination') as Record<string, unknown>
    expect(pagination.pageSize).toBe(100)
    expect(pagination.total).toBe(1234)
  })

  it('页面传 pageSize 10 时，档位补进当前这一档', () => {
    const w = mountTable({ pagination: { pageSize: 10 } })
    const pagination = w.findComponent(TableStub).props('pagination') as Record<string, unknown>
    expect(pagination.pageSize).toBe(10)
    expect(pagination.pageSizeOptions).toEqual(['10', '20', '50', '100'])
  })

  it('页面自己列的档位优先，不被默认档位顶掉', () => {
    const w = mountTable({ pagination: { pageSize: 8, pageSizeOptions: ['8', '16', '32'] } })
    const pagination = w.findComponent(TableStub).props('pagination') as Record<string, unknown>
    expect(pagination.pageSizeOptions).toEqual(['8', '16', '32'])
  })

  it('pagination=false 原样关闭（详情页内嵌小表）', () => {
    const w = mountTable({ pagination: false })
    expect(w.findComponent(TableStub).props('pagination')).toBe(false)
  })

  it('loading 时不抢跑空态', () => {
    const w = mountTable({ dataSource: [], loading: true })
    expect(w.findComponent(TableStub).exists()).toBe(true)
    expect(w.findComponent(StateBlock).exists()).toBe(false)
  })

  it('空数据给空态块而不是裸表格', () => {
    const w = mountTable({ dataSource: [] })
    expect(w.findComponent(TableStub).exists()).toBe(false)
    expect(w.findComponent(StateBlock).props('state')).toBe('empty')
  })

  it('空态第二行默认仍是通用话术', () => {
    const w = mountTable({ dataSource: [] })
    expect(w.text()).toContain('调整筛选条件，或新建一条记录')
  })

  it('只读页传 emptyLine 时，空态第二行换成页面给的那句，不再暗示新建', () => {
    const w = mountTable({ dataSource: [], emptyLine: '这一栏还没有内容。' })
    expect(w.text()).toContain('这一栏还没有内容。')
    expect(w.text()).not.toContain('新建一条记录')
  })

  it('error 优先于一切，且原因要念出来', () => {
    const w = mountTable({ dataSource: [], loading: true, error: '加载文章列表失败' })
    const block = w.findComponent(StateBlock)
    expect(block.props('state')).toBe('error')
    expect(block.props('detail')).toBe('加载文章列表失败')
  })

  // ===== SPEC-UI-6：错误态能自救（重试 / 权限分流 / 旧数据） =====
  it('传 retry 时错误块里出现「重试」，点了就调页面加载函数', async () => {
    let calls = 0
    const w = mountTable({ dataSource: [], error: '加载失败', retry: () => { calls += 1 } })
    expect(w.find('.btn-stub').exists()).toBe(true)
    await w.find('.btn-stub').trigger('click')
    expect(calls).toBeGreaterThan(0)
  })

  it('没传 retry 时不摆一颗点了没反应的按钮', () => {
    const w = mountTable({ dataSource: [], error: '加载失败' })
    expect(w.find('.btn-stub').exists()).toBe(false)
  })

  it('权限不足不能念「稍后重试」', () => {
    const w = mountTable({ dataSource: [], error: '没有权限执行该操作' })
    const next = w.find('.admin-state-block__next').text()
    expect(next).toContain('管理员')
    expect(next).not.toContain('稍后重试')
  })

  // ===== SPEC-UI-7 U3：重试有反馈、有上限、只读才自动 =====
  it('重试在途时按钮 loading + 禁用，连点只发一次', async () => {
    let release!: () => void
    const retry = vi.fn(() => new Promise<void>((resolve) => { release = resolve }))
    const w = mountTable({ dataSource: [], error: '服务器处理失败，请稍后重试或联系管理员', retry })
    const btn = w.find('.btn-stub')
    await btn.trigger('click')
    expect(btn.attributes('disabled')).toBe('')
    await btn.trigger('click')
    expect(retry).toHaveBeenCalledTimes(1)
    release()
    await flushPromises()
    await btn.trigger('click')
    expect(retry).toHaveBeenCalledTimes(2)
  })

  it('连续第 2 次读失败后改劝「把诊断发给管理员」，不再只让人点重试', async () => {
    const w = mountTable({ dataSource: [], loading: true, retry: () => {} })
    await w.setProps({ loading: false, error: '服务器处理失败，请稍后重试或联系管理员' })
    expect(w.find('.admin-state-block__hint').exists()).toBe(false)
    await w.setProps({ loading: true })
    await w.setProps({ loading: false })
    expect(w.find('.admin-state-block__hint').exists()).toBe(true)
  })

  it('只读页开 autoRetryReadOnly：服务异常失败后自动重读一次，本轮不再自动', async () => {
    vi.useFakeTimers()
    const retry = vi.fn()
    const w = mountTable({ dataSource: [], loading: true, retry, autoRetryReadOnly: true })
    await w.setProps({ loading: false, error: '服务器处理失败，请稍后重试或联系管理员' })
    vi.advanceTimersByTime(1300)
    await w.vm.$nextTick()
    expect(retry).toHaveBeenCalledTimes(1)
    await w.setProps({ loading: true })
    await w.setProps({ loading: false })
    vi.advanceTimersByTime(1300)
    await w.vm.$nextTick()
    expect(retry).toHaveBeenCalledTimes(1)
  })

  it('403 不自动重试：重读不会把权限变出来', async () => {
    vi.useFakeTimers()
    const retry = vi.fn()
    const w = mountTable({ dataSource: [], loading: true, retry, autoRetryReadOnly: true })
    await w.setProps({ loading: false, error: '没有权限执行该操作' })
    vi.advanceTimersByTime(1300)
    await w.vm.$nextTick()
    expect(retry).not.toHaveBeenCalled()
  })

  it('没开 autoRetryReadOnly 时，网络失败也只等人点，不自己重读', async () => {
    vi.useFakeTimers()
    const retry = vi.fn()
    const w = mountTable({ dataSource: [], loading: true, retry })
    await w.setProps({ loading: false, error: '无法连接服务器，请确认后端已启动' })
    vi.advanceTimersByTime(1300)
    await w.vm.$nextTick()
    expect(retry).not.toHaveBeenCalled()
  })

  it('keepStaleOnError：刷新失败保留上一次的行并挂提示，不整表撤成错误块', async () => {
    const w = mountTable({ dataSource: [{ id: 1 }], keepStaleOnError: true })
    await w.setProps({ dataSource: [], loading: true })
    await w.setProps({ loading: false, error: '网络抖动' })
    expect(w.findComponent(StateBlock).exists()).toBe(false)
    expect(w.findComponent(TableStub).props('dataSource')).toEqual([{ id: 1 }])
    expect(w.text()).toContain('下面是上一次读到的数据')
  })

  it('没开 keepStaleOnError 时，失败照样整表撤成错误块（默认行为不变）', async () => {
    const w = mountTable({ dataSource: [{ id: 1 }] })
    await w.setProps({ dataSource: [], loading: true })
    await w.setProps({ loading: false, error: '网络抖动' })
    expect(w.findComponent(StateBlock).props('state')).toBe('error')
    expect(w.findComponent(TableStub).exists()).toBe(false)
  })

  it('M2：staleKey 一变，上一份旧行立刻作废——页面没来得及清也不能端上来', async () => {
    // 页面在切客户时往往还没把 dataSource 清空，这正是串号最容易发生的一瞬
    const w = mountTable({ dataSource: [{ id: 1 }], keepStaleOnError: true, staleKey: '客户A|第1页' })
    await w.setProps({ staleKey: '客户B|第1页', loading: true })
    await w.setProps({ loading: false, error: '网络抖动' })
    expect(w.findComponent(StateBlock).props('state')).toBe('error')
    expect(w.findComponent(TableStub).exists()).toBe(false)
  })

  it('M2：换上下文后读成功，新一档的行照常上桌', async () => {
    const w = mountTable({ dataSource: [{ id: 1 }], keepStaleOnError: true, staleKey: '客户A' })
    await w.setProps({ staleKey: '客户B', dataSource: [], loading: true })
    await w.setProps({ dataSource: [{ id: 2 }], loading: false, error: null })
    expect(w.findComponent(TableStub).props('dataSource')).toEqual([{ id: 2 }])
  })

  it('还失败着的时候，页面自带的空态插槽也不许抢戏（M1：失败态与空态分离）', () => {
    const w = mountTable({ dataSource: [], error: '读取失败' }, { emptyText: '<span class="empty-slot">这一档还没有数据</span>' })
    expect(w.findComponent(StateBlock).props('state')).toBe('error')
    expect(w.find('.empty-slot').exists()).toBe(false)
  })

  it('成功读到 0 条时，页面自带的空态引导照旧保留（首次使用引导不许被规则误伤）', () => {
    // 这一例要把 emptyText 插槽真渲出来，TableStub 只渲默认插槽看不见它
    const w = mount(DataTable, {
      props: { dataSource: [] },
      slots: { emptyText: '<span class="empty-slot">这一档还没有数据</span>' },
      global: {
        stubs: {
          'a-table': {
            name: 'ATable',
            props: ['dataSource', 'loading', 'rowKey', 'pagination', 'scroll'],
            template: '<div class="table-stub"><slot name="emptyText" /></div>',
          },
          StateBlock,
        },
      },
    })
    expect(w.findComponent(StateBlock).exists()).toBe(false)
    expect(w.find('.empty-slot').exists()).toBe(true)
  })

  it('columns 等其余属性透传给 a-table', () => {
    const w = mount(DataTable, {
      props: { dataSource: [{ id: 1 }] },
      attrs: { columns: [{ title: '标题' }], size: 'middle' },
      global: { stubs: { 'a-table': TableStub, StateBlock } },
    })
    expect(w.findComponent(TableStub).attributes('columns')).toBeTruthy()
    expect(w.findComponent(TableStub).attributes('size')).toBe('middle')
  })

  // ===== G12（Spec-G P0）：窄屏兜底 =====
  // 浏览器那一侧的判据更硬，这两例只守组件契约——别让下一次重构又把兜底删了。
  // 现场账（同一支判据两头各量一遍，存档 scratch/p6g-out/）：
  //   squeeze-m-old2.json = 改之前 375 档 5 屏里 4 屏 FAIL、合计 29 格被压成「一字一行」（最狠每行 1 字）；
  //   squeeze-m-new2.json = 改之后 0 格，且渲染出的 10 张表全部有横向滚动层；
  //   squeeze-pc-new2.json = 1440 档两头都 0 格（判据不是「逢窄屏就红」）。
  // 上一轮那条「越界才 FAIL」的旧判据对这 4 屏全绿——它量不到压缩，所以判据先于修复提交。

  it('G12：页面没写 scroll 时，组件给 { x: max-content } 兜底', () => {
    const w = mountTable()
    expect(w.findComponent(TableStub).props('scroll')).toEqual({ x: 'max-content' })
  })

  it('G12：页面显式传的 scroll 优先，兜底不许吃掉它', () => {
    const w = mountTable({ scroll: { x: 1200, y: 400 } })
    expect(w.findComponent(TableStub).props('scroll')).toEqual({ x: 1200, y: 400 })
  })

  it('G12：scroll=false 是「这张表明确不要横向滚动」，不许被兜底改成对象', () => {
    const w = mountTable({ scroll: false })
    expect(w.findComponent(TableStub).props('scroll')).toBe(false)
  })

  // ===== SPEC-UI-8 G1：读失败度量从这里落账 =====
  it('失败一发记一次曝光（无行时同时记风险触发）；重试成功后记重试成功与恢复耗时', async () => {
    resetErrorMetrics()
    const w = mountTable({ dataSource: [], loading: true, retry: () => {} })
    await w.setProps({ loading: false, error: '服务器处理失败，请稍后重试或联系管理员' })

    let m = getErrorMetrics()
    expect(m.exposures).toBe(1)
    expect(m.errorZeroRowCases).toBe(1)

    await w.find('.btn-stub').trigger('click')
    expect(getErrorMetrics().retryAttempts).toBe(1)

    await w.setProps({ loading: true, error: null })
    await w.setProps({ loading: false, error: null, dataSource: [{ id: 1 }] })

    m = getErrorMetrics()
    expect(m.retrySuccesses).toBe(1)
    expect(m.retrySuccessRate).toBe(1)
    expect(m.recoveryCount).toBe(1)
    expect(m.avgRecoveryMs).toBeGreaterThanOrEqual(0)
  })

  it('有旧行时错误不再算「错误 + 0 行」，但仍记一次曝光', async () => {
    resetErrorMetrics()
    const w = mountTable({ dataSource: [{ id: 1 }], loading: true, keepStaleOnError: true })
    await w.setProps({ dataSource: [], loading: false, error: '网络抖动' })

    const m = getErrorMetrics()
    expect(m.exposures).toBe(1)
    expect(m.errorZeroRowCases).toBe(0)
  })
})
