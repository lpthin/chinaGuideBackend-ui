import { describe, it, expect, vi } from 'vitest'
import { flushPromises, mount } from "@vue/test-utils"
import WizardSteps from '../WizardSteps.vue'
import { createWizardState } from '../wizardModel'

/**
 * 真向导：步骤条 + beforeNext 校验钩子 + 状态在 modelValue 对象里（调用方落库，刷新后传回即回原步）。
 * a-button/a-steps 桩成命名组件——true 桩不渲染 slot 也接不到 click。
 */
const StepsStub = {
  name: 'ASteps',
  props: ['current'],
  template: '<div class="steps" :data-current="current"><slot /></div>',
}
const StepStub = { name: 'AStep', props: ['title'], template: '<span class="step">{{ title }}</span>' }
const ButtonStub = {
  name: 'AButton',
  props: ['disabled', 'type'],
  emits: ['click'],
  template: '<button class="btn" :disabled="disabled" @click="$emit(\'click\')"><slot /></button>',
}

const steps = [
  { key: 'brand', title: '品牌档案' },
  { key: 'questions', title: '问题池' },
  { key: 'confirm', title: '预估确认' },
]

const mountWizard = (props: Record<string, unknown> = {}, slots: Record<string, string> = {}) =>
  mount(WizardSteps, {
    props: { steps, modelValue: createWizardState(), ...props },
    slots,
    global: { stubs: { 'a-steps': StepsStub, 'a-step': StepStub, 'a-button': ButtonStub } },
  })

function clickNext(w: ReturnType<typeof mountWizard>) {
  const next = w.findAllComponents(ButtonStub).find((b) => b.text() === '下一步')
  next!.vm.$emit('click')
}

describe('WizardSteps', () => {
  it('步骤条按 steps 渲染，slot 名是 step-{key}', () => {
    const w = mountWizard({ modelValue: { current: 1, maxReached: 2 } }, { 'step-questions': '<p class="q">题目清单</p>' })
    expect(w.findAll('.step').map((s) => s.text())).toEqual(['品牌档案', '问题池', '预估确认'])
    expect(w.find('.steps').attributes('data-current')).toBe('1')
    expect(w.find('.q').text()).toBe('题目清单')
  })

  it('下一步：emit 新状态对象，maxReached 只增不减', () => {
    const w = mountWizard()
    clickNext(w)
    const emitted = w.emitted('update:modelValue')![0][0]
    expect(emitted).toEqual({ current: 1, maxReached: 1 })
  })

  it('beforeNext 返回字符串＝拦下并念出原因；返回 true 放行', async () => {
    const beforeNext = vi.fn().mockResolvedValueOnce('品牌名还没填').mockResolvedValueOnce(true)
    const w = mountWizard({ beforeNext })
    clickNext(w)
    await flushPromises()
    expect(w.find('.admin-wizard__hint').text()).toBe('品牌名还没填')
    expect(w.emitted('update:modelValue')).toBeFalsy()
    clickNext(w)
    await flushPromises()
    expect(w.emitted('update:modelValue')).toBeTruthy()
  })

  it('往回走不做校验', async () => {
    const beforeNext = vi.fn()
    const w = mountWizard({ modelValue: { current: 2, maxReached: 2 }, beforeNext })
    const back = w.findAllComponents(ButtonStub).find((b) => b.text() === '上一步')
    back!.vm.$emit('click')
    expect(beforeNext).not.toHaveBeenCalled()
    expect(w.emitted('update:modelValue')![0][0]).toEqual({ current: 1, maxReached: 2 })
  })

  it('末步不再出「下一步」按钮', () => {
    const w = mountWizard({ modelValue: { current: 2, maxReached: 2 } })
    expect(w.findAllComponents(ButtonStub).some((b) => b.text() === '下一步')).toBe(false)
  })

  it('刷新不丢步：调用方持久化的对象传回来，就停在那一步', () => {
    const persisted = { current: 2, maxReached: 2 }
    const w = mountWizard({ modelValue: persisted }, { 'step-confirm': '<p>确认页</p>' })
    expect(w.find('.steps').attributes('data-current')).toBe('2')
    expect(w.find('p').text()).toBe('确认页')
  })

  it('首步「上一步」禁用', () => {
    const w = mountWizard()
    const back = w.findAllComponents(ButtonStub).find((b) => b.text() === '上一步')
    expect(back!.props('disabled')).toBe(true)
  })
})
