import { describe, it, expect, beforeEach, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { Button, Checkbox, Switch, Textarea } from 'ant-design-vue'
import GeoOpportunityPanel from '../GeoOpportunityPanel.vue'
import { geoCampaignApi } from '../../../api/geoCampaign'
import type { GeoOpportunity, GeoOpportunityList, GeoVocabulary } from '../../../api/geoCampaign'

/**
 * 机会问题清单 + 一键成内容（Spec-F §11.5 / 10-6）。
 *
 * 这一屏是全站唯一「按一下就花钱、还往站点里写内容」的地方，所以用例逐条钉住它容易说谎的那几处：
 * 1. **没看预估按不动**，且换过动作之后旧价必须作废（确认一个数、花另一个数是 §12 明令的形状）；
 * 2. **`notice` 原样念**，并且此时连勾选框都不摆——摆一个永远按不动的勾选框是假闸；
 * 3. **回执里的 `nextStep` 必须被念出来**：草稿≠已发布，只报「成功」就是谎报；
 * 4. **界面上没有「标记已发布」那一发**（`PUBLISHED` 只能由后端读内容自己的状态得到）；
 * 5. **词表不抄**：动作名、缺口名、状态名全部来自假词表，TS 里写死一份就会在这条用例上红。
 *
 * 真组件：Button / Checkbox / Switch / Textarea（闸的判据是「不勾就发不出去」「不选就发不出去」，
 * 替件按不动就是假绿）。抽屉替件，它自己有专门的用例。
 */

vi.mock('vue-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-router')>()
  return { ...actual, useRoute: () => ({ params: {}, query: {} }) }
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
      opportunities: vi.fn(), opportunityEstimate: vi.fn(),
      opportunityDraft: vi.fn(), opportunityDismiss: vi.fn(),
    },
  }
})

const DRAWER_STUB = {
  name: 'GeoOpportunityDrawer',
  props: ['open', 'opportunity', 'vocabulary'],
  template: '<div class="opp-drawer-stub" :data-open="open ? \'1\' : \'0\'" />',
}

const TAG_STUB = {
  name: 'ATag',
  props: ['color'],
  template: '<span class="tag-stub" :data-color="color"><slot /></span>',
}

const VOCABULARY = {
  runStatuses: {}, metrics: {}, metricDefinitions: {}, confirmStates: {}, judgeStates: {},
  prominences: {}, prominenceDefinitions: {}, positionLabel: '在推荐清单里的第几项',
  sentiments: {}, sentimentDefinitions: {}, accessChannelNote: '本轮口径=API 问答',
  gapTypes: { NOT_COVERED: '假档位一', COVERED_CITED: '假档位四' },
  gapDefinitions: {},
  opportunityActions: { PAGE: '假动作新建页', FAQ: '假动作加问答', ARTICLE: '假动作写文章', CASE: '假动作加案例' },
  opportunityActionDefinitions: {
    PAGE: '假说明：建一张草稿页', FAQ: '假说明：加一条问答',
    ARTICLE: '假说明：写一篇文章', CASE: '假说明：加一个案例',
  },
  opportunityStates: { OPEN: '假状态还没动', DRAFTED: '假状态已出草稿', PUBLISHED: '假状态已发布' },
} as unknown as GeoVocabulary

function row(overrides: Partial<GeoOpportunity> = {}): GeoOpportunity {
  return {
    id: 3, runId: 88, campaignId: 12, questionId: 41, coreWord: '种植牙',
    questionText: '种植牙要多少钱', kind: 'MENTION', gapType: 'NOT_COVERED',
    gapTypeLabel: '接口给的缺口名', gapDefinition: '接口给的缺口判据',
    actionType: 'PAGE', actionLabel: '接口给的动作名', evidenceNumerator: 0, evidenceDenominator: 2,
    draftRef: null, state: 'OPEN', stateLabel: '接口给的状态名', dismissedReason: null,
    verifiedRunId: null, verifiedGapType: null, verifiedAt: null, verificationNote: null,
    createdAt: null, updatedAt: null, ...overrides,
  }
}

function list(items: GeoOpportunity[], overrides: Partial<GeoOpportunityList> = {}): GeoOpportunityList {
  return {
    runId: 88, unmeasuredQuestions: 0, items,
    opportunityCount: items.length, resolvedCount: 0, ...overrides,
  }
}

const ESTIMATE = {
  opportunityId: 3, actionType: 'PAGE', actionLabel: '接口给的动作名',
  actionDefinition: '假说明：建一张草稿页', callCount: 1, estimatedTokens: 2400,
  remainingTokens: 88000, tenantBearsCost: true, draftEnabled: true,
  accounting: '页面改版草稿那条账（AI_PORTAL_REVISION）', notice: null,
}

function mountPanel(items: GeoOpportunity[] = [row()], overrides: Partial<GeoOpportunityList> = {}) {
  vi.mocked(geoCampaignApi.opportunities).mockResolvedValue(list(items, overrides) as never)
  const wrapper = mount(GeoOpportunityPanel, {
    props: { runId: 88, vocabulary: VOCABULARY },
    global: {
      stubs: {
        'a-tag': TAG_STUB,
        GeoOpportunityDrawer: DRAWER_STUB,
        'a-button': Button,
        'a-checkbox': Checkbox,
        'a-switch': Switch,
        'a-textarea': Textarea,
      },
    },
  })
  return flushPromises().then(() => wrapper)
}

function buttonByText(wrapper: ReturnType<typeof mount>, text: string) {
  const found = wrapper.findAll('button').find((node: any) => (node.text() || '').trim() === text)
  if (!found) throw new Error(`找不到文字为「${text}」的按钮`)
  return found
}

function hasButton(wrapper: ReturnType<typeof mount>, text: string): boolean {
  return wrapper.findAll('button').some((node: any) => (node.text() || '').trim() === text)
}

/** 打开某一行的动作面板（真点，不是直接改 props） */
async function openPanel(wrapper: ReturnType<typeof mount>, text = '怎么办') {
  await buttonByText(wrapper, text).trigger('click')
  await flushPromises()
}

/** 选动作：那一个按钮的文字是「名字 + 说明」两段，所以按名字点它的名牌，点击冒泡到按钮 */
async function pickAction(wrapper: ReturnType<typeof mount>, name: string) {
  const label = wrapper.findAll('.geo-opp__action-label').find((node: any) => node.text().trim() === name)
  if (!label) throw new Error(`找不到动作「${name}」`)
  await label.trigger('click')
  await flushPromises()
}

async function quote(wrapper: ReturnType<typeof mount>) {
  await buttonByText(wrapper, '看这个动作的预估（一次模型都不调）').trigger('click')
  await flushPromises()
}

async function tickConfirm(wrapper: ReturnType<typeof mount>) {
  await wrapper.find('input[type="checkbox"]').setValue(true)
  await flushPromises()
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(geoCampaignApi.opportunityEstimate).mockResolvedValue(ESTIMATE as never)
  // 默认让「按下去」成功：不然某一条用例会悄悄走通错误分支，而它测的是别的东西
  vi.mocked(geoCampaignApi.opportunityDraft).mockResolvedValue({
    opportunity: row({ state: 'DRAFTED', draftRef: 'page:33' }),
    nextStep: '页面草稿已经生成。',
  } as never)
  vi.mocked(geoCampaignApi.opportunityDismiss).mockResolvedValue(row({ state: 'DISMISSED' }) as never)
})

describe('清单第一屏：三个数分开、作用域明说', () => {
  it('挂载就按当前轮次读一次，并把「跨轮存活」那句摆在明面上', async () => {
    const wrapper = await mountPanel([row()], { opportunityCount: 3, resolvedCount: 2, unmeasuredQuestions: 6 })
    expect(geoCampaignApi.opportunities).toHaveBeenCalledWith(88, false)
    expect(wrapper.text()).toContain('3 条机会还差着')
    expect(wrapper.text()).toContain('2 条已达成')
    expect(wrapper.text()).toContain('另有 6 道题这一轮判不了')
    expect(wrapper.text()).toContain('跨轮存活')
  })

  it('判不了的题数为 null 的老轮次念「未统计」，不念 0', async () => {
    const wrapper = await mountPanel([], { unmeasuredQuestions: null })
    expect(wrapper.text()).toContain('未统计')
    expect(wrapper.text()).not.toContain('另有 0 道题')
  })

  it('缺口名与状态名念的是接口给的那一句，TS 里没有第二份词表', async () => {
    const wrapper = await mountPanel()
    expect(wrapper.text()).toContain('接口给的缺口名')
    expect(wrapper.text()).toContain('接口给的状态名')
    expect(wrapper.text()).toContain('接口给的缺口判据')
    expect(wrapper.text()).not.toContain('站里没这内容')
  })

  it('「未验证」那一句话原样摆在状态旁边（它是一句话不是第五个状态词）', async () => {
    const wrapper = await mountPanel([row({
      state: 'PUBLISHED', stateLabel: '假状态已发布', draftRef: 'page:33',
      verificationNote: '未验证：内容已经发布，但还没有一轮诊断跑到这道题。',
    })])
    expect(wrapper.find('.geo-opp__unverified').text()).toContain('未验证：内容已经发布')
  })

  it('切换「把已达成也列出来」会带着参数重读，而不是在前端挑掉', async () => {
    const wrapper = await mountPanel()
    await wrapper.find('.geo-opp__toolbar .ant-switch').trigger('click')
    await flushPromises()
    expect(geoCampaignApi.opportunities).toHaveBeenLastCalledWith(88, true)
  })
})

describe('先看价再点头', () => {
  it('没点预估之前主按钮按不动，写了原因也一次请求都不发', async () => {
    const wrapper = await mountPanel()
    await openPanel(wrapper)
    expect(wrapper.text()).toContain('没看预估之前主按钮按不动')
    const primary = wrapper.find('.geo-opp__confirm-actions button')
    expect(primary.attributes('disabled')).toBeDefined()
    expect(primary.text()).toContain('请先看这个动作的预估')
    await primary.trigger('click')
    await flushPromises()
    expect(geoCampaignApi.opportunityDraft).not.toHaveBeenCalled()
  })

  it('预估四行把接口的数与那句「走哪条账」原样念出来', async () => {
    const wrapper = await mountPanel()
    await openPanel(wrapper)
    await quote(wrapper)
    const text = wrapper.find('.geo-opp__estimate').text()
    expect(text).toContain('2400')
    expect(text).toContain('页面改版草稿那条账（AI_PORTAL_REVISION）')
    expect(text).toContain('计入本租户额度')
  })

  it('换动作 ⇒ 旧价立刻作废，必须重新预估一次才能按', async () => {
    const wrapper = await mountPanel()
    await openPanel(wrapper)
    await quote(wrapper)
    await tickConfirm(wrapper)
    expect(buttonByText(wrapper, '确认并生成草稿').attributes('disabled')).toBeUndefined()

    await pickAction(wrapper, '假动作加案例')
    expect(wrapper.find('.geo-opp__estimate').exists()).toBe(false)
    const primary = wrapper.find('.geo-opp__confirm-actions button')
    expect(primary.attributes('disabled')).toBeDefined()
    expect(primary.text()).toContain('请先看这个动作的预估')

    await quote(wrapper)
    expect(geoCampaignApi.opportunityEstimate).toHaveBeenLastCalledWith(3, 'CASE')
    await tickConfirm(wrapper)
    await buttonByText(wrapper, '确认并生成草稿').trigger('click')
    await flushPromises()
    expect(geoCampaignApi.opportunityDraft).toHaveBeenCalledWith(3, 'CASE', true)
  })

  it('notice 非空 ⇒ 那句原因摆在明面上、勾选框不摆、主按钮说「不会受理」', async () => {
    vi.mocked(geoCampaignApi.opportunityEstimate).mockResolvedValue({
      ...ESTIMATE, notice: '今天已经用一键动作生成过 10 份草稿，达到每日上限 10 份。',
    } as never)
    const wrapper = await mountPanel()
    await openPanel(wrapper)
    await quote(wrapper)
    expect(wrapper.find('.geo-opp__notice').text()).toContain('达到每日上限 10 份')
    expect(wrapper.find('input[type="checkbox"]').exists()).toBe(false)
    const primary = wrapper.find('.geo-opp__confirm-actions button')
    expect(primary.text()).toContain('这一发不会受理')
    await primary.trigger('click')
    await flushPromises()
    expect(geoCampaignApi.opportunityDraft).not.toHaveBeenCalled()
  })
})

describe('回执与终态', () => {
  it('成功回执把 nextStep 原样念出来：草稿不是已发布', async () => {
    vi.mocked(geoCampaignApi.opportunityDraft).mockResolvedValue({
      opportunity: row({ state: 'DRAFTED', draftRef: 'page:33' }),
      nextStep: '页面草稿已经生成（/zhongzhiya）。发布前还缺 seo_description、seo_title。',
    } as never)
    const wrapper = await mountPanel()
    await openPanel(wrapper)
    await quote(wrapper)
    await tickConfirm(wrapper)
    await buttonByText(wrapper, '确认并生成草稿').trigger('click')
    await flushPromises()
    expect(notificationMock.success).toHaveBeenCalled()
    const message = notificationMock.success.mock.calls[0][0] as { description: string }
    expect(message.description).toContain('发布前还缺 seo_description')
    // 花钱之后重读一遍：面板不许停在按之前的那份清单
    expect(geoCampaignApi.opportunities).toHaveBeenCalledTimes(2)
  })

  it('被拒时后端那句话就是原因，原样递到用户眼前', async () => {
    vi.mocked(geoCampaignApi.opportunityDraft).mockRejectedValue(
      new Error('这一条已经被放弃（理由：不是我们的客户）'),
    )
    const wrapper = await mountPanel()
    await openPanel(wrapper)
    await quote(wrapper)
    await tickConfirm(wrapper)
    await buttonByText(wrapper, '确认并生成草稿').trigger('click')
    await flushPromises()
    expect(notificationMock.error).toHaveBeenCalled()
    expect((notificationMock.error.mock.calls[0][0] as { description: string }).description)
      .toContain('这一条已经被放弃')
  })

  it('整屏没有「标记已发布」那一发：状态只能读出来', async () => {
    const wrapper = await mountPanel()
    await openPanel(wrapper)
    await quote(wrapper)
    expect(hasButton(wrapper, '标记已发布')).toBe(false)
    expect(hasButton(wrapper, '已发布')).toBe(false)
    expect(wrapper.text()).not.toContain('标记为已发布')
  })

  it('已发布那一行不再摆放弃入口，还没动的才摆', async () => {
    const wrapper = await mountPanel([row({ state: 'PUBLISHED', stateLabel: '假状态已发布', draftRef: 'page:33' })])
    await openPanel(wrapper)
    expect(wrapper.find('.geo-opp__dismiss').exists()).toBe(false)
    expect(hasButton(wrapper, '放弃这一条')).toBe(false)
  })

  it('放弃要有理由：空着按不动，填了 trim 之后发出去', async () => {
    vi.mocked(geoCampaignApi.opportunityDismiss).mockResolvedValue(
      row({ state: 'DISMISSED' }) as never,
    )
    const wrapper = await mountPanel()
    await openPanel(wrapper)
    const dismiss = buttonByText(wrapper, '放弃这一条')
    expect(dismiss.attributes('disabled')).toBeDefined()
    await wrapper.find('textarea').setValue('  这道题不是我们的客户会问的  ')
    await flushPromises()
    expect(buttonByText(wrapper, '放弃这一条').attributes('disabled')).toBeUndefined()
    await buttonByText(wrapper, '放弃这一条').trigger('click')
    await flushPromises()
    expect(geoCampaignApi.opportunityDismiss).toHaveBeenCalledWith(3, '这道题不是我们的客户会问的')
  })
})

describe('留痕入口', () => {
  it('点「留痕」把这一行交给抽屉，而不是在清单里自己拼一份时间线', async () => {
    const wrapper = await mountPanel()
    await buttonByText(wrapper, '留痕').trigger('click')
    await flushPromises()
    const drawer = wrapper.find('.opp-drawer-stub')
    expect(drawer.attributes('data-open')).toBe('1')
  })
})
