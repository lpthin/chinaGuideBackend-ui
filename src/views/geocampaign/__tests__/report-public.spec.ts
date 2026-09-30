import { beforeEach, describe, it, expect, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { Button, Checkbox, Input } from 'ant-design-vue'
import GeoCampaignReportView from '../GeoCampaignReportView.vue'
import GeoJudgmentDrawer from '../GeoJudgmentDrawer.vue'
import GeoReportPublicView from '../GeoReportPublicView.vue'
import { geoCampaignApi } from '../../../api/geoCampaign'
import type { GeoAnswerTrace, GeoJudgment, GeoReport, GeoVocabulary } from '../../../api/geoCampaign'

/**
 * 诊断报告的只读外链（Spec-G G6 的访客侧，任务 #158 的前端那一半）。
 *
 * 这一族用例只钉一条原则：<b>「登录态读」与「令牌读」共用同一份形状，公开那一侧一个写动作都没有</b>。
 * 具体拆成五条：
 * 1. 带令牌时页面只打 `/api/geo/public/{令牌}/...` 那几个 GET，`geoCampaignApi` 那一条路一次都不碰
 *    ——碰了就是拿访客的身份去敲管理面，后端会用 401/403 回你，界面等于把客户链接变成错误页；
 * 2. 「判定这一轮」「按当前勾选重算份额」「一键成内容」「发/撤链接」四块在公开态<em>不存在</em>，
 *    而且页面把「为什么没有」念出来（§9.6：不让人猜这一屏是不是坏了）；
 * 3. 溯源抽屉走同一条岔口：客户点得开原文，读的是公开那六个 GET；
 * 4. 读不到时念的是后端那一句「链接无效或已过期」，界面不替它区分「过期」与「不存在」
 *    ——一分就把这一页变成有效令牌探测器；
 * 5. 没令牌时（登录态）一切照旧：这一发同时是「G6 没把原来的报告页改坏」的回归。
 *
 * 一处有意的偏差要写在这里：发链接那一块挂在<b>报告页头部</b>（`GeoReportLinkPanel`），
 * 不是工作台那一排的轮次行。理由是「给客户看的是这一轮的账」——发与撤的上下文就是这一轮的报告，
 * 摆在轮次列表上会让人以为链接开的是整个工作台。
 *
 * `useRoute` 给替件、`notification` 给替件、api 层给替件（http 换成记录 URL 的替身），
 * 组件（Button/Input/StateBlock/PageShell/抽屉本体）用真的——替件按不动的按钮测出来的是假绿。
 */

const httpMock = vi.hoisted(() => ({
  get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(),
}))

vi.mock('../../../api/http', () => ({
  default: httpMock,
  AI_REQUEST_TIMEOUT: 180000,
  describeHttpError: (e: unknown) => String(e instanceof Error ? e.message : e),
}))

const routeMock = vi.hoisted(() => ({ params: {} as Record<string, string>, query: {} as Record<string, string> }))

vi.mock('vue-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-router')>()
  return { ...actual, useRoute: () => routeMock }
})

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
      getReport: vi.fn(), vocabulary: vi.fn(), recalculateSov: vi.fn(), judge: vi.fn(),
      judgments: vi.fn(), answer: vi.fn(), opportunities: vi.fn(),
      issueReportLink: vi.fn(), reportLinks: vi.fn(), revokeReportLink: vi.fn(),
    },
  }
})

const TOKEN = 'b'.repeat(64)
const PUBLIC = `/geo/public/${TOKEN}`

const VOCABULARY = {
  runStatuses: {}, metrics: {}, metricDefinitions: {}, confirmStates: {}, judgeStates: {},
  prominences: {}, prominenceDefinitions: {}, positionLabel: '在推荐清单里的第几项',
  sentiments: {}, sentimentDefinitions: {}, accessChannelNote: '本轮口径=API 问答',
} satisfies GeoVocabulary

/** 公开口回的报告：五个数都先给空表，本页只验形状与口子，卡的渲染有 report-view.spec 那一整份 */
function publicReport(): GeoReport {
  return {
    run: {
      id: 88, campaignId: 12, tenantId: 15, brandProfileId: 7, siteId: 3,
      status: 'SUCCEEDED', statusLabel: 'SUCCEEDED', stageText: null, progress: 100,
      accessChannel: 'API', questionCount: 4, platformCount: 1, repeatTimes: 1,
      callCount: 4, failedCallCount: 0, promptTokens: 100, completionTokens: 200,
      errorMessage: null, stalledReason: null, queuedReason: null, queueAhead: null,
      // 故意给「判过之前」那一态：登录态下这一屏本来摆得出「判定这一轮」那一发与勾选框，
      // 公开态把它们全摘掉才测得出来——DONE 那一态下两边都不摆，断言就成了空跑
      judgeState: null, judgeStateLabel: null, judgeCallCount: 0,
      judgePromptTokens: null, judgeCompletionTokens: null, judgePromptVersion: null,
      judgeErrorMessage: null, judgeStalledReason: null, firstAskAt: null,
      startedAt: '2026-10-01T09:00:00', finishedAt: '2026-10-01T09:20:00',
      createdBy: 't15_admin', createdAt: '2026-10-01T09:00:00',
    },
    platforms: ['千问'],
    mentionRate: [], recommendRate: [], sovShare: [], sentimentShare: [],
    promptCoverage: null,
    callCount: 4, failedCallCount: 0, unmeasuredSubjects: [], unmeasuredQuestions: [],
    accessChannelNote: '本轮口径=API 问答',
    judgePromptVersion: 'geo-judge-v1', judgeModelLabel: 'qwen3.7-plus',
    notMeasuredJudgments: 0, generatedAt: '2026-10-01T09:20:00',
  }
}

function judgmentRow(): GeoJudgment {
  return {
    id: 501, callId: 9001, scope: 'BRAND', subjectId: 7, subject: '纳欣口腔',
    prominence: 'RECOMMENDED', prominenceLabel: '接口给的档位', positionRank: 2,
    positionLabel: '在推荐清单里的第几项', sentiment: 'POS', sentimentLabel: '接口给的情感',
    sentimentReason: '原文里说它便宜又正规', evidenceQuote: '纳欣口腔价格透明',
    matchedText: '纳欣口腔', judgeModelId: 11, judgePromptVersion: 'geo-judge-v1',
    notMeasuredReason: null, createdAt: '2026-10-01T09:10:00',
  }
}

const DRAWER_STUB = {
  name: 'ADrawer',
  props: ['open', 'title', 'width', 'placement'],
  template: '<div class="drawer-stub" :data-open="open ? \'1\' : \'0\'"><i class="drawer-title">{{ title }}</i><slot /></div>',
}

/** 报告页挂没挂上抽屉、传的是令牌还是轮次号，是这一族要钉的形状；抽屉自己的渲染有它自己的用例 */
const DRAWER_RECORD_STUB = {
  name: 'GeoJudgmentDrawer',
  props: ['open', 'runId', 'token', 'vocabulary'],
  template: '<div class="drawer-stub" :data-token="token" :data-run-id="runId" />',
}

const PANEL_RECORD_STUB = {
  name: 'GeoReportLinkPanel',
  props: ['runId'],
  template: '<div class="link-panel-stub" :data-run-id="runId" />',
}

const OPPORTUNITY_PANEL_STUB = {
  name: 'GeoOpportunityPanel',
  props: ['runId', 'vocabulary'],
  template: '<div class="opp-panel-stub" :data-run-id="runId" />',
}

function reportStubs() {
  return {
    'a-button': Button,
    'a-input': Input,
    'a-checkbox': Checkbox,
    GeoJudgmentDrawer: DRAWER_RECORD_STUB,
    GeoReportLinkPanel: PANEL_RECORD_STUB,
    GeoOpportunityPanel: OPPORTUNITY_PANEL_STUB,
  }
}

function buttonsByText(wrapper: ReturnType<typeof mount>, text: string) {
  const target = text.replace(/\s+/g, '')
  return wrapper.findAll('button').filter((node: any) => (node.text() || '').replace(/\s+/g, '') === target)
}

function publicGetUrls(): string[] {
  return httpMock.get.mock.calls.map((call) => String(call[0]))
}

async function mountPublic(props: Record<string, unknown> = {}) {
  const wrapper = mount(GeoCampaignReportView, {
    props: { token: TOKEN, ...props },
    global: { stubs: reportStubs() },
  })
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  vi.clearAllMocks()
  routeMock.params = {}
  routeMock.query = {}
  httpMock.get.mockImplementation((url: string) => {
    if (String(url).endsWith('/report')) return Promise.resolve(publicReport())
    if (String(url).endsWith('/vocabulary')) return Promise.resolve(VOCABULARY)
    if (String(url).endsWith('/judgments')) return Promise.resolve([judgmentRow()])
    if (String(url).endsWith('/context')) return Promise.resolve({ runId: 88, expiresAt: '2026-10-15T10:00:00' })
    if (String(url).includes('/answer/')) {
      return Promise.resolve({
        callId: 9001, modelConfigId: 11, modelName: 'qwen3.7-plus', provider: '阿里云',
        questionText: '宁波哪家牙科便宜又正规', questionKind: 'TRACKED', sampleSeq: 1,
        createdAt: '2026-10-01T09:05:00', answerText: '在宁波可以看看纳欣口腔，价格透明。',
        judgments: [judgmentRow()],
      })
    }
    return Promise.resolve({})
  })
  vi.mocked(geoCampaignApi.getReport).mockResolvedValue(publicReport() as never)
  vi.mocked(geoCampaignApi.vocabulary).mockResolvedValue(VOCABULARY as never)
})

describe('带令牌时：这一屏只敲公开那六个 GET', () => {
  it('报告与词表都从 /geo/public/{令牌}/... 读，管理面一次都没碰', async () => {
    await mountPublic()
    expect(publicGetUrls()).toEqual([`${PUBLIC}/report`, `${PUBLIC}/vocabulary`])
    expect(geoCampaignApi.getReport).not.toHaveBeenCalled()
    expect(geoCampaignApi.vocabulary).not.toHaveBeenCalled()
    expect(httpMock.post.mock.calls).toHaveLength(0)
    expect(httpMock.put.mock.calls).toHaveLength(0)
    expect(httpMock.delete.mock.calls).toHaveLength(0)
  })

  it('地址里没有轮次号这个位置：读哪一轮是令牌说的', async () => {
    await mountPublic()
    for (const url of publicGetUrls()) {
      expect(url.startsWith(PUBLIC)).toBe(true)
      expect(url).not.toContain('runId')
      expect(url).not.toContain('88')
    }
  })

  it('数字照样看得见：五个卡的空态、口径那句免责、落库时刻都在', async () => {
    const wrapper = await mountPublic()
    expect(wrapper.text()).toContain('轮次 88')
    expect(wrapper.text()).toContain('本轮口径=API 问答')
    expect(wrapper.text()).toContain('本轮数字落库于')
    expect(wrapper.text()).toContain('AI 品牌提及（分平台）')
  })
})

describe('公开态一个写入口都不摆，并把「为什么没有」念出来', () => {
  it('判定那一发与勾选框都不在，给的是那句「这一屏是只读的」', async () => {
    const wrapper = await mountPublic()
    expect(wrapper.find('.geo-report__judge-confirm').exists()).toBe(false)
    expect(buttonsByText(wrapper, '判定明细与原文')).toHaveLength(1)
    expect(wrapper.find('.geo-report__judge-hint').text()).toContain('这一屏是只读的')
    // 同一份数据在登录态下摆得出「请先勾选确认」那一发（下面那组回归用例钉着），这里必须是 0 个
    expect(buttonsByText(wrapper, '请先勾选确认')).toHaveLength(0)
    expect(buttonsByText(wrapper, '确认并判定这一轮')).toHaveLength(0)
    expect(geoCampaignApi.judge).not.toHaveBeenCalled()
  })

  it('SOV 那一发改成一句说明：外链只有读数，没有重算那一发', async () => {
    const wrapper = await mountPublic()
    expect(wrapper.find('.geo-report__sov-action').exists()).toBe(false)
    expect(buttonsByText(wrapper, '按当前勾选重算份额')).toHaveLength(0)
    expect(wrapper.text()).toContain('外链这一侧只有读数')
  })

  it('发链接那一块不在：谁能把这一轮的账再暴露一次，不由拿链接的人决定', async () => {
    const wrapper = await mountPublic()
    expect(wrapper.findComponent(PANEL_RECORD_STUB).exists()).toBe(false)
    expect(geoCampaignApi.reportLinks).not.toHaveBeenCalled()
    expect(geoCampaignApi.issueReportLink).not.toHaveBeenCalled()
  })

  it('机会清单换成「这一屏之外的那些动作」那一卡：四个动作都不在外链上', async () => {
    const wrapper = await mountPublic()
    expect(wrapper.findComponent(OPPORTUNITY_PANEL_STUB).exists()).toBe(false)
    expect(wrapper.find('.geo-report__card[data-card="share-note"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('一键成内容')
    expect(geoCampaignApi.opportunities).not.toHaveBeenCalled()
  })
})

describe('溯源抽屉在令牌下走同一条岔口', () => {
  it('报告页把令牌传给抽屉，传的不是轮次号', async () => {
    const wrapper = await mountPublic()
    const drawer = wrapper.find('.drawer-stub')
    expect(drawer.attributes('data-token')).toBe(TOKEN)
  })

  it('抽屉读原文：走公开口，不碰 /geo/campaign/...', async () => {
    const wrapper = mount(GeoJudgmentDrawer, {
      props: { open: true, runId: null, token: TOKEN, vocabulary: VOCABULARY },
      global: { stubs: { 'a-drawer': DRAWER_STUB, 'a-button': Button } },
    })
    await flushPromises()
    expect(publicGetUrls()).toContain(`${PUBLIC}/judgments`)
    expect(geoCampaignApi.judgments).not.toHaveBeenCalled()

    await buttonsByText(wrapper, '看原文')[0].trigger('click')
    await flushPromises()
    expect(publicGetUrls()).toContain(`${PUBLIC}/answer/9001`)
    expect(geoCampaignApi.answer).not.toHaveBeenCalled()
    expect(wrapper.find('.geo-trace__answer-body').text()).toContain('纳欣口腔')
  })

  it('抽屉里的公开口失败：原样念后端那一句，不写成「加载失败」', async () => {
    httpMock.get.mockImplementation((url: string) =>
      String(url).endsWith('/judgments')
        ? Promise.reject(new Error('链接无效或已过期'))
        : Promise.resolve(VOCABULARY))
    const wrapper = mount(GeoJudgmentDrawer, {
      props: { open: true, runId: null, token: TOKEN, vocabulary: VOCABULARY },
      global: { stubs: { 'a-drawer': DRAWER_STUB, 'a-button': Button } },
    })
    await flushPromises()
    expect(wrapper.text()).toContain('链接无效或已过期')
  })
})

describe('外链页那一层：令牌从地址里来，读不到就只给那一句', () => {
  async function mountPublicPage() {
    const wrapper = mount(GeoReportPublicView, { global: { stubs: reportStubs() } })
    await flushPromises()
    return wrapper
  }

  it('路径里的令牌既是顶栏那一发的凭据，也是报告本体的凭据', async () => {
    routeMock.params = { token: TOKEN }
    const wrapper = await mountPublicPage()
    expect(httpMock.get).toHaveBeenCalledWith(`${PUBLIC}/context`)
    expect(wrapper.text()).toContain('轮次 88')
    expect(wrapper.text()).toContain('本链接到')
    expect(wrapper.find('.drawer-stub').attributes('data-token')).toBe(TOKEN)
  })

  it('时区那句只念一次：formatDateTimeWithZone 自己带了标注，模板再拼一遍就是现场那句重复', async () => {
    // 现场读数在 scratch/p6g-live/：只读外链顶栏直出过
    // 「本链接到 2026-10-15 05:40（北京时间 UTC+8）（北京时间 UTC+8）失效」
    routeMock.params = { token: TOKEN }
    const wrapper = await mountPublicPage()
    const until = wrapper.find('.geo-public__until').text()
    expect(until.match(/北京时间 UTC\+8/g)?.length).toBe(1)
    // 但一句都不许少：G8 的判据是「这串数字是哪个时区」必须写在页面上
    expect(until).toContain('北京时间 UTC+8')
    expect(until).toContain('2026-10-15')
  })

  it('顶栏读不出到期时刻时，报告本体照旧显示：两发各读各的', async () => {
    routeMock.params = { token: TOKEN }
    httpMock.get.mockImplementation((url: string) =>
      String(url).endsWith('/context')
        ? Promise.reject(new Error('链接无效或已过期'))
        : (String(url).endsWith('/report')
          ? Promise.resolve(publicReport())
          : Promise.resolve(VOCABULARY)))
    const wrapper = await mountPublicPage()
    expect(wrapper.text()).toContain('链接无效或已过期')
    expect(wrapper.find('.geo-public__until').exists()).toBe(false)
    expect(wrapper.text()).toContain('AI 品牌提及（分平台）')
  })

  it('地址里没有令牌：不发请求，说的是「链接里没有凭证」', async () => {
    routeMock.params = { token: '' }
    const wrapper = await mountPublicPage()
    expect(httpMock.get.mock.calls).toHaveLength(0)
    expect(wrapper.text()).toContain('链接里没有凭证')
    expect(wrapper.find('.geo-public__empty').exists()).toBe(true)
  })

  it('手抄链接把令牌贴在查询串上也认：白看一次「没有凭证」没有意义', async () => {
    routeMock.params = { token: '' }
    routeMock.query = { token: TOKEN }
    await mountPublicPage()
    expect(httpMock.get).toHaveBeenCalledWith(`${PUBLIC}/context`)
  })

  it('报告读不到时念的是后端那一句，界面上没有第二种说法', async () => {
    routeMock.params = { token: TOKEN }
    httpMock.get.mockImplementation((url: string) =>
      String(url).endsWith('/report')
        ? Promise.reject(new Error('链接无效或已过期'))
        : Promise.resolve(VOCABULARY))
    const wrapper = await mountPublicPage()
    const text = wrapper.text()
    expect(text).toContain('链接无效或已过期')
    // 「过期了」「不存在」「被人改过作用域」三种说法一个都不许出现：一分就成了有效令牌探测器
    expect(text).not.toContain('已过期，请')
    expect(text).not.toContain('不存在')
  })
})

describe('登录态那一条路没被 G6 改坏', () => {
  it('没令牌时照旧按 runId 走 /geo/campaign/...，发链接那一块也挂得上', async () => {
    const wrapper = mount(GeoCampaignReportView, {
      props: { runId: 88 },
      global: { stubs: reportStubs() },
    })
    await flushPromises()
    expect(geoCampaignApi.getReport).toHaveBeenCalledWith(88)
    expect(httpMock.get.mock.calls).toHaveLength(0)
    expect(wrapper.findComponent(PANEL_RECORD_STUB).exists()).toBe(true)
    expect(wrapper.find('.link-panel-stub').attributes('data-run-id')).toBe('88')
    expect(wrapper.findComponent(OPPORTUNITY_PANEL_STUB).exists()).toBe(true)
    // 同一份数据在登录态下：勾选框与那一发都在（第二道闸要真点得动），公开态少的是这两样
    expect(wrapper.find('.geo-report__judge-confirm').exists()).toBe(true)
    expect(buttonsByText(wrapper, '请先勾选确认')).toHaveLength(1)
    expect(buttonsByText(wrapper, '按当前勾选重算份额')).toHaveLength(1)
    expect(wrapper.find('.drawer-stub').attributes('data-run-id')).toBe('88')
  })

  it('地址上两个都没有：说的是「报告地址不完整」而不是发一发空请求', async () => {
    const wrapper = mount(GeoCampaignReportView, { global: { stubs: reportStubs() } })
    await flushPromises()
    expect(httpMock.get.mock.calls).toHaveLength(0)
    expect(geoCampaignApi.getReport).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('报告地址不完整')
    expect(wrapper.text()).toContain('回工作台或向导第⑤步')
  })
})
