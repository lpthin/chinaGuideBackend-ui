import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import EmptyListHint from '../EmptyListHint.vue'

/**
 * 空态那一格的四件硬事（M-P53 拍板「只保人会看错的屏」+「没有时给个新建入口」）：
 *
 * 1. 后端答了成因就逐字念那一句，界面不改写、不合并（话术唯一出处是后端 `EmptyResultReasons`）。
 * 2. 新建入口只在「后端答了 NONE」且「这一屏真有新建动作、登录的人有权限」两件事同时成立时摆。
 *    少摆一颗按钮人还能自己找；多摆一颗会骗人去补一份根本不缺的东西，所以这一条要钉死。
 * 3. 点它要真的把 create 事件发出去（事件名写成工厂函数会静默失效，界面照样渲得出来）。
 * 4. 读失败与「没行」是两件事，不许混。
 */
const BUTTON = {
  name: 'AButton',
  // 声明 emits 是必要的：不声明时父组件的 @click 会既当组件事件监听、又当原生监听挂到同一个
  // button 上，一次点击跑两遍（第一版就红在这里，报的是 emitted 两条）。
  emits: ['click'],
  template: '<button class="btn-stub" :class="type" @click="$emit(\'click\')"><slot /></button>'
}

const mountHint = (props: Record<string, unknown>) =>
  mount(EmptyListHint, { props, global: { stubs: { 'a-button': BUTTON } } } as any)

describe('EmptyListHint 念的是后端那句原文', () => {
  it('后端给了 emptyLine 就逐字念它，一个字不改', () => {
    const line = '报警规则：这一档查过了，一条都没有。'
    const w = mountHint({ emptyLine: line, emptyReason: 'NONE' })
    expect(w.text()).toBe(line)
  })

  it('后端没答（两格都空着）时念自己那句兜底，不蒙成任何一种成因', () => {
    const w = mountHint({ emptyLine: null, emptyReason: null })
    expect(w.text()).toContain('后端没回是哪一种空')
    expect(w.text()).not.toContain('一条都没有')
  })

  it('读失败优先：说的是读失败，不是「这一档没有」', () => {
    const w = mountHint({ readFailed: '读口断了', emptyLine: '报警规则：这一档查过了，一条都没有。' })
    expect(w.text()).toContain('这一发读失败：读口断了')
    expect(w.text()).toContain('读失败不是「这一档没有」')
    expect(w.text()).not.toContain('一条都没有')
  })

  it('还在读的时候整句不渲，免得先闪一句「没有」', () => {
    const w = mountHint({ loading: true, emptyLine: '报警规则：这一档查过了，一条都没有。' })
    expect(w.text()).toBe('')
  })
})

describe('EmptyListHint 那颗新建入口', () => {
  it('后端答 NONE、这一屏有新建动作且有权限 → 摆按钮，label 用传进来的那句', () => {
    const w = mountHint({ emptyLine: 'A', emptyReason: 'NONE', canCreate: true, createLabel: '新建一条规则' })
    const btn = w.find('.btn-stub')
    expect(btn.exists()).toBe(true)
    expect(btn.text()).toBe('新建一条规则')
  })

  it('点它真的把 create 事件发出去', async () => {
    const w = mountHint({ emptyLine: 'A', emptyReason: 'NONE', canCreate: true })
    await w.find('.btn-stub').trigger('click')
    expect(w.emitted('create')).toHaveLength(1)
  })

  const NO_BUTTON: Array<[string, Record<string, unknown>]> = [
    ['读不到这一档（NOT_VISIBLE）', { emptyReason: 'NOT_VISIBLE' }],
    ['这一页翻过了头（OUT_OF_RANGE）', { emptyReason: 'OUT_OF_RANGE' }],
    ['后端没答是哪一种空', { emptyReason: null }],
    ['没权限的人（canCreate=false）', { emptyReason: 'NONE', canCreate: false }]
  ]

  it.each(NO_BUTTON)('%s → 不摆新建入口', (_label, props) => {
    const w = mountHint({ emptyLine: 'A', canCreate: true, createLabel: '新建', ...props })
    expect(w.find('.btn-stub').exists()).toBe(false)
  })

  it('不认识的码一律当「后端没答」：既不摆按钮，也不念成某一句成因', () => {
    const w = mountHint({ emptyLine: undefined, emptyReason: 'WEIRD' as any, canCreate: true })
    expect(w.find('.btn-stub').exists()).toBe(false)
    expect(w.text()).toContain('后端没回是哪一种空')
  })
})
