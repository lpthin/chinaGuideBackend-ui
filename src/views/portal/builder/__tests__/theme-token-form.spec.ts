import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { Button, Input, InputNumber, Select } from 'ant-design-vue'
import ThemeTokenForm from '../ThemeTokenForm.vue'
import type { ThemeTokenField } from '../../../../api/themePresets'

/**
 * 样式变量行的唯一渲法（搭建器的「本页覆盖」与站级主题面板都走这一份）。
 *
 * 钉的是「后端那份白名单的种类有没有被如实渲出来」，尤其字体那一档：
 * 字体槽一旦渲成输入框，界面就允许人敲 `18px Whatever, url(...)`，而 theme_json 的值
 * 最后会变成 CSS 的 font-family——那是 D4「不许产出任意样式」那条红线的侧面。
 * 所以这里既要点名下拉（选项来自 /tokens，不在这儿抄第二份字体清单），
 * 也要点名那一行里没有自由文本框。
 *
 * 控件全部挂真的：桩件不 emit，「点了清却什么都没发」那种绿是假的。
 */
const REAL_CONTROLS = {
  'a-select': Select,
  'a-input': Input,
  'a-input-number': InputNumber,
  'a-button': Button
}

const STUBS_OFF = {
  'a-select': false,
  'a-input': false,
  'a-input-number': false,
  'a-button': false
} as const

const FIELDS: ThemeTokenField[] = [
  { key: 'colorPrimary', kind: 'COLOR', min: 0, max: 0 },
  { key: 'fontScale', kind: 'SCALE', min: 0.8, max: 1.4 },
  {
    key: 'fontHeading',
    kind: 'FONT',
    min: 0,
    max: 0,
    options: [{ value: 'songti', label: '宋体' }, { value: 'pingfang', label: '苹方' }]
  }
]

function mountForm(model: Record<string, string | number> = {}) {
  return mount(ThemeTokenForm, {
    props: { fields: FIELDS, model, emptyHint: '没有可改的键' },
    global: { components: REAL_CONTROLS, stubs: { ...STUBS_OFF } }
  })
}

function rowOf(wrapper: ReturnType<typeof mountForm>, key: string) {
  const field = FIELDS.find(item => item.key === key)
  const label = { colorPrimary: '主色', fontScale: '字号比例', fontHeading: '标题字体' }[key]
  if (!field) throw new Error(`字段清单里没有 ${key}`)
  const row = wrapper.findAll('.theme-token-form__row')
    .find(item => item.find('label')?.text() === label)
  if (!row) throw new Error(`「${label}」那一行没渲出来（label 用的是中文展示名，见 designTokens）`)
  return row
}

describe('ThemeTokenForm 按白名单种类渲出的那一行', () => {
  it('字体那一档是下拉，选项就是服务端给的这几档', () => {
    const wrapper = mountForm()
    const select = rowOf(wrapper, 'fontHeading').findComponent(Select)
    expect(select.props('options') as unknown[]).toEqual([
      { value: 'songti', label: '宋体' },
      { value: 'pingfang', label: '苹方' }
    ])
  })

  it('字体那一档绝不给自由文本框：值会变成 CSS 的 font-family', () => {
    const wrapper = mountForm()
    expect(rowOf(wrapper, 'fontHeading').find('input.ant-input').exists()).toBe(false)
    // 颜色那一档才该是文本框，两条放一起测才分得出「按种类渲」而不是「全都渲成下拉」
    expect(rowOf(wrapper, 'colorPrimary').find('input.ant-input').exists()).toBe(true)
  })

  it('比例那一档带着服务端给的区间', () => {
    const wrapper = mountForm()
    const number = rowOf(wrapper, 'fontScale').findComponent(InputNumber)
    expect(number.props('min')).toBe(0.8)
    expect(number.props('max')).toBe(1.4)
  })

  it('改一个键只发那一个键，其余不动', async () => {
    const wrapper = mountForm({ colorPrimary: '#1B6EF3', radius: '8px' })
    await rowOf(wrapper, 'colorPrimary').find('input.ant-input').setValue('#ff6b35')
    const emitted = wrapper.emitted('update')
    const last = emitted && emitted[emitted.length - 1]
    expect(last?.[0]).toBe('colorPrimary')
    expect(last?.[1]).toBe('#ff6b35')
  })

  it('每行都有「清」，清的是这一键', async () => {
    const wrapper = mountForm()
    await rowOf(wrapper, 'colorPrimary').findAll('button')[0]!.trigger('click')
    expect(wrapper.emitted('clear')?.[0]?.[0]).toBe('colorPrimary')
  })

  it('白名单为空时把「为什么没有框」说出来，不留一个空白面板', () => {
    const wrapper = mount(ThemeTokenForm, {
      props: { fields: [], model: {}, emptyHint: '样式变量清单还没取到' },
      global: { components: REAL_CONTROLS, stubs: { ...STUBS_OFF } }
    })
    expect(wrapper.findAll('.theme-token-form__row').length).toBe(0)
    expect(wrapper.text()).toContain('样式变量清单还没取到')
  })
})
