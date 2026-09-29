import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import DataTable from '../DataTable.vue'
import StateBlock from '../StateBlock.vue'

/**
 * DataTable 的分页单一口径（§7.3 列表一律分页、每页上限 100）与三态兜底。
 * a-table 桩成命名组件：要读它收到的 pagination 配置，true 桩会把 slot 咽掉。
 */
const TableStub = {
  name: 'ATable',
  props: ['dataSource', 'loading', 'rowKey', 'pagination'],
  template: '<div class="table-stub"><slot /></div>',
}

function mountTable(props: Record<string, unknown> = {}, slots: Record<string, string> = {}) {
  return mount(DataTable, {
    props: { dataSource: [{ id: 1 }], ...props },
    slots,
    global: { stubs: { 'a-table': TableStub, StateBlock } },
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

  it('error 优先于一切，且原因要念出来', () => {
    const w = mountTable({ dataSource: [], loading: true, error: '加载文章列表失败' })
    const block = w.findComponent(StateBlock)
    expect(block.props('state')).toBe('error')
    expect(block.props('detail')).toBe('加载文章列表失败')
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
})
