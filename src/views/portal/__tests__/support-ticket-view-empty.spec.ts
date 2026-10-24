import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { h } from 'vue'
import { Button } from 'ant-design-vue'
import { createPinia } from 'pinia'
import SupportTicketView from '../SupportTicketView.vue'
import { supportTicketsApi } from '../../../api/supportTickets'

/**
 * 工单两屏的空态（M-P73）：这两屏的空会被读成「这一家没提过工单」，
 * 所以「读不到」与「真的没有」必须念后端那一句，界面不自己挑成因。
 *
 * 钉四件：
 * 1. 三种空各念各的，逐字比后端原文，页面上不许出现「暂无数据」；
 * 2. 后端没答成因时界面不替它猜；
 * 3. 读失败说的是读失败，不是「这一档没有」；
 * 4. 「提交新工单」那颗只在提交人视角的「真的没有」摆，平台队列（这一屏写不了工单）与读不到都不摆。
 */

vi.mock('ant-design-vue', async () => {
  const actual = await vi.importActual<Record<string, any>>('ant-design-vue')
  return {
    ...actual,
    message: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() }
  }
})

vi.mock('../../../api/supportTickets', async importOriginal => {
  const actual = await importOriginal<Record<string, any>>()
  return {
    ...actual,
    supportTicketsApi: {
      statuses: vi.fn(),
      listMine: vi.fn(),
      listForAdmin: vi.fn(),
      submit: vi.fn(),
      reply: vi.fn(),
      close: vi.fn(),
      closeByAdmin: vi.fn()
    }
  }
})

/** 真 a-table 在这环境里渲不出表体，换成按 dataSource 空不空来决定摆不加空态那一格的壳 */
const TABLE_STUB = {
  name: 'ATable',
  props: {
    dataSource: { type: Array, default: () => [] },
    columns: { type: Array, default: () => [] },
    loading: { type: Boolean, default: false }
  },
  setup(props: any, { slots }: any) {
    return () => {
      const rows = props.dataSource as any[]
      return h('div', { class: 'table-stub' }, rows.length === 0
        ? [slots.emptyText ? slots.emptyText({}) : h('div', '暂无数据')]
        : rows.map((record) => h('div', { class: 'row', 'data-row': record.id }, String(record.topic))))
    }
  }
}

const MINE_LINES: Array<[string, string]> = [
  ['NONE', '我的工单：这一档查过了，一条都没有。'],
  ['NOT_VISIBLE', '我的工单：这一档读不到（选中的那个身份在这张表里没有行），所以这里不能说「没有」。'],
  ['OUT_OF_RANGE', '我的工单：这一页翻过了头，往前面的页翻回来就有；这里没行不等于这一档没有。']
]

async function mountView(
  mode: 'mine' | 'queue',
  rows: any[],
  cause: { emptyReason?: string | null; emptyLine?: string | null } = {},
  failWith?: Error
) {
  vi.mocked(supportTicketsApi.statuses).mockResolvedValue({ open: '待处理' } as any)
  const list = mode === 'queue' ? supportTicketsApi.listForAdmin : supportTicketsApi.listMine
  if (failWith) {
    vi.mocked(list).mockRejectedValue(failWith)
  } else {
    vi.mocked(list).mockResolvedValue({
      records: rows,
      total: rows.length,
      page: 1,
      size: Math.max(rows.length, 1),
      pages: rows.length ? 1 : 0,
      emptyReason: cause.emptyReason ?? null,
      emptyLine: cause.emptyLine ?? null
    } as any)
  }
  const wrapper = mount(SupportTicketView, {
    attachTo: document.body,
    props: { mode },
    global: {
      plugins: [createPinia()],
      // a-button 挂真实组件：全局桩把它渲成空壳，空态里那颗新建入口就找不到也点不动
      stubs: {
        'a-table': TABLE_STUB,
        'a-button': Button,
        'a-card': PASS_THROUGH('ACard'),
        'filter-bar': PASS_THROUGH('FilterBar'),
        'a-space': PASS_THROUGH('ASpace'),
        'a-modal': MODAL_STUB
      }
    }
  })
  await flushPromises()
  return wrapper
}

/** 后端那一句（「真的没有」那一档下面还会多摆一颗提交按钮，比那一句时把它摘掉） */
const hintText = (wrapper: any) => {
  const node = wrapper.find('.empty-line').element.cloneNode(true) as HTMLElement
  node.querySelectorAll('.create-on-empty').forEach((button) => button.remove())
  return (node.textContent || '').trim()
}

const createButton = (wrapper: any) => wrapper.find('.create-on-empty')

/** 全局桩把这些容器渲成空壳（插槽一个字都不渲），空态那一格就永远摸不到；这里换透传的壳 */
const PASS_THROUGH = (name: string) => ({
  name,
  template: `<div class="${name.toLowerCase()}-stub"><slot /><slot name="actions" /></div>`
})

/** 弹窗关着的时候不该往页面上写任何东西（否则「暂无数据」这种话会从别的格子里冒出来） */
const MODAL_STUB = {
  name: 'AModal',
  props: { open: { type: Boolean, default: false } },
  template: '<div v-if="open" class="modal-stub"><slot /></div>'
}

const ROW = { id: 7, tenantId: 2, topic: '想改首页', content: '把首页第三个栏目挪前', status: 'open' }

describe('工单两屏的空态成因', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    vi.clearAllMocks()
  })

  it.each(MINE_LINES)('提交人视角回 %s 那一档时逐字念后端那一句，页面上没有「暂无数据」', async (reason, line) => {
    const wrapper = await mountView('mine', [], { emptyReason: reason, emptyLine: line })
    expect(hintText(wrapper)).toBe(line)
    expect(wrapper.html()).not.toContain('暂无数据')
    wrapper.unmount()
  })

  it('平台队列那一屏的空念的是「平台工单队列」那句（主语不能顶替）', async () => {
    const line = '平台工单队列：这一档读不到（选中的那个身份在这张表里没有行），所以这里不能说「没有」。'
    const wrapper = await mountView('queue', [], { emptyReason: 'NOT_VISIBLE', emptyLine: line })
    expect(hintText(wrapper)).toBe(line)
    wrapper.unmount()
  })

  it('后端没回是哪一种空时念「界面不替它猜」，不蒙成「真的没有」', async () => {
    const wrapper = await mountView('mine', [])
    expect(hintText(wrapper)).toContain('后端没回是哪一种空')
    expect(wrapper.html()).not.toContain('一条都没有')
    wrapper.unmount()
  })

  it('读失败那一发说的是读失败，不是「这一档没有」', async () => {
    const wrapper = await mountView('mine', [], {}, new Error('请先选择租户'))
    const said = hintText(wrapper)
    expect(said).toContain('这一发读失败：请先选择租户')
    expect(said).toContain('读失败不是「这一档没有」')
    expect(createButton(wrapper).exists()).toBe(false)
    wrapper.unmount()
  })

  it('「真的没有」才摆提交新工单：平台队列与读不到都不摆', async () => {
    const mine = await mountView('mine', [], { emptyReason: 'NONE', emptyLine: MINE_LINES[0][1] })
    expect(createButton(mine).exists()).toBe(true)
    mine.unmount()
    document.body.innerHTML = ''

    const unreadable = await mountView('mine', [], { emptyReason: 'NOT_VISIBLE', emptyLine: MINE_LINES[1][1] })
    expect(createButton(unreadable).exists()).toBe(false)
    unreadable.unmount()
    document.body.innerHTML = ''

    const queue = await mountView('queue', [], { emptyReason: 'NONE', emptyLine: '平台工单队列：这一档查过了，一条都没有。' })
    expect(createButton(queue).exists()).toBe(false)
    queue.unmount()
  })

  it('有行的时候根本不渲空态那一句', async () => {
    const wrapper = await mountView('mine', [ROW])
    expect(wrapper.find('.empty-line').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('一条都没有')
    wrapper.unmount()
  })
})
