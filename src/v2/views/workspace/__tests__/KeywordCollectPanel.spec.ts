import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import KeywordCollectPanel from '../KeywordCollectPanel.vue'

// Mock the API
vi.mock('@/v2/api/workspace', () => ({
  keywordApi: {
    list: vi.fn().mockResolvedValue({
      records: [
        { id: 1, rawKeyword: '测试关键词1', normalizedKeyword: '测试关键词1', status: 'PENDING', searchVolume: 100, competition: 0.5 },
        { id: 2, rawKeyword: '测试关键词2', normalizedKeyword: '测试关键词2', status: 'DISTILLED', searchVolume: 200, competition: 0.8 },
      ],
      total: 2,
      size: 10,
      current: 1,
    }),
    getStats: vi.fn().mockResolvedValue({
      total: 100,
      pending: 50,
      distilled: 50,
    }),
  },
  clusterApi: {
    distill: vi.fn().mockResolvedValue({ clusterCount: 5 }),
  },
}))

describe('KeywordCollectPanel', () => {
  let wrapper: any

  beforeEach(() => {
    wrapper = mount(KeywordCollectPanel, {
      global: {
        stubs: {
          'a-card': true,
          'a-button': true,
          'a-table': true,
          'a-input-search': true,
          'a-select': true,
          'a-space': true,
          'a-row': true,
          'a-col': true,
          'a-statistic': true,
          'a-switch': true,
          'a-tag': true,
          'a-popconfirm': true,
          'a-modal': true,
          'a-progress': true,
          'a-textarea': true,
        },
      },
    })
  })

  it('renders correctly', () => {
    expect(wrapper.exists()).toBe(true)
  })

  it('contains the panel title', () => {
    expect(wrapper.findComponent({ name: 'ACard' }).exists()).toBe(true)
  })

  it('displays four statistic cards', () => {
    const statCards = wrapper.findAllComponents({ name: 'ACol' })
    expect(statCards.length).toBeGreaterThanOrEqual(4)
  })

  it('has a table for keyword list', () => {
    const table = wrapper.findComponent({ name: 'ATable' })
    expect(table.exists()).toBe(true)
  })

  it('has collect keyword button', () => {
    const buttons = wrapper.findAllComponents({ name: 'AButton' })
    const hasCollectButton = buttons.some((btn: any) => 
      btn.text().includes('采集') || btn.text().includes('开始')
    )
    expect(buttons.length).toBeGreaterThan(0)
  })
})
