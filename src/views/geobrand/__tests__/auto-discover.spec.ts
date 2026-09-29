import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import WizardCompetitorStep from '../WizardCompetitorStep.vue'
import { autoDiscoverSummary } from '../geoBrandWizard'
import type { GeoAutoDiscoverResult } from '../../../api/geoBrand'

/**
 * 竞品自动发现（§0.4 Q13 拍板：要做、要控量、上限可配、默认不勾选）。
 * 用例喂的是一份假回执：discovered=5, kept=2, limit=2, skipped=3——
 * 界面必须念出「另外 3 个未纳入，上限 2 可在平台配置里改」，并且每条发现的竞品都是未勾选的开关。
 * a-switch 桩成带 data-checked 的 span：要断言的正是真组件绑出去的那个 checked 值。
 */

const SwitchStub = {
  name: 'ASwitch',
  props: ['checked'],
  emits: ['change'],
  template: '<span class="switch" :data-checked="checked === true ? \'true\' : \'false\'"></span>',
}
const ButtonStub = {
  name: 'AButton',
  props: ['disabled', 'loading'],
  emits: ['click'],
  template: '<button class="btn" :disabled="disabled"><slot /></button>',
}
const TagStub = {
  name: 'ATag',
  props: ['color'],
  inheritAttrs: false,
  template: '<span class="tag" :data-color="color"><slot /></span>',
}

const result: GeoAutoDiscoverResult = {
  discovered: 5,
  kept: 2,
  limit: 2,
  skipped: 3,
  items: [
    { id: 11, brandProfileId: 7, name: '同行甲', words: ['甲', 'JIA'], origin: 'AUTO', sourceRunId: 3, enabled: false },
    { id: 12, brandProfileId: 7, name: '同行乙', words: ['乙'], origin: 'AUTO', sourceRunId: 3, enabled: false },
  ],
}

function mountStep() {
  return mount(WizardCompetitorStep, {
    props: { profileId: 7, autoResult: result, discovering: false },
    global: { stubs: { 'a-switch': SwitchStub, 'a-button': ButtonStub, 'a-tag': TagStub } },
  })
}

describe('自动发现回执的显示纪律', () => {
  it('判据本体：skipped 与 limit 原样进句子，不四舍五入不省略', () => {
    expect(autoDiscoverSummary(result)).toBe('另外 3 个未纳入，上限 2 可在平台配置里改')
  })

  it('回执在界面上念全：发现 5 个、纳入 2 个、另外 3 个未纳入、上限 2', () => {
    const w = mountStep()
    const counts = w.find('.geobrand-wizard-discover__counts').text()
    expect(counts).toContain('本轮发现 5 个，纳入 2 个')
    expect(counts).toContain('另外 3 个未纳入，上限 2 可在平台配置里改')
  })

  it('每条发现的竞品默认未勾选，且界面写明未勾选不进 SOV 分母', () => {
    const w = mountStep()
    const switches = w.findAllComponents(SwitchStub)
    expect(switches.length).toBe(2)
    switches.forEach((s) => expect(s.attributes('data-checked')).toBe('false'))
    expect(w.text()).toContain('未勾选的不计入 SOV 分母')
  })

  it('发现的竞品来源标签走 statusTokens 的 geoOrigin（自动发现=蓝），不是页面色表', () => {
    const w = mountStep()
    const originTags = w.findAll('.tag').filter((t) => t.text() === '自动发现')
    expect(originTags.length).toBe(2)
    originTags.forEach((t) => expect(t.attributes('data-color')).toBe('blue'))
  })

  it('没有档案时点「自动发现」不发起：按钮可点但由面板拦下提示，不发请求', () => {
    const w = mount(WizardCompetitorStep, {
      props: { profileId: null, autoResult: null, discovering: false },
      global: { stubs: { 'a-switch': SwitchStub, 'a-button': ButtonStub, 'a-tag': TagStub } },
    })
    expect(w.find('.geobrand-wizard-discover__result').exists()).toBe(false)
    const button = w.findAllComponents(ButtonStub).find((b) => b.text() === '自动发现同类竞品')
    expect(button).toBeTruthy()
  })
})
