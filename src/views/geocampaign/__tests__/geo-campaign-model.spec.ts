import { describe, it, expect } from 'vitest'
import {
  MENTION_VS_RECOMMEND_NOTE,
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
  highlightParts,
  judgeCostText,
  judgeGate,
  judgeHint,
  liveRunOf,
  parseWizardState,
  platformHint,
  runGate,
  runPercent,
  sentimentBar,
  sentimentSegmentClass,
  wizardStateJson,
} from '../geoCampaignModel'
import type { GeoEstimate, GeoMetricRow, GeoRun } from '../../../api/geoCampaign'
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
    judgeCallCount: 30,
    judgeEstimatedTokens: 18000,
    totalCallCount: 60,
    totalEstimatedTokens: 60000,
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
    judgeState: null,
    judgeStateLabel: '未判定',
    judgeCallCount: null,
    judgePromptTokens: null,
    judgeCompletionTokens: null,
    judgePromptVersion: null,
    judgeErrorMessage: null,
    judgeStalledReason: null,
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

describe('预估那六行：提问与判定各归各的账（§10-3 + §11.4 两段式）', () => {
  it('提问两行、判定两行、合计一行、耗时一行，数字原样念后端的', () => {
    const lines = estimateLines(estimate())
    expect(lines.map((line) => line.label)).toEqual([
      '提问 · 调用次数',
      '提问 · 预计 token',
      '判定 · 调用次数',
      '判定 · 预计 token',
      '两段合计',
      '预计耗时',
    ])
    expect(lines[0].value).toBe('30 次')
    expect(lines[0].note).toBe('5 题 × 2 个平台 × 每题重复 3 次')
    expect(lines[2].value).toBe('30 次')
    expect(lines[3].value).toBe('18000')
    expect(lines[4].value).toBe('60 次 / 60000 token')
    expect(lines[5].value).toBe('约 6 分钟')
  })

  it('前端不自己重算乘积：接口给 30 就念 30，哪怕 5×2×3 看着也是 30', () => {
    const lines = estimateLines(estimate({ callCount: 31 }))
    expect(lines[0].value).toBe('31 次')
  })

  it('合计用的是接口的 total*，不是前端把两段加出来的（加一遍就有第二份账）', () => {
    const lines = estimateLines(estimate({ callCount: 30, judgeCallCount: 30, totalCallCount: 61, totalEstimatedTokens: 999 }))
    expect(lines[4].value).toBe('61 次 / 999 token')
  })

  it('判定那一行自己说清「一条回答判一次、判全部主体」，也说不成功回答时是 0', () => {
    const lines = estimateLines(estimate({ judgeCallCount: 0 }))
    expect(lines[2].note).toContain('一条成功回答送进模型一次')
    expect(lines[2].value).toBe('0 次')
  })

  it('勾选确认那一发只提提问：合计那行自己写明判定要另外点头', () => {
    const lines = estimateLines(estimate())
    expect(lines[4].note).toContain('点「确认并开始诊断」只花提问那一段')
  })
})

describe('judgeGate：判定这一发的六道闸，顺序对着后端 requestJudge（§11.4）', () => {
  it('提问还在跑 → 按不动，说的是「这一轮还在提问」而不是「参数错误」', () => {
    const gated = judgeGate({ run: run({ status: 'RUNNING', judgeState: null }), confirmChecked: true, submitting: false })
    expect(gated).toEqual({ disabled: true, text: '这一轮还在提问，先等它' })
  })

  it('已经判过 → 按不动，按钮那句说的是「不重判」这条纪律', () => {
    const gated = judgeGate({ run: run({ judgeState: 'DONE', judgeCallCount: 30 }), confirmChecked: true, submitting: false })
    expect(gated.disabled).toBe(true)
    expect(gated.text).toBe('这一轮判过了')
  })

  it('正在判定且没停着 → 按不动：两次判定抢同一批回答，后那一笔钱不在预估里', () => {
    const gated = judgeGate({ run: run({ judgeState: 'JUDGING', judgeCallCount: 8 }), confirmChecked: true, submitting: false })
    expect(gated).toEqual({ disabled: true, text: '正在判定，等它跑完' })
  })

  it('判定停着不动的那一轮 → 放行，重按只补缺（出路跟着判据走，#108）', () => {
    const stalled = run({ judgeState: 'JUDGING', judgeCallCount: 8, judgeStalledReason: '这一轮判定已经 18 分钟没有新进度' })
    expect(judgeGate({ run: stalled, confirmChecked: true, submitting: false }))
      .toEqual({ disabled: false, text: '确认并判定这一轮' })
    expect(judgeHint(stalled)).toContain('只补还缺的那几条')
    expect(judgeHint(stalled)).toContain('18 分钟没有新进度')
  })

  it('一次成功回答都没取到 → 按不动，说的是「没有可判的回答」', () => {
    const gated = judgeGate({ run: run({ callCount: 0 }), confirmChecked: true, submitting: false })
    expect(gated).toEqual({ disabled: true, text: '这一轮没有可判的回答' })
    expect(judgeHint(run({ callCount: 0 }))).toContain('先重跑提问')
  })

  it('没勾确认 → 按不动：判定是第二次花钱，勾选就是它那道闸', () => {
    expect(judgeGate({ run: run(), confirmChecked: false, submitting: false }))
      .toEqual({ disabled: true, text: '请先勾选确认' })
  })

  it('全过才放行：文字是「确认并判定这一轮」', () => {
    expect(judgeGate({ run: run(), confirmChecked: true, submitting: false }))
      .toEqual({ disabled: false, text: '确认并判定这一轮' })
  })

  it('轮次为 null 时不假装能按', () => {
    expect(judgeGate({ run: null, confirmChecked: true, submitting: false }).text).toBe('还没有可判定的轮次')
    expect(judgeGate({ run: run(), confirmChecked: true, submitting: true }).text).toBe('正在提交判定')
  })

  it('上一次判定失败过 → 放行并说清「从头补判缺的那些，提问一次都不重跑」', () => {
    const failed = run({ judgeState: 'FAILED', judgeErrorMessage: '默认对话模型不可用' })
    expect(judgeGate({ run: failed, confirmChecked: true, submitting: false }).disabled).toBe(false)
    expect(judgeHint(failed)).toContain('从头补判')
    // 「先重跑提问」是另一条路（库里没回答时）的说法，判定失败不该把人支去重跑第一段
    expect(judgeHint(failed)).not.toContain('先重跑提问')
  })
})

describe('judgeCostText：判定那一段的钱单独一行（两段各记各的）', () => {
  it('判过之后条数与 token 都在，并带上提示词版本', () => {
    expect(judgeCostText(run({ judgeState: 'DONE', judgeCallCount: 30, judgePromptTokens: 900, judgeCompletionTokens: 210, judgePromptVersion: 'geo-judge-v1' })))
      .toBe('判定 30 条 · 1110 token · 提示词版本 geo-judge-v1')
  })

  it('从没判过时说「一次都没跑过」，不报一个 0 token 装作判过了', () => {
    expect(judgeCostText(run())).toBe('判定那一段一次都没跑过')
  })
})

function sentimentRow(overrides: Partial<GeoMetricRow> = {}): GeoMetricRow {
  return {
    id: Math.floor(Math.random() * 100000),
    scope: 'BRAND',
    subject: '纳欣口腔',
    modelConfigId: 4,
    modelLabel: 'DeepSeek',
    metric: 'sentiment_share',
    metricLabel: '情感占比',
    definition: '该档情感的回答数 ÷ 提到本品牌的回答数。每一档都要带判定理由与原文引句，缺任一不进统计',
    numerator: 3,
    denominator: 12,
    value: 0.25,
    ciLow: null,
    ciHigh: null,
    computedAt: '2026-09-29T10:20:00',
    sentiment: 'POS',
    sentimentLabel: '正面',
    notMeasuredCount: 2,
    judgePromptVersion: 'geo-judge-v1',
    ...overrides,
  }
}

function tiers(nums: [number, number, number], denominator = 12): GeoMetricRow[] {
  const keys = ['POS', 'NEU', 'NEG'] as const
  const labels = ['正面', '中立', '负面']
  return keys.map((key, index) => sentimentRow({
    sentiment: key,
    sentimentLabel: labels[index],
    numerator: nums[index],
    denominator,
    value: denominator > 0 ? nums[index] / denominator : null,
  }))
}

describe('sentimentBar：三档之外那一段必须看得见（§11.4 第四道校验的界面形态）', () => {
  it('三档各占一段，宽度对着分母算，不是把三档自己归一化', () => {
    const bar = sentimentBar(tiers([6, 3, 1]))
    expect(bar?.denominator).toBe(12)
    expect(bar?.segments.map((segment) => [segment.key, segment.percent])).toEqual([['POS', 50], ['NEU', 25], ['NEG', 8.3]])
    expect(bar?.measuredPercent).toBe(83.3)
    expect(bar?.unmeasured).toEqual({ count: 2, percent: 16.7 })
  })

  it('判得一条不漏时不摆「未测量」那一段：零缺口写成有缺口也是谎报', () => {
    const bar = sentimentBar(tiers([6, 3, 3]))
    expect(bar?.unmeasured).toBeNull()
    expect(bar?.measuredPercent).toBe(100)
  })

  it('档位名与顺序都跟着接口走：这里不列第二份词表', () => {
    const bar = sentimentBar(tiers([1, 1, 1]))
    expect(bar?.segments.map((segment) => segment.label)).toEqual(['正面', '中立', '负面'])
    const shuffled = sentimentBar(tiers([1, 1, 1]).reverse())
    expect(shuffled?.segments.map((segment) => segment.key)).toEqual(['NEG', 'NEU', 'POS'])
  })

  it('分母为 0（一条都没提到本品牌）时不除零：百分比 0、不摆未测量段', () => {
    const bar = sentimentBar(tiers([0, 0, 0], 0))
    expect(bar?.segments.every((segment) => segment.percent === 0)).toBe(true)
    expect(bar?.unmeasured).toBeNull()
    expect(bar?.measuredPercent).toBe(0)
  })

  it('没有带档位的行（这一轮没判过）返回 null，界面走「未取到」那一态', () => {
    expect(sentimentBar([sentimentRow({ sentiment: null, sentimentLabel: null })])).toBeNull()
    expect(sentimentBar([])).toBeNull()
  })

  it('认不出来的档位落到 other 那档灰，不借正面/负面那两色', () => {
    expect(sentimentSegmentClass('POS')).toBe('pos')
    expect(sentimentSegmentClass('NEU')).toBe('neu')
    expect(sentimentSegmentClass('NEG')).toBe('neg')
    expect(sentimentSegmentClass('MIXED')).toBe('other')
    expect(sentimentSegmentClass(null)).toBe('other')
  })
})

describe('「提到」与「在推荐位」这两个数：各占一格、永不相加（§11.4 第三条）', () => {
  it('那句话就写在这里，说明的是包含关系而不是两笔观测', () => {
    expect(MENTION_VS_RECOMMEND_NOTE).toContain('永远不相加')
    expect(MENTION_VS_RECOMMEND_NOTE).toContain('共用同一个分母')
    expect(MENTION_VS_RECOMMEND_NOTE).toContain('12 已经包含 4')
  })

  it('这一句里没有任何相加的写法（把两个数加起来才是违规）', () => {
    expect(MENTION_VS_RECOMMEND_NOTE).not.toMatch(/[+\-]\s*\d+\s*=\s*\d+/)
  })
})

describe('highlightParts：原文高亮不靠 v-html（回答是模型产出的不可信内容）', () => {
  it('命中段切成 hit，前后各留普通段', () => {
    expect(highlightParts('去纳欣口腔看看，纳欣口腔的医生不错', '纳欣口腔')).toEqual([
      { text: '去', hit: false },
      { text: '纳欣口腔', hit: true },
      { text: '看看，', hit: false },
      { text: '纳欣口腔', hit: true },
      { text: '的医生不错', hit: false },
    ])
  })

  it('needle 不在原文里时整段原样返回，界面上不凭空亮一块', () => {
    expect(highlightParts('今天的回答里没有那家', '纳欣口腔')).toEqual([{ text: '今天的回答里没有那家', hit: false }])
  })

  it('空原文 / 空 needle 都不炸', () => {
    expect(highlightParts(null, 'x')).toEqual([])
    expect(highlightParts('正文', null)).toEqual([{ text: '正文', hit: false }])
    expect(highlightParts('正文', '   ')).toEqual([{ text: '正文', hit: false }])
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
