import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { h } from 'vue'
import { Button, message } from 'ant-design-vue'
import RevisionTicketView from '../RevisionTicketView.vue'
import { portalTicketsApi } from '../../../api/portalTickets'
import { portalPagesApi } from '../../../api/portalPages'
import { pagedResult } from '../../../test-utils/pagedResult'
import { useAuthStore } from '../../../stores/auth'

/**
 * 改版工单审阅屏的空态（M-P73）。
 *
 * 这一屏的空会被运营读成「这一家没提过改版」，于是干脆不发预览链接。所以：
 * 1. 「读不到这一档」与「真的没有」必须念后端那两句不同的原文，界面不合并、不改写；
 * 2. 后端没答成因时不替它猜；
 * 3. 读失败说的就是读失败，不许混进「没行」；
 * 4. 这一屏永远不摆新建入口——改版工单是客户从预览链接里提的，运营这侧没有「新建一条工单」这个动作，
 *    摆一颗等于骗人去替客户写单。
 *
 * 这一口没有「翻过头」那一档（后端一次给全、页面上的翻页是表格本地的），所以这里不测它。
 */

vi.mock('../../../api/portalTickets', async importOriginal => {
  const actual = await importOriginal<typeof import('../../../api/portalTickets')>()
  return {
    ...actual,
    portalTicketsApi: {
      ...actual.portalTicketsApi,
      options: vi.fn(),
      list: vi.fn(),
      listSessions: vi.fn()
    }
  }
})

vi.mock('../../../api/portalPages', () => ({
  portalPagesApi: { list: vi.fn() }
}))

vi.mock('ant-design-vue', async () => {
  const actual = await vi.importActual<Record<string, any>>('ant-design-vue')
  return {
    ...actual,
    message: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() }
  }
})

const TABLE_STUB = {
  name: 'ATable',
  props: {
    dataSource: { type: Array, default: () => [] }
  },
  setup(props: any, { slots }: any) {
    return () =>
      h('div', { class: 'table-stub' }, props.dataSource.length === 0
        ? h('div', { class: 'empty' }, slots.emptyText ? slots.emptyText({}) : '暂无数据')
        : props.dataSource.map((record: any) => h('div', { class: 'row' }, String(record.id))))
  }
}

const PASS_THROUGH = (name: string) => ({
  name,
  template: `<div class="${name.toLowerCase()}-stub"><slot /><slot name="message" /><slot name="description" /></div>`
})

/** 弹层关着的时候一个字都不该往页面上写：抽屉与预览链接弹窗里各还有一张表，透传会让「暂无数据」从别的格子冒出来 */
const OVERLAY_STUB = (name: string) => ({
  name,
  props: { open: { type: Boolean, default: false } },
  template: `<div v-if="open" class="${name.toLowerCase()}-stub"><slot /></div>`
})

const NONE_LINE = '改版工单：这一档查过了，一条都没有。'
const NOT_VISIBLE_LINE =
  '改版工单：这一档读不到（选中的那个身份在这张表里没有行），所以这里不能说「没有」。'

async function mountView(
  extras: { records?: any[]; emptyReason?: string | null; emptyLine?: string | null },
  failWith?: Error
) {
  useAuthStore().user = {
    id: 1,
    username: 'tester',
    roles: ['SITE_ADMIN'],
    permissions: ['portal:build:review', 'portal:page:manage']
  } as any

  if (failWith) {
    vi.mocked(portalTicketsApi.list).mockRejectedValue(failWith)
  } else {
    vi.mocked(portalTicketsApi.list).mockResolvedValue({
      records: extras.records || [],
      total: (extras.records || []).length,
      page: 1,
      size: Math.max((extras.records || []).length, 1),
      pages: 1,
      emptyReason: extras.emptyReason ?? null,
      emptyLine: extras.emptyLine ?? null
    } as any)
  }
  vi.mocked(portalTicketsApi.options).mockResolvedValue({
    statuses: { open: '待处理' },
    viewports: { desktop: '桌面' },
    intents: { copy: '改文案' }
  } as any)
  vi.mocked(portalPagesApi.list).mockResolvedValue(pagedResult([{ id: 43, title: '联系我们', slug: 'contact' }] as any))

  const wrapper = mount(RevisionTicketView, {
    attachTo: document.body,
    global: {
      stubs: {
        DraftReviewCard: true,
        'a-alert': PASS_THROUGH('AAlert'),
        'a-table': TABLE_STUB,
        'a-button': Button,
        'a-select': PASS_THROUGH('ASelect'),
        'a-input': { name: 'AInput', template: '<input class="input-stub" />' },
        'a-form': PASS_THROUGH('AForm'),
        'a-form-item': PASS_THROUGH('AFormItem'),
        'a-space': PASS_THROUGH('ASpace'),
        'a-tag': { name: 'ATag', template: '<span class="tag-stub"><slot /></span>' },
        'a-tooltip': PASS_THROUGH('ATooltip'),
        'a-drawer': OVERLAY_STUB('ADrawer'),
        'a-modal': OVERLAY_STUB('AModal'),
        'a-popconfirm': PASS_THROUGH('APopconfirm'),
        'a-spin': PASS_THROUGH('ASpin'),
        'a-divider': PASS_THROUGH('ADivider'),
        'a-empty': PASS_THROUGH('AEmpty'),
        'a-descriptions': PASS_THROUGH('ADescriptions'),
        'a-descriptions-item': PASS_THROUGH('ADescriptionsItem')
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

describe('改版工单屏的空态', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    document.body.innerHTML = ''
  })

  it('后端回「真的没有」时逐字念那一句，页面上没有「暂无数据」', async () => {
    const wrapper = await mountView({ emptyReason: 'NONE', emptyLine: NONE_LINE })
    expect(hintText(wrapper)).toBe(NONE_LINE)
    expect(wrapper.html()).not.toContain('暂无数据')
  })

  it('后端回「读不到这一档」时念读不到，不念成「一条都没有」', async () => {
    const wrapper = await mountView({ emptyReason: 'NOT_VISIBLE', emptyLine: NOT_VISIBLE_LINE })
    expect(hintText(wrapper)).toBe(NOT_VISIBLE_LINE)
    expect(wrapper.html()).not.toContain('一条都没有')
  })

  it('后端没回是哪一种空时念「界面不替它猜」，不蒙成「真的没有」', async () => {
    const wrapper = await mountView({ emptyReason: null, emptyLine: null })
    expect(hintText(wrapper)).toContain('后端没回是哪一种空')
    expect(wrapper.html()).not.toContain('一条都没有')
  })

  it('读失败那一发说的是读失败，不是「这一档没有」', async () => {
    const wrapper = await mountView({}, new Error('读口断了'))
    const said = hintText(wrapper)
    expect(said).toContain('这一发读失败：读口断了')
    expect(said).toContain('读失败不是「这一档没有」')
    expect(said).not.toContain('一条都没有')
    expect(message.error).toHaveBeenCalledWith(expect.stringContaining('工单列表加载失败'))
  })

  it('这一屏永不摆新建入口（客户从预览链接提单，运营这侧没有「新建工单」这个动作）', async () => {
    const none = await mountView({ emptyReason: 'NONE', emptyLine: NONE_LINE })
    expect(none.find('.create-on-empty').exists()).toBe(false)
  })

  it('有行的时候不渲空态那一句', async () => {
    const wrapper = await mountView({ records: [{ id: 7, status: 'open', clientText: '把标题改短点' }] })
    expect(wrapper.find('.empty-line').exists()).toBe(false)
    expect(wrapper.html()).not.toContain('一条都没有')
  })
})
