import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { h } from 'vue'
import { Button, message } from 'ant-design-vue'
import PortalHealthView from '../PortalHealthView.vue'
import { portalHealthApi } from '../../../api/portalHealth'
import { portalPagesApi } from '../../../api/portalPages'
import { siteApi } from '../../../api/workspace'
import { pagedResult } from '../../../test-utils/pagedResult'
import { useAuthStore } from '../../../stores/auth'

/**
 * 巡检屏的空态（M-P83）。
 *
 * 这一屏原来写死一句话，形状像「这个站没毛病」。于是两种完全不同的事被念成同一种：
 * 「选中的那一家根本读不到行」和「那一发读失败」。运营看完就按「这个站是健康的」去发站点。
 * 现在这一格说哪一句，全看后端那一发回了什么，所以这里逐字钉三档 + 读失败 + 界面上不再长旧那句。
 *
 * 这一口是不分页的全量读（后端一次把筛出来的行都给完，翻页是表格本地的），
 * 所以「这一页翻过了头」在这一屏结构上出现不了，这里就不测它。
 */

vi.mock('ant-design-vue', async () => {
  const actual = await vi.importActual<Record<string, any>>('ant-design-vue')
  return {
    ...actual,
    message: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() }
  }
})

vi.mock('../../../api/portalHealth', async () => {
  const actual = await vi.importActual<Record<string, any>>('../../../api/portalHealth')
  return {
    ...actual,
    portalHealthApi: {
      ...actual.portalHealthApi,
      options: vi.fn(),
      findings: vi.fn(),
      scan: vi.fn()
    }
  }
})
vi.mock('../../../api/portalPages', () => ({ portalPagesApi: { list: vi.fn() } }))
vi.mock('../../../api/workspace', () => ({ siteApi: { list: vi.fn() } }))
vi.mock('../../../api/portalValidation', async () => {
  const actual = await vi.importActual<Record<string, any>>('../../../api/portalValidation')
  return {
    ...actual,
    portalValidationApi: { latest: vi.fn(), runs: vi.fn(), options: vi.fn(), scan: vi.fn() }
  }
})
vi.mock('../../../api/portalTickets', () => ({
  portalTicketsApi: { draft: vi.fn(), apply: vi.fn(), discard: vi.fn() }
}))

/**
 * 空态只在「没有行」时才渲，所以这一支桩必须真的渲 emptyText：
 * 视图那边是 data-table（真组件）→ a-table（这一支桩），上一批那份桩没接这一格，
 * 测到的只是空气。
 */
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
  template: `<div class="${name.toLowerCase()}-stub"><slot /><slot name="message" /></div>`
})

const OPTIONS = {
  types: {
    seo_missing: { key: 'seo_missing', label: 'SEO 描述缺失', aiFixMode: 'suggestion', hint: 'x' }
  },
  statuses: { open: '待处理' }
}

const NONE_LINE = '页面巡检结果：这一档查过了，一条都没有。'
const NOT_VISIBLE_LINE =
  '页面巡检结果：这一档读不到（选中的那个身份在这张表里没有行），所以这里不能说「没有」。'

async function mountView(
  read: { records?: any[]; emptyReason?: string | null; emptyLine?: string | null } = {},
  failWith?: Error
) {
  useAuthStore().user = {
    id: 1,
    username: 'tester',
    roles: ['SUPER_ADMIN'],
    permissions: ['portal:build:health']
  } as any
  vi.mocked(portalHealthApi.options).mockResolvedValue(OPTIONS as any)
  if (failWith) {
    vi.mocked(portalHealthApi.findings).mockRejectedValue(failWith)
  } else {
    const records = read.records || []
    vi.mocked(portalHealthApi.findings).mockResolvedValue({
      records,
      total: records.length,
      page: 1,
      size: Math.max(records.length, 1),
      pages: 1,
      emptyReason: read.emptyReason ?? null,
      emptyLine: read.emptyLine ?? null
    } as any)
  }
  vi.mocked(portalPagesApi.list).mockResolvedValue(pagedResult([{ id: 43, title: '联系我们', slug: 'contact' }] as any))
  vi.mocked(siteApi.list).mockResolvedValue([{ id: 1, name: '小山口腔' }] as any)

  const wrapper = mount(PortalHealthView, {
    attachTo: document.body,
    global: {
      stubs: {
        SiteValidationStrip: true,
        DraftReviewCard: true,
        'a-alert': PASS_THROUGH('AAlert'),
        'a-table': TABLE_STUB,
        'a-button': Button,
        'a-select': { name: 'ASelect', props: ['value', 'options'], template: '<select />' },
        'a-space': PASS_THROUGH('ASpace'),
        'a-tag': { name: 'ATag', template: '<span class="tag-stub"><slot /></span>' },
        'a-popconfirm': { name: 'APopconfirm', props: ['title'], template: '<span><slot /></span>' },
        'a-descriptions': PASS_THROUGH('ADescriptions'),
        'a-descriptions-item': PASS_THROUGH('ADescriptionsItem'),
        'a-modal': { name: 'AModal', props: ['open'], template: '<div v-if="open"><slot /></div>' },
        'a-spin': PASS_THROUGH('ASpin'),
        'a-divider': PASS_THROUGH('ADivider'),
        'a-empty': PASS_THROUGH('AEmpty'),
        'a-tooltip': PASS_THROUGH('ATooltip')
      }
    }
  })
  await flushPromises()
  return wrapper
}

function hintText(wrapper: any): string {
  const node = wrapper.find('.empty-line').element.cloneNode(true) as HTMLElement
  node.querySelectorAll('.create-on-empty').forEach(button => button.remove())
  return (node.textContent || '').trim()
}

/** antd 给两字按钮中间塞了一个空格（「刷 新」），所以这里按剥掉空格的文本来认 */
function refreshButton(wrapper: any) {
  return wrapper.findAll('button').find((node: any) => (node.text() || '').replace(/\s/g, '') === '刷新')
}

describe('巡检屏的空态', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    document.body.innerHTML = ''
  })

  it('后端回「真的没有」时逐字念那一句，界面上没有「暂无数据」', async () => {
    const wrapper = await mountView({ emptyReason: 'NONE', emptyLine: NONE_LINE })
    expect(hintText(wrapper)).toBe(NONE_LINE)
    expect(wrapper.html()).not.toContain('暂无数据')
  })

  it('后端回「这一档读不到」时念读不到，不念成「一条都没有」', async () => {
    const wrapper = await mountView({ emptyReason: 'NOT_VISIBLE', emptyLine: NOT_VISIBLE_LINE })
    expect(hintText(wrapper)).toBe(NOT_VISIBLE_LINE)
    expect(wrapper.html()).not.toContain('一条都没有')
    // 现场浏览器那一发（2026-10-27 13:37，租户 999999）念到过：连身份都认不出来时，
    // 「这一站还没扫过」根本不成其为原因，摆出来等于给人一条走不通的路
    expect(wrapper.find('.portal-health-page__empty-howto').exists()).toBe(false)
  })

  it('后端没回是哪一种空时念「界面不替它猜」，不蒙成「真的没有」', async () => {
    const wrapper = await mountView({})
    expect(hintText(wrapper)).toContain('后端没回是哪一种空')
    expect(wrapper.html()).not.toContain('一条都没有')
  })

  it('读失败说的是读失败，且上一发的行跟着清掉', async () => {
    const ok = await mountView({ records: [{ id: 9 }] })
    expect(ok.find('.empty-line').exists()).toBe(false)
    expect(ok.findAll('.row').length).toBe(1)

    vi.mocked(portalHealthApi.findings).mockRejectedValueOnce(new Error('巡检口断了'))
    await refreshButton(ok)!.trigger('click')
    await flushPromises()

    const said = hintText(ok)
    expect(said).toContain('这一发读失败：巡检口断了')
    expect(said).toContain('读失败不是「这一档没有」')
    expect(said).not.toContain('一条都没有')
    expect(ok.findAll('.row').length).toBe(0)
    expect(message.error).toHaveBeenCalledWith(expect.stringContaining('巡检口断了'))
  })

  it('旧那句写死的「没有待处理的巡检结果」在界面上一个字都不剩（读不到/读失败都不再念成健康）', async () => {
    const none = await mountView({ emptyReason: 'NONE', emptyLine: NONE_LINE })
    expect(none.html()).not.toContain('没有待处理的巡检结果')
    const unreadable = await mountView({ emptyReason: 'NOT_VISIBLE', emptyLine: NOT_VISIBLE_LINE })
    expect(unreadable.html()).not.toContain('没有待处理的巡检结果')
    const failed = await mountView({}, new Error('巡检口断了'))
    expect(failed.html()).not.toContain('没有待处理的巡检结果')
  })

  it('「还没扫过」这一句只在后端答了成因时摆，读失败那一发不摆', async () => {
    const none = await mountView({ emptyReason: 'NONE', emptyLine: NONE_LINE })
    expect(none.find('.portal-health-page__empty-howto').exists()).toBe(true)

    const failed = await mountView({}, new Error('巡检口断了'))
    expect(failed.find('.portal-health-page__empty-howto').exists()).toBe(false)
  })

  it('这一屏永不摆新建入口（巡检结果是扫出来的，没有「手工新建一条」这个动作）', async () => {
    const wrapper = await mountView({ emptyReason: 'NONE', emptyLine: NONE_LINE })
    expect(wrapper.find('.create-on-empty').exists()).toBe(false)
  })

  it('有行的时候不渲空态那一句', async () => {
    const wrapper = await mountView({ records: [{ id: 11 }], emptyReason: null, emptyLine: null })
    expect(wrapper.find('.empty-line').exists()).toBe(false)
    expect(wrapper.html()).not.toContain('一条都没有')
  })
})
