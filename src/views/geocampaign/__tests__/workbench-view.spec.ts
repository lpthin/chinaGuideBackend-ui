import { describe, it, expect, beforeEach, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import GeoCampaignWorkbenchView from '../GeoCampaignWorkbenchView.vue'
import { geoCampaignApi, type GeoCampaign } from '../../../api/geoCampaign'
import { geoBrandApi } from '../../../api/geoBrand'
import { siteApi } from '../../../api/workspace'

/**
 * GEO 诊断工作台（Spec-F §10-1，P2）。
 *
 * 这一页刻意做的两件事比它做的任何事都好测，所以钉死：
 * 1. **不在这里起跑**：「跑新一轮」是一次跳转（去向导第⑤步），整页找不到能发 `POST /run` 的控件；
 * 2. **没有总分格**：账目列只有「问什么形状 / 确认态 / 最近一轮」，一个合并分都不摆。
 *
 * 其余是「不许谎报」那几条：没档案 = 第①步入口而不是空白页；
 * 最近几轮每个计划只报它自己那一条；没跑过的计划说「还没跑过一轮」，不显示 0 轮。
 */

const pushSpy = vi.hoisted(() => vi.fn())

// 只替 useRouter：`api/geoCampaign → http → router/index` 这条链要拿到真的 createRouter，
// 整体替换 vue-router 会在装配阶段就炸，跟本页要验的东西无关。
vi.mock('vue-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-router')>()
  return { ...actual, useRouter: () => ({ push: pushSpy }) }
})

vi.mock('ant-design-vue', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('ant-design-vue')
  return { ...actual, notification: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() } }
})

vi.mock('../../../api/workspace', () => ({
  siteApi: { list: vi.fn() },
}))

vi.mock('../../../api/geoBrand', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../api/geoBrand')>()
  return { ...actual, geoBrandApi: { listProfiles: vi.fn() } }
})

vi.mock('../../../api/geoCampaign', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../api/geoCampaign')>()
  return {
    ...actual,
    geoCampaignApi: {
      vocabulary: vi.fn(),
      listCampaigns: vi.fn(),
      estimate: vi.fn(),
      runs: vi.fn(),
      run: vi.fn(),
    },
  }
})

const TABLE_STUB = {
  name: 'ATable',
  props: {
    dataSource: { type: Array, default: () => [] },
    columns: { type: Array, default: () => [] },
    pagination: { type: Object, default: undefined },
  },
  template: `
    <div class="table-stub">
      <div v-for="record in dataSource" :key="record.id" class="row">
        <template v-for="column in columns" :key="column.key">
          <slot v-if="$slots.bodyCell" name="bodyCell" :column="column" :record="record" />
        </template>
      </div>
    </div>`,
}

const TAG_STUB = {
  name: 'ATag',
  props: ['color'],
  template: '<span class="tag-stub" :data-color="color"><slot /></span>',
}

const BUTTON_STUB = {
  name: 'AButton',
  props: ['disabled', 'type', 'size', 'loading'],
  emits: ['click'],
  template: '<button class="btn" :disabled="disabled" @click="$emit(\'click\')"><slot /></button>',
}

const SELECT_STUB = {
  name: 'ASelect',
  props: ['value', 'options', 'placeholder'],
  emits: ['update:value'],
  template: '<div class="select-stub"><button v-for="opt in options" :key="String(opt.value)" class="select-option" @click="$emit(\'update:value\', opt.value)">{{ opt.label }}</button></div>',
}

function stubs() {
  return {
    'a-table': TABLE_STUB,
    'a-tag': TAG_STUB,
    'a-button': BUTTON_STUB,
    'a-select': SELECT_STUB,
    // percent 得落到 data- 上：进度条画没画、画的是百分之几，是这一页唯一看得见的进度
    'a-progress': { name: 'AProgress', props: ['percent'], template: '<i class="progress-stub" :data-percent="percent" />' },
  }
}

function campaign(overrides: Partial<GeoCampaign> = {}): GeoCampaign {
  const latestRun = overrides.latestRun
  return {
    id: 12,
    tenantId: 1,
    siteId: 3,
    brandProfileId: 7,
    name: '牙科一期',
    platformIds: [4],
    questionIds: [],
    questionCount: 5,
    platformCount: 2,
    repeatTimes: 3,
    costEstimateCalls: 30,
    costEstimateTokens: 42000,
    confirmState: 'PENDING_CONFIRM',
    confirmStateLabel: '待确认',
    wizardState: null,
    note: null,
    createdBy: 'admin',
    createdAt: '2026-09-29T10:00:00',
    updatedAt: null,
    latestRun: latestRun === undefined
      ? {
        id: 88, campaignId: 12, tenantId: 1, brandProfileId: 7, siteId: 3,
        status: 'SUCCEEDED', statusLabel: 'SUCCEEDED', stageText: null, progress: 100,
        accessChannel: 'Web API', questionCount: 5, platformCount: 2, repeatTimes: 3,
        callCount: 30, failedCallCount: 0, promptTokens: 2000, completionTokens: 800,
        errorMessage: null, stalledReason: null,
        judgeState: null, judgeStateLabel: '未判定', judgeCallCount: null,
        judgePromptTokens: null, judgeCompletionTokens: null, judgePromptVersion: null,
        judgeErrorMessage: null, judgeStalledReason: null,
        startedAt: '2026-09-29T10:00:00', finishedAt: '2026-09-29T10:06:00',
        createdBy: 'admin', createdAt: '2026-09-29T10:00:00',
      }
      : latestRun,
    ...overrides,
  }
}

async function mountView(campaigns: GeoCampaign[] = [campaign()]) {
  vi.mocked(geoCampaignApi.listCampaigns).mockResolvedValue({
    records: campaigns, total: campaigns.length, page: 1, size: 20,
  } as never)
  const wrapper = mount(GeoCampaignWorkbenchView, {
    global: { stubs: stubs() },
  })
  await flushPromises()
  return wrapper
}

function buttonsByText(wrapper: ReturnType<typeof mount>, text: string) {
  return wrapper.findAllComponents(BUTTON_STUB).filter((node: any) => node.text() === text)
}

function rowText(wrapper: ReturnType<typeof mount>) {
  const row = wrapper.find('.table-stub .row')
  if (!row.exists()) throw new Error('找不到计划表的那一行')
  return row.text()
}

beforeEach(() => {
  vi.clearAllMocks()
  pushSpy.mockReset()
  vi.mocked(siteApi.list).mockResolvedValue([{ id: 3, name: '纳欣口腔官网' }] as never)
  vi.mocked(geoBrandApi.listProfiles).mockResolvedValue({
    records: [{ id: 7, brandName: '纳欣口腔', siteId: 3 }], total: 1, page: 1, size: 100,
  } as never)
  vi.mocked(geoCampaignApi.vocabulary).mockResolvedValue({
    runStatuses: { SUCCEEDED: '已完成', RUNNING: '诊断中', PENDING: '排队中', PARTIAL: '部分完成', FAILED: '失败' },
    metrics: {},
    metricDefinitions: {},
    confirmStates: {},
    accessChannelNote: '本轮口径=API 问答',
  } as never)
})

describe('没有档案 = 第①步的入口，不是一页空白', () => {
  it('档案为空：整页给「从第①步开始」，并且不发计划请求', async () => {
    vi.mocked(geoBrandApi.listProfiles).mockResolvedValue({ records: [], total: 0, page: 1, size: 100 } as never)
    const wrapper = await mountView([])
    expect(wrapper.text()).toContain('这一步还没有品牌档案')
    expect(wrapper.text()).toContain('从第①步开始')
    expect(geoCampaignApi.listCampaigns).not.toHaveBeenCalled()
    await buttonsByText(wrapper, '从第①步开始')[0].trigger('click')
    expect(pushSpy).toHaveBeenCalledWith({ name: 'workspace-geo-brand-wizard', query: {} })
  })

  it('词表读不到不拦整页：账还是那一本账，只是标签退回原样字符串', async () => {
    vi.mocked(geoCampaignApi.vocabulary).mockRejectedValue(new Error('词表 500'))
    const wrapper = await mountView()
    expect(wrapper.find('.table-stub').exists()).toBe(true)
    expect(wrapper.find('.tag-stub').text()).toBe('SUCCEEDED')
  })
})

describe('计划表：只报形状、确认态与最近一轮', () => {
  it('形状列念「5 题 × 2 平台 × 3 次」和预估，确认态用后端给的那句中文', async () => {
    const wrapper = await mountView()
    const row = rowText(wrapper)
    expect(row).toContain('5 题 × 2 平台 × 3 次')
    // `costEstimateCalls/Tokens` 是【提问那一段】的账：这里写成两段合计就是把第二次花钱说成第一次
    expect(row).toContain('预估提问 30 次 / 42000 token')
    expect(row).toContain('判定另算')
    expect(row).not.toContain('预估 60')
    expect(row).toContain('待确认')
    expect(row).toContain('第 88 轮')
  })

  it('最近一轮卡上判定那一段各念各的：没判过就说没判过，判过的报条数与 token', async () => {
    const wrapper = await mountView()
    const recent = wrapper.find('.geo-workbench__recent')
    expect(recent.text()).toContain('判定那一段一次都没跑过')
    expect(recent.findAll('.tag-stub')[1].text()).toBe('未判定')

    const judged = await mountView([campaign({
      latestRun: {
        ...campaign().latestRun!,
        judgeState: 'DONE', judgeStateLabel: '已判定', judgeCallCount: 30,
        judgePromptTokens: 6000, judgeCompletionTokens: 900, judgePromptVersion: 'geo-judge-v1',
      },
    })])
    expect(judged.find('.geo-workbench__recent').text()).toContain('判定 30 条 · 6900 token · 提示词版本 geo-judge-v1')
    expect(judged.findAll('.tag-stub')[1].text()).toBe('已判定')
  })

  it('判定停着与判定失败在卡上各念各的：加的是话，不是状态词（#108）', async () => {
    const stalled = await mountView([campaign({
      latestRun: {
        ...campaign().latestRun!,
        judgeState: 'JUDGING', judgeStateLabel: '判定中',
        judgeStalledReason: '判定已经 18 分钟没有新进度，重按只补缺的那几条。',
      },
    })])
    expect(stalled.find('.geo-workbench__recent-stalled').text()).toContain('18 分钟没有新进度')
    expect(stalled.findAll('.tag-stub')[1].text()).toBe('判定中')

    const failed = await mountView([campaign({
      latestRun: {
        ...campaign().latestRun!,
        judgeState: 'FAILED', judgeStateLabel: '判定失败',
        judgeErrorMessage: '默认对话模型那一行已经被停用。',
      },
    })])
    expect(failed.find('.geo-workbench__recent-error').text()).toContain('默认对话模型那一行已经被停用')
  })

  it('整页没有总分格：列标题与正文里都不出现合并得分那一类', async () => {
    const wrapper = await mountView()
    expect(wrapper.text()).not.toMatch(/综合得分|加权平均|GEO 总分[：:]/)
    // 这一句自查本身是页面上的实话
    expect(wrapper.text()).toContain('这里没有「GEO 总分」那一格')
  })

  it('没跑过的计划说「还没跑过一轮」，不显示 0 轮', async () => {
    const wrapper = await mountView([campaign({ latestRun: null })])
    const row = rowText(wrapper)
    expect(row).toContain('还没跑过一轮')
    expect(row).not.toContain('0 轮')
    // 没有轮次就没有「看报告」可点
    expect(buttonsByText(wrapper, '最近一轮报告')).toHaveLength(0)
  })
})

describe('最近 3 轮：每个计划只报它自己那一条', () => {
  it('两张计划卡按轮次 id 从新到旧排，念的是各计划自己的最近一轮', async () => {
    const wrapper = await mountView([
      campaign({ id: 12, name: '牙科一期', latestRun: { ...campaign().latestRun!, id: 88 } }),
      campaign({ id: 13, name: '牙科二期', latestRun: { ...campaign().latestRun!, id: 91, status: 'RUNNING', progress: 30 } }),
    ])
    const cards = wrapper.findAll('.geo-workbench__recent-card')
    expect(cards).toHaveLength(2)
    expect(cards[0].text()).toContain('牙科二期 · 轮次 91')
    expect(cards[0].text()).toContain('诊断中')
    expect(cards[0].find('.progress-stub').attributes('data-percent')).toBe('30')
    expect(cards[1].text()).toContain('牙科一期 · 轮次 88')
    expect(wrapper.text()).toContain('最近 3 轮（各计划的最新一轮）')
  })

  it('四个计划也只摆最近三条：卡位写死，别把这一排长成第二张表', async () => {
    const many = [1, 2, 3, 4].map((n) => campaign({
      id: 10 + n,
      latestRun: { ...campaign().latestRun!, id: 100 + n },
    }))
    const wrapper = await mountView(many)
    expect(wrapper.findAll('.geo-workbench__recent-card')).toHaveLength(3)
  })

  it('卡上的「看报告」按轮次 id 跳报告页（不是按计划 id）', async () => {
    const wrapper = await mountView()
    await buttonsByText(wrapper, '看报告')[0].trigger('click')
    expect(pushSpy).toHaveBeenCalledWith({ name: 'workspace-geo-campaign-report', params: { runId: '88' } })
  })
})

describe('「跑新一轮」是跳转，不是执行（§6.2 两段式）', () => {
  it('带着档案 id、step=platform 与计划 id 跳向导第⑤步，整页不发 run', async () => {
    const wrapper = await mountView()
    await buttonsByText(wrapper, '跑新一轮')[0].trigger('click')
    expect(pushSpy).toHaveBeenCalledWith({
      name: 'workspace-geo-brand-wizard',
      query: { profileId: '7', step: 'platform', campaignId: '12' },
    })
    expect(geoCampaignApi.run).not.toHaveBeenCalled()
    expect(geoCampaignApi.estimate).not.toHaveBeenCalled()
  })

  it('换站点会重新取档案与计划：列表跟着筛选走，不留在上一个站点的账上', async () => {
    vi.mocked(siteApi.list).mockResolvedValue([{ id: 3, name: 'A 站' }, { id: 9, name: 'B 站' }] as never)
    const wrapper = await mountView()
    const siteOption = wrapper
      .findAll('.select-stub')[0]
      .findAll('.select-option')
      .find((node: any) => node.text() === 'B 站')
    await siteOption!.trigger('click')
    await flushPromises()
    expect(geoBrandApi.listProfiles).toHaveBeenLastCalledWith(expect.objectContaining({ siteId: 9 }))
    // 换筛选要翻回第 1 页：停在第 4 页看到的是空列表，却会被读成「这个站点没计划」
    expect(geoCampaignApi.listCampaigns).toHaveBeenLastCalledWith(
      expect.objectContaining({ brandProfileId: 7, page: 1 }),
    )
  })
})
