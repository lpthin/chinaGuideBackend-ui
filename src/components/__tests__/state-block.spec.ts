import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import StateBlock from '../StateBlock.vue'
import { rememberRawDetail } from '../../utils/errorRaw'

/**
 * 三态语义不许互换（display.ts 的 暂无 / 未取到）；每态自带一条「下一步做什么」。
 */
const PASS = (name: string) => ({ name, template: '<div><slot /></div>' })

// 错误块里的 403/401 求助动作要读会话（有没有工单权限），先给一个空会话
beforeEach(() => {
  setActivePinia(createPinia())
})

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

  // ===== SPEC-UI-7 U2：念了「找管理员」就得给出入口 =====
  it('403 错误块接入求助动作；401 摆「重新登录」', () => {
    const forbidden = mount(StateBlock, { props: { state: 'error', detail: '没有权限执行该操作' } })
    expect(forbidden.find('.error-help-actions__copy').exists()).toBe(true)
    const expired = mount(StateBlock, { props: { state: 'error', detail: '登录状态已失效，请重新登录' } })
    expect(expired.find('.error-help-actions__relogin').exists()).toBe(true)
  })

  // ===== SPEC-UI-7 U4：错误态可访问性 =====
  it('错误态给读屏播报（role=status + aria-live），空态不抢播报', () => {
    const error = mount(StateBlock, { props: { state: 'error', detail: '读取失败' } })
    expect(error.attributes('role')).toBe('status')
    expect(error.attributes('aria-live')).toBe('polite')
    expect(error.attributes('aria-atomic')).toBe('true')
    const empty = mount(StateBlock, { props: { state: 'empty' } })
    expect(empty.attributes('aria-live')).toBeUndefined()
  })

  it('原文折叠有可读标签，summary / 复制都在原生 Tab 顺序里', () => {
    rememberRawDetail('读取失败', 'GET /api/admin/audit-logs → HTTP 500')
    const w = mount(StateBlock, { props: { state: 'error', detail: '读取失败' } })
    const details = w.find('details.admin-state-block__raw')
    expect(details.exists()).toBe(true)
    expect(details.find('summary').text()).toContain('排查用')
    const copy = details.find('button.admin-state-block__copy')
    expect(copy.attributes('type')).toBe('button')
    expect(copy.attributes('tabindex')).toBeUndefined()
    expect(details.find('summary').attributes('tabindex')).toBeUndefined()
  })

  it('G2：原文区给一颗「导出诊断包」，整包可下载而不必复现', () => {
    rememberRawDetail('读取失败-G2', 'GET /api/audit-logs → HTTP 500\nrequestId: req-1')
    const w = mount(StateBlock, { props: { state: 'error', detail: '读取失败-G2' } })
    const download = w.find('button.admin-state-block__download')
    expect(download.exists()).toBe(true)
    expect(download.text()).toBe('导出诊断包')
    expect(download.attributes('type')).toBe('button')
    expect(download.attributes('tabindex')).toBeUndefined()
  })

  it('键盘链路所需的三样都还在：原文 → 复制 → 页内重试', () => {
    rememberRawDetail('读取失败', 'HTTP 500')
    const w = mount(StateBlock, {
      props: { state: 'error', detail: '读取失败' },
      slots: { default: '<button class="retry">重试</button>' },
    })
    expect(w.find('details summary').exists()).toBe(true)
    expect(w.find('button.admin-state-block__copy').exists()).toBe(true)
    expect(w.find('button.retry').exists()).toBe(true)
    for (const el of [...w.findAll('button'), ...w.findAll('summary')]) {
      expect(el.attributes('tabindex')).toBeUndefined()
    }
  })
})
