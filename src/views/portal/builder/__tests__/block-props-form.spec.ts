import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { Alert, Input, InputNumber, Radio, Select, Switch, Textarea } from 'ant-design-vue'
import BlockPropsForm from '../BlockPropsForm.vue'

/**
 * 这个表单是「区块白名单 → 界面」的最后一环：槽位是字面内容还是门户数据绑定，
 * 决定了保存进 layout_json 的结构长什么样，所以两条切换路径都得钉住。
 *
 * setup.ts 把所有 a-* 组件桩掉了，而这里要验的正是「真实控件的 change 事件能不能变成一次写入」，
 * 所以逐个把用到的控件换成真组件：桩件不会 emit，用它测出来的绿是假的。
 */
const REAL_CONTROLS = {
  'a-radio-group': Radio.Group,
  'a-radio-button': Radio.Button,
  'a-textarea': Textarea,
  'a-select': Select,
  'a-input': Input,
  'a-input-number': InputNumber,
  'a-switch': Switch,
  'a-alert': Alert
}

const STUBS_OFF = {
  'a-radio-group': false,
  'a-radio-button': false,
  'a-textarea': false,
  'a-select': false,
  'a-input': false,
  'a-input-number': false,
  'a-switch': false,
  'a-alert': false
} as const

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    title: { oneOf: [{ type: 'string', maxLength: 200 }, { type: 'object', additionalProperties: false, properties: { $data: { type: 'string' } }, required: ['$data'] }] },
    items: { type: 'object', additionalProperties: false, properties: { $data: { type: 'string' } }, required: ['$data'] },
    columns: { type: 'integer', minimum: 1, maximum: 4 },
    featured: { type: 'boolean' },
    layout: { enum: ['grid', 'list'] },
    media: { type: 'object', description: '不认识的形状' }
  }
} as const

function mountForm(model: Record<string, unknown>) {
  return mount(BlockPropsForm, {
    global: { components: REAL_CONTROLS, stubs: { ...STUBS_OFF } },
    props: { schema: SCHEMA as unknown as Record<string, unknown>, model, allowedSources: ['heroData.title', 'services'] }
  })
}

function rowOf(wrapper: ReturnType<typeof mountForm>, name: string) {
  return wrapper.findAll('.block-props-form__row').find(row => row.find('.block-props-form__label span')?.text() === name)
}

function lastEmitted(wrapper: ReturnType<typeof mountForm>): Record<string, unknown> | undefined {
  const calls = wrapper.emitted('update:model')
  const last = calls && calls[calls.length - 1]
  return last ? (last[0] as Record<string, unknown>) : undefined
}

describe('BlockPropsForm 由区块 schema 生成的槽位表单', () => {
  it('绑定中的槽位显示绑定模式，字面值槽位显示文本框', () => {
    const wrapper = mountForm({ title: { $data: 'heroData.title' }, featured: true })
    expect(rowOf(wrapper, 'title')!.find('textarea').exists()).toBe(false)
    expect(rowOf(wrapper, 'featured')!.find('button[role=switch]').exists()).toBe(true)
  })

  it('从绑定切回字面内容时写入空串，不留第二份真相', async () => {
    const wrapper = mountForm({ title: { $data: 'heroData.title' } })
    const row = rowOf(wrapper, 'title')!
    await row.findAll('input[type=radio]')[0]!.setValue('literal')
    expect(lastEmitted(wrapper)).toEqual({ title: '' })
  })

  it('从字面内容切到绑定时写入 {$data:""}，让校验器去拒而不是前端猜字段', async () => {
    const wrapper = mountForm({ title: '种植牙专科' })
    const row = rowOf(wrapper, 'title')!
    await row.findAll('input[type=radio]')[1]!.setValue('binding')
    expect(lastEmitted(wrapper)).toEqual({ title: { $data: '' } })
  })

  it('只有 $data 形状的槽位不给字面内容入口', () => {
    const wrapper = mountForm({ items: { $data: 'services' } })
    const row = rowOf(wrapper, 'items')!
    expect(row.findAll('input[type=radio]')).toHaveLength(0)
    expect(row.find('textarea').exists()).toBe(false)
  })

  it('枚举、整数、布尔各按自己的控件写入原值', async () => {
    const wrapper = mountForm({ featured: false })
    await rowOf(wrapper, 'featured')!.find('button[role=switch]').trigger('click')
    expect(lastEmitted(wrapper)).toEqual({ featured: true })
    expect(rowOf(wrapper, 'layout')!.find('.ant-select').exists()).toBe(true)
    expect(rowOf(wrapper, 'columns')!.find('.ant-input-number').exists()).toBe(true)
  })

  it('认不出的形状退化成只读并说明原因，不凭空造结构', () => {
    const wrapper = mountForm({ media: { url: 'x' } })
    const row = rowOf(wrapper, 'media')!
    expect(row.text()).toContain('无法识别的结构，只读')
    expect(row.find('input').attributes('disabled')).toBeDefined()
  })
})
