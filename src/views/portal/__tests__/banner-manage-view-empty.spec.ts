import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { h } from 'vue'
import { Button } from 'ant-design-vue'
import BannerManageView from '../BannerManageView.vue'
import { bannerApi } from '../../../api/portal'
import { message } from 'ant-design-vue'

/**
 * 轮播图那一屏的空态与统计数（M-P73）：这一屏的空会被读成「这一家的轮播图没了」，
 * 统计数三块更会把「读不到这一家」摆成 0——那是同一句谎报的两种说法。
 *
 * 钉六件：
 * 1. 三种空各念各的，逐字比后端原文，页面上不许出现「暂无数据」；
 * 2. 后端没答成因时界面不替它猜；
 * 3. 读失败说的是读失败，不是「这一档没有」；
 * 4. 「这一页翻过了头」时界面自己翻回第一页再读一遍；
 * 5. 新建入口只在「真的没有」那一档摆（读不到与翻过头都不摆，那两种空不是说「这一屏还空着」）；
 * 6. 读不到这一家（或列表/统计读失败）时三块统计摆「—」，不许摆 0；真租户没行才摆真数。
 */

vi.mock('ant-design-vue', async () => {
  const actual = await vi.importActual<Record<string, any>>('ant-design-vue')
  return {
    ...actual,
    message: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() }
  }
})

vi.mock('../../../api/portal', async importOriginal => {
  const actual = await importOriginal<Record<string, any>>()
  return {
    ...actual,
    bannerApi: { list: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn(), delete: vi.fn(), stats: vi.fn() }
  }
})

const TABLE_STUB = {
  name: 'ATable',
  props: {
    dataSource: { type: Array, default: () => [] },
    columns: { type: Array, default: () => [] }
  },
  setup(props: any, { slots }: any) {
    return () => {
      const rows = props.dataSource as any[]
      return h('div', { class: 'table-stub' }, rows.length === 0
        ? [slots.emptyText ? slots.emptyText({}) : h('div', '暂无数据')]
        : rows.map((record) => h('div', { class: 'row', 'data-row': record.id }, String(record.title))))
    }
  }
}

const PAGINATION_STUB = {
  name: 'APagination',
  props: { current: { type: Number, default: 1 }, pageSize: { type: Number, default: 20 }, total: { type: Number, default: 0 } },
  emits: ['update:current', 'change'],
  setup(props: any, { emit }: any) {
    return () => h('div', { class: 'pagination-stub' }, [
      // 真实控件替身：翻页先要回写 v-model:current，再发 change——只发 change 的壳会让界面停在第 1 页，
      // 那一发「翻过头」就永远测不到（判据是 page > 1 才成立）
      h('button', {
        class: 'go-page-5',
        onClick: () => {
          emit('update:current', 5)
          emit('change', 5, props.pageSize)
        }
      }, '到第 5 页')
    ])
  }
}

/** 全局桩把这些容器渲成空壳（插槽一个字都不渲），屏上的表格与统计就永远摸不到；这里换一个透传的壳 */
const PASS_THROUGH = (name: string) => ({
  name,
  template: `<div class="${name.toLowerCase()}-stub"><slot /><slot name="actions" /></div>`
})

/** 弹窗只有 open 为真才渲内容：预览/表单那两发的壳都带 a-table 之外的东西，关掉时不该往页面上写 */
const MODAL_STUB = {
  name: 'AModal',
  props: { open: { type: Boolean, default: false } },
  template: '<div v-if="open" class="modal-stub"><slot /></div>'
}

const BANNER_LINES: Array<[string, string]> = [
  ['NONE', '轮播图：这一档查过了，一条都没有。'],
  ['NOT_VISIBLE', '轮播图：这一档读不到（选中的那个身份在这张表里没有行），所以这里不能说「没有」。'],
  ['OUT_OF_RANGE', '轮播图：这一页翻过了头，往前面的页翻回来就有；这里没行不等于这一档没有。']
]

/** 列表那一发：cause 带成因，total 是后端同一次查询带回的总条数 */
function page(rows: any[], cause: { emptyReason?: string | null; emptyLine?: string | null } = {}, total = rows.length) {
  return {
    records: rows,
    total,
    page: 1,
    size: Math.max(rows.length, 1),
    pages: total ? Math.ceil(total / Math.max(rows.length, 1)) : 0,
    emptyReason: cause.emptyReason ?? null,
    emptyLine: cause.emptyLine ?? null
  }
}

async function mountView(options: {
  first?: any
  rest?: () => any
  failWith?: Error
} = {}) {
  const list = vi.mocked(bannerApi.list)
  if (options.failWith) {
    list.mockRejectedValue(options.failWith)
  } else {
    list.mockResolvedValue(options.first ?? page([]))
    if (options.rest) {
      // 统计那三发（以及翻过头后重拉的那一发）走调用方给的第二份读数
      list.mockImplementation(async () => options.rest!())
    }
  }
  const wrapper = mount(BannerManageView, {
    attachTo: document.body,
    global: {
      stubs: {
        'a-table': TABLE_STUB,
        'a-pagination': PAGINATION_STUB,
        'a-button': Button,
        'a-card': PASS_THROUGH('ACard'),
        'a-spin': PASS_THROUGH('ASpin'),
        'a-row': PASS_THROUGH('ARow'),
        'a-col': PASS_THROUGH('ACol'),
        'filter-bar': PASS_THROUGH('FilterBar'),
        'a-space': PASS_THROUGH('ASpace'),
        'a-modal': MODAL_STUB,
        'a-popconfirm': PASS_THROUGH('APopconfirm'),
        'a-select': PASS_THROUGH('ASelect'),
        'a-select-option': PASS_THROUGH('ASelectOption'),
        'a-tag': { name: 'ATag', template: '<span class="tag-stub"><slot /></span>' },
        MediaImagePicker: true,
        DemoFlag: true
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

/** 三块统计现在各摆着什么（顺序 = 总数 / 展示中 / 已停用） */
const statValues = (wrapper: any) =>
  wrapper.findAll('.stat-value').map((node: any) => node.text())

const ROW = { id: 3, tenantId: 2, title: '春季促销', imageUrl: '/a.png', sort: 1, status: 'ENABLED', createdAt: '2026-10-25T00:00:00' }

describe('BannerManageView 的空态与统计数', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    vi.clearAllMocks()
  })

  it.each(BANNER_LINES)('后端回 %s 那一档时逐字念那一句，页面上没有「暂无数据」', async (reason, line) => {
    const wrapper = await mountView({ first: page([], { emptyReason: reason, emptyLine: line }) })
    expect(hintText(wrapper)).toBe(line)
    expect(wrapper.html()).not.toContain('暂无数据')
    wrapper.unmount()
  })

  it('后端没回是哪一种空时念「界面不替它猜」，不蒙成「真的没有」', async () => {
    const wrapper = await mountView({ first: page([]) })
    expect(hintText(wrapper)).toContain('后端没回是哪一种空')
    expect(wrapper.html()).not.toContain('一条都没有')
    wrapper.unmount()
  })

  it('读失败那一发说的是读失败，不是「这一档没有」', async () => {
    const wrapper = await mountView({ failWith: new Error('这个账号没有看轮播图的资格') })
    const said = hintText(wrapper)
    expect(said).toContain('这一发读失败：这个账号没有看轮播图的资格')
    expect(said).toContain('读失败不是「这一档没有」')
    wrapper.unmount()
  })

  it('后端回「这一页翻过了头」时界面自己翻回第一页再读一遍', async () => {
    const list = vi.mocked(bannerApi.list)
    const wrapper = await mountView({ first: page([], { emptyReason: 'NONE', emptyLine: BANNER_LINES[0][1] }) })

    list
      .mockResolvedValueOnce(page([], { emptyReason: 'OUT_OF_RANGE', emptyLine: BANNER_LINES[2][1] }, 47) as any)
      .mockResolvedValue(page([ROW], {}, 1) as any)
    await wrapper.find('.go-page-5').trigger('click')
    await flushPromises()

    expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1 }))
    expect(message.info).toHaveBeenCalledWith('刚才那一页超出总页数了，已自动翻回第一页。')
  })

  it('「真的没有」才在空态里摆新建入口：读不到与翻过头都不摆', async () => {
    const none = await mountView({ first: page([], { emptyReason: 'NONE', emptyLine: BANNER_LINES[0][1] }) })
    expect(none.find('.create-on-empty').text()).toBe('新建 Banner')
    none.unmount()
    document.body.innerHTML = ''

    const unreadable = await mountView({ first: page([], { emptyReason: 'NOT_VISIBLE', emptyLine: BANNER_LINES[1][1] }) })
    expect(unreadable.find('.create-on-empty').exists()).toBe(false)
    unreadable.unmount()
    document.body.innerHTML = ''

    const overflow = await mountView({ first: page([], { emptyReason: 'OUT_OF_RANGE', emptyLine: BANNER_LINES[2][1] }) })
    expect(overflow.find('.create-on-empty').exists()).toBe(false)
    overflow.unmount()
  })

  it('读不到这一家时三块统计摆「—」，不许摆 0', async () => {
    const wrapper = await mountView({
      first: page([], { emptyReason: 'NOT_VISIBLE', emptyLine: BANNER_LINES[1][1] })
    })
    expect(statValues(wrapper)).toEqual(['—', '—', '—'])
    wrapper.unmount()
  })

  it('列表读失败时统计同样摆「—」，不摆 0', async () => {
    const wrapper = await mountView({ failWith: new Error('读口断了') })
    expect(statValues(wrapper)).toEqual(['—', '—', '—'])
    wrapper.unmount()
  })

  it('真租户「查过了没有」时统计摆真数（0 就写 0，那是查过的结果）', async () => {
    const wrapper = await mountView({
      first: page([], { emptyReason: 'NONE', emptyLine: BANNER_LINES[0][1] }),
      rest: () => page([], {}, 0)
    })
    expect(statValues(wrapper)).toEqual(['0', '0', '0'])
    wrapper.unmount()
  })

  it('有行时不渲空态那一句，统计摆的是后端回的总条数', async () => {
    const wrapper = await mountView({
      first: page([ROW], {}, 12),
      rest: () => page([ROW], {}, 12)
    })
    expect(wrapper.find('.empty-line').exists()).toBe(false)
    expect(statValues(wrapper)).toEqual(['12', '12', '12'])
    wrapper.unmount()
  })
})
