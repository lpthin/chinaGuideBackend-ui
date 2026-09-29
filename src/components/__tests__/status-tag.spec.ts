import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import StatusTag from '../StatusTag.vue'
import DictTag from '../DictTag.vue'
import type { StatusDomain } from '../../utils/statusTokens'

/**
 * StatusTag 只认 statusTokens.ts；颜色/兜底文案与各页今天渲染的一致。
 * a-tag 必须桩成渲染 slot 的命名组件——setup.ts 的 true 桩会把文本咽掉。
 */
const TagStub = {
  name: 'ATag',
  props: ['color'],
  inheritAttrs: false,
  template: '<span class="tag" :data-color="color"><slot /></span>',
}

const mountTag = (props: { domain: StatusDomain; status?: string | null; label?: string | null }) =>
  mount(StatusTag, { props, global: { stubs: { 'a-tag': TagStub } } })

describe('StatusTag', () => {
  it('内容状态沿用 contentStatus 的表：已发布=success 绿', () => {
    const w = mountTag({ domain: 'article', status: 'published' })
    expect(w.text()).toBe('已发布')
    expect(w.attributes('data-color')).toBe('success')
  })

  it('队列的 pending 是蓝（processing），不与任务排队的橙混淆', () => {
    expect(mountTag({ domain: 'queue', status: 'pending' }).attributes('data-color')).toBe('processing')
    expect(mountTag({ domain: 'run', status: 'pending' }).attributes('data-color')).toBe('orange')
  })

  it('needs_human 合流后取多数派的橙（引用探测原来是红，差异已记录）', () => {
    expect(mountTag({ domain: 'run', status: 'needs_human' }).attributes('data-color')).toBe('orange')
    expect(mountTag({ domain: 'revision', status: 'needs_human' }).attributes('data-color')).toBe('orange')
  })

  it('后端词表到手时用 label 覆盖兜底文案，颜色仍归映射表', () => {
    const w = mountTag({ domain: 'run', status: 'done', label: '这一轮跑完了' })
    expect(w.text()).toBe('这一轮跑完了')
    expect(w.attributes('data-color')).toBe('green')
  })

  it('空状态与未知状态：与 contentStatus 今天的口径一致（- 与原样显示）', () => {
    expect(mountTag({ domain: 'article', status: null }).text()).toBe('-')
    const unknown = mountTag({ domain: 'invoice', status: 'WEIRD' })
    expect(unknown.text()).toBe('WEIRD')
    expect(unknown.attributes('data-color')).toBe('default')
  })

  it('发票大写码的文案逐字来自 BillingView', () => {
    expect(mountTag({ domain: 'invoice', status: 'PENDING' }).text()).toBe('待支付')
    expect(mountTag({ domain: 'invoice', status: 'REFUNDED' }).attributes('data-color')).toBe('blue')
  })
})

describe('DictTag', () => {
  const mountDict = (props: Record<string, unknown>) =>
    mount(DictTag, { props, global: { stubs: { 'a-tag': TagStub } } })

  it('品牌词绿、竞品词橙、命中蓝，各指各的', () => {
    expect(mountDict({ kind: 'brand', value: '纳欣口腔' }).attributes('data-color')).toBe('green')
    expect(mountDict({ kind: 'competitor', value: '瑞尔' }).attributes('data-color')).toBe('orange')
    expect(mountDict({ kind: 'hit', value: 'brand_mentioned' }).attributes('data-color')).toBe('blue')
    expect(mountDict({ kind: 'neutral', value: 'x' }).attributes('data-color')).toBe('default')
  })

  it('没有词值时给 PH_DASH 占位而不是空标签', () => {
    const w = mountDict({ kind: 'brand', value: null })
    expect(w.text()).toBe('—')
  })
})
