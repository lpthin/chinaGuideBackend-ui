import { describe, it, expect, beforeEach, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import WizardPlatformStep from '../WizardPlatformStep.vue'
import { geoCampaignApi, type GeoCampaign, type GeoPlatformOption } from '../../../api/geoCampaign'
import { geoBrandApi } from '../../../api/geoBrand'

/**
 * 向导第 ⑤ 步「平台与预算」（Spec-F §10-2 ⑤ + §10-3，P2 换掉 P1 那块「下一期接入」的牌子）。
 *
 * 这一屏的四条纪律：
 * 1. **平台卡片只有一个出处**：`GET /geo/campaign/platforms`。界面不许自己列「支持哪几家」，
 *    一家都没有时说清去哪一屏开通，而不是给一个空勾选框让人原地打转；
 * 2. **题的范围不在这里重挑**：建计划时 `questionIds` 交空数组，后端拍「该档案下当前启用的题」；
 *    界面只报启用题的三道两类数（含未启用的计数就是谎报要问什么）；
 * 3. **少于 3 家只提示不拦**：建议值不是硬闸，只有一两家也得能跑（§10-2 ⑤）；
 * 4. **步状态跟着计划走**：存计划时把 {current,maxReached} 抄进 `wizard_state`，
 *    刷新/换设备回来还在第⑤步（§10-2 最后那条）。
 */

const { loadEstimateSpy, notificationMock } = vi.hoisted(() => ({
  loadEstimateSpy: vi.fn(),
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
      platforms: vi.fn(),
      listCampaigns: vi.fn(),
      createCampaign: vi.fn(),
      updateCampaign: vi.fn(),
      estimate: vi.fn(),
      runs: vi.fn(),
      run: vi.fn(),
    },
  }
})

vi.mock('../../../api/geoBrand', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../api/geoBrand')>()
  return {
    ...actual,
    geoBrandApi: { questions: vi.fn() },
  }
})

const GROUP_STUB = {
  name: 'ACheckboxGroup',
  props: ['value'],
  emits: ['update:value'],
  template: '<div class="group-stub"><slot /></div>',
}

const CHECKBOX_STUB = {
  name: 'ACheckbox',
  props: ['value', 'checked'],
  template: '<label class="card-stub" :data-value="value"><slot /></label>',
}

/** 预估面板换成桩：这一屏测的是「存计划 → 让它去取价」，面板自己的规矩在 run-panel.spec.ts */
const PANEL_STUB = {
  name: 'CampaignRunPanel',
  expose: ['loadEstimate', 'loadRuns', 'reset'],
  methods: { loadEstimate: loadEstimateSpy, loadRuns: () => {}, reset: () => {} },
  template: '<div class="panel-stub" />',
}

const BUTTON_STUB = {
  name: 'AButton',
  props: ['disabled', 'loading', 'type', 'size'],
  emits: ['click'],
  template: '<button class="btn" :disabled="disabled || loading" @click="$emit(\'click\')"><slot /></button>',
}

function platform(id: number, name: string, modelName: string | null = 'deepseek-v4-pro'): GeoPlatformOption {
  return { id, name, provider: 'deepseek', modelName, modelType: 'CHAT' }
}

function campaign(overrides: Partial<GeoCampaign> = {}): GeoCampaign {
  return {
    id: 12,
    tenantId: 1,
    siteId: 3,
    brandProfileId: 7,
    name: '牙科一期',
    platformIds: [4],
    questionIds: [],
    questionCount: 5,
    platformCount: 1,
    repeatTimes: 3,
    costEstimateCalls: 15,
    costEstimateTokens: 21000,
    confirmState: 'PENDING_CONFIRM',
    confirmStateLabel: '待确认',
    wizardState: '{"current":4,"maxReached":4}',
    note: null,
    createdBy: 'admin',
    createdAt: '2026-09-29T10:00:00',
    updatedAt: null,
    latestRun: null,
    ...overrides,
  }
}

async function mountStep(props: Record<string, unknown> = {}) {
  const wrapper = mount(WizardPlatformStep, {
    props: {
      profileId: 7,
      siteId: 3,
      brandName: '纳欣口腔',
      wizardState: { current: 4, maxReached: 4 },
      ...props,
    },
    global: {
      stubs: {
        'a-checkbox-group': GROUP_STUB,
        'a-checkbox': CHECKBOX_STUB,
        'a-button': BUTTON_STUB,
        'a-input': { name: 'AInput', props: ['value', 'placeholder', 'maxlength'], emits: ['update:value'], template: '<input>' },
        'a-input-number': { name: 'AInputNumber', props: ['value', 'min', 'max'], emits: ['update:value'], template: '<input>' },
        'a-form-item': { name: 'AFormItem', props: ['label'], template: '<div class="field"><span class="field-label">{{ label }}</span><slot /></div>' },
        CampaignRunPanel: PANEL_STUB,
      },
    },
  })
  await flushPromises()
  return wrapper
}

function buttonsByText(wrapper: ReturnType<typeof mount>, text: string) {
  return wrapper.findAllComponents(BUTTON_STUB).filter((node: any) => node.text() === text)
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(geoCampaignApi.platforms).mockResolvedValue([platform(4, 'DeepSeek'), platform(11, '通义千问')] as never)
  vi.mocked(geoCampaignApi.listCampaigns).mockResolvedValue({ records: [], total: 0, page: 1, size: 20 } as never)
  vi.mocked(geoBrandApi.questions).mockResolvedValue({
    tenant: [
      { id: 1, kind: 'MENTION', enabled: true },
      { id: 2, kind: 'MENTION', enabled: false },
      { id: 3, kind: 'REPUTATION', enabled: true },
    ],
    platform: [{ id: 4, kind: 'MENTION', enabled: true }],
  } as never)
})

describe('平台卡片：只有那一个出处', () => {
  it('卡片来自 /geo/campaign/platforms，按 siteId 查，一张都不自己编', async () => {
    const wrapper = await mountStep()
    expect(geoCampaignApi.platforms).toHaveBeenCalledWith(3)
    const cards = wrapper.findAll('.card-stub')
    expect(cards).toHaveLength(2)
    expect(cards.map((card: any) => card.text()).join(' ')).toContain('DeepSeek')
    expect(cards.map((card: any) => card.text()).join(' ')).toContain('deepseek-v4-pro')
  })

  it('一个可选平台都没有：说清去「大模型配置」开通，不摆空勾选框', async () => {
    vi.mocked(geoCampaignApi.platforms).mockResolvedValue([] as never)
    const wrapper = await mountStep()
    expect(wrapper.find('.group-stub').exists()).toBe(false)
    expect(wrapper.text()).toContain('一个可选平台都没有')
    expect(wrapper.text()).toContain('大模型配置')
  })

  it('少于建议的 3 家只提示不拦：保存按钮照样能按', async () => {
    const wrapper = await mountStep()
    wrapper.findComponent(GROUP_STUB).vm.$emit('update:value', [4])
    await flushPromises()
    expect(wrapper.find('.geo-step-platform__hint').text()).toContain('建议至少勾 3 家')
    expect(wrapper.find('.geo-step-platform__hint').text()).toContain('少了也能跑')
    const save = buttonsByText(wrapper, '存为诊断计划')[0]
    expect(save.props('disabled')).toBeFalsy()
  })

  it('没有站点时不发平台请求，也不演一屏卡片', async () => {
    await mountStep({ siteId: null })
    expect(geoCampaignApi.platforms).not.toHaveBeenCalled()
  })

  it('没有品牌档案时整屏给第①步的出路：建计划要有主体', async () => {
    const wrapper = await mountStep({ profileId: null })
    expect(wrapper.text()).toContain('还没有品牌档案')
    expect(wrapper.text()).toContain('回到第 ① 步保存品牌档案')
    expect(wrapper.find('.geo-step-platform__cards').exists()).toBe(false)
  })
})

describe('这一轮问什么：只报启用题，题池交给后端拍快照', () => {
  it('启用题按两类报数，未启用的那道不计进「合计」', async () => {
    const wrapper = await mountStep()
    const note = wrapper.findAll('.geo-step-platform__note')[1].text()
    expect(note).toContain('可见度 2 道')
    expect(note).toContain('口碑 1 道')
    expect(note).toContain('合计 3 道')
    expect(note).not.toContain('合计 4 道')
  })

  it('存计划：questionIds 交空数组（=该档案下当前启用的题），并把向导步状态抄进去', async () => {
    vi.mocked(geoCampaignApi.createCampaign).mockResolvedValue(campaign() as never)
    const wrapper = await mountStep()
    wrapper.findComponent(GROUP_STUB).vm.$emit('update:value', [4, 11])
    await flushPromises()
    await buttonsByText(wrapper, '存为诊断计划')[0].trigger('click')
    await flushPromises()
    expect(geoCampaignApi.createCampaign).toHaveBeenCalledWith(
      expect.objectContaining({
        siteId: 3,
        brandProfileId: 7,
        platformIds: [4, 11],
        questionIds: [],
        repeatTimes: 3,
        wizardState: '{"current":4,"maxReached":4}',
      }),
    )
    // 建完立刻去取价——这一段与「点头」之间还隔着一次预估（§6.2 两段式）
    expect(loadEstimateSpy).toHaveBeenCalled()
    expect(geoCampaignApi.run).not.toHaveBeenCalled()
  })

  it('建好之后按钮换成「保存这一屏的勾选」，再存走 PUT 而不是又建一个', async () => {
    vi.mocked(geoCampaignApi.createCampaign).mockResolvedValue(campaign() as never)
    vi.mocked(geoCampaignApi.updateCampaign).mockResolvedValue(campaign() as never)
    const wrapper = await mountStep()
    await buttonsByText(wrapper, '存为诊断计划')[0].trigger('click')
    await flushPromises()
    expect(buttonsByText(wrapper, '保存这一屏的勾选')).toHaveLength(1)
    await buttonsByText(wrapper, '保存这一屏的勾选')[0].trigger('click')
    await flushPromises()
    expect(geoCampaignApi.updateCampaign).toHaveBeenCalledWith(12, expect.objectContaining({ wizardState: '{"current":4,"maxReached":4}' }))
    expect(geoCampaignApi.createCampaign).toHaveBeenCalledTimes(1)
    // 改计划不动已经在跑的那一轮：这句话得说在屏上，不能只记在代码注释里
    expect(notificationMock.success.mock.calls.map((call: unknown[]) => JSON.stringify(call)).join(' '))
      .toContain('已经在跑的那一轮不受影响')
  })

  it('从工作台的「跑新一轮」带着计划过来：先把它选中，不用人再挑一次', async () => {
    vi.mocked(geoCampaignApi.listCampaigns).mockResolvedValue({
      records: [campaign(), campaign({ id: 13, name: '牙科二期', platformIds: [4, 11], platformCount: 2 })],
      total: 2, page: 1, size: 20,
    } as never)
    const wrapper = await mountStep({ initialCampaignId: 13 })
    expect(wrapper.findComponent(GROUP_STUB).props('value')).toEqual([4, 11])
    expect(buttonsByText(wrapper, '保存这一屏的勾选')).toHaveLength(1)
  })

  it('已有计划列出来，每条带形状与确认态，并能跳到最近一轮报告', async () => {
    vi.mocked(geoCampaignApi.listCampaigns).mockResolvedValue({
      records: [campaign({ latestRun: { id: 88 } as never})],
      total: 1, page: 1, size: 20,
    } as never)
    const wrapper = await mountStep()
    const line = wrapper.find('.geo-step-platform__plans li').text()
    expect(line).toContain('5 题 × 1 平台 × 3 次')
    expect(line).toContain('待确认')
    await buttonsByText(wrapper, '最近一轮报告')[0].trigger('click')
    expect(wrapper.emitted('view-report')?.[0]).toEqual([88])
  })
})
