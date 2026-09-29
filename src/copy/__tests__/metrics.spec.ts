import { describe, it, expect } from 'vitest'
import { METRIC_COPY, METRIC_HARD_RULES, TREND_NOTE, type MetricKey } from '../metrics'

/**
 * §5 三条禁令写进测试（Spec 要求「不只是写文档」）：
 * 界面引用的口径文本里不许出现「排名」措辞、不许出现合并总分的说法，率必须带分母口径。
 */
describe('copy/metrics 硬规矩', () => {
  const keys = Object.keys(METRIC_COPY) as MetricKey[]

  it('九个指标口径全部有出处文本', () => {
    expect(keys.length).toBeGreaterThanOrEqual(9)
    for (const k of keys) {
      expect(METRIC_COPY[k].name).toBeTruthy()
      expect(METRIC_COPY[k].tip.length).toBeGreaterThan(10)
    }
  })

  it('禁令一：口径文本里没有「总分」这类跨平台合并分', () => {
    for (const k of keys) {
      expect(METRIC_COPY[k].tip).not.toContain('总分')
    }
    expect(METRIC_HARD_RULES.noCombinedScore).toContain('总分')
  })

  it('禁令二：AI 答案口径文本不出现「排名」二字（出现即 bug）', () => {
    for (const k of keys) {
      expect(METRIC_COPY[k].tip).not.toContain('排名')
    }
    expect(TREND_NOTE).not.toContain('排名')
    expect(METRIC_HARD_RULES.noRankingWording).toContain('排名')
  })

  it('禁令三：分母要露出来——提及率/推荐率/SOV/覆盖率的文本都写死分母', () => {
    expect(METRIC_COPY.mention_rate.tip).toContain('成功回答总数')
    expect(METRIC_COPY.ai_sov.tip).toContain('分母')
    expect(METRIC_COPY.prompt_coverage.tip).toContain('追踪题数')
    expect(METRIC_HARD_RULES.denominatorVisible).toContain('分母')
  })

  it('TrendNote 固定话术：API 口径声明与重合区间在同一句里', () => {
    expect(TREND_NOTE).toContain('API 口径')
    expect(TREND_NOTE).toContain('32–43%')
  })
})
