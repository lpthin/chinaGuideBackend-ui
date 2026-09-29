import { describe, it, expect, beforeEach, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { Button } from 'ant-design-vue'
import CampaignRunPanel from '../CampaignRunPanel.vue'
import { geoCampaignApi } from '../../../api/geoCampaign'
import type { GeoEstimate, GeoRun } from '../../../api/geoCampaign'

/**
 * 预估与确认面板（Spec-F §10-3 + §6.2，P2 唯一的花钱出口）。
 *
 * §10-3 那三句判据在这里逐句钉：
 * 1. 「六行：提问两行 + 判定两行 + 合计 + 耗时」——数字只转述接口，前端不做乘法，
 *    也不把两段合成一行的「预计 token」（那是 §11.4 反对的形状）；
 * 2. 「`estimate.notice` 存在时主按钮禁用并把理由念出来」——理由必须**原样**出现，
 *    不改写成「参数错误」，也不因为摆了 notice 就顺手摆一个能点的确认框；
 * 3. 「勾选确认才能跑」——`api.run` 只可能在勾选之后被调起来，且带的是 true；
 *    而这一发点的只是【提问那一段】，判定要另外点头（§6.2 两段式）；
 * 4. 「同一计划已经有一轮在跑 ⇒ 第二发起不来」（#125）——按钮文字念的是在等谁，
 *    而被判定为「停着」的那一条不算在飞，否则一条死行会把这个计划永久锁死。
 *
 * 另外钉住轮询的两条纪律：切计划要重取预估并且把勾选清零（价变了就要重新点头），
 * 组件卸载要把定时器清掉（留下一堆 5 秒表就是在偷跑网络）。
 */

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
      estimate: vi.fn(),
      run: vi.fn(),
      runs: vi.fn(),
    },
  }
})

const CheckboxStub = {
  name: 'ACheckbox',
  props: ['checked', 'value'],
  emits: ['update:checked'],
  // 声明 emits 的桩必须自己把事件发回去：@click 挂在组件事件上，用原生 input 点它不等于勾上了
  template: `<label class="check-stub" :data-checked="checked === true ? 'true' : 'false'">
    <input type="checkbox" :checked="checked" @change="$emit('update:checked', $event.target.checked)">
    <span class="check-text"><slot /></span>
  </label>`,
}

const AlertStub = {
  name: 'AAlert',
  props: ['type', 'message', 'description', 'showIcon'],
  template: `<div class="alert-stub" :data-type="type"><span class="alert-message">{{ message }}</span></div>`,
}

const PROGRESS_STUB = {
  name: 'AProgress',
  props: ['percent'],
  template: '<i class="progress-stub" :data-percent="percent" />',
}

const TAG_STUB = {
  name: 'ATag',
  props: ['color'],
  template: '<span class="tag-stub" :data-color="color"><slot /></span>',
}

function stubs() {
  return {
    'a-button': Button,
    'a-checkbox': CheckboxStub,
    'a-alert': AlertStub,
    'a-progress': PROGRESS_STUB,
    'a-tag': TAG_STUB,
  }
}

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

async function mountPanel(props: Record<string, unknown> = {}) {
  const wrapper = mount(CampaignRunPanel, {
    props: { campaignId: 12, ...props },
    global: { stubs: stubs() },
  })
  await flushPromises()
  return wrapper
}

function buttonsByText(wrapper: ReturnType<typeof mount>, text: string) {
  return wrapper.findAll('button').filter((node: any) => (node.text() || '').trim() === text)
}

function primaryButton(wrapper: ReturnType<typeof mount>) {
  const found = wrapper.findAll('button').find((node: any) => {
    const classes = node.attributes('class') || ''
    return classes.includes('ant-btn-primary')
  })
  if (!found) throw new Error('找不到主按钮：预估面板的「确认并开始诊断」那一发就是它')
  return found
}

/**
 * 真把那格勾选翻上去：组件读的是 change 事件里的 `target.checked`，
 * 而 jsdom 的 `trigger('change')` 只发事件不改 `checked`，用它测出来的是界面走不到的一条路。
 */
async function tickConfirm(wrapper: ReturnType<typeof mount>) {
  const input = wrapper.find('.check-stub input').element as HTMLInputElement
  input.checked = true
  input.dispatchEvent(new Event('change', { bubbles: true }))
  await flushPromises()
}

beforeEach(() => {
  vi.clearAllMocks()
  document.body.innerHTML = ''
  vi.mocked(geoCampaignApi.runs).mockResolvedValue([])
  vi.mocked(geoCampaignApi.run).mockResolvedValue(run() as never)
})

describe('先看价，再点头（§10-3 六行 + 两段式）', () => {
  it('没取预估时主按钮是死的，说的是「请先看预估」，也不摆确认框', async () => {
    const wrapper = await mountPanel()
    expect(primaryButton(wrapper).attributes('disabled')).toBeDefined()
    expect(primaryButton(wrapper).text()).toBe('请先看预估')
    expect(wrapper.find('.check-stub').exists()).toBe(false)
    expect(wrapper.text()).toContain('还没有取到预估')
    expect(geoCampaignApi.estimate).not.toHaveBeenCalled()
  })

  it('「先估算这一轮」按下去只发 estimate 一发，不带 confirm 也不起跑', async () => {
    vi.mocked(geoCampaignApi.estimate).mockResolvedValue(estimate() as never)
    const wrapper = await mountPanel()
    await buttonsByText(wrapper, '先估算这一轮')[0].trigger('click')
    await flushPromises()
    expect(geoCampaignApi.estimate).toHaveBeenCalledWith(12)
    expect(geoCampaignApi.run).not.toHaveBeenCalled()
  })

  it('预估到手：六行数字原样转述接口，乘积不自己算，两段也不合成一行', async () => {
    vi.mocked(geoCampaignApi.estimate).mockResolvedValue(estimate({ callCount: 31 }) as never)
    const wrapper = await mountPanel()
    await buttonsByText(wrapper, '先估算这一轮')[0].trigger('click')
    await flushPromises()
    const rows = wrapper.findAll('.geo-run-panel__estimate tbody tr')
    expect(rows).toHaveLength(6)
    expect(rows.map((row: any) => row.text()).join('\n')).toContain('31 次')
    expect(rows[0].text()).toContain('5 题 × 2 个平台 × 每题重复 3 次')
    expect(rows[1].text()).toContain('42000')
    // 判定那一段单独两行：合起来写「预计 token 60000」就等于把第二次花钱藏进第一次的账里
    expect(rows[2].text()).toContain('判定 · 调用次数')
    expect(rows[2].text()).toContain('30 次')
    expect(rows[3].text()).toContain('18000')
    expect(rows[4].text()).toContain('60 次 / 60000 token')
    // 合计那句必须同时说清「这一发只花提问那一段」，否则六行读起来像一次付款
    expect(rows[4].text()).toContain('只花提问那一段')
    expect(rows[5].text()).toContain('约 6 分钟')
    // 计费方向跟着 tenantBearsCost 走（true = 扣本租户额度并报名剩余）
    expect(wrapper.find('.geo-run-panel__billing').text()).toContain('计入本租户额度')
    expect(wrapper.find('.geo-run-panel__billing').text()).toContain('900000')
  })

  it('看过预估但没勾确认 → 还是按不动，按钮写「请先勾选确认」', async () => {
    vi.mocked(geoCampaignApi.estimate).mockResolvedValue(estimate() as never)
    const wrapper = await mountPanel()
    await buttonsByText(wrapper, '先估算这一轮')[0].trigger('click')
    await flushPromises()
    expect(primaryButton(wrapper).attributes('disabled')).toBeDefined()
    expect(primaryButton(wrapper).text()).toBe('请先勾选确认')
    expect(geoCampaignApi.run).not.toHaveBeenCalled()
  })

  it('勾选后按钮变「确认并开始诊断」，点下去发的是 confirm: true', async () => {
    vi.mocked(geoCampaignApi.estimate).mockResolvedValue(estimate() as never)
    const wrapper = await mountPanel()
    await buttonsByText(wrapper, '先估算这一轮')[0].trigger('click')
    await flushPromises()
    // 确认框那句得把次数念出来：勾的是「提问 30 次」，不是一个抽象的同意
    expect(wrapper.find('.check-text').text()).toContain('调用模型提问 30 次')
    await tickConfirm(wrapper)
    expect(primaryButton(wrapper).attributes('disabled')).toBeUndefined()
    await primaryButton(wrapper).trigger('click')
    await flushPromises()
    expect(geoCampaignApi.run).toHaveBeenCalledWith(12, true)
    // 两段式：这一发点下去只花提问那一段，判定（推荐位与情感三档）是第二次点头
    expect(wrapper.find('.geo-run-panel__confirm-note').text()).toContain('判定')
    expect(wrapper.find('.geo-run-panel__confirm-note').text()).toContain('另一次点头')
  })

  it('重取一次预估就把勾选清零：留着它等于替一个没看过的数字签字', async () => {
    vi.mocked(geoCampaignApi.estimate).mockResolvedValue(estimate() as never)
    const wrapper = await mountPanel()
    await buttonsByText(wrapper, '先估算这一轮')[0].trigger('click')
    await flushPromises()
    await tickConfirm(wrapper)
    expect(primaryButton(wrapper).text()).toBe('确认并开始诊断')

    vi.mocked(geoCampaignApi.estimate).mockResolvedValue(estimate({ callCount: 90 }) as never)
    await buttonsByText(wrapper, '先估算这一轮')[0].trigger('click')
    await flushPromises()
    expect(primaryButton(wrapper).text()).toBe('请先勾选确认')
    expect(wrapper.find('.check-stub').attributes('data-checked')).toBe('false')
  })
})

describe('notice：这一轮不会受理（§6.2 成本闸的界面那一半）', () => {
  const NOTICE =
    '这一轮要 30 次调用，超过单轮上限 20 次（app.geo.max-calls-per-run），不会受理。减少题目或平台数量后再跑。'

  it('理由原样挂出来（warning 色），主按钮禁用并把它的名字写成这一句的结论', async () => {
    vi.mocked(geoCampaignApi.estimate).mockResolvedValue(estimate({ notice: NOTICE }) as never)
    const wrapper = await mountPanel()
    await buttonsByText(wrapper, '先估算这一轮')[0].trigger('click')
    await flushPromises()
    const alert = wrapper.find('.alert-stub')
    expect(alert.attributes('data-type')).toBe('warning')
    // 原样念，不改写：后端那句里带着出路（减题/减平台/上限叫什么）
    expect(alert.find('.alert-message').text()).toBe(NOTICE)
    expect(primaryButton(wrapper).text()).toBe('这一轮不会受理')
    expect(primaryButton(wrapper).attributes('disabled')).toBeDefined()
  })

  it('notice 挡着的时候连确认框都不摆：勾一个点不动的按钮是骗人', async () => {
    vi.mocked(geoCampaignApi.estimate).mockResolvedValue(estimate({ notice: NOTICE }) as never)
    const wrapper = await mountPanel()
    await buttonsByText(wrapper, '先估算这一轮')[0].trigger('click')
    await flushPromises()
    expect(wrapper.find('.check-stub').exists()).toBe(false)
    await primaryButton(wrapper).trigger('click')
    await flushPromises()
    expect(geoCampaignApi.run).not.toHaveBeenCalled()
  })

  it('计划被关掉时后端给的是另一句（确认后也不会调用模型），这里照原样念', async () => {
    vi.mocked(geoCampaignApi.estimate).mockResolvedValue(
      estimate({ campaignEnabled: false, notice: '诊断开关当前是关的（app.geo.campaign-enabled=false），确认后也不会调用模型。' }) as never,
    )
    const wrapper = await mountPanel()
    await buttonsByText(wrapper, '先估算这一轮')[0].trigger('click')
    await flushPromises()
    expect(wrapper.find('.alert-message').text()).toContain('app.geo.campaign-enabled=false')
    expect(wrapper.find('.check-stub').exists()).toBe(false)
  })
})

describe('轮次那一排：状态中文只来自词表', () => {
  it('词表给了就用词表，没给才退回接口自带的 statusLabel', async () => {
    vi.mocked(geoCampaignApi.runs).mockResolvedValue([run({ status: 'PARTIAL', statusLabel: 'PARTIAL' })] as never)
    const withVocab = await mountPanel({ runStatusLabels: { PARTIAL: '部分完成' } })
    expect(withVocab.find('.tag-stub').text()).toBe('部分完成')
    expect(withVocab.find('.tag-stub').attributes('data-color')).toBe('orange')

    vi.mocked(geoCampaignApi.runs).mockResolvedValue([run({ status: 'PARTIAL', statusLabel: '偏了' })] as never)
    const withoutVocab = await mountPanel()
    await buttonsByText(withoutVocab, '刷新轮次')[0].trigger('click')
    await flushPromises()
    expect(withoutVocab.find('.tag-stub').text()).toBe('偏了')
  })

  it('提问与判定是两份词表、两个标签：判定的中文只来自接口的 judgeStateLabel（§11.4）', async () => {
    vi.mocked(geoCampaignApi.runs).mockResolvedValue([
      run({
        status: 'SUCCEEDED', judgeState: 'JUDGING', judgeStateLabel: '判定中',
        judgeCallCount: 12, judgePromptTokens: 3000, judgeCompletionTokens: 400,
      }),
    ] as never)
    const wrapper = await mountPanel({ runStatusLabels: { SUCCEEDED: '已完成' } })
    await buttonsByText(wrapper, '刷新轮次')[0].trigger('click')
    await flushPromises()
    const tags = wrapper.findAll('.tag-stub')
    expect(tags[0].text()).toBe('已完成')
    expect(tags[1].text()).toBe('判定中')
    // 两段的账各念各的，不合成一个「本轮 token」
    const meta = wrapper.find('.geo-run-panel__run-meta').text()
    expect(meta).toContain('2000 + 800 token')
    expect(meta).toContain('判定 12 条 3400 token')
  })

  it('判定停着不动与判定失败各念各的：一个补一句出路，一个念后端那句原因（#108）', async () => {
    vi.mocked(geoCampaignApi.runs).mockResolvedValue([
      run({
        status: 'PARTIAL', judgeState: 'JUDGING', judgeStateLabel: '判定中',
        judgeStalledReason: '判定已经 18 分钟没有新进度，只补还缺的那几条。',
      }),
    ] as never)
    const wrapper = await mountPanel({ runStatusLabels: { PARTIAL: '部分完成' } })
    await buttonsByText(wrapper, '刷新轮次')[0].trigger('click')
    await flushPromises()
    expect(wrapper.find('.geo-run-panel__run-stalled').text()).toContain('18 分钟没有新进度')
    // 状态词还是词表给的那一个：卡住不改状态
    expect(wrapper.findAll('.tag-stub')[0].text()).toBe('部分完成')

    vi.mocked(geoCampaignApi.runs).mockResolvedValue([
      run({ status: 'SUCCEEDED', judgeState: 'FAILED', judgeStateLabel: '判定失败', judgeErrorMessage: '默认对话模型那一行已经被停用。' }) as never,
    ] as never)
    const failed = await mountPanel()
    await buttonsByText(failed, '刷新轮次')[0].trigger('click')
    await flushPromises()
    expect(failed.find('.geo-run-panel__run-error').text()).toContain('默认对话模型那一行已经被停用')
  })

  it('跑完的那一轮给「看报告」并按 id 跳过去，跑挂的那一轮不给（报告页没有账可翻）', async () => {
    vi.mocked(geoCampaignApi.runs).mockResolvedValue([run({ id: 90, status: 'SUCCEEDED' })] as never)
    const ok = await mountPanel()
    await buttonsByText(ok, '刷新轮次')[0].trigger('click')
    await flushPromises()
    await buttonsByText(ok, '看报告')[0].trigger('click')
    expect(ok.emitted('view-report')?.[0]).toEqual([90])

    vi.mocked(geoCampaignApi.runs).mockResolvedValue([run({ status: 'FAILED', errorMessage: '模型侧超时' })] as never)
    const wrapper = await mountPanel()
    await buttonsByText(wrapper, '刷新轮次')[0].trigger('click')
    await flushPromises()
    expect(buttonsByText(wrapper, '看报告')).toHaveLength(0)
    expect(wrapper.text()).toContain('模型侧超时')
  })

  it('在跑的轮次画进度条并每 5 秒回读；卸载后表停掉，不留下空转的网络请求', async () => {
    vi.useFakeTimers()
    try {
      vi.mocked(geoCampaignApi.runs).mockResolvedValue([run({ status: 'RUNNING', progress: 40 })] as never)
      const wrapper = await mountPanel()
      await buttonsByText(wrapper, '刷新轮次')[0].trigger('click')
      await flushPromises()
      expect(wrapper.find('.progress-stub').attributes('data-percent')).toBe('40')
      const before = vi.mocked(geoCampaignApi.runs).mock.calls.length
      vi.advanceTimersByTime(5000)
      await flushPromises()
      expect(vi.mocked(geoCampaignApi.runs).mock.calls.length).toBeGreaterThan(before)

      wrapper.unmount()
      const afterUnmount = vi.mocked(geoCampaignApi.runs).mock.calls.length
      vi.advanceTimersByTime(20000)
      await flushPromises()
      expect(vi.mocked(geoCampaignApi.runs).mock.calls.length).toBe(afterUnmount)
    } finally {
      vi.useRealTimers()
    }
  })

  it('全部落定就不再轮询：跑完的计划不该被这一页一直敲', async () => {
    vi.useFakeTimers()
    try {
      vi.mocked(geoCampaignApi.runs).mockResolvedValue([run({ status: 'SUCCEEDED' })] as never)
      const wrapper = await mountPanel()
      await buttonsByText(wrapper, '刷新轮次')[0].trigger('click')
      await flushPromises()
      const calls = vi.mocked(geoCampaignApi.runs).mock.calls.length
      vi.advanceTimersByTime(15000)
      await flushPromises()
      expect(vi.mocked(geoCampaignApi.runs).mock.calls.length).toBe(calls)
      wrapper.unmount()
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('在飞闸：这个计划已经有一轮在跑时，第二发起不来（#125）', () => {
  const STALLED = '这一轮已经 22 分钟没有新进度，大概率是被服务重启带断了。界面不替它改状态——现在可以直接再起一轮。'

  it('轮次列表里有真在跑的那一条：主按钮按不动并把在等谁念出来，勾了确认也不发 run', async () => {
    vi.mocked(geoCampaignApi.runs).mockResolvedValue(
      [run({ status: 'RUNNING', progress: 40, stageText: '正在问第 12 / 30 次' })] as never,
    )
    vi.mocked(geoCampaignApi.estimate).mockResolvedValue(estimate() as never)
    const wrapper = await mountPanel()
    await buttonsByText(wrapper, '先估算这一轮')[0].trigger('click')
    await flushPromises()
    await tickConfirm(wrapper)

    expect(primaryButton(wrapper).text()).toBe('这一轮还在跑，先等它')
    expect(primaryButton(wrapper).attributes('disabled')).toBeDefined()
    expect(wrapper.find('.geo-run-panel__waiting').text()).toContain('轮次 88 还在跑')
    expect(wrapper.find('.geo-run-panel__waiting').text()).toContain('付两遍钱')
    await primaryButton(wrapper).trigger('click')
    await flushPromises()
    expect(geoCampaignApi.run).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('停着不动的那一条不算在飞：按钮照样能按，否则这个计划被一条死行永久锁死', async () => {
    vi.mocked(geoCampaignApi.runs).mockResolvedValue(
      [run({ status: 'RUNNING', progress: 40, stalledReason: STALLED })] as never,
    )
    vi.mocked(geoCampaignApi.estimate).mockResolvedValue(estimate() as never)
    const wrapper = await mountPanel()
    await buttonsByText(wrapper, '先估算这一轮')[0].trigger('click')
    await flushPromises()
    await tickConfirm(wrapper)

    expect(primaryButton(wrapper).text()).toBe('确认并开始诊断')
    expect(primaryButton(wrapper).attributes('disabled')).toBeUndefined()
    await primaryButton(wrapper).trigger('click')
    await flushPromises()
    expect(geoCampaignApi.run).toHaveBeenCalledWith(12, true)
  })

  it('停着的那一轮在列表里看得见那句原因，而状态词还是词表给的那一个（#108：加的是话，不是状态）', async () => {
    vi.mocked(geoCampaignApi.runs).mockResolvedValue(
      [run({ status: 'RUNNING', progress: 40, stalledReason: STALLED })] as never,
    )
    const wrapper = await mountPanel({ runStatusLabels: { RUNNING: '诊断中' } })
    await buttonsByText(wrapper, '刷新轮次')[0].trigger('click')
    await flushPromises()
    expect(wrapper.find('.tag-stub').text()).toBe('诊断中')
    expect(wrapper.find('.geo-run-panel__run-stalled').text()).toContain('22 分钟没有新进度')
    expect(wrapper.find('.geo-run-panel__run-stalled').text()).toContain('现在可以直接再起一轮')
  })

  it('停着的那一条不再轮询：敲一条死行敲不出新进度，5 秒一张的表是在骗自己', async () => {
    vi.useFakeTimers()
    try {
      vi.mocked(geoCampaignApi.runs).mockResolvedValue(
        [run({ status: 'RUNNING', progress: 40, stalledReason: STALLED })] as never,
      )
      const wrapper = await mountPanel()
      await buttonsByText(wrapper, '刷新轮次')[0].trigger('click')
      await flushPromises()
      const calls = vi.mocked(geoCampaignApi.runs).mock.calls.length
      vi.advanceTimersByTime(15000)
      await flushPromises()
      expect(vi.mocked(geoCampaignApi.runs).mock.calls.length).toBe(calls)
      wrapper.unmount()
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('没有计划对象时不发请求', () => {
  it('campaignId 为空：空态说清去哪儿建，估算与刷新都不发出去', async () => {
    const wrapper = await mountPanel({ campaignId: null })
    await buttonsByText(wrapper, '先估算这一轮')[0].trigger('click')
    await buttonsByText(wrapper, '刷新轮次')[0].trigger('click')
    await flushPromises()
    expect(geoCampaignApi.estimate).not.toHaveBeenCalled()
    expect(geoCampaignApi.runs).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('还没有诊断计划')
  })
})
