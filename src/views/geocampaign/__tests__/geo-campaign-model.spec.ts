import { describe, it, expect } from 'vitest'
import {
  REPEAT_MAX,
  REPEAT_MIN,
  SUGGESTED_PLATFORM_MIN,
  billingLine,
  campaignRunSummary,
  emptyCampaignDraft,
  estimateLines,
  fractionText,
  formatInterval,
  formatRate,
  gapLines,
  liveRunOf,
  parseWizardState,
  platformHint,
  runGate,
  runPercent,
  wizardStateJson,
} from '../geoCampaignModel'
import type { GeoEstimate, GeoRun } from '../../../api/geoCampaign'
import { PH_DASH, PH_NOT_MEASURED } from '../../../utils/display'

/**
 * P2 的显示判据本体（视图与用例认同一份，Spec-F §10-3 / §10-4 / §9.6）。
 * 这里刻意不放指标口径的句子：那一句跟着数据行走（`row.definition`），抄进前端就有第二份真相。
 */

function estimate(overrides: Partial<GeoEstimate> = {}): GeoEstimate {
  return {
    campaignId: 12,
    questionCount: 5,
    platformCount: 2,
    repeatTimes: 3,
    callCount: 30,
    estimatedTokens: 42000,
    estimatedMinutes: 6,
    remainingTokens: 900000,
    campaignEnabled: true,
    tenantBearsCost: true,
    notice: null,
    ...overrides,
  }
}

function run(overrides: Partial<GeoRun> = {}): GeoRun {
  return {
    id: 88,
    campaignId: 12,
    tenantId: 1,
    brandProfileId: 7,
    siteId: 3,
    status: 'SUCCEEDED',
    statusLabel: 'ok',
    stageText: null,
    progress: 100,
    accessChannel: 'Web API',
    questionCount: 5,
    platformCount: 2,
    repeatTimes: 3,
    callCount: 30,
    failedCallCount: 0,
    promptTokens: 2000,
    completionTokens: 800,
    errorMessage: null,
    stalledReason: null,
    startedAt: '2026-09-29T10:00:00',
    finishedAt: '2026-09-29T10:06:00',
    createdBy: 'admin',
    createdAt: '2026-09-29T10:00:00',
    ...overrides,
  }
}

describe('runGate：两段式在前端的形状（§6.2 + §10-3）', () => {
  it('没取到预估 → 按不动，按钮自己说「请先看预估」', () => {
    expect(runGate({ estimate: null, confirmChecked: true, starting: false }))
      .toEqual({ disabled: true, text: '请先看预估' })
  })

  it('这个计划已经有一轮在跑 → 按不动，按钮说的是「等它跑完」而不是「参数错误」（#125）', () => {
    const gated = runGate({
      estimate: estimate(),
      confirmChecked: true,
      starting: false,
      liveRun: run({ status: 'RUNNING', progress: 40 }),
    })
    expect(gated.disabled).toBe(true)
    expect(gated.text).toBe('这一轮还在跑，先等它')
  })

  it('notice 非空 → 按不动，按钮写「这一轮不会受理」；勾了确认也一样', () => {
    const gated = runGate({
      estimate: estimate({ notice: '这一轮要 30 次调用，超过单轮上限 20 次' }),
      confirmChecked: true,
      starting: false,
    })
    expect(gated.disabled).toBe(true)
    expect(gated.text).toBe('这一轮不会受理')
  })

  it('看过预估、没勾确认 → 仍然按不动：勾选就是那第二道闸', () => {
    expect(runGate({ estimate: estimate(), confirmChecked: false, starting: false }))
      .toEqual({ disabled: true, text: '请先勾选确认' })
  })

  it('五条全过才放行，放行后的文字是「确认并开始诊断」', () => {
    expect(runGate({ estimate: estimate(), confirmChecked: true, starting: false, liveRun: null }))
      .toEqual({ disabled: false, text: '确认并开始诊断' })
  })

  it('拒绝理由的优先顺序与后端 requestRun 一致：起跑中 > 没预估 > 在飞 > 不受理 > 没点头', () => {
    expect(runGate({ estimate: null, confirmChecked: false, starting: true }).text).toBe('正在起跑')
    // 在飞压过 notice：先让他等那一轮跑完，比告诉他额度不够更贴近此刻真正挡着的东西
    expect(runGate({ estimate: estimate({ notice: 'x' }), confirmChecked: true, starting: false, liveRun: run({ status: 'RUNNING' }) }).text)
      .toBe('这一轮还在跑，先等它')
    // notice 压过勾选：闸已经关上了，再催用户点头只是让人白勾一次
    expect(runGate({ estimate: estimate({ notice: 'x' }), confirmChecked: true, starting: false }).text)
      .toBe('这一轮不会受理')
  })
})

describe('liveRunOf：哪一轮算「真的在跑」（#125 的判据，跟后端 liveRunOf 同一份）', () => {
  it('PENDING / RUNNING 且没被判定为停着的，就是在飞', () => {
    expect(liveRunOf([run({ id: 1, status: 'PENDING' })])?.id).toBe(1)
    expect(liveRunOf([run({ id: 2, status: 'RUNNING', progress: 30 })])?.id).toBe(2)
  })

  it('停着不动的那一轮不算在飞：否则一条被重启带死的行会永久锁住这个计划重跑', () => {
    expect(liveRunOf([run({ status: 'RUNNING', stalledReason: '这一轮已经 22 分钟没有新进度' })])).toBeNull()
  })

  it('跑完的、跑挂的、部分完成的都不算在飞，空列表也不算', () => {
    expect(liveRunOf([run({ status: 'SUCCEEDED' }), run({ status: 'PARTIAL' }), run({ status: 'FAILED' })])).toBeNull()
    expect(liveRunOf([])).toBeNull()
  })

  it('停着的旧轮排在前面时，取的还是那一条真在跑的', () => {
    const runs = [
      run({ id: 91, status: 'RUNNING', stalledReason: '被重启带断了' }),
      run({ id: 92, status: 'RUNNING', progress: 10 }),
    ]
    expect(liveRunOf(runs)?.id).toBe(92)
  })
})

describe('预估那三行（§10-3）', () => {
  it('正好三行：调用次数 / 预计 token / 预计耗时，乘积原样念后端的数', () => {
    const lines = estimateLines(estimate())
    expect(lines.map((line) => line.label)).toEqual(['调用次数', '预计 token', '预计耗时'])
    expect(lines[0].value).toBe('30 次')
    expect(lines[0].note).toBe('5 题 × 2 个平台 × 每题重复 3 次')
    expect(lines[1].value).toBe('42000')
    expect(lines[2].value).toBe('约 6 分钟')
  })

  it('前端不自己重算乘积：接口给 30 就念 30，哪怕 5×2×3 看着也是 30', () => {
    const lines = estimateLines(estimate({ callCount: 31 }))
    expect(lines[0].value).toBe('31 次')
  })
})

describe('这一笔钱记在谁账上（V142 交付态闸的界面那一半）', () => {
  it('已交付租户：计入本额度并报剩余，不写「免费」', () => {
    expect(billingLine(estimate({ tenantBearsCost: true }))).toBe(
      '这一轮的消耗计入本租户额度，本月剩余 900000 token。',
    )
  })

  it('未交付：说「由平台承担」，并且不报一个假的剩余额度', () => {
    const line = billingLine(estimate({ tenantBearsCost: false }))
    expect(line).toContain('平台承担')
    expect(line).not.toContain('900000')
  })
})

describe('率与区间：没测过不显示 0%（§9.6）', () => {
  it('null / undefined / 空串 → 「未取到」，不是 0.0% 也不是 NaN', () => {
    expect(formatRate(null)).toBe(PH_NOT_MEASURED)
    expect(formatRate(undefined)).toBe(PH_NOT_MEASURED)
    expect(formatRate('')).toBe(PH_NOT_MEASURED)
  })

  it('真测到的 0 就画 0.0%：0% 是一个观测值，不许借「未取到」藏起来', () => {
    expect(formatRate(0)).toBe('0.0%')
    expect(formatRate(0.1234)).toBe('12.3%')
  })

  it('Wilson 区间两端齐全才画；缺任一端返回 null，界面给占位符', () => {
    expect(formatInterval(0.125, 0.455)).toBe('12.5%–45.5%')
    expect(formatInterval(null, 0.455)).toBeNull()
    expect(formatInterval(0.125, undefined)).toBeNull()
  })

  it('分母为 0 的未测量行：分子分母照样念得出来，点得到分母（§11.3）', () => {
    expect(fractionText(0, 0)).toBe('0 / 0')
    expect(fractionText(3, 12)).toBe('3 / 12')
    expect(fractionText(1, null)).toBe(PH_DASH)
  })
})

describe('平台勾选的建议与不拦（§10-2 ⑤）', () => {
  it('一家都没有：说的是去哪一屏开通，而不是「勾选至少一家」', () => {
    expect(platformHint(0, 0)).toContain('大模型配置')
  })

  it('少于建议值只提示不拦：句子点名当前勾了几家', () => {
    const hint = platformHint(1, 2)
    expect(hint).toContain(`建议至少勾 ${SUGGESTED_PLATFORM_MIN} 家`)
    expect(hint).toContain('现在 1 家')
    expect(hint).toContain('少了也能跑')
  })

  it('够数了就闭嘴：不制造一条没人需要的警告', () => {
    expect(platformHint(SUGGESTED_PLATFORM_MIN, 4)).toBeNull()
  })
})

describe('「没测到」的三个出口（§9.6）', () => {
  it('三样都有时各说各的，标题带次数', () => {
    const lines = gapLines({ failedCallCount: 4, unmeasuredSubjects: ['同行甲'], unmeasuredQuestions: ['哪家便宜'] })
    expect(lines.map((line) => line.title)).toEqual([
      '4 次未取到回答',
      '判不了的对象',
      '判不了的题',
    ])
    expect(lines[0].text).toContain('不在任何率的分母里')
    expect(lines[1].text).toContain('同行甲')
    expect(lines[1].text).toContain('不进 SOV 分母')
    expect(lines[2].text).toContain('哪家便宜')
    expect(lines[2].text).toContain('要动的是题的核心词')
  })

  it('全都没有时一条都不摆：缺口为零还写着「有未取到的回答」就是谎报', () => {
    expect(gapLines({ failedCallCount: 0, unmeasuredSubjects: [], unmeasuredQuestions: [] })).toEqual([])
  })

  it('只缺题时不硬造对象那一格', () => {
    const lines = gapLines({ failedCallCount: 0, unmeasuredSubjects: [], unmeasuredQuestions: ['哪家正规'] })
    expect(lines.map((line) => line.title)).toEqual(['判不了的题'])
  })
})

describe('进度与轮次摘要', () => {
  it('百分比落在 0~100：后端给 floor 值，越界与 null 都不炸界面', () => {
    expect(runPercent(run({ progress: 42 }))).toBe(42)
    expect(runPercent(run({ progress: 130 }))).toBe(100)
    expect(runPercent(run({ progress: -3 }))).toBe(0)
    expect(runPercent(run({ progress: null }))).toBe(0)
    expect(runPercent(null)).toBe(0)
  })

  it('没跑过的计划说「还没跑过一轮」，不显示 0 轮（PH_NOT_RUN 与 0 是两个意思）', () => {
    expect(campaignRunSummary({ latestRun: null })).toBe('还没跑过一轮')
  })

  it('跑过的计划点名轮次 id、状态与阶段文案', () => {
    const summary = campaignRunSummary({ latestRun: run({ stageText: '正在问第 12 / 30 次' }) })
    expect(summary).toContain('第 88 轮')
    expect(summary).toContain('ok')
    expect(summary).toContain('正在问第 12 / 30 次')
    // 没有阶段文案时不留一个孤零零的分隔符
    expect(campaignRunSummary({ latestRun: run({ stageText: null }) })).toBe('第 88 轮 · ok')
  })
})

describe('草稿与向导步状态（§10-2 步状态进 geo_campaign）', () => {
  it('重复次数的边界与后端 clamp 同源：1~10，默认 3', () => {
    expect([REPEAT_MIN, REPEAT_MAX, emptyCampaignDraft().repeatTimes]).toEqual([1, 10, 3])
  })

  it('存进去再读回来是同一个形状；脏 JSON 当没有（不让一次坏写入卡死向导）', () => {
    expect(parseWizardState(wizardStateJson({ current: 4, maxReached: 4 }))).toEqual({ current: 4, maxReached: 4 })
    expect(parseWizardState('')).toBeNull()
    expect(parseWizardState('{oops')).toBeNull()
    expect(parseWizardState('{"current":"x","maxReached":4}')).toBeNull()
    expect(parseWizardState('{"current":-1,"maxReached":3}')).toBeNull()
  })

  it('maxReached 不被压到 current 以下：进度条不许倒退', () => {
    expect(parseWizardState('{"current":3,"maxReached":1}')).toEqual({ current: 3, maxReached: 3 })
  })

  it('存的 JSON 只带这两个数：向导状态里塞别的字段等于给后端表写私有协议', () => {
    expect(wizardStateJson({ current: 4, maxReached: 4, extra: 1 } as never)).toBe('{"current":4,"maxReached":4}')
  })
})
