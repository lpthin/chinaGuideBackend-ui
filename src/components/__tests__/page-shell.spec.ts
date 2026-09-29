import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import PageShell from '../PageShell.vue'
import FilterBar from '../FilterBar.vue'

/**
 * P0 底座骨架件：PageShell 管页面 padding 与右上操作区，FilterBar 沿用
 * global.less 已定稿的 .toolbar-fill / .toolbar-actions 命名，不另造一套。
 */
describe('PageShell', () => {
  it('渲染标题与副标题', () => {
    const w = mount(PageShell, { props: { title: '品牌诊断', subtitle: '分平台 × 分指标' } })
    expect(w.find('.admin-page__title').text()).toBe('品牌诊断')
    expect(w.find('.admin-page__subtitle').text()).toBe('分平台 × 分指标')
  })

  it('没有副标题时不留空壳', () => {
    const w = mount(PageShell, { props: { title: '热词库' } })
    expect(w.find('.admin-page__subtitle').exists()).toBe(false)
  })

  it('actions 插槽在头部右侧、footer 可选', () => {
    const w = mount(PageShell, {
      props: { title: 'T' },
      slots: { actions: '<button class="go">立即诊断</button>', default: '<p class="body">内容</p>', footer: '<span>底部</span>' },
    })
    expect(w.find('.admin-page__actions .go').exists()).toBe(true)
    expect(w.find('.admin-page__body .body').text()).toBe('内容')
    expect(w.find('.admin-page__footer').text()).toBe('底部')
  })

  it('页面 padding 归骨架：根节点带 admin-page 类（样式在组件 scoped 里，页面不再自写）', () => {
    const w = mount(PageShell, { props: { title: 'T' } })
    expect(w.classes()).toContain('admin-page')
    expect(w.find('.admin-page__head').exists()).toBe(true)
  })
})

describe('FilterBar', () => {
  it('字段靠左、动作靠右，沿用 global.less 的 toolbar-fill / toolbar-actions 约定', () => {
    const w = mount(FilterBar, {
      slots: { default: '<input class="kw" />', actions: '<button class="q">查询</button>' },
    })
    expect(w.classes()).toContain('toolbar-fill')
    expect(w.find('.admin-filter-bar__actions').classes()).toContain('toolbar-actions')
    expect(w.find('.admin-filter-bar__fields .kw').exists()).toBe(true)
    expect(w.find('.admin-filter-bar__actions .q').exists()).toBe(true)
  })

  it('无动作组时fields仍在', () => {
    const w = mount(FilterBar, { slots: { default: '<span class="f">字段</span>' } })
    expect(w.find('.f').text()).toBe('字段')
  })
})
