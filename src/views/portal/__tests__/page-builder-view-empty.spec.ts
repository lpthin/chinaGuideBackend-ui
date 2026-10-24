import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { Button } from 'ant-design-vue'
import PageBuilderView from '../PageBuilderView.vue'
import { portalPagesApi, type PortalPage } from '../../../api/portalPages'
import { portalSitesApi } from '../../../api/portalSites'
import { themePresetsApi } from '../../../api/themePresets'
import { siteThemeApi } from '../../../api/siteTheme'
import { pagedResult } from '../../../test-utils/pagedResult'

/**
 * 门户页面屏的空态（M-P74）。
 *
 * `/api/portal/pages` 换成 `PagedRead` 那一形之后，这一屏「没有行」有三种完全不同的意思，
 * 而它会被读成「这个站点还没有页面」——所以那一句只认后端原文，界面不改写、不合并、不替它猜：
 * 1. NONE / NOT_VISIBLE 各念后端那一句，逐字比对，页面上不许残留「暂无数据」和旧的「这个站点还没有页面」；
 * 2. 后端没答成因（null）时念界面自己那句，不蒙成「一条都没有」；
 * 3. 读失败说的是这一发读失败，它和「没行」是两件事；
 * 4. 「新建页面」只在后端答了 NONE、且这一屏真的有建设权（portal:build:manage）时才摆，
 *    只持读/发码的人不该看见一颗点了收 403 的按钮；
 * 5. 有行的时候那一句整段都不出现。
 */

vi.mock('ant-design-vue', async () => {
  const actual = await vi.importActual<Record<string, any>>('ant-design-vue')
  return {
    ...actual,
    message: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() }
  }
})

vi.mock('../../../api/portalPages', () => ({
  portalPagesApi: {
    list: vi.fn(),
    get: vi.fn(),
    blocks: vi.fn(),
    statusLabels: vi.fn(),
    changeSourceLabels: vi.fn(),
    preview: vi.fn(),
    publish: vi.fn(),
    offline: vi.fn(),
    versions: vi.fn(),
    versionsDiff: vi.fn(),
    validate: vi.fn(),
    updateLayout: vi.fn(),
    updateMeta: vi.fn(),
    create: vi.fn(),
    rollback: vi.fn(),
    remove: vi.fn()
  }
}))
vi.mock('../../../api/portalSites', () => ({ portalSitesApi: { listMine: vi.fn() } }))
vi.mock('../../../api/themePresets', () => ({ themePresetsApi: { tokens: vi.fn(), list: vi.fn() } }))
// 站点主题面板挂在同一列（canBuild 才渲），不桩住它就直接拿真 http 去请 /admin/sites/{id}
vi.mock('../../../api/siteTheme', () => ({
  siteThemeApi: { get: vi.fn(), update: vi.fn(), saveSkin: vi.fn(), applySkin: vi.fn() }
}))

const authState = { permissions: [] as string[] }

vi.mock('../../../stores/auth', () => ({
  useAuthStore: () => ({
    get permissions() {
      return authState.permissions
    },
    isSuperAdmin: false,
    hasPermission: (code: string) => authState.permissions.includes(code)
  })
}))

/** 纯透传壳：文案原样吐回文本节点（a-alert 的 message 走 props 而不是 slot） */
const PASS_THROUGH = (name: string) => ({
  name,
  props: ['title', 'message', 'type', 'description', 'label', 'size', 'spinning', 'dataSource'],
  template: `<div class="${name}-stub">{{ title }}{{ message }}{{ description }}{{ label }}`
    + '<slot /><slot name="extra" /><slot name="overlay" /></div>'
})

const OVERLAY = (name: string) => ({
  name,
  props: ['open', 'title'],
  template: `<div v-if="open" class="${name}-stub">{{ title }}<slot /><slot name="footer" /></div>`
})

const TABLE_STUB = {
  name: 'ATable',
  props: {
    dataSource: { type: Array, default: () => [] },
    columns: { type: Array, default: () => [] }
  },
  template:
    '<div class="table-stub"><div v-for="(record, index) in dataSource" :key="index" class="row">'
    + '<template v-for="column in columns" :key="column.key">'
    + '<slot v-if="$slots.bodyCell" name="bodyCell" :column="column" :record="record" /></template></div></div>'
}

const LIST_STUB = {
  name: 'AList',
  props: { dataSource: { type: Array, default: () => [] } },
  template: '<div class="list-stub"><div v-for="(item, index) in dataSource" :key="index" class="list-item">'
    + '<slot name="renderItem" :item="item" /></div></div>'
}

const stubs = {
  'a-button': Button,
  BlockPropsForm: { name: 'BlockPropsForm', props: ['schema', 'model'], template: '<div class="props-stub" />' },
  PortalViewportPreview: { name: 'PortalViewportPreview', props: ['blocks', 'theme'], template: '<div class="preview-stub" />' },
  'a-form': PASS_THROUGH('a-form'),
  'a-form-item': PASS_THROUGH('a-form-item'),
  'a-select': PASS_THROUGH('a-select'),
  'a-spin': PASS_THROUGH('a-spin'),
  'a-empty': PASS_THROUGH('a-empty'),
  'a-alert': PASS_THROUGH('a-alert'),
  'a-card': PASS_THROUGH('a-card'),
  'a-list': LIST_STUB,
  'a-list-item': PASS_THROUGH('a-list-item'),
  'a-tag': PASS_THROUGH('a-tag'),
  'a-space': PASS_THROUGH('a-space'),
  'a-dropdown': PASS_THROUGH('a-dropdown'),
  'a-menu': PASS_THROUGH('a-menu'),
  'a-menu-item': PASS_THROUGH('a-menu-item'),
  'a-divider': PASS_THROUGH('a-divider'),
  'a-input': PASS_THROUGH('a-input'),
  'a-textarea': PASS_THROUGH('a-textarea'),
  'a-input-number': PASS_THROUGH('a-input-number'),
  'a-switch': PASS_THROUGH('a-switch'),
  'a-row': PASS_THROUGH('a-row'),
  'a-col': PASS_THROUGH('a-col'),
  'a-modal': OVERLAY('a-modal'),
  'a-drawer': OVERLAY('a-drawer'),
  'a-table': TABLE_STUB,
  'a-popconfirm': {
    name: 'APopconfirm',
    props: ['title', 'disabled'],
    emits: ['confirm'],
    template: '<span class="popconfirm-stub"><slot /></span>'
  }
}

const PAGE: PortalPage = {
  id: 77,
  siteId: 9,
  title: '常见问题',
  slug: 'geo-q-1',
  pageKind: 'custom',
  status: 'draft',
  version: 3,
  layoutJson: '{"blocks":[]}',
  themeJson: null,
  navVisible: false,
  navSort: 0
} as unknown as PortalPage

/** 后端这一屏给的那两句（唯一出处是后端的 EmptyResultReasons，这里是它的原文） */
const NONE_LINE = '门户页面：这个站点下没有页面（这一档查过了，一条都没有）。'
const NOT_VISIBLE_LINE = '门户页面：当前选中的身份在这个站点读不到页面，所以这里不能说「没有」。'

/** 空回包的形状和 pagedResult 一致，只是成因那两格给的是后端答的那一种 */
function emptyResult(reason: string | null, line: string | null) {
  return { records: [], total: 0, page: 1, size: 1, pages: 1, emptyReason: reason, emptyLine: line }
}

async function mountView(permissions: string[], payload?: any, failWith?: Error) {
  authState.permissions = permissions
  if (failWith) {
    vi.mocked(portalPagesApi.list).mockRejectedValue(failWith)
  } else {
    vi.mocked(portalPagesApi.list).mockResolvedValue(payload)
  }
  const wrapper = mount(PageBuilderView, { global: { stubs } })
  await flushPromises()
  return wrapper
}

/** 后端那一句（NONE 那一档下面还会多摆一颗新建按钮，比对文案前先把它摘掉） */
const hintText = (wrapper: any) => {
  const node = wrapper.find('.empty-line').element.cloneNode(true) as HTMLElement
  node.querySelectorAll('.create-on-empty').forEach((button) => button.remove())
  return (node.textContent || '').trim()
}

const TWO_EMPTIES: Array<[string, string]> = [
  ['NONE', NONE_LINE],
  ['NOT_VISIBLE', NOT_VISIBLE_LINE]
]

describe('PageBuilderView 的空态成因（M-P74）', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(portalPagesApi.get).mockResolvedValue(PAGE)
    vi.mocked(portalPagesApi.statusLabels).mockResolvedValue({ draft: '草稿', published: '已发布' })
    vi.mocked(portalPagesApi.changeSourceLabels).mockResolvedValue({ manual: '人工' })
    vi.mocked(portalPagesApi.preview).mockResolvedValue({ blocks: [], theme: null, path: '/p/geo-q-1', skippedBlocks: [] } as never)
    vi.mocked(portalPagesApi.blocks).mockResolvedValue([])
    vi.mocked(themePresetsApi.tokens).mockResolvedValue([{ key: 'colorPrimary', kind: 'COLOR', min: 0, max: 0 }] as never)
    vi.mocked(siteThemeApi.get).mockResolvedValue(
      { id: 9, name: '演示站', themeJson: null, themePresetId: null, themeUpdatedAt: null } as never
    )
    vi.mocked(portalSitesApi.listMine).mockResolvedValue([{ id: 9, code: 'site-9', name: '演示站', domain: null }])
  })

  it.each(TWO_EMPTIES)('后端回 %s 那一档时逐字念那一句，页面上没有「暂无数据」也没有旧话术', async (reason, line) => {
    const wrapper = await mountView(['portal:page:manage', 'portal:build:manage'], emptyResult(reason, line))

    expect(hintText(wrapper)).toBe(line)
    const html = wrapper.html()
    expect(html).not.toContain('暂无数据')
    // 界面自己编的那句旧话术已经作废：成因只认后端
    expect(html).not.toContain('这个站点还没有页面')
    wrapper.unmount()
  })

  it('后端没回是哪一种空时念「界面不替它猜」，不蒙成「一条都没有」', async () => {
    const wrapper = await mountView(['portal:page:manage', 'portal:build:manage'], emptyResult(null, null))

    expect(hintText(wrapper)).toContain('后端没回是哪一种空')
    const html = wrapper.html()
    expect(html).not.toContain('一条都没有')
    expect(html).not.toContain('暂无数据')
    wrapper.unmount()
  })

  it('读失败那一发说的是读失败，不是「这一档没有」', async () => {
    const wrapper = await mountView(['portal:page:manage', 'portal:build:manage'], undefined, new Error('页面清单那一发断了'))

    const said = hintText(wrapper)
    expect(said).toContain('这一发读失败：页面清单那一发断了')
    expect(said).toContain('读失败不是「这一档没有」')
    expect(said).not.toContain('一条都没有')
    wrapper.unmount()
  })

  it('有建设码时 NONE 摆「新建页面」，只持读/发码时那一句照念但没有按钮', async () => {
    const canBuild = await mountView(['portal:page:manage', 'portal:build:manage'], emptyResult('NONE', NONE_LINE))
    const button = canBuild.find('.create-on-empty')
    expect(button.exists()).toBe(true)
    expect(button.text().replace(/\s+/g, '')).toBe('新建页面')
    canBuild.unmount()

    const readOnly = await mountView(['portal:page:manage'], emptyResult('NONE', NONE_LINE))
    expect(hintText(readOnly)).toBe(NONE_LINE)
    expect(readOnly.find('.create-on-empty').exists()).toBe(false)
    // 藏的不止空态那一颗：工具栏那颗同样按码渲染，缺码的人点了只会收 403
    expect(readOnly.findAll('button').map(node => node.text().replace(/\s+/g, ''))).not.toContain('新建页面')
    readOnly.unmount()
  })

  it('NOT_VISIBLE 就算有建设码也不摆新建按钮（读不到不等于这一档还空着）', async () => {
    const wrapper = await mountView(['portal:page:manage', 'portal:build:manage'], emptyResult('NOT_VISIBLE', NOT_VISIBLE_LINE))

    expect(wrapper.find('.create-on-empty').exists()).toBe(false)
    wrapper.unmount()
  })

  it('有行的时候那一句整段都不渲', async () => {
    const wrapper = await mountView(['portal:page:manage', 'portal:build:manage'], pagedResult([PAGE]))

    expect(wrapper.find('.empty-line').exists()).toBe(false)
    expect(wrapper.findAll('.list-item')).toHaveLength(1)
    expect(wrapper.text()).not.toContain('门户页面：')
    wrapper.unmount()
  })
})
