import { describe, it, expect } from 'vitest'
import type { GeoOpportunity, GeoOpportunityEstimate, GeoVocabulary } from '../../../api/geoCampaign'
import {
  DISMISS_REASON_MAX,
  SCOPE_NOTE,
  UNMEASURED_NOTE,
  actionDefinition,
  actionKeys,
  actionLabel,
  billingLine,
  draftGate,
  draftRefText,
  estimateLines,
  evidenceText,
  isSettledState,
  summarySentence,
} from '../geoOpportunityModel'

/**
 * 机会问题清单的显示判据（Spec-F §11.5 / 10-6）。
 *
 * 钉的是两件最容易坏的事：
 * 1. **词表一份都不抄**——动作键、中文名、判据句子全部从后端 `vocabulary` / 行自带字段读，
 *    所以这里的用例喂的是【假词表】，界面念出来的必须是假词表里那一句，不是 TS 里写死的；
 * 2. **「先看价再点头」的闸顺序**——换过动作之后旧价必须作废。少了这一条，面板上挂着
 *    「新建一页 2,400 token」、按下去跑的是刚选上的「加一个案例」，那就是确认了一个数花了一个数
 *    （§12 花钱端点那条）。
 */

const VOCABULARY = {
  runStatuses: {},
  metrics: {},
  metricDefinitions: {},
  confirmStates: {},
  judgeStates: {},
  prominences: {},
  prominenceDefinitions: {},
  positionLabel: '在推荐清单里的第几项',
  sentiments: {},
  sentimentDefinitions: {},
  accessChannelNote: '本轮口径=API 问答',
  gapTypes: { NOT_COVERED: '假档位一' },
  gapDefinitions: { NOT_COVERED: '假判据一' },
  opportunityActions: { PAGE: '假动作新建页', FAQ: '假动作加问答', ARTICLE: '假动作写文章', CASE: '假动作加案例' },
  opportunityActionDefinitions: { PAGE: '假动作说明：建一张草稿页' },
  opportunityStates: { OPEN: '假状态还没动', DRAFTED: '假状态已出草稿' },
} as unknown as GeoVocabulary

/** 词表到手了，但里面压根没有机会那一族（老后端没升级那一形）：这时只能退回行自带的名字 */
const NO_OPPORTUNITY_VOCABULARY = {} as unknown as GeoVocabulary

function estimate(overrides: Partial<GeoOpportunityEstimate> = {}): GeoOpportunityEstimate {
  return {
    opportunityId: 3,
    actionType: 'PAGE',
    actionLabel: '假动作新建页',
    actionDefinition: '假动作说明：建一张草稿页',
    callCount: 1,
    estimatedTokens: 2400,
    remainingTokens: 88000,
    // 这一个动作（新建页）走的是通用池：G4 之后四个动作分属两池，词表由后端按动作现给
    quotaPoolLabel: '通用 AI 额度池',
    tenantBearsCost: true,
    draftEnabled: true,
    accounting: '页面改版草稿那条账（AI_PORTAL_REVISION）',
    notice: null,
    ...overrides,
  }
}

function row(overrides: Partial<GeoOpportunity> = {}): GeoOpportunity {
  return {
    id: 3,
    runId: 88,
    campaignId: 12,
    questionId: 41,
    coreWord: '种植牙',
    questionText: '种植牙要多少钱',
    kind: 'MENTION',
    gapType: 'NOT_COVERED',
    gapTypeLabel: '假档位一',
    gapDefinition: '假判据一',
    actionType: 'PAGE',
    actionLabel: '假动作新建页',
    evidenceNumerator: 0,
    evidenceDenominator: 2,
    draftRef: null,
    state: 'OPEN',
    stateLabel: '假状态还没动',
    dismissedReason: null,
    verifiedRunId: null,
    verifiedGapType: null,
    verifiedAt: null,
    verificationNote: null,
    createdAt: null,
    updatedAt: null,
    ...overrides,
  }
}

describe('词表全部来自接口：TS 里不许有第二份', () => {
  it('四个动作的键与顺序就是后端那一族，前端不列自己的清单', () => {
    expect(actionKeys(VOCABULARY)).toEqual(['PAGE', 'FAQ', 'ARTICLE', 'CASE'])
    expect(actionKeys(null)).toEqual([])
  })

  it('动作中文名与说明都念词表里那一句（假词表能验出来是不是抄的）', () => {
    expect(actionLabel(VOCABULARY, 'CASE')).toBe('假动作加案例')
    expect(actionDefinition(VOCABULARY, 'PAGE')).toBe('假动作说明：建一张草稿页')
    // 词表里没有说明的那一个动作：宁可留一个横杠，也不许编一句「大概会怎样」
    expect(actionDefinition(VOCABULARY, 'CASE')).toBe('—')
  })

  it('词表缺档时退回行自带的中文名，两个都没有才原样显示状态码', () => {
    expect(actionLabel(NO_OPPORTUNITY_VOCABULARY, 'FAQ', '接口给的标签')).toBe('接口给的标签')
    expect(actionLabel(NO_OPPORTUNITY_VOCABULARY, 'FAQ')).toBe('FAQ')
    expect(actionLabel(NO_OPPORTUNITY_VOCABULARY, null)).toBe('—')
  })

  it('放弃理由的长度上限是后端那一个数（界面先拦住，别让人拿一次 400）', () => {
    expect(DISMISS_REASON_MAX).toBe(500)
  })
})

describe('清单头部那三个数分开说（§9.6）', () => {
  it('还差着的、已达成的、判不了的各报各的，合成一句就是谎报', () => {
    const sentence = summarySentence({
      runId: 88, unmeasuredQuestions: 6, items: [], opportunityCount: 3, resolvedCount: 2,
    })
    expect(sentence).toContain('3 条机会还差着')
    expect(sentence).toContain('2 条已达成')
    expect(sentence).toContain('另有 6 道题这一轮判不了')
  })

  it('判不了的题数没统计过时念「未统计」，真测到的 0 就念 0', () => {
    const base = { runId: 88, items: [] as GeoOpportunity[], opportunityCount: 0, resolvedCount: 0 }
    expect(summarySentence({ ...base, unmeasuredQuestions: null })).toContain('未统计')
    expect(summarySentence({ ...base, unmeasuredQuestions: 0 })).toContain('另有 0 道题')
  })

  it('作用域与出路那两句话摆在这里：清单跨轮存活、判不了的题要补的是核心词', () => {
    expect(SCOPE_NOTE).toContain('跨轮存活')
    expect(UNMEASURED_NOTE).toContain('核心词')
  })
})

describe('先看价再点头：闸的顺序与「换动作旧价作废」', () => {
  const open = { selectedAction: 'PAGE', confirmChecked: true, submitting: false }

  it('没看过预估就按不动，按钮上写的是「先看预估」而不是「参数错误」', () => {
    expect(draftGate({ ...open, estimate: null, estimatedAction: null }).text).toBe('请先看这个动作的预估')
  })

  it('换过动作之后那份价作废：显示的是「新建一页」的价，按下跑的却是刚选的「加一个案例」，这一形必须拦', () => {
    const gate = draftGate({
      selectedAction: 'CASE', estimatedAction: 'PAGE', estimate: estimate(),
      confirmChecked: true, submitting: false,
    })
    expect(gate.disabled).toBe(true)
    expect(gate.text).toBe('请先看这个动作的预估')
  })

  it('notice 非空 ⇒ 主按钮说「这一发不会受理」，勾选与提交都到不了', () => {
    const gate = draftGate({
      ...open, estimate: estimate({ notice: '今天已经用一键动作生成过 10 份草稿' }), estimatedAction: 'PAGE',
    })
    expect(gate.disabled).toBe(true)
    expect(gate.text).toBe('这一发不会受理')
  })

  it('没勾选 ⇒ 第二道闸按不动；勾了才放行', () => {
    expect(draftGate({ ...open, estimate: estimate(), estimatedAction: 'PAGE', confirmChecked: false }).text)
      .toBe('请先勾选确认')
    const ready = draftGate({ ...open, estimate: estimate(), estimatedAction: 'PAGE' })
    expect(ready.disabled).toBe(false)
    expect(ready.text).toBe('确认并生成草稿')
  })

  it('提交中 ⇒ 只有「正在生成」一种说法，重复按不会二次扣钱', () => {
    expect(draftGate({
      ...open, estimate: estimate(), estimatedAction: 'PAGE', submitting: true,
    }).text).toBe('正在生成')
  })

  it('一个动作都没选（词表还没到手）⇒ 按不动并且说的是选动作，不是看预估', () => {
    expect(draftGate({
      selectedAction: null, estimatedAction: null, estimate: null, confirmChecked: true, submitting: false,
    }).text).toBe('先选一个动作')
  })
})

describe('预估那几行只做显示不做算术', () => {
  it('四个数原样念出来，「这笔钱走哪条账」用的就是接口那句 accounting', () => {
    const lines = estimateLines(estimate())
    expect(lines.map((line) => line.label)).toEqual(
      ['模型调用', '预计 token', '这笔钱走哪条账', '账记在谁身上'],
    )
    expect(lines[1].value).toBe('2400')
    expect(lines[2].value).toBe('页面改版草稿那条账（AI_PORTAL_REVISION）')
    expect(lines[0].value).toBe('1 次')
  })

  it('账在谁身上跟着 tenantBearsCost 走：念反方向等于骗人一次', () => {
    expect(billingLine(estimate())).toContain('通用 AI 额度池')
    expect(billingLine(estimate({ tenantBearsCost: false }))).toContain('由平台承担')
  })

  it('四个动作分属两池：「本月剩余」必须点名是哪一池（G4）', () => {
    // 同一屏上换动作就是换池子。界面写死一个池名（或者干脆不写）都会讲错：
    // 加问答的钱在 GEO 专用池，新建页 / 写文章 / 加案例在通用池
    expect(billingLine(estimate({ quotaPoolLabel: 'GEO 诊断专用额度池' }))).toBe(
      '计入本租户的「GEO 诊断专用额度池」，该池本月剩余 88000 token。',
    )
    expect(billingLine(estimate({ quotaPoolLabel: '通用 AI 额度池' }))).toBe(
      '计入本租户的「通用 AI 额度池」，该池本月剩余 88000 token。',
    )
    expect(billingLine(estimate({ tenantBearsCost: false }))).toContain('通用 AI 额度池')
  })
})

describe('行上那两格读数', () => {
  it('产出对象念动作名 + 引用，因为前缀与动作是后端同一处写进去的', () => {
    expect(draftRefText(row({ draftRef: 'page:33' }))).toBe('假动作新建页 · page:33')
    expect(draftRefText(row())).toBe('—')
  })

  it('观测那一格：分母没算过时是横杠，真取到 0 次就念 0 / 2', () => {
    expect(evidenceText(row())).toBe('0 / 2 条回答引用到我们站')
    expect(evidenceText(row({ evidenceDenominator: null }))).toBe('—')
  })

  it('已经定论的那两格不再摆「放弃」入口，未动的与已出草稿的还可以', () => {
    expect(isSettledState('PUBLISHED')).toBe(true)
    expect(isSettledState('DISMISSED')).toBe(true)
    expect(isSettledState('OPEN')).toBe(false)
    expect(isSettledState('DRAFTED')).toBe(false)
    expect(isSettledState(null)).toBe(false)
  })
})
