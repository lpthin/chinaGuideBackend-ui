import { beforeEach, describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import WizardSteps from '../../../components/WizardSteps.vue'
import WizardPlatformStep from '../WizardPlatformStep.vue'
import MeasuredCount from '../MeasuredCount.vue'
import { GEO_WIZARD_STEPS, loadWizardState, saveWizardState, wizardStorageKey } from '../geoBrandWizard'
import { PH_NOT_MEASURED } from '../../../utils/display'
import type { WizardState } from '../../../components/wizardModel'

/**
 * 向导的「走得动 / 走不动 / 走到头是什么」三件事（Spec-F §11.2 P1、§9.6 不许谎报）：
 * 1. beforeNext 返回字符串时人被拦在原地、那句话红字显示在步底；
 * 2. 步骤状态 {current,maxReached} 按档案 id 落 localStorage，刷新回原步；
 * 3. 第⑤步只摆形状：「完成」是禁用的，界面上不暗示任何诊断已被安排；
 * 4. 没测过的数显示「未取到」，不显示 0。
 * 桩都写在本文件里（不用全局桩），断言的正是真组件绑出去的那个 prop 值。
 */

const StepsStub = {
  name: 'ASteps',
  props: ['current'],
  template: '<div class="steps"><slot /></div>',
}
const StepStub = {
  name: 'AStep',
  props: ['title'],
  template: '<span class="step">{{ title }}</span>',
}
const ButtonStub = {
  name: 'AButton',
  props: { disabled: Boolean, type: String, loading: Boolean },
  emits: ['click'],
  // 声明了 emits 的组件，父级的 @click 是组件事件而不是原生监听 ⇒ 桩必须自己 emit，
  // 否则点了没反应，测出来的「拦住了」是假的。
  template: '<button class="btn" :disabled="disabled" @click="$emit(\'click\')"><slot /></button>',
}

function stubs() {
  return { 'a-steps': StepsStub, 'a-step': StepStub, 'a-button': ButtonStub }
}

function buttonByText(w: ReturnType<typeof mount>, text: string) {
  return w.findAllComponents(ButtonStub).find((b) => b.text() === text)
}

function mountWizard(modelValue: WizardState, beforeNext?: (to: number) => boolean | string) {
  return mount(WizardSteps, {
    props: { steps: GEO_WIZARD_STEPS, modelValue, beforeNext },
    slots: { 'step-brand': '<p class="s0">品牌设置步</p>', 'step-platform': '<p class="s4">平台与预算步</p>' },
    global: { stubs: stubs() },
  })
}

describe('WizardSteps：校验不过就拦在原地', () => {
  it('beforeNext 返回字符串 → 步号不变、那句话显示在步底', async () => {
    const w = mountWizard({ current: 0, maxReached: 0 }, () => '请填写品牌名')
    await buttonByText(w, '下一步')!.trigger('click')
    expect(w.emitted('update:modelValue')).toBeFalsy()
    expect(w.find('.admin-wizard__hint').text()).toBe('请填写品牌名')
    expect(w.find('.s0').exists()).toBe(true)
  })

  it('beforeNext 放行 → 前进到第②步，maxReached 记到 1', async () => {
    const w = mountWizard({ current: 0, maxReached: 0 }, () => true)
    await buttonByText(w, '下一步')!.trigger('click')
    expect(w.emitted('update:modelValue')?.[0]?.[0]).toEqual({ current: 1, maxReached: 1 })
    expect(w.find('.admin-wizard__hint').exists()).toBe(false)
  })

  it('最后一步没有「下一步」：P1 到⑤为止没有可点的出口，不假装能跑诊断', () => {
    const w = mountWizard({ current: 4, maxReached: 4 })
    expect(buttonByText(w, '下一步')).toBeUndefined()
    expect(buttonByText(w, '上一步')?.props('disabled')).toBe(false)
  })

  it('第一步「上一步」禁用', () => {
    const w = mountWizard({ current: 0, maxReached: 2 })
    expect(buttonByText(w, '上一步')?.props('disabled')).toBe(true)
  })
})

describe('步骤状态的落盘与回读', () => {
  beforeEach(() => localStorage.clear())

  it('按档案 id 存、按档案 id 取：回到上次走到的那一步', () => {
    saveWizardState(7, { current: 3, maxReached: 4 })
    expect(localStorage.getItem(wizardStorageKey(7))).toBeTruthy()
    expect(loadWizardState(7)).toEqual({ current: 3, maxReached: 4 })
  })

  it('不同档案互不串：换档案从第①步重新开始', () => {
    saveWizardState(7, { current: 3, maxReached: 4 })
    expect(loadWizardState(8)).toEqual({ current: 0, maxReached: 0 })
  })

  it('脏数据一律回第①步，不崩：JSON 坏、步号越界、非整数都算', () => {
    localStorage.setItem(wizardStorageKey(7), 'not-json')
    expect(loadWizardState(7)).toEqual({ current: 0, maxReached: 0 })
    localStorage.setItem(wizardStorageKey(7), JSON.stringify({ current: 99, maxReached: 99 }))
    expect(loadWizardState(7)).toEqual({ current: 0, maxReached: 0 })
    localStorage.setItem(wizardStorageKey(7), JSON.stringify({ current: 'x', maxReached: 1 }))
    expect(loadWizardState(7)).toEqual({ current: 0, maxReached: 0 })
  })

  it('maxReached 不会被回读压小到 current 以下（进度条不许倒退）', () => {
    localStorage.setItem(wizardStorageKey(7), JSON.stringify({ current: 2, maxReached: 1 }))
    expect(loadWizardState(7)).toEqual({ current: 2, maxReached: 2 })
  })

  it('没有档案时用 draft 槽，新建向导的步骤也不丢', () => {
    saveWizardState(null, { current: 1, maxReached: 1 })
    expect(localStorage.getItem(wizardStorageKey(null))).toContain('"current":1')
    expect(loadWizardState(null)).toEqual({ current: 1, maxReached: 1 })
  })
})

describe('第⑤步：只有形状，没有承诺', () => {
  it('写明「下一期接入」与「本页不会安排任何诊断」，主按钮「完成」是禁用的', () => {
    const w = mount(WizardPlatformStep, { global: { stubs: stubs() } })
    expect(w.text()).toContain('平台与预算：下一期接入')
    expect(w.text()).toContain('本页不会安排任何诊断')
    const finish = buttonByText(w, '完成')
    expect(finish).toBeTruthy()
    expect(finish!.props('disabled')).toBe(true)
  })
})

describe('MeasuredCount：没测过 ≠ 0', () => {
  it('null / undefined 显示「未取到」', () => {
    expect(mount(MeasuredCount, { props: { value: null } }).text()).toBe(PH_NOT_MEASURED)
    expect(mount(MeasuredCount, { props: {} }).text()).toBe(PH_NOT_MEASURED)
  })

  it('真测到的 0 就画 0，不许借「未取到」把 0 藏起来', () => {
    const w = mount(MeasuredCount, { props: { value: 0 } })
    expect(w.text()).toBe('0')
    expect(w.attributes('data-measured')).toBe('true')
  })
})
