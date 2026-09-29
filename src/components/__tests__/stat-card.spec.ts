import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import StatCard from '../StatCard.vue'
import TrendNote from '../TrendNote.vue'
import { METRIC_COPY, TREND_NOTE } from '../../copy/metrics'

/**
 * StatCard：分母可见（§5）、值未取到不冒充 0（§9.6）、tooltip 文本只从 copy/metrics.ts 来。
 */
const TooltipStub = {
  name: 'ATooltip',
  props: ['title'],
  template: '<span class="tip" :data-title="title"><slot /></span>',
}

const mountCard = (props: Record<string, unknown>) =>
  mount(StatCard, { props: { label: '提及率', metricKey: 'mention_rate', ...props }, global: { stubs: { 'a-tooltip': TooltipStub } } })

describe('StatCard', () => {
  it('值 + 分子/分母同屏，分母不许缺席', () => {
    const w = mountCard({ value: '32.5%', numerator: 13, denominator: 40, ci: '±5.1%' })
    expect(w.find('.admin-stat-card__value').text()).toBe('32.5%')
    expect(w.find('.admin-stat-card__fraction').text()).toBe('13 / 40')
    expect(w.find('.admin-stat-card__ci').text()).toBe('±5.1%')
  })

  it('tooltip 文本逐字等于 METRIC_COPY 的口径句，页里手写解释进不来', () => {
    const w = mountCard({ value: 1 })
    expect(w.find('.tip').attributes('data-title')).toBe(METRIC_COPY.mention_rate.tip)
  })

  it('没测到显示「未取到」，绝不显示 0 或空白', () => {
    const w = mountCard({ value: null })
    expect(w.find('.admin-stat-card__value').text()).toBe('未取到')
  })

  it('分母在场分子缺位时用 PH_DASH 占位', () => {
    const w = mountCard({ value: '—', denominator: 0 })
    expect(w.find('.admin-stat-card__fraction').text()).toBe('— / 0')
  })
})

describe('TrendNote', () => {
  it('横幅文本就是 TREND_NOTE：API 口径 + 重合 32–43% 那两句固定话术', () => {
    const w = mount(TrendNote)
    expect(w.text()).toBe(TREND_NOTE)
    expect(w.text()).toContain('不等于')
    expect(w.text()).toContain('32–43%')
  })
})
