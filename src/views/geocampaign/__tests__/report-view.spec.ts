import { describe, it, expect, beforeEach, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { Button, Checkbox } from 'ant-design-vue'
import GeoCampaignReportView from '../GeoCampaignReportView.vue'
import { geoCampaignApi } from '../../../api/geoCampaign'
import type { GeoMetricRow, GeoReport } from '../../../api/geoCampaign'

/**
 * 诊断报告五卡（Spec-F §10-4 + §11.4 的语义判定那一半）。
 *
 * §5 的三条禁令与 §11.3 的「每个率都点得到分母」在这一屏是看得见的东西，所以逐条钉：
 * 1. **不做跨平台合并总分**——整页文本里不许出现「总分」「综合得分」这类格，也不许把一个加权数
 *    摆在任何卡的标题位；
 * 2. **口径句子来自那一行本身**——喂给各表的 `definition` 各不相同，界面上必须各念各的；
 *    页面自己写一份公式（或给两卡复用同一句）判红；
 * 3. **`value` 为 null 是「未取到」，不是 0%**——同时分子分母照旧显示，缺口那几个出口各说各的；
 * 4. 头部那句 `accessChannelNote` 只出现一次（§5 禁令 2），并且用的就是接口回的那一句；
 * 5. **提及率与推荐率永不相加**（§11.4 第三条）——它们共用同一个分母，相加就是把包含关系读成两笔；
 * 6. **情感三档加起来不到 100% 时，缺的那一段在条上看得见**（§11.4 第四条）——不许把判据缺口画成成功观测。
 *
 * 还有一条整族通用的：**判定是第二段花钱的动作**（§6.2 两段式）。所以这一屏既有「判定这一轮」
 * 那一发（要点头、要花钱），也有 DONE / JUDGING / 停着不动三种情形各自的按钮话术。
 *
 * stub 形状照后端 record 抄：`mentionRate` / `recommendRate` 每平台一行、`sentimentShare` 每
 * （平台 × 档位）一行、`sovShare` 每（平台 × 对象）一行、`promptCoverage` 只有一行且
 * `modelConfigId` 为 null（覆盖率不分平台，见 GeoMetricCalculator 注释）。
 */

// 只替 useRoute：`api/geoCampaign → http → router/index` 这条链要拿到真的 createRouter，
// 整体替换 vue-router 会让页面在装配阶段就炸（跟本页要测的东西无关）。
vi.mock('vue-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-router')>()
  return { ...actual, useRoute: () => ({ params: {}, query: {} }) }
})

// 只替 notification：判定/重算失败时后端那句原因是「数据」，界面上的处置是把它原样递到用户眼前，
// 这一条得能在断言里读到；组件本身（Button 等）用真的，否则按不动的就是用例而不是界面。
const { notificationMock } = vi.hoisted(() => ({
  notificationMock: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}))

vi.mock('ant-design-vue', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('ant-design-vue')
  return { ...actual, notification: notificationMock }
})

vi.mock('../../../api/geoCampaign', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../api/geoCampaign')>()
  return {
    ...actual,
    geoCampaignApi: {
      getReport: vi.fn(), vocabulary: vi.fn(), recalculateSov: vi.fn(),
      judge: vi.fn(), judgments: vi.fn(), answer: vi.fn(),
      opportunities: vi.fn(), opportunityEstimate: vi.fn(), opportunityDraft: vi.fn(),
      opportunityDismiss: vi.fn(), opportunityStateLog: vi.fn(),
    },
  }
})

const TAG_STUB = {
  name: 'ATag',
  props: ['color'],
  template: '<span class="tag-stub" :data-color="color"><slot /></span>',
}

const PROGRESS_STUB = {
  name: 'AProgress',
  props: ['percent'],
  template: '<i class="progress-stub" :data-percent="percent" />',
}

/** 抽屉自己的渲染有它自己的用例（judgment-drawer.spec.ts），这里只钉「报告那一发点得开它」 */
/** 机会清单自己有整套用例（opportunity-panel.spec.ts），这里只钉「报告把它挂上了、传的是这一轮」 */
const OPPORTUNITY_PANEL_STUB = {
  name: 'GeoOpportunityPanel',
  props: ['runId', 'vocabulary'],
  template: '<div class="opp-panel-stub" :data-run-id="runId" />',
}

const DRAWER_STUB = {
  name: 'GeoJudgmentDrawer',
  props: ['open', 'runId', 'vocabulary'],
  template: '<div class="drawer-stub" :data-open="open ? \'1\' : \'0\'" :data-run-id="runId" />',
}

const ACCESS_CHANNEL_NOTE =
  '本轮口径=API 问答：这是我们用配置的模型接口问出来的答案，'
  + '不等于你在豆包/DeepSeek 等 App 里实际看到的答案（那一层的观测本 Spec 未开启）。'

const MENTION_DEF = '该平台这一轮里，提到本品牌的【成功回答数】÷ 该平台成功拿到回答的总次数'
const RECOMMEND_DEF = '该平台这一轮里，本品牌被放进推荐清单的【成功回答数】÷ 该平台成功拿到回答的总次数。与提及率同一个分母，所以不是两笔钱'
const SOV_DEF = '本品牌被提及次数 ÷（本品牌 + 全部【勾选参与对比】的竞品被提及次数之和）。未勾选的竞品不进分母'
const COVERAGE_DEF = '站内已发布内容对得上这道题的题数 ÷ 本轮问过的追踪题数。分母不是调用次数，所以这一条不分平台'
const SENTIMENT_DEF = '提到本品牌的那几条回答里，这一档占的条数 ÷ 提到本品牌的回答数。分母与上面两卡都不是同一个'

function metricRow(overrides: Partial<GeoMetricRow>): GeoMetricRow {
  return {
    id: Math.floor(Math.random() * 10000),
    scope: 'BRAND',
    subject: '纳欣口腔',
    modelConfigId: 4,
    modelLabel: 'DeepSeek',
    metric: 'mention_rate',
    metricLabel: '提及率',
    definition: MENTION_DEF,
    numerator: 6,
    denominator: 15,
    value: 0.4,
    ciLow: 0.19,
    ciHigh: 0.66,
    computedAt: '2026-09-29T10:06:00',
    sentiment: null,
    sentimentLabel: null,
    notMeasuredCount: null,
    judgePromptVersion: null,
    ...overrides,
  }
}

/** 一（平台 × 档位）一行：分母是「提到本品牌的回答数」，三档分子之和小于分母就是判不成的那些 */
function sentimentRow(overrides: Partial<GeoMetricRow>): GeoMetricRow {
  return metricRow({
    metric: 'sentiment_share',
    metricLabel: '情感占比',
    definition: SENTIMENT_DEF,
    denominator: 6,
    judgePromptVersion: 'geo-judge-v1',
    ...overrides,
  })
}

function tiers(prefix: number): GeoMetricRow[] {
  return [
    sentimentRow({ id: 61 + prefix, sentiment: 'POS', sentimentLabel: '正面', numerator: 3 }),
    sentimentRow({ id: 62 + prefix, sentiment: 'NEU', sentimentLabel: '中立', numerator: 2 }),
    // 真的判成「一次负面都没有」：0% 是一个观测值，跟「未取到」是两件事
    sentimentRow({ id: 63 + prefix, sentiment: 'NEG', sentimentLabel: '负面', numerator: 0, value: 0, ciLow: null, ciHigh: null }),
  ]
}

function report(overrides: Partial<GeoReport> = {}): GeoReport {
  return {
    run: {
      id: 88,
      campaignId: 12,
      tenantId: 1,
      brandProfileId: 7,
      siteId: 3,
      status: 'SUCCEEDED',
      statusLabel: 'SUCCEEDED',
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
      queuedReason: null,
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
    },
    platforms: ['DeepSeek', '通义千问'],
    mentionRate: [
      metricRow({ id: 1, modelLabel: 'DeepSeek' }),
      metricRow({ id: 2, modelLabel: '通义千问', numerator: 3, denominator: 15, value: 0.2 }),
    ],
    recommendRate: [
      metricRow({
        id: 11, metric: 'recommend_rate', metricLabel: '推荐率', definition: RECOMMEND_DEF,
        modelLabel: 'DeepSeek', numerator: 4, denominator: 15, value: 0.2667,
        notMeasuredCount: 2, judgePromptVersion: 'geo-judge-v1',
      }),
      metricRow({
        id: 12, metric: 'recommend_rate', metricLabel: '推荐率', definition: RECOMMEND_DEF,
        modelLabel: '通义千问', numerator: 1, denominator: 15, value: 0.0667,
        notMeasuredCount: 0, judgePromptVersion: 'geo-judge-v1',
      }),
    ],
    sovShare: [
      metricRow({ id: 3, metric: 'sov_share', metricLabel: 'AI SOV', definition: SOV_DEF, subject: '纳欣口腔', numerator: 9, denominator: 15, value: 0.6 }),
      metricRow({ id: 4, metric: 'sov_share', metricLabel: 'AI SOV', definition: SOV_DEF, scope: 'COMPETITOR', subject: '同行甲', numerator: 4, denominator: 15, value: 0.2667 }),
    ],
    sentimentShare: tiers(0),
    promptCoverage: metricRow({
      id: 5, metric: 'prompt_coverage', metricLabel: '问题覆盖率', definition: COVERAGE_DEF,
      modelConfigId: null, modelLabel: null, numerator: 3, denominator: 5, value: 0.6, ciLow: 0.23, ciHigh: 0.88,
    }),
    callCount: 30,
    failedCallCount: 0,
    unmeasuredSubjects: [],
    unmeasuredQuestions: [],
    accessChannelNote: ACCESS_CHANNEL_NOTE,
    judgePromptVersion: null,
    judgeModelLabel: null,
    notMeasuredJudgments: 0,
    generatedAt: '2026-09-29T10:07:00',
    ...overrides,
  }
}

/** 判定跑过一轮之后的那份账（头部那一行「判定 N 条 · token · 版本」与三档同时有数） */
function judged(overrides: Partial<GeoReport> = {}): Partial<GeoReport> {
  return {
    run: {
      ...report().run,
      judgeState: 'DONE',
      judgeStateLabel: '已判定',
      judgeCallCount: 30,
      judgePromptTokens: 6000,
      judgeCompletionTokens: 900,
      judgePromptVersion: 'geo-judge-v1',
    },
    judgePromptVersion: 'geo-judge-v1',
    judgeModelLabel: 'qwen3.7-plus',
    ...overrides,
  }
}

function baseStubs() {
  return {
    'a-tag': TAG_STUB,
    'a-progress': PROGRESS_STUB,
    GeoJudgmentDrawer: DRAWER_STUB,
    GeoOpportunityPanel: OPPORTUNITY_PANEL_STUB,
    // 勾选框用真组件：第二道闸（§6.2）的判据是「不勾就发不出去」，替件按不动就是假绿
    'a-checkbox': Checkbox,
    // 「按当前勾选重算份额」与「确认并判定这一轮」那两发要真按得动：a-button 用声明了 emits 的桩，
    // 模板里不自己 $emit('click') 的话，页面挂的 @click 永远走不到，测出来的是假绿
    'a-button': Button,
  }
}

async function mountView(overrides: Partial<GeoReport> = {}) {
  vi.mocked(geoCampaignApi.getReport).mockResolvedValue(report(overrides) as never)
  const wrapper = mount(GeoCampaignReportView, {
    props: { runId: 88 },
    global: { stubs: baseStubs() },
  })
  await flushPromises()
  return wrapper
}

function buttonByText(wrapper: ReturnType<typeof mount>, text: string) {
  const found = wrapper.findAll('button').find((node: any) => (node.text() || '').trim() === text)
  if (!found) throw new Error(`找不到文字为「${text}」的按钮`)
  return found
}

function cardOf(wrapper: ReturnType<typeof mount>, key: string) {
  const card = wrapper.find(`.geo-report__card[data-card="${key}"]`)
  if (!card.exists()) throw new Error(`找不到 data-card="${key}" 那一卡`)
  return card
}

function rowsOfCard(wrapper: ReturnType<typeof mount>, key: string): string[] {
  return cardOf(wrapper, key).findAll('.geo-report__table tbody tr').map((row: any) => row.text())
}

/** 真实勾选框：点它才走 ant 的 change → update:checked，替件会把「勾了才能按」这条闸测成假绿 */
async function tickConfirm(wrapper: ReturnType<typeof mount>) {
  const input = wrapper.find('input[type="checkbox"]')
  if (!input.exists()) throw new Error('判定那一发没有确认勾选框：两段式闸在界面上少了第二道')
  await input.setValue(true)
  await flushPromises()
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(geoCampaignApi.vocabulary).mockResolvedValue({
    runStatuses: { PENDING: '排队中', RUNNING: '诊断中', SUCCEEDED: '已完成', PARTIAL: '部分完成', FAILED: '失败' },
    metrics: {},
    metricDefinitions: {},
    confirmStates: {},
    judgeStates: { JUDGING: '判定中', DONE: '已判定', FAILED: '判定失败' },
    prominences: {},
    prominenceDefinitions: {},
    positionLabel: '在推荐清单里的第几项',
    sentiments: {},
    sentimentDefinitions: {},
    accessChannelNote: ACCESS_CHANNEL_NOTE,
  } as never)
  vi.mocked(geoCampaignApi.judge).mockResolvedValue({ ...report().run, judgeState: 'JUDGING' } as never)
})

describe('卡一：AI 品牌提及（分平台，不做合并）', () => {
  it('每个平台一行，率旁边带着自己的分子分母与 95% 区间', async () => {
    const wrapper = await mountView()
    const rows = rowsOfCard(wrapper, 'mention')
    expect(rows).toHaveLength(2)
    expect(rows[0]).toContain('DeepSeek')
    expect(rows[0]).toContain('40.0%')
    expect(rows[0]).toContain('6 / 15')
    expect(rows[0]).toContain('19.0%–66.0%')
    expect(rows[1]).toContain('通义千问')
    expect(rows[1]).toContain('20.0%')
  })

  it('整页没有跨平台总分：没有合并格、没有合计行，也没有把两个率平均掉的数', async () => {
    const wrapper = await mountView()
    const text = wrapper.text()
    // 「这里刻意没有一个「总分」格」这句自查本身要留着，被删掉才是真出事
    expect(text).toContain('这里刻意没有一个「总分」格')
    expect(text).not.toMatch(/综合得分|加权平均|平均提及率|合计行|总分：/)
    expect(text).not.toMatch(/合计\s*[\d.]+%/)
    // (0.4+0.2)/2 = 30.0% 那种合并数一旦冒出来，这里先红
    expect(text).not.toContain('30.0%')
    // 提及率卡里正好两行=两个平台，第三行「合并」就是违规
    expect(rowsOfCard(wrapper, 'mention')).toHaveLength(2)
  })

  it('口径句子逐行取自那一行自己：提及率那一句不会跑到覆盖率格子里', async () => {
    const wrapper = await mountView()
    expect(rowsOfCard(wrapper, 'mention')[0]).toContain('该平台成功拿到回答的总次数')
    expect(rowsOfCard(wrapper, 'coverage')[0]).toContain('分母不是调用次数')
    expect(rowsOfCard(wrapper, 'sov')[0]).toContain('未勾选的竞品不进分母')
  })

  it('value 为 null 的那一行显示「未取到」，但分母照样念得出来', async () => {
    const wrapper = await mountView({
      mentionRate: [metricRow({ id: 9, numerator: 0, denominator: 0, value: null, ciLow: null, ciHigh: null })],
    })
    const row = rowsOfCard(wrapper, 'mention')[0]
    expect(row).toContain('未取到')
    expect(row).not.toContain('0.0%')
    expect(row).toContain('0 / 0')
    // 区间没算过就不凭空出现 ±
    expect(row).toContain('—')
  })
})

describe('卡二：AI 推荐（与提及率两个数分开摆，永不相加）', () => {
  it('每个平台一行推荐率，带分子分母与「判不成」那几条', async () => {
    const wrapper = await mountView()
    const rows = rowsOfCard(wrapper, 'recommend')
    expect(rows).toHaveLength(2)
    expect(rows[0]).toContain('DeepSeek')
    expect(rows[0]).toContain('26.7%')
    expect(rows[0]).toContain('4 / 15')
    expect(rows[0]).toContain('2 条')
    expect(rows[1]).toContain('通义千问')
    expect(rows[1]).toContain('6.7%')
  })

  it('两个数各占一格：40.0% 与 26.7% 都在，合出来的 66.7% 一个都没有', async () => {
    const wrapper = await mountView()
    const text = wrapper.text()
    expect(text).toContain('40.0%')
    expect(text).toContain('26.7%')
    // 提到 6 + 推荐 4 = 10 次、40%+26.7%=66.7% 那种读法一旦出现就是违规（§11.4 第三条）
    expect(text).not.toContain('66.7%')
    expect(text).toContain('共用同一个分母')
    expect(text).toContain('12 已经包含 4')
  })

  it('推荐率卡里念的是推荐率那一行的 definition，不是提及率那一句', async () => {
    const wrapper = await mountView()
    const row = rowsOfCard(wrapper, 'recommend')[0]
    expect(row).toContain('被放进推荐清单')
    expect(row).not.toContain('提到本品牌的【成功回答数】')
  })

  it('一轮还没判过所以没有推荐率行：说的是它出自语义判定，出路是「判定这一轮」而不是重跑提问', async () => {
    const wrapper = await mountView({ recommendRate: [] })
    const card = cardOf(wrapper, 'recommend')
    expect(card.text()).toContain('这一轮还没有推荐率行')
    expect(card.text()).toContain('判定这一轮')
    expect(card.text()).toContain('不重跑提问')
  })
})

describe('卡三：情感三档（缺口看得见，没有「净情感」）', () => {
  it('一根条上三个色块，宽度对着同一个分母算，不是把三档自己归一化', async () => {
    const wrapper = await mountView(judged())
    const segments = cardOf(wrapper, 'sentiment').findAll('.geo-report__seg')
    const measured = segments.filter((node: any) => !node.classes().includes('geo-report__seg--unmeasured'))
    expect(measured.map((node: any) => node.attributes('data-sentiment'))).toEqual(['POS', 'NEU', 'NEG'])
    expect(measured[0].attributes('style')).toContain('width: 50%')
    expect(measured[1].attributes('style')).toContain('width: 33.3%')
    expect(cardOf(wrapper, 'sentiment').text()).toContain('分母 6 条（提到本品牌的回答数）')
  })

  it('三档只有 5 条、判不成 1 条：缺的那一段画在条上，并写明它不是「中立」', async () => {
    const wrapper = await mountView(judged())
    const note = wrapper.find('.geo-report__bar-note')
    expect(note.exists()).toBe(true)
    expect(note.text()).toContain('三档加起来是 83.3%')
    expect(note.text()).toContain('缺的那 1 条不是「中立」')
    const gap = wrapper.find('.geo-report__seg--unmeasured')
    expect(gap.exists()).toBe(true)
    expect(gap.text()).toContain('1 条')
    expect(gap.attributes('style')).toContain('width: 16.7%')
  })

  it('三档恰好铺满分母时不摆「未取到」那一段：没有缺口还画一格就是谎报', async () => {
    const wrapper = await mountView(judged({
      sentimentShare: [
        sentimentRow({ id: 71, sentiment: 'POS', sentimentLabel: '正面', numerator: 4 }),
        sentimentRow({ id: 72, sentiment: 'NEU', sentimentLabel: '中立', numerator: 2 }),
        sentimentRow({ id: 73, sentiment: 'NEG', sentimentLabel: '负面', numerator: 0, value: 0 }),
      ],
    }))
    expect(wrapper.find('.geo-report__seg--unmeasured').exists()).toBe(false)
    expect(wrapper.find('.geo-report__bar-note').exists()).toBe(false)
  })

  it('负面那一档真的是 0 就画 0.0%：不借「未取到」把一个观测值藏起来', async () => {
    const wrapper = await mountView(judged())
    const neg = rowsOfCard(wrapper, 'sentiment').find((row) => row.includes('负面'))
    expect(neg).toContain('0.0%')
    expect(neg).not.toContain('未取到')
  })

  it('没有「净情感」那一格：两个都是模型判出来的档位，相减没人问过它是什么', async () => {
    const wrapper = await mountView(judged())
    expect(cardOf(wrapper, 'sentiment').text()).toContain('这里没有「净情感」')
  })

  it('判过一轮但还没有情感行：说的是先按「判定这一轮」，不摆一张空条', async () => {
    const wrapper = await mountView({ sentimentShare: [] })
    const card = cardOf(wrapper, 'sentiment')
    expect(card.text()).toContain('这一轮还没有情感行')
    expect(card.text()).toContain('每档都点得开到那条回答的原文')
    expect(card.findAll('.geo-report__bar')).toHaveLength(0)
  })

  it('一个平台的条绝不与另一个平台合并：分平台各一根（§5 禁令 1）', async () => {
    const wrapper = await mountView(judged({
      sentimentShare: [...tiers(0), ...tiers(100).map((row) => ({ ...row, modelLabel: '通义千问' }))],
    }))
    const bars = cardOf(wrapper, 'sentiment').findAll('.geo-report__bar-block')
    expect(bars).toHaveLength(2)
    expect(bars[0].text()).toContain('DeepSeek')
    expect(bars[1].text()).toContain('通义千问')
  })
})

describe('卡四：推荐问题覆盖（覆盖 ≠ 被引用）', () => {
  it('一行给率、分子分母、未覆盖几道，并写明它与「被引用」是两条指标', async () => {
    const wrapper = await mountView()
    const row = rowsOfCard(wrapper, 'coverage')[0]
    expect(row).toContain('60.0%')
    expect(row).toContain('3 / 5')
    expect(row).toContain('2 道')
    expect(wrapper.text()).toContain('覆盖」= 站内有内容对得上这道题，与「被 AI 引用」是两条指标')
  })

  it('coverage 为 null（全轮判不了题）：说不「没有可判的题」和出路，不摆一张空表', async () => {
    const wrapper = await mountView({ promptCoverage: null })
    const card = cardOf(wrapper, 'coverage')
    expect(card.text()).toContain('这一轮没有可判的题')
    expect(card.text()).toContain('先在题池里补核心词')
    expect(card.find('.geo-report__table').exists()).toBe(false)
  })
})

describe('卡五：SOV 共用分母这件事必须写在脸上', () => {
  it('本品牌与竞品同平台并列，份额合起来 100% 的解释在卡底', async () => {
    const wrapper = await mountView()
    const rows = rowsOfCard(wrapper, 'sov')
    expect(rows).toHaveLength(2)
    expect(rows[0]).toContain('纳欣口腔')
    expect(rows[1]).toContain('同行甲')
    expect(wrapper.text()).toContain('同一平台的每一行共用同一个分母')
    expect(wrapper.text()).toContain('而不是「市场上有多少」')
  })

  it('一家竞品都没勾所以没有 SOV 行：说的是「只有自家的份额不是观测值」，不是 0%', async () => {
    const wrapper = await mountView({ sovShare: [] })
    expect(wrapper.text()).toContain('这一轮没有 SOV 行')
    expect(wrapper.text()).toContain('恒等于 100%')
    expect(wrapper.text()).toContain('勾选至少一家')
  })
})

describe('两段各花的钱：头部与「判定这一轮」那一发（§6.2 + §11.4）', () => {
  it('提问与判定是两个标签：判定那一份词表来自接口的 label，界面没抄第二份', async () => {
    const wrapper = await mountView()
    const tags = wrapper.findAll('.tag-stub')
    expect(tags[0].text()).toBe('已完成')
    expect(tags[1].text()).toBe('未判定')
  })

  it('后端换了词就用后端那个：界面对判定状态没有任何本地映射（接口的 label 说什么就念什么）', async () => {
    const wrapper = await mountView({
      run: { ...report().run, judgeState: 'JUDGING', judgeStateLabel: '正在逐条送进模型' },
    })
    expect(wrapper.findAll('.tag-stub')[1].text()).toBe('正在逐条送进模型')
  })

  it('这一轮没判过：判定那一行说「一次都没跑过」，并且不猜当前的默认模型是谁', async () => {
    const wrapper = await mountView()
    expect(wrapper.text()).toContain('判定那一段一次都没跑过')
    expect(wrapper.text()).toContain('这一轮还没判过，界面上不猜当前的默认模型')
  })

  it('判过了就念条数、token 与提示词版本，模型名取自判定行那一刻', async () => {
    const wrapper = await mountView(judged())
    expect(wrapper.text()).toContain('判定 30 条 · 6900 token · 提示词版本 geo-judge-v1')
    expect(wrapper.text()).toContain('qwen3.7-plus')
    expect(wrapper.text()).toContain('推荐率与情感三档出自提示词版本 geo-judge-v1')
    expect(wrapper.text()).toContain('两版各留各的行')
  })

  it('没勾确认按不动：按钮说的是「请先勾选确认」，点它一次请求都不发', async () => {
    const wrapper = await mountView()
    const button = buttonByText(wrapper, '请先勾选确认')
    expect(button.attributes('disabled')).toBeDefined()
    await button.trigger('click')
    await flushPromises()
    expect(geoCampaignApi.judge).not.toHaveBeenCalled()
  })

  it('勾了确认才发这一发，而且 confirm 恒为 true（后端的第二段点头判的就是它）', async () => {
    const wrapper = await mountView()
    await tickConfirm(wrapper)
    const button = buttonByText(wrapper, '确认并判定这一轮')
    expect(button.attributes('disabled')).toBeUndefined()
    await button.trigger('click')
    await flushPromises()
    expect(geoCampaignApi.judge).toHaveBeenCalledWith(88, true)
    expect(notificationMock.success).toHaveBeenCalled()
    wrapper.unmount()
  })

  it('提问还在跑的那一轮判定按不动：半批判出来的推荐率没有分母可解释', async () => {
    const wrapper = await mountView({
      run: { ...report().run, status: 'RUNNING', progress: 40, stageText: '正在问第 12 / 30 次', finishedAt: null },
    })
    expect(buttonByText(wrapper, '这一轮还在提问，先等它').attributes('disabled')).toBeDefined()
    expect(wrapper.find('.geo-report__judge-hint').text()).toContain('提问那一段还没跑完')
  })

  it('判过了不原地重判：按钮说「这一轮判过了」，出路是新建一轮而不是覆盖上一版判据', async () => {
    const wrapper = await mountView(judged())
    expect(buttonByText(wrapper, '这一轮判过了').attributes('disabled')).toBeDefined()
    const hint = wrapper.find('.geo-report__judge-hint').text()
    expect(hint).toContain('已经按提示词版本 geo-judge-v1 判过 30 条')
    expect(hint).toContain('同一轮不原地重判')
    // 判过之后不必再点头，勾选框摆着只是让人误以为还能花一次钱
    expect(wrapper.find('input[type="checkbox"]').exists()).toBe(false)
  })

  it('判定停着不动：原样念那句原因，并且放行重按（只补缺，不重复扣钱）', async () => {
    const wrapper = await mountView({
      run: {
        ...report().run,
        judgeState: 'JUDGING',
        judgeStateLabel: '判定中',
        judgeStalledReason: '判定已经 18 分钟没有新进度，大概率是被服务重启带断了。',
      },
    })
    expect(wrapper.find('.geo-report__head-stalled').text()).toContain('18 分钟没有新进度')
    await tickConfirm(wrapper)
    const button = buttonByText(wrapper, '确认并判定这一轮')
    expect(button.attributes('disabled')).toBeUndefined()
    expect(wrapper.find('.geo-report__judge-hint').text()).toContain('只补还缺的那几条')
  })

  it('上一回判定失败：按钮照样放行，念的是「修好配置再按一次，提问一次都不会重跑」', async () => {
    const wrapper = await mountView({
      run: {
        ...report().run,
        judgeState: 'FAILED',
        judgeStateLabel: '判定失败',
        judgeErrorMessage: '默认对话模型那一行已经被停用，判定发不出去。',
      },
    })
    await tickConfirm(wrapper)
    expect(buttonByText(wrapper, '确认并判定这一轮').attributes('disabled')).toBeUndefined()
    expect(wrapper.find('.geo-report__judge-hint').text()).toContain('提问那一段一次都不会重跑')
    expect(wrapper.find('.geo-report__judge-error').text()).toContain('默认对话模型那一行已经被停用')
  })

  it('一次成功回答都没有的轮次不受理判定：按钮说「没有可判的回答」，hint 指向重跑提问', async () => {
    const wrapper = await mountView({
      run: { ...report().run, callCount: 0, failedCallCount: 30 },
      failedCallCount: 30,
      mentionRate: [],
      recommendRate: [],
    })
    expect(buttonByText(wrapper, '这一轮没有可判的回答').attributes('disabled')).toBeDefined()
    expect(wrapper.find('.geo-report__judge-hint').text()).toContain('先重跑提问')
  })

  it('后端拒的时候念的是它那一句，不改写成「操作失败」，页面上的账也不动', async () => {
    vi.mocked(geoCampaignApi.judge).mockRejectedValue(
      new Error('这一轮的判定正在跑（GEO_JUDGE_IN_FLIGHT）：两次判定抢同一批回答，第二笔钱不在任何预估里。'),
    )
    const wrapper = await mountView()
    await tickConfirm(wrapper)
    await buttonByText(wrapper, '确认并判定这一轮').trigger('click')
    await flushPromises()
    const described = JSON.stringify(notificationMock.error.mock.calls)
    expect(described).toContain('两次判定抢同一批回答')
    expect(described).not.toContain('操作失败')
    expect(wrapper.findAll('.tag-stub')[1].text()).toBe('未判定')
  })

  it('另有 N 条没过四道校验：说清它不进分子但照样在分母里，并且点得开明细', async () => {
    const wrapper = await mountView(judged({ notMeasuredJudgments: 3 }))
    const line = wrapper.find('.geo-report__head-unmeasured')
    expect(line.text()).toContain('另有 3 条判定没过四道校验')
    expect(line.text()).toContain('不进任何分子，但照样在分母里')
    await buttonByText(wrapper, '判定明细与原文').trigger('click')
    await flushPromises()
    expect(wrapper.find('.drawer-stub').attributes('data-open')).toBe('1')
  })
})

describe('缺口与口径标注（§9.6 + §5 禁令 2）', () => {
  it('三个出口同时存在时各说各的，一个都不省', async () => {
    const wrapper = await mountView({
      failedCallCount: 4,
      run: { ...report().run, failedCallCount: 4 },
      unmeasuredSubjects: ['甲'],
      unmeasuredQuestions: ['哪家便宜'],
    })
    const gaps = wrapper.findAll('.geo-report__gap').map((node: any) => node.text())
    expect(gaps).toHaveLength(3)
    expect(gaps.join(' ')).toContain('4 次未取到回答')
    expect(gaps.join(' ')).toContain('判不了的对象')
    expect(gaps.join(' ')).toContain('判不了的题')
    expect(wrapper.text()).toContain('取到 30 次回答 · 未取到 4 次')
  })

  it('一点缺口都没有时不摆「没测到的部分」那一格：零缺口写成有缺口也是谎报', async () => {
    const wrapper = await mountView()
    expect(wrapper.text()).not.toContain('没测到的部分')
  })

  it('accessChannelNote 用的是接口回的那一句，整页只出现一次', async () => {
    const wrapper = await mountView()
    const occurrences = wrapper.text().split(ACCESS_CHANNEL_NOTE).length - 1
    expect(occurrences).toBe(1)
    expect(geoCampaignApi.vocabulary).toHaveBeenCalled()
  })

  it('没有观测口径的那一格既不摆数字也不摆空壳：指标卡仍只有五张', async () => {
    const wrapper = await mountView()
    const text = wrapper.text()
    expect(text).toContain('既没有它的数字也没有它的空格')
    expect(wrapper.findAll('.geo-report__card[data-card]')).toHaveLength(5)
    expect(text).not.toContain('引用链接率：')
  })

  it('§5 禁令：整页没有「排名」那个字，位置只认词表给的那句叫法', async () => {
    const wrapper = await mountView(judged())
    expect(wrapper.text()).not.toContain('排名')
  })

  it('页脚交代数从哪来：取自快照表，不是这一页现算的', async () => {
    const wrapper = await mountView()
    expect(wrapper.text()).toContain('geo_metric_snapshot')
    expect(wrapper.text()).toContain('2026-09-29 10:07')
  })
})

describe('轮次还在跑时的报告页', () => {
  it('RUNNING：进度条 + 「下面这些数字是已经落库的部分」，不装作这一轮跑完了', async () => {
    const wrapper = await mountView({
      run: { ...report().run, status: 'RUNNING', progress: 40, stageText: '正在问第 12 / 30 次', finishedAt: null },
    })
    expect(wrapper.find('.progress-stub').attributes('data-percent')).toBe('40')
    expect(wrapper.text()).toContain('正在问第 12 / 30 次')
    expect(wrapper.text()).toContain('这一轮还没跑完')
    // 状态中文来自词表
    expect(wrapper.find('.tag-stub').text()).toBe('诊断中')
  })

  it('轮次 id 没带上：说清是地址的问题，不发请求也不演一张空报告', async () => {
    const wrapper = mount(GeoCampaignReportView, {
      props: { runId: null },
      global: { stubs: { 'a-tag': TAG_STUB, 'a-progress': PROGRESS_STUB, GeoJudgmentDrawer: DRAWER_STUB } },
    })
    await flushPromises()
    expect(wrapper.text()).toContain('报告地址不完整')
    expect(geoCampaignApi.getReport).not.toHaveBeenCalled()
  })

  it('换轮次 id 会重读并清掉上一轮的错：把旧错误挂在新一页上是谎报', async () => {
    vi.mocked(geoCampaignApi.getReport)
      .mockRejectedValueOnce(new Error('这一轮不属于当前租户（GEO_CAMPAIGN_NOT_FOUND）'))
      .mockResolvedValueOnce(report() as never)
    const wrapper = mount(GeoCampaignReportView, {
      props: { runId: 88 },
      global: { stubs: baseStubs() },
    })
    await flushPromises()
    expect(wrapper.text()).toContain('这一轮不属于当前租户')
    await wrapper.setProps({ runId: 89 })
    await flushPromises()
    expect(geoCampaignApi.getReport).toHaveBeenCalledTimes(2)
    expect(wrapper.text()).not.toContain('这一轮不属于当前租户')
    expect(wrapper.text()).toContain('轮次 88')
  })

  it('停着不动的那一轮：报告页头念出那句原因，而状态词还是「诊断中」一个字没改（#108）', async () => {
    const wrapper = await mountView({
      run: {
        ...report().run,
        status: 'RUNNING',
        progress: 40,
        finishedAt: null,
        stalledReason: '这一轮已经 22 分钟没有新进度，大概率是被服务重启带断了。这里不替它改状态——但可以现在直接再起一轮。',
      },
    })
    expect(wrapper.find('.tag-stub').text()).toBe('诊断中')
    expect(wrapper.find('.geo-report__head-stalled').text()).toContain('22 分钟没有新进度')
    expect(wrapper.find('.geo-report__head-stalled').text()).toContain('再起一轮')
  })
})

describe('SOV 按当前勾选重算（§11.3：分母随勾选走，且这一发不花钱）', () => {
  it('按下去只发 recalculateSov 这一发，页面换成重算回来的那份账', async () => {
    vi.mocked(geoCampaignApi.recalculateSov).mockResolvedValue(report({
      sovShare: [
        metricRow({ id: 3, metric: 'sov_share', definition: SOV_DEF, subject: '纳欣口腔', numerator: 9, denominator: 21, value: 0.4286 }),
        metricRow({ id: 4, metric: 'sov_share', definition: SOV_DEF, scope: 'COMPETITOR', subject: '同行甲', numerator: 4, denominator: 21, value: 0.1905 }),
        metricRow({ id: 6, metric: 'sov_share', definition: SOV_DEF, scope: 'COMPETITOR', subject: '同行乙', numerator: 8, denominator: 21, value: 0.381 }),
      ],
    }) as never)
    const wrapper = await mountView()
    await buttonByText(wrapper, '按当前勾选重算份额').trigger('click')
    await flushPromises()
    expect(geoCampaignApi.recalculateSov).toHaveBeenCalledWith(88)
    expect(geoCampaignApi.getReport).toHaveBeenCalledTimes(1)
    // 重算回来的那份直接进表：分母从 15 变 21，三家并列
    expect(rowsOfCard(wrapper, 'sov')).toHaveLength(3)
    expect(rowsOfCard(wrapper, 'sov')[0]).toContain('9 / 21')
    expect(wrapper.text()).toContain('勾选参与对比的竞品被提及次数之和')
    // 这一发不花钱也不碰判定那两卡：提及率与推荐率的行一个字没动
    expect(rowsOfCard(wrapper, 'mention')).toHaveLength(2)
    expect(rowsOfCard(wrapper, 'recommend')).toHaveLength(2)
    expect(geoCampaignApi.judge).not.toHaveBeenCalled()
  })

  it('重算不改情感与推荐率：那两卡是语义判定的产物，走的是另一发花钱的动作', async () => {
    const wrapper = await mountView()
    await buttonByText(wrapper, '按当前勾选重算份额').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('一次模型都不调用，也不会新增轮次')
    expect(wrapper.text()).toContain('情感与推荐率不走这条路')
  })

  it('后端拒的时候念的是它那一句，不改写成「操作失败」', async () => {
    vi.mocked(geoCampaignApi.recalculateSov).mockRejectedValue(
      new Error('这一轮一次成功的回答都没取到，SOV 算不出来：先看上面「未取到」那一格。'),
    )
    const wrapper = await mountView()
    await buttonByText(wrapper, '按当前勾选重算份额').trigger('click')
    await flushPromises()
    expect(notificationMock.error).toHaveBeenCalled()
    const described = JSON.stringify(notificationMock.error.mock.calls)
    expect(described).toContain('一次成功的回答都没取到')
    expect(described).not.toContain('操作失败')
    // 拒了就不许把旧账说成新的：页面还是原来那份
    expect(rowsOfCard(wrapper, 'sov')).toHaveLength(2)
    expect(rowsOfCard(wrapper, 'sov')[0]).toContain('9 / 15')
  })

  it('还在跑的那一轮重算是按不动的：半轮回答算出来的份额不是任何一批题的份额', async () => {
    const wrapper = await mountView({
      run: { ...report().run, status: 'RUNNING', progress: 40, stageText: '正在问第 12 / 30 次', finishedAt: null },
    })
    const button = buttonByText(wrapper, '按当前勾选重算份额')
    expect(button.attributes('disabled')).toBeDefined()
    expect(wrapper.find('.geo-report__sov-hint').text()).toContain('跑完才能重算')
    await button.trigger('click')
    await flushPromises()
    expect(geoCampaignApi.recalculateSov).not.toHaveBeenCalled()
  })

  it('一家竞品都没勾所以没有 SOV 行时，这一发照样摆着——出路是重算，不是再花钱跑一轮', async () => {
    const wrapper = await mountView({ sovShare: [] })
    expect(wrapper.text()).toContain('然后按下面那一发「按当前勾选重算份额」')
    const button = buttonByText(wrapper, '按当前勾选重算份额')
    expect(button.attributes('disabled')).toBeUndefined()
    expect(wrapper.text()).toContain('一次模型都不调用')
  })
})

describe('机会问题那一卡挂上了（§10-6 的入口）', () => {
  it('报告把当前轮次与词表交给机会清单面板，而不是自己抄一份清单', async () => {
    const wrapper = await mountView()
    const panel = wrapper.find('.opp-panel-stub')
    expect(panel.exists()).toBe(true)
    expect(panel.attributes('data-run-id')).toBe('88')
  })

  it('覆盖率卡里那句话说的是「下面那一卡」，不再承诺「排在下一期」', async () => {
    const wrapper = await mountView()
    const note = cardOf(wrapper, 'coverage').find('.geo-report__card-note').text()
    expect(note).toContain('机会问题')
    expect(note).not.toContain('下一期')
  })
})
