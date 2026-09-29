import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import QuestionDraftRow from '../QuestionDraftRow.vue'
import {
  MENTION_QUESTION_WARNING,
  REPUTATION_QUESTION_WARNING,
  questionViolation,
  validateStepAdvance,
} from '../geoBrandWizard'

/**
 * 两类题的判据（Spec-F §11.2 的「双向负例」验收）：
 * - MENTION 题面出现品牌名/品牌词 ⇒ 拦，警告原话「可见度问题的题面不能出现品牌名：这样几乎一定会被提到，看不出与同行差距」；
 * - REPUTATION 题面没有品牌名 ⇒ 拦，警告原话「口碑问题的题面必须出现品牌名，否则测不出别人怎么评价我们」；
 * 反向各一条放行。两句都是后端 GeoQuestionKinds 的逐字镜像。
 * 判据本体只有 geoBrandWizard.questionViolation 一份：
 * 组件红字、按钮禁用、向导 beforeNext 拦住「下一步」用的都是它的返回值。
 */

const TOKENS = ['测试品牌', 'Acme']

const InputStub = { name: 'AInput', props: ['value'], template: '<input class="core-input" :value="value" />' }
const TextareaStub = {
  name: 'ATextarea',
  props: ['value', 'rows'],
  emits: ['update:value'],
  template: '<textarea class="question-input" :value="value"></textarea>',
}
const ButtonStub = {
  name: 'AButton',
  props: ['disabled', 'type', 'loading'],
  emits: ['click'],
  template: '<button class="btn" :disabled="disabled"><slot /></button>',
}

function mountRow(kind: 'MENTION' | 'REPUTATION', questionText: string) {
  return mount(QuestionDraftRow, {
    props: { kind, tokens: TOKENS, coreWord: '口腔', questionText },
    global: { stubs: { 'a-input': InputStub, 'a-textarea': TextareaStub, 'a-button': ButtonStub } },
  })
}

function submitButton(w: ReturnType<typeof mountRow>) {
  return w.findAllComponents(ButtonStub).find((b) => b.text() === '加入问题池')!
}

describe('判据本体（与后端拒绝条件是同一句话）', () => {
  it('MENTION：题面含品牌名 → 拦下并给警告原文', () => {
    expect(questionViolation('MENTION', '测试品牌最新活动有哪些', TOKENS)).toBe(MENTION_QUESTION_WARNING)
  })

  it('MENTION：题面含英文品牌词按大小写不敏感拦（模型回答里品牌名常见混排）', () => {
    expect(questionViolation('MENTION', 'acme 的售后怎么样', TOKENS)).toBe(MENTION_QUESTION_WARNING)
  })

  it('MENTION：题面不带品牌名的行业问题放行', () => {
    expect(questionViolation('MENTION', '杭州哪家口腔诊所比较靠谱', TOKENS)).toBe(null)
  })

  it('REPUTATION：题面没有品牌名 → 拦下并给警告原文', () => {
    expect(questionViolation('REPUTATION', '杭州哪家口腔诊所比较靠谱', TOKENS)).toBe(REPUTATION_QUESTION_WARNING)
  })

  it('REPUTATION：题面带品牌名放行', () => {
    expect(questionViolation('REPUTATION', '大家怎么评价测试品牌的服务', TOKENS)).toBe(null)
  })

  it('validateStepAdvance：第①步品牌名必填、③④步带不合格草稿就拦在原地', () => {
    const base = { mentionDraft: { coreWord: '', questionText: '' }, reputationDraft: { coreWord: '', questionText: '' }, tokens: TOKENS }
    expect(validateStepAdvance({ ...base, from: 0, brandName: '' })).toBe('请填写品牌名')
    expect(validateStepAdvance({ ...base, from: 0, brandName: '测试品牌' })).toBe(true)
    expect(validateStepAdvance({ ...base, from: 2, brandName: '测试品牌', mentionDraft: { coreWord: '', questionText: '测试品牌怎么样' } }))
      .toBe(MENTION_QUESTION_WARNING)
    expect(validateStepAdvance({ ...base, from: 3, brandName: '测试品牌', reputationDraft: { coreWord: '', questionText: '哪家最好' } }))
      .toBe(REPUTATION_QUESTION_WARNING)
    expect(validateStepAdvance({ ...base, from: 2, brandName: '测试品牌', mentionDraft: { coreWord: '', questionText: '哪家口腔最好' } }))
      .toBe(true)
  })
})

describe('QuestionDraftRow 真组件：红字警告与按钮禁用同源', () => {
  it('MENTION 题面含品牌名：警告逐字渲染，提交按钮禁用', () => {
    const w = mountRow('MENTION', '测试品牌最新活动有哪些')
    expect(w.find('.geobrand-question-warning').text()).toBe(MENTION_QUESTION_WARNING)
    expect(submitButton(w).props('disabled')).toBe(true)
  })

  it('MENTION 干净题面：没有警告，按钮可提交', () => {
    const w = mountRow('MENTION', '杭州哪家口腔诊所比较靠谱')
    expect(w.find('.geobrand-question-warning').exists()).toBe(false)
    expect(submitButton(w).props('disabled')).toBe(false)
  })

  it('REPUTATION 缺品牌名：警告逐字渲染，按钮禁用', () => {
    const w = mountRow('REPUTATION', '杭州哪家口腔诊所比较靠谱')
    expect(w.find('.geobrand-question-warning').text()).toBe(REPUTATION_QUESTION_WARNING)
    expect(submitButton(w).props('disabled')).toBe(true)
  })

  it('REPUTATION 带品牌名：没有警告，按钮可提交', () => {
    const w = mountRow('REPUTATION', '大家怎么评价测试品牌的服务')
    expect(w.find('.geobrand-question-warning').exists()).toBe(false)
    expect(submitButton(w).props('disabled')).toBe(false)
  })
})
