import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { h } from 'vue'
import { Button, Col, Form, FormItem, Row, message } from 'ant-design-vue'
import ArticleTemplateView from '../ArticleTemplateView.vue'
import { articleTemplateApi } from '../../../api/ai-model'

/**
 * 顶部那四块统计卡（M-P75 现场抓到）：删掉一行之后表里少了一行，统计卡还写着旧的「模板总数」。
 * 统计和那张表读的是同一批行，写完不跟着刷就是界面谎报。
 *
 * 这一档只挂真实控件那一族：表格用替身渲 bodyCell（编辑/复制/删除三颗是真 a-button，
 * 气泡确认按「界面真点得到」替成一颗会 emit confirm 的按钮——真 Popconfirm 要点弹层里的确定，
 * jsdom 里那层弹层不挂），删完让 list 回空表，断言统计卡跟着归零。
 */

vi.mock('ant-design-vue', async () => {
  const actual = await vi.importActual<Record<string, any>>('ant-design-vue')
  return {
    ...actual,
    message: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() }
  }
})

vi.mock('../../../api/ai-model', () => ({
  articleTemplateApi: {
    list: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    toggleStatus: vi.fn(),
    copy: vi.fn(),
    delete: vi.fn()
  }
}))

vi.mock('../../../stores/auth', () => ({
  useAuthStore: () => ({
    selectedTenantId: null,
    tenantId: 1,
    user: { id: 1 },
    isSuperAdmin: true,
    hasPermission: () => true
  })
}))

const ROW = {
  id: 7,
  name: '软文模板甲',
  category: 'marketing',
  description: '示例',
  content: '内容',
  variables: '[]',
  isActive: true,
  isSystem: false
}

const TABLE_STUB = {
  name: 'ATable',
  props: {
    dataSource: { type: Array, default: () => [] },
    columns: { type: Array, default: () => [] },
    loading: { type: Boolean, default: false },
    pagination: { type: [Object, Boolean], default: () => ({}) }
  },
  setup(props: any, { slots }: any) {
    return () => {
      const rows = props.dataSource as any[]
      if (props.pagination === false) {
        return h('div', { class: 'vars-table-stub' }, [rows.length ? '有变量' : ''])
      }
      return h('div', { class: 'table-stub' }, [
        rows.length === 0
          ? h('div', { class: 'empty' }, slots.emptyText ? slots.emptyText({}) : '暂无数据')
          : rows.map((record) =>
              h('div', { class: 'row', 'data-row': record.id }, [
                ...(slots.bodyCell ? [slots.bodyCell({ column: { key: 'action' }, record })] : [])
              ])
            )
      ])
    }
  }
}

const PASS_THROUGH = (name: string, tag = 'div') => ({
  name,
  template: `<${tag} class="${name.toLowerCase()}-stub"><slot /><slot name="overlay" /></${tag}>`
})

function statValues(wrapper: any) {
  return wrapper.findAll('.stat-value').map((node: any) => node.text())
}

async function mountView() {
  let deleted = false
  vi.mocked(articleTemplateApi.list).mockImplementation((params: any) => {
    const rows = deleted ? [] : [ROW]
    return Promise.resolve({ records: rows, total: rows.length } as any)
  })
  vi.mocked(articleTemplateApi.delete).mockImplementation(() => {
    deleted = true
    return Promise.resolve(undefined as any)
  })

  const wrapper = mount(ArticleTemplateView, {
    attachTo: document.body,
    global: {
      stubs: {
        'filter-bar': {
          name: 'FilterBar',
          template: '<div class="filter-bar-stub"><slot /><slot name="actions" /></div>'
        },
        'a-card': PASS_THROUGH('ACard'),
        'a-space': PASS_THROUGH('ASpace'),
        'a-table': TABLE_STUB,
        'a-input-search': { name: 'AInputSearch', template: '<input class="search-stub" />' },
        'a-input': { name: 'AInput', template: '<input class="input-stub" />' },
        'a-textarea': { name: 'ATextarea', template: '<textarea class="textarea-stub"></textarea>' },
        'a-select': { name: 'ASelect', template: '<select class="select-stub"></select>' },
        'a-select-option': {
          name: 'ASelectOption',
          props: ['value'],
          template: '<option :value="value"><slot /></option>'
        },
        'a-button': Button,
        'a-switch': { name: 'ASwitch', template: '<span class="switch-stub" />' },
        'a-tag': { name: 'ATag', template: '<span class="tag-stub"><slot /></span>' },
        'a-popconfirm': {
          name: 'APopconfirm',
          props: ['title'],
          emits: ['confirm'],
          template: '<span class="popconfirm-stub"><slot /><button class="yes" @click="$emit(\'confirm\')">确认删除</button></span>'
        },
        'a-divider': { name: 'ADivider', template: '<hr class="divider-stub" />' },
        'a-modal': {
          name: 'AModal',
          props: ['open'],
          template: '<div class="modal-stub"><slot v-if="open" /></div>'
        },
        'a-form': Form,
        'a-form-item': FormItem,
        'a-row': Row,
        'a-col': Col
      }
    }
  })
  await flushPromises()
  return wrapper
}

describe('ArticleTemplateView 的统计卡', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('删掉一行后统计卡跟着变，不许还写着删之前那个数', async () => {
    const wrapper = await mountView()

    expect(statValues(wrapper)[0]).toBe('1')

    await wrapper.find('.popconfirm-stub .yes').trigger('click')
    await flushPromises()

    expect(articleTemplateApi.delete).toHaveBeenCalledWith(7)
    expect(wrapper.findAll('.row')).toHaveLength(0)
    expect(statValues(wrapper)).toEqual(['0', '0', '0', '0'])
    expect(message.success).toHaveBeenCalledWith('删除成功')
  })
})
