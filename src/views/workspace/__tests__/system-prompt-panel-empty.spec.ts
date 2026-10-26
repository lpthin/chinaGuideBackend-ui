import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { h } from 'vue'
import { message } from 'ant-design-vue'
import SystemPromptPanel from '../SystemPromptPanel.vue'
import { systemPromptApi } from '../../../api'
import { JUMP_BACK_NOTICE } from '../../../utils/emptyPage'

/**
 * 超管「系统提示词模板」那一屏（M-P78）。
 *
 * 这一屏有两处会谎报：
 * 1. 空表只念 antd 默认的「暂无数据」，「真的没有」与「这一发读失败」念出来是同一句；
 * 2. 表格把翻页整个关掉（`:pagination="false"`）、请求也不带 page/size，于是后端默认只回前 20 条
 *    ——现读库里有 22 条，界面上永远看不见剩下的那几条，看着像「一共就这 20 条」。
 *
 * 钉九件，全部挂真实控件（表格替身走它自己的 change 事件，不直接改 pagination）：
 * 请求带页码、后端总条数摆进分页器、三种空各念各的、后端没答时界面不猜、
 * 读失败说的是读失败并且清掉旧行、翻过头自动回第一页、只有「真的没有」摆新建、
 * 空那一格那颗新建真的开得弹窗（与工具栏那颗同名，选择器必须收到 `.empty` 里面）、有行不渲空态。
 */

vi.mock('ant-design-vue', async () => {
  const actual = await vi.importActual<Record<string, any>>('ant-design-vue')
  return {
    ...actual,
    message: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() }
  }
})

vi.mock('../../../api', () => ({
  systemPromptApi: {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn()
  }
}))

/** 表格替身：行、空态那一格、以及分页器从后端拿到的总条数（那一条是这一屏旧缺陷的所在） */
const TABLE_STUB = {
  name: 'ATable',
  props: {
    dataSource: { type: Array, default: () => [] },
    loading: { type: Boolean, default: false },
    pagination: { type: [Object, Boolean], default: false }
  },
  emits: ['change'],
  setup(props: any, { slots, emit }: any) {
    return () => {
      const rows = props.dataSource as any[]
      const total = typeof props.pagination === 'object' ? props.pagination?.total : undefined
      return h('div', { class: 'table-stub' }, [
        h('button', { class: 'go-page', onClick: () => emit('change', { current: 3, pageSize: 10 }) }, '到第 3 页'),
        h('span', { class: 'pagination-total' }, String(total)),
        rows.length === 0
          ? h('div', { class: 'empty' }, slots.emptyText ? slots.emptyText({}) : '暂无数据')
          : rows.map((record) =>
              h('div', { class: 'row', 'data-row': record.id }, [
                h('span', { class: 'cell-name' }, String(record.name))
              ])
            )
      ])
    }
  }
}

/** 关着的弹窗不许把它的表单与「暂无」字样漏进同一页（M-P73 那一课的壳缺陷） */
const MODAL_STUB = {
  name: 'AModal',
  props: { open: { type: Boolean, default: false }, title: { type: String, default: '' } },
  setup(props: any, { slots }: any) {
    return () => (props.open ? h('div', { class: 'modal-stub' }, slots.default?.()) : null)
  }
}

const PASS_THROUGH = (name: string, tag = 'div') => ({
  name,
  template: `<${tag} class="${name.toLowerCase()}-stub"><slot /><slot name="icon" /></${tag}>`
})

const ROW = { id: 23, name: '建站出方案·跨页一致性重问默认模板', purpose: 'site_proposal', version: 'v1', enabled: true }

type PageShape = { records: any[]; total: number; pages?: number; emptyReason?: string | null; emptyLine?: string | null }

async function mountView(
  rows: any[],
  pageExtras: Omit<PageShape, 'records' | 'total'> & { total?: number } = {}
) {
  const list = vi.mocked(systemPromptApi.list)
  list.mockResolvedValue({
    records: rows,
    total: pageExtras.total ?? rows.length,
    page: 1,
    size: 10,
    pages: 1,
    emptyReason: null,
    emptyLine: null,
    ...pageExtras
  } as any)

  const wrapper = mount(SystemPromptPanel, {
    attachTo: document.body,
    global: {
      stubs: {
        'a-table': TABLE_STUB,
        'a-table-column': { name: 'ATableColumn', template: '<div class="column-stub"><slot /></div>' },
        'a-modal': MODAL_STUB,
        'a-form': PASS_THROUGH('AForm', 'form'),
        'a-form-item': PASS_THROUGH('AFormItem'),
        'a-input': { name: 'AInput', template: '<input class="input-stub" />' },
        'a-textarea': { name: 'ATextarea', template: '<textarea class="textarea-stub"></textarea>' },
        'a-select': { name: 'ASelect', template: '<select class="select-stub"></select>' },
        'a-select-option': {
          name: 'ASelectOption',
          props: ['value'],
          template: '<option :value="value"><slot /></option>'
        },
        'a-switch': { name: 'ASwitch', template: '<span class="switch-stub"></span>' },
        'a-tag': PASS_THROUGH('ATag', 'span'),
        'a-space': PASS_THROUGH('ASpace'),
        'a-button': {
          name: 'AButton',
          props: ['type', 'danger', 'size'],
          template: '<button class="button-stub" :class="{ danger }"><slot /></button>'
        },
        'a-popconfirm': {
          name: 'APopconfirm',
          emits: ['confirm'],
          template: '<button class="pop-stub" @click="$emit(\'confirm\')"><slot /></button>'
        },
        PlusOutlined: { name: 'PlusOutlined', template: '<i class="icon-stub" />' }
      }
    }
  })
  await flushPromises()
  return wrapper
}

/** 后端那一句（「真的没有」那一档下面还多摆一颗新建，比那一句时把它摘掉） */
const hintText = (wrapper: any) => {
  const node = wrapper.find('.empty-line').element.cloneNode(true) as HTMLElement
  node.querySelectorAll('.create-on-empty').forEach((button) => button.remove())
  return (node.textContent || '').trim()
}

const THREE_EMPTIES: Array<[string, string]> = [
  ['NONE', '提示词模板：这一档查过了，一条都没有。'],
  ['NOT_VISIBLE', '提示词模板：这一档读不到（选中的那个身份在这张表里没有行），所以这里不能说「没有」。'],
  ['OUT_OF_RANGE', '提示词模板：这一页翻过了头，往前面的页翻回来就有；这里没行不等于这一档没有。']
]

describe('SystemPromptPanel 的空态成因与分页', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('请求里带页码与每页条数（旧代码不带，于是后端默认只回前 20 条）', async () => {
    await mountView([ROW])

    expect(systemPromptApi.list).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, size: 10 })
    )
  })

  it('后端报的总条数摆进分页器：22 条就是 22 条，不是这一页那 20 行', async () => {
    const wrapper = await mountView([ROW], { total: 22, pages: 3 })

    expect(wrapper.find('.pagination-total').text()).toBe('22')
  })

  it.each(THREE_EMPTIES)('后端回 %s 那一档时逐字念那一句，页面上没有「暂无数据」', async (reason, line) => {
    const wrapper = await mountView([], { emptyReason: reason, emptyLine: line })

    expect(hintText(wrapper)).toBe(line)
    expect(wrapper.html()).not.toContain('暂无数据')
  })

  it('后端没回是哪一种空时念「界面不替它猜」，不蒙成「真的没有」', async () => {
    const wrapper = await mountView([], { emptyReason: null, emptyLine: null })

    expect(hintText(wrapper)).toContain('后端没回是哪一种空')
    expect(wrapper.html()).not.toContain('暂无数据')
    expect(wrapper.html()).not.toContain('一条都没有')
  })

  it('读失败那一发说的是读失败，并且把上一批旧行清掉', async () => {
    const wrapper = await mountView([ROW])
    expect(wrapper.findAll('.row')).toHaveLength(1)

    vi.mocked(systemPromptApi.list).mockRejectedValue(new Error('后端服务不可用（网关 502），请确认服务已启动'))
    await wrapper.find('.go-page').trigger('click')
    await flushPromises()

    expect(wrapper.findAll('.row')).toHaveLength(0)
    const said = hintText(wrapper)
    expect(said).toContain('这一发读失败：后端服务不可用（网关 502），请确认服务已启动')
    expect(said).toContain('读失败不是「这一档没有」')
    expect(said).not.toContain('一条都没有')
  })

  it('后端回「这一页翻过了头」时界面自己翻回第一页再读一遍', async () => {
    const list = vi.mocked(systemPromptApi.list)
    const wrapper = await mountView([ROW])
    list
      .mockResolvedValueOnce({ records: [], total: 22, pages: 3, emptyReason: 'OUT_OF_RANGE', emptyLine: THREE_EMPTIES[2][1] } as any)
      .mockResolvedValueOnce({ records: [], total: 0, pages: 0, emptyReason: 'NONE', emptyLine: THREE_EMPTIES[0][1] } as any)

    await wrapper.find('.go-page').trigger('click')
    await flushPromises()

    expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1 }))
    expect(message.info).toHaveBeenCalledWith(JUMP_BACK_NOTICE)
    expect(hintText(wrapper)).toBe(THREE_EMPTIES[0][1])
  })

  it('「真的没有」才摆新建按钮，读不到与翻过头都不摆', async () => {
    const none = await mountView([], { emptyReason: 'NONE', emptyLine: THREE_EMPTIES[0][1] })
    expect(none.find('.empty .create-on-empty').exists()).toBe(true)

    const invisible = await mountView([], { emptyReason: 'NOT_VISIBLE', emptyLine: THREE_EMPTIES[1][1] })
    expect(invisible.find('.empty .create-on-empty').exists()).toBe(false)

    const outOfRange = await mountView([], { emptyReason: 'OUT_OF_RANGE', emptyLine: THREE_EMPTIES[2][1] })
    expect(outOfRange.find('.empty .create-on-empty').exists()).toBe(false)
  })

  it('空那一格那颗「新建模板」点开的是这一屏自己的新建弹窗', async () => {
    const wrapper = await mountView([], { emptyReason: 'NONE', emptyLine: THREE_EMPTIES[0][1] })
    expect(wrapper.find('.modal-stub').exists()).toBe(false)

    await wrapper.find('.empty .create-on-empty').trigger('click')
    await flushPromises()

    expect(wrapper.find('.modal-stub').exists()).toBe(true)
  })

  it('有行的时候根本不渲空态那一句', async () => {
    const wrapper = await mountView([ROW])

    expect(wrapper.find('.empty').exists()).toBe(false)
    expect(wrapper.html()).not.toContain('一条都没有')
  })
})
