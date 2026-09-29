import { describe, it, expect, beforeEach, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import GeoCampaignReportView from '../GeoCampaignReportView.vue'
import { geoCampaignApi } from '../../../api/geoCampaign'
import type { GeoMetricRow, GeoReport } from '../../../api/geoCampaign'

/**
 * 诊断报告前两卡（Spec-F §10-4 的 P2 范围：AI 品牌提及 + 推荐问题覆盖，外加竞品 SOV 那一排）。
 *
 * §5 的三条禁令与 §11.3 的「每个率都点得到分母」在这一屏是看得见的东西，所以逐条钉：
 * 1. **不做跨平台合并总分**——整页文本里不许出现「总分」「综合得分」这类格，也不许把一个加权数
 *    摆在任何卡的标题位；
 * 2. **口径句子来自那一行本身**——喂给两表的 `definition` 各不相同，界面上必须各念各的；
 *    页面自己写一份公式（或给两卡复用同一句）判红；
 * 3. **`value` 为 null 是「未取到」，不是 0%**——同时分子分母照旧显示，缺口那三个出口各说各的；
 * 4. 头部那句 `accessChannelNote` 只出现一次（§5 禁令 2），并且用的就是接口回的那一句。
 *
 * stub 形状照后端 record 抄：`mentionRate` 每个平台一行、`sovShare` 每（平台 × 对象）一行、
 * `promptCoverage` 只有一行且 `modelConfigId` 为 null（覆盖率不分平台，见 GeoMetricCalculator 注释）。
 */

// 只替 useRoute：`api/geoCampaign → http → router/index` 这条链要拿到真的 createRouter，
// 整体替换 vue-router 会让页面在装配阶段就炸（跟本页要测的东西无关）。
vi.mock('vue-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-router')>()
  return { ...actual, useRoute: () => ({ params: {}, query: {} }) }
})

vi.mock('../../../api/geoCampaign', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../api/geoCampaign')>()
  return {
    ...actual,
    geoCampaignApi: { getReport: vi.fn(), vocabulary: vi.fn() },
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

const ACCESS_CHANNEL_NOTE =
  '本轮口径=API 问答：这是我们用配置的模型接口问出来的答案，'
  + '不等于你在豆包/DeepSeek 等 App 里实际看到的答案（那一层的观测本 Spec 未开启）。'

const MENTION_DEF = '该平台这一轮里，提到本品牌的【成功回答数】÷ 该平台成功拿到回答的总次数'
const SOV_DEF = '本品牌被提及次数 ÷（本品牌 + 全部【勾选参与对比】的竞品被提及次数之和）。未勾选的竞品不进分母'
const COVERAGE_DEF = '站内已发布内容对得上这道题的题数 ÷ 本轮问过的追踪题数。分母不是调用次数，所以这一条不分平台'

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
    ...overrides,
  }
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
    sovShare: [
      metricRow({ id: 3, metric: 'sov_share', metricLabel: 'AI SOV', definition: SOV_DEF, subject: '纳欣口腔', numerator: 9, denominator: 15, value: 0.6 }),
      metricRow({ id: 4, metric: 'sov_share', metricLabel: 'AI SOV', definition: SOV_DEF, scope: 'COMPETITOR', subject: '同行甲', numerator: 4, denominator: 15, value: 0.2667 }),
    ],
    promptCoverage: metricRow({
      id: 5, metric: 'prompt_coverage', metricLabel: '问题覆盖率', definition: COVERAGE_DEF,
      modelConfigId: null, modelLabel: null, numerator: 3, denominator: 5, value: 0.6, ciLow: 0.23, ciHigh: 0.88,
    }),
    callCount: 30,
    failedCallCount: 0,
    unmeasuredSubjects: [],
    unmeasuredQuestions: [],
    accessChannelNote: ACCESS_CHANNEL_NOTE,
    generatedAt: '2026-09-29T10:07:00',
    ...overrides,
  }
}

async function mountView(overrides: Partial<GeoReport> = {}) {
  vi.mocked(geoCampaignApi.getReport).mockResolvedValue(report(overrides) as never)
  const wrapper = mount(GeoCampaignReportView, {
    props: { runId: 88 },
    global: {
      stubs: {
        'a-tag': TAG_STUB,
        'a-progress': PROGRESS_STUB,
        'a-button': { name: 'AButton', props: ['disabled', 'type', 'size'], emits: ['click'], template: '<button><slot /></button>' },
      },
    },
  })
  await flushPromises()
  return wrapper
}

function rowsOf(wrapper: ReturnType<typeof mount>, index: number) {
  const tables = wrapper.findAll('.geo-report__table')
  if (!tables[index]) throw new Error(`找不到第 ${index + 1} 张表`)
  return tables[index].findAll('tbody tr').map((row: any) => row.text())
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(geoCampaignApi.vocabulary).mockResolvedValue({
    runStatuses: { PENDING: '排队中', RUNNING: '诊断中', SUCCEEDED: '已完成', PARTIAL: '部分完成', FAILED: '失败' },
    metrics: {},
    metricDefinitions: {},
    confirmStates: {},
    accessChannelNote: ACCESS_CHANNEL_NOTE,
  } as never)
})

describe('卡一：AI 品牌提及（分平台，不做合并）', () => {
  it('每个平台一行，率旁边带着自己的分子分母与 95% 区间', async () => {
    const wrapper = await mountView()
    const rows = rowsOf(wrapper, 0)
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
    expect(rowsOf(wrapper, 0)).toHaveLength(2)
  })

  it('口径句子逐行取自那一行自己：提及率那一句不会跑到覆盖率格子里', async () => {
    const wrapper = await mountView()
    expect(rowsOf(wrapper, 0)[0]).toContain('该平台成功拿到回答的总次数')
    expect(rowsOf(wrapper, 1)[0]).toContain('分母不是调用次数')
    expect(rowsOf(wrapper, 2)[0]).toContain('未勾选的竞品不进分母')
  })

  it('value 为 null 的那一行显示「未取到」，但分母照样念得出来', async () => {
    const wrapper = await mountView({
      mentionRate: [metricRow({ id: 9, numerator: 0, denominator: 0, value: null, ciLow: null, ciHigh: null })],
    })
    const row = rowsOf(wrapper, 0)[0]
    expect(row).toContain('未取到')
    expect(row).not.toContain('0.0%')
    expect(row).toContain('0 / 0')
    // 区间没算过就不凭空出现 ±
    expect(row).toContain('—')
  })
})

describe('卡二：推荐问题覆盖（覆盖 ≠ 被引用）', () => {
  it('一行给率、分子分母、未覆盖几道，并写明它与「被引用」是两条指标', async () => {
    const wrapper = await mountView()
    const row = rowsOf(wrapper, 1)[0]
    expect(row).toContain('60.0%')
    expect(row).toContain('3 / 5')
    expect(row).toContain('2 道')
    expect(wrapper.text()).toContain('覆盖」= 站内有内容对得上这道题，与「被 AI 引用」是两条指标')
  })

  it('coverage 为 null（全轮判不了题）：说不「没有可判的题」和出路，不摆一张空表', async () => {
    const wrapper = await mountView({ promptCoverage: null })
    const text = wrapper.text()
    expect(text).toContain('这一轮没有可判的题')
    expect(text).toContain('先在题池里补核心词')
    expect(wrapper.findAll('.geo-report__table')).toHaveLength(2)
  })
})

describe('SOV：共用分母这件事必须写在脸上', () => {
  it('本品牌与竞品同平台并列，份额合起来 100% 的解释在卡底', async () => {
    const wrapper = await mountView()
    const rows = rowsOf(wrapper, 2)
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

  it('本期只有两卡：推荐率与情感既不摆数字也不摆空壳', async () => {
    const wrapper = await mountView()
    const text = wrapper.text()
    expect(text).toContain('推荐率与情感三档')
    expect(text).toContain('既没有它们的数字也没有它们的空格')
    expect(text).not.toContain('情感三档：')
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
      global: { stubs: { 'a-tag': TAG_STUB, 'a-progress': PROGRESS_STUB } },
    })
    await flushPromises()
    expect(wrapper.text()).toContain('报告地址不完整')
    expect(geoCampaignApi.getReport).not.toHaveBeenCalled()
  })
})
