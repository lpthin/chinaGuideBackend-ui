import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { h } from 'vue'
import ArticlesPanel from '../ArticlesPanel.vue'
import { adminApi, articleManageApi, categoryApi, dashboardApi } from '../../../api'

/**
 * 内容管理屏的四张统计卡（M-P104）：这一屏只取前 100 篇，
 * 原来前三张卡拿这 100 篇冒充「整家」口径，500 篇文章时也念 100。
 *
 * 钉四件：
 * 1. 文章总数/已发布/今日新增/待审核/近 7 天新增/本月新增认后端统计口，不数本屏 100 行；
 * 2. 侧栏草稿箱/待审核也认后端统计口；
 * 3. 统计口没取到时念「—」，不拿本屏行数补（文章总数可退回列表口回的 total）；
 * 4. 只取到 100 篇而这家更多时，把「这一屏只取了前 100 篇」摆出来。
 */

vi.mock('ant-design-vue', async () => {
  const actual = await vi.importActual<Record<string, any>>('ant-design-vue')
  return {
    ...actual,
    message: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
    Modal: { confirm: vi.fn(), destroyAll: vi.fn() }
  }
})

vi.mock('../../../api', () => ({
  adminApi: {
    users: { list: vi.fn(), get: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() }
  },
  articleManageApi: {
    list: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn()
  },
  categoryApi: {
    list: vi.fn()
  },
  dashboardApi: {
    getStats: vi.fn()
  }
}))

const auth = vi.hoisted(() => ({
  selectedTenantId: 15 as number | null,
  tenantId: 15,
  user: { id: 1, tenantId: 15 },
  isSuperAdmin: true,
  hasPermission: () => true
}))

vi.mock('../../../stores/auth', () => ({ useAuthStore: () => auth }))

vi.mock('vue-router', async () => {
  const actual = await vi.importActual<Record<string, any>>('vue-router')
  return {
    ...actual,
    useRoute: () => ({ params: {}, query: {}, meta: { title: '内容管理' } }),
    useRouter: () => ({ push: vi.fn() })
  }
})

const PASS_THROUGH = (name: string, tag = 'div') => ({
  name,
  template: `<${tag} class="${name.toLowerCase()}-stub"><slot /><slot name="title" /><slot name="actions" /><slot name="extra" /><slot name="overlay" /><slot name="addonBefore" /></${tag}>`
})

const TABLE_STUB = {
  name: 'ATable',
  props: {
    dataSource: { type: Array, default: () => [] },
    columns: { type: Array, default: () => [] },
    loading: { type: Boolean, default: false },
    pagination: { type: [Object, Boolean], default: () => ({}) },
    rowSelection: { type: Object, default: null },
    scroll: { type: Object, default: null },
    rowKey: { type: [String, Function], default: 'id' }
  },
  setup(props: any, { slots }: any) {
    return () => {
      const rows = (props.dataSource || []) as any[]
      return h('div', { class: 'table-stub' }, [
        rows.length === 0
          ? h('div', { class: 'table-empty' }, slots.emptyText ? slots.emptyText({}) : [])
          : rows.map((record) => h('div', { class: 'row', 'data-row': record.id }, String(record.id)))
      ])
    }
  }
}

const ROWS = Array.from({ length: 100 }, (_, i) => ({
  id: i + 1,
  title: `文章 ${i + 1}`,
  status: 'draft',
  viewCount: i === 0 ? 999 : 2,
  createdAt: '2026-10-20T00:00:00',
  updatedAt: '2026-10-20T00:00:00'
}))

const STATS = {
  totalArticles: 500,
  publishedCount: 321,
  draftCount: 12,
  todayCount: 3,
  articlesWeek: 7,
  monthCount: 30,
  pendingReview: 9
}

async function mountView(options: {
  rows?: any[]
  listTotal?: number
  stats?: Record<string, number> | null
} = {}) {
  const rows = options.rows ?? ROWS
  const listTotal = options.listTotal ?? 500

  vi.mocked(articleManageApi.list).mockResolvedValue({
    records: rows,
    total: listTotal,
    page: 1,
    size: 100,
    pages: Math.ceil(listTotal / 100)
  } as any)
  vi.mocked(categoryApi.list).mockResolvedValue([] as any)
  vi.mocked(adminApi.users.list).mockResolvedValue({ records: [] } as any)

  if (options.stats === null) {
    vi.mocked(dashboardApi.getStats).mockRejectedValue(new Error('统计口断了'))
  } else {
    vi.mocked(dashboardApi.getStats).mockResolvedValue((options.stats ?? STATS) as any)
  }

  const wrapper = mount(ArticlesPanel, {
    global: {
      stubs: {
        'filter-bar': {
          name: 'FilterBar',
          template: '<div class="filter-bar-stub"><slot /><slot name="actions" /></div>'
        },
        'a-spin': PASS_THROUGH('ASpin'),
        'a-row': PASS_THROUGH('ARow'),
        'a-col': PASS_THROUGH('ACol'),
        'a-card': PASS_THROUGH('ACard'),
        'a-space': PASS_THROUGH('ASpace'),
        'a-form': PASS_THROUGH('AForm'),
        'a-form-item': PASS_THROUGH('AFormItem'),
        'a-descriptions': PASS_THROUGH('ADescriptions'),
        'a-descriptions-item': PASS_THROUGH('ADescriptionsItem'),
        'a-divider': PASS_THROUGH('ADivider'),
        'a-dropdown': PASS_THROUGH('ADropdown'),
        'a-menu': PASS_THROUGH('AMenu'),
        'a-menu-item': PASS_THROUGH('AMenuItem'),
        'a-menu-divider': { name: 'AMenuDivider', template: '<hr class="menu-divider-stub" />' },
        'a-modal': PASS_THROUGH('AModal'),
        'a-tooltip': PASS_THROUGH('ATooltip'),
        'a-select': PASS_THROUGH('ASelect'),
        'a-select-option': { name: 'ASelectOption', props: ['value'], template: '<option :value="value"><slot /></option>' },
        'a-tree-select': PASS_THROUGH('ATreeSelect'),
        'a-segmented': PASS_THROUGH('ASegmented'),
        'a-upload': PASS_THROUGH('AUpload'),
        'a-switch': PASS_THROUGH('ASwitch'),
        'a-checkbox': PASS_THROUGH('ACheckbox'),
        'a-range-picker': PASS_THROUGH('ARangePicker'),
        'a-empty': { name: 'AEmpty', template: '<div class="empty-stub"></div>' },
        'a-tag': { name: 'ATag', template: '<span class="tag-stub"><slot /></span>' },
        'a-input': { name: 'AInput', template: '<input class="input-stub" />' },
        'a-input-search': { name: 'AInputSearch', template: '<input class="search-stub" />' },
        'a-textarea': { name: 'ATextarea', template: '<textarea class="textarea-stub"></textarea>' },
        'a-button': { name: 'AButton', template: '<button class="button-stub"><slot /></button>' },
        'a-alert': { name: 'AAlert', props: ['type', 'message'], template: '<div class="alert-stub">{{ message }}</div>' },
        'a-table': TABLE_STUB,
        'empty-list-hint': {
          name: 'EmptyListHint',
          props: ['loading', 'readFailed', 'emptyLine', 'emptyReason'],
          template: '<div class="empty-line-stub">{{ emptyLine }}</div>'
        },
        'demo-flag': { name: 'DemoFlag', template: '<span class="demo-flag-stub" />' }
      }
    }
  })
  await flushPromises()
  return wrapper
}

const texts = (wrapper: any, selector: string) =>
  wrapper.findAll(selector).map((node: any) => (node.text() || '').trim())

describe('ArticlesPanel 的四张统计卡认后端统计口', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('总数/已发布/今日新增/近 7 天/待审核/本月新增都念后端整家口径，不数本屏 100 行', async () => {
    const wrapper = await mountView()

    expect(texts(wrapper, '.stat-value')).toEqual(['500', '3', '9', '999'])
    expect(texts(wrapper, '.stat-trend')).toEqual(['321', '7', '30', '1197'])
    expect(texts(wrapper, '.entry-count')).toEqual(['12 篇', '9 篇'])
  })

  it('统计口这一发没取到时念「—」，不拿本屏行数补；文章总数退回列表口的 total', async () => {
    const wrapper = await mountView({ stats: null })

    expect(texts(wrapper, '.stat-value')).toEqual(['500', '—', '—', '999'])
    expect(texts(wrapper, '.stat-trend')).toEqual(['—', '—', '—', '1197'])
    expect(texts(wrapper, '.entry-count')).toEqual(['— 篇', '— 篇'])
  })

  it('取到的行数比这家总数少时摆出「这一屏只取了前 100 篇」', async () => {
    const wrapper = await mountView()

    expect(wrapper.find('.view-note').exists()).toBe(true)
    expect(wrapper.find('.view-note').text()).toContain('这一屏只取了前 100 篇，这家共 500 篇')
    expect(wrapper.find('.status-tags-label').text()).toContain('按已取的 100 篇统计')
  })

  it('取到的行数就等于这家总数时不摆那句范围说明', async () => {
    const wrapper = await mountView({ rows: ROWS.slice(0, 5), listTotal: 5, stats: { ...STATS, totalArticles: 5 } })

    expect(wrapper.find('.view-note').exists()).toBe(false)
  })
})
describe('超管没选客户时这一屏一口不发', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('平台模式：文章/分类/作者/统计四发都不发，四张卡念「—」，新建按钮是灰的，屏上说清为什么', async () => {
    auth.selectedTenantId = null
    const wrapper = await mountView()

    expect(articleManageApi.list).not.toHaveBeenCalled()
    expect(categoryApi.list).not.toHaveBeenCalled()
    expect(adminApi.users.list).not.toHaveBeenCalled()
    expect(dashboardApi.getStats).not.toHaveBeenCalled()
    expect(texts(wrapper, '.stat-value')).toEqual(['—', '—', '—', '—'])
    expect(wrapper.find('.scope-hint').text()).toContain('当前没有选定客户')

    const createButton = wrapper.findAll('button').find(node => node.text().includes('新建文章'))
    expect(createButton, '侧栏里要有「新建文章」按钮').toBeTruthy()
    expect(createButton!.attributes('disabled')).toBeDefined()
  })

  it('选了一家客户：列表、分类、作者、统计都带这一家的编号去读', async () => {
    auth.selectedTenantId = 15
    const wrapper = await mountView()

    expect(articleManageApi.list).toHaveBeenCalledWith(expect.objectContaining({ tenantId: 15 }))
    expect(categoryApi.list).toHaveBeenCalledWith(expect.objectContaining({ tenantId: 15 }))
    expect(adminApi.users.list).toHaveBeenCalledWith(expect.objectContaining({ tenantId: 15 }))
    expect(dashboardApi.getStats).toHaveBeenCalledWith(15)
    expect(wrapper.find('.scope-hint').exists()).toBe(false)
  })
})
