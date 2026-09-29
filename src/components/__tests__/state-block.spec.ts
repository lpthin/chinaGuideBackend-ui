import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import StateBlock from '../StateBlock.vue'

/**
 * 三态语义不许互换（display.ts 的 暂无 / 未取到）；每态自带一条「下一步做什么」。
 */
const PASS = (name: string) => ({ name, template: '<div><slot /></div>' })

describe('StateBlock', () => {
  it('空态：标题「暂无」+ 一条下一步', () => {
    const w = mount(StateBlock, { props: { state: 'empty' }, global: { stubs: { 'a-empty': PASS('AEmpty') } } })
    expect(w.find('.admin-state-block__title').text()).toBe('暂无')
    expect(w.find('.admin-state-block__next').text()).toContain('筛选')
    expect(w.attributes('data-state')).toBe('empty')
  })

  it('错误态：说清是读取失败，detail 原样念出来', () => {
    const w = mount(StateBlock, { props: { state: 'error', detail: '502 Bad Gateway' } })
    expect(w.find('.admin-state-block__title').text()).toBe('读取失败')
    expect(w.find('.admin-state-block__detail').text()).toBe('502 Bad Gateway')
    expect(w.find('.admin-state-block__next').text()).toContain('traceId')
  })

  it('未取到态：用 PH_NOT_MEASURED 的词，不冒充空态', () => {
    const w = mount(StateBlock, { props: { state: 'not-measured' } })
    expect(w.find('.admin-state-block__title').text()).toBe('未取到')
    expect(w.find('.admin-state-block__next').text()).not.toBe('')
  })

  it('next / title 可被调用方覆盖；extra 插槽留给页内动作', () => {
    const w = mount(StateBlock, {
      props: { state: 'empty', title: '还没有站点', next: '先新建一个站点' },
      slots: { default: '<button class="new">新建</button>' },
    })
    expect(w.find('.admin-state-block__title').text()).toBe('还没有站点')
    expect(w.find('.admin-state-block__next').text()).toBe('先新建一个站点')
    expect(w.find('.extra, .new').exists()).toBe(true)
  })
})
