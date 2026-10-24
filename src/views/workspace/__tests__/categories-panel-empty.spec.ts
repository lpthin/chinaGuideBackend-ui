import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { Button, message } from 'ant-design-vue'
import CategoriesPanel from '../CategoriesPanel.vue'
import { categoryApi } from '../../../api'

/**
 * 栏目管理屏的空态（M-P72）：这一屏的空会被读成「这一家没有栏目」，
 * 所以「读不到」与「真的没有」必须念后端那一句；读不到时统计数也不许摆 0。
 *
 * 钉五件：
 * 1. 后端答的两种空各念各的，页面上不许再出现「暂无分类」；
 * 2. 后端没答成因时界面不替它猜；
 * 3. 读失败说的是读失败，不是「这一档没有」；
 * 4. 读不到与读失败时三格统计摆「—」，只有「真的没有」才摆 0；
 * 5. 「真的没有」才摆新增按钮，读不到不摆。
 */

vi.mock('ant-design-vue', async () => {
  const actual = await vi.importActual<Record<string, any>>('ant-design-vue')
  return {
    ...actual,
    message: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
    Modal: { confirm: vi.fn() }
  }
})

vi.mock('../../../api', () => ({
  categoryApi: {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn()
  }
}))

vi.mock('echarts', () => ({
  init: vi.fn(),
  getInstanceByDom: vi.fn()
}))

const PASS_THROUGH = (name: string) => ({
  name,
  template: `<div class="${name.toLowerCase()}-stub"><slot /><slot name="title" /><slot name="actions" /><slot name="extra" /></div>`
})

const FIELD_STUB = (name: string) => ({ name, template: `<input class="${name.toLowerCase()}-stub" />` })

type ListShape = {
  records: any[]
  emptyReason?: string | null
  emptyLine?: string | null
}

async function mountView(rows: any[], extras: Omit<ListShape, 'records'> = {}, failWith?: Error) {
  const list = vi.mocked(categoryApi.list)
  if (failWith) {
    list.mockRejectedValue(failWith)
  } else {
    list.mockResolvedValue({
      records: rows,
      total: rows.length,
      page: 1,
      size: Math.max(rows.length, 1),
      pages: rows.length ? 1 : 0,
      ...extras
    } as any)
  }

  const wrapper = mount(CategoriesPanel, {
    global: {
      stubs: {
        'filter-bar': {
          name: 'FilterBar',
          template: '<div class="filter-bar-stub"><slot /><slot name="actions" /></div>'
        },
        'a-spin': PASS_THROUGH('ASpin'),
        'a-card': PASS_THROUGH('ACard'),
        'a-row': PASS_THROUGH('ARow'),
        'a-col': PASS_THROUGH('ACol'),
        'a-space': PASS_THROUGH('ASpace'),
        'a-tag': { name: 'ATag', template: '<span class="tag-stub"><slot /></span>' },
        'a-tabs': PASS_THROUGH('ATabs'),
        'a-tab-pane': PASS_THROUGH('ATabPane'),
        'a-form': PASS_THROUGH('AForm'),
        'a-form-item': PASS_THROUGH('AFormItem'),
        'a-divider': PASS_THROUGH('ADivider'),
        'a-modal': PASS_THROUGH('AModal'),
        'a-tree': { name: 'ATree', template: '<div class="tree-stub"><slot /></div>' },
        'a-button': Button,
        'a-input-search': FIELD_STUB('AInputSearch'),
        'a-input': FIELD_STUB('AInput'),
        'a-textarea': { name: 'ATextarea', template: '<textarea class="a-textarea-stub"></textarea>' },
        'a-input-number': { name: 'AInputNumber', template: '<input class="a-input-number-stub" />' },
        'a-select': PASS_THROUGH('ASelect'),
        'a-select-option': { name: 'ASelectOption', template: '<option><slot /></option>' },
        'a-tree-select': PASS_THROUGH('ATreeSelect'),
        'a-switch': PASS_THROUGH('ASwitch'),
        'a-checkbox': PASS_THROUGH('ACheckbox'),
        'a-radio': PASS_THROUGH('ARadio')
      }
    }
  })
  await flushPromises()
  return wrapper
}

const hintText = (wrapper: any) => {
  const node = wrapper.find('.empty-line').element.cloneNode(true) as HTMLElement
  node.querySelectorAll('.create-on-empty').forEach((button) => button.remove())
  return (node.textContent || '').trim()
}

const statValues = (wrapper: any) =>
  wrapper.findAll('.stat-value').map((node: any) => (node.text() || '').trim())

const ROW = {
  id: 7,
  name: '新闻',
  slug: 'news',
  parentId: 0,
  status: 'enabled',
  articleCount: 3
}

describe('CategoriesPanel 的空态成因', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it.each([
    ['NONE', '栏目：这一档查过了，一条都没有。'],
    ['NOT_VISIBLE', '栏目：这一档读不到（选中的那个身份在这张表里没有行），所以这里不能说「没有」。']
  ])('后端回 %s 那一档时逐字念那一句，页面上没有「暂无分类」', async (reason, line) => {
    const wrapper = await mountView([], { emptyReason: reason, emptyLine: line })

    expect(hintText(wrapper)).toBe(line)
    expect(wrapper.html()).not.toContain('暂无分类')
  })

  it('后端没回是哪一种空时念「界面不替它猜」，不蒙成「真的没有」', async () => {
    const wrapper = await mountView([], { emptyReason: null, emptyLine: null })

    expect(hintText(wrapper)).toContain('后端没回是哪一种空')
    expect(wrapper.html()).not.toContain('一条都没有')
  })

  it('读失败那一发说的是读失败，不是「这一档没有」', async () => {
    const wrapper = await mountView([], {}, new Error('读口断了'))

    const said = hintText(wrapper)
    expect(said).toContain('这一发读失败：读口断了')
    expect(said).toContain('读失败不是「这一档没有」')
    expect(said).not.toContain('一条都没有')
  })

  it('读不到时三格统计摆「—」，只有「真的没有」才摆 0', async () => {
    const invisible = await mountView([], {
      emptyReason: 'NOT_VISIBLE',
      emptyLine: '栏目：这一档读不到（选中的那个身份在这张表里没有行），所以这里不能说「没有」。'
    })
    expect(statValues(invisible)).toEqual(['—', '—', '—'])

    const none = await mountView([], { emptyReason: 'NONE', emptyLine: '栏目：这一档查过了，一条都没有。' })
    expect(statValues(none)).toEqual(['0', '0', '0'])
  })

  it('读失败时统计也摆「—」', async () => {
    const wrapper = await mountView([], {}, new Error('读口断了'))

    expect(statValues(wrapper)).toEqual(['—', '—', '—'])
  })

  it('「真的没有」才摆新增按钮，读不到不摆', async () => {
    const none = await mountView([], { emptyReason: 'NONE', emptyLine: '栏目：这一档查过了，一条都没有。' })
    expect(none.find('.create-on-empty').exists()).toBe(true)

    const invisible = await mountView([], {
      emptyReason: 'NOT_VISIBLE',
      emptyLine: '栏目：这一档读不到（选中的那个身份在这张表里没有行），所以这里不能说「没有」。'
    })
    expect(invisible.find('.create-on-empty').exists()).toBe(false)
  })

  it('有行的时候根本不渲空态那一句，统计照实念', async () => {
    const wrapper = await mountView([ROW])

    expect(wrapper.find('.empty-line').exists()).toBe(false)
    expect(statValues(wrapper)).toEqual(['1', '3', '1'])
  })

  it('读失败后本屏清空，不把上一发那一条当成还在', async () => {
    const wrapper = await mountView([], {}, new Error('读口断了'))

    expect(wrapper.find('.tree-stub').exists()).toBe(false)
    expect(message.error).toHaveBeenCalledWith('分类数据加载失败：读口断了')
  })
})
