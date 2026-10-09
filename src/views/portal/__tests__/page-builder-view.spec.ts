import { describe, it, expect, beforeEach, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { Button } from 'ant-design-vue'
import PageBuilderView from '../PageBuilderView.vue'
import { portalPagesApi, type PortalPage } from '../../../api/portalPages'
import { portalSitesApi } from '../../../api/portalSites'
import { themePresetsApi } from '../../../api/themePresets'
import { siteThemeApi } from '../../../api/siteTheme'

/**
 * 页面搭建视图的两档权限形状（Q-P7-3）。
 *
 * 后端把 `/api/portal/pages` 拆成两码之后，这一页同时服务两种人：
 * - 只持 `portal:page:manage` 的租户管理员：读页、改页面信息、发布、下线；
 * - 另持 `portal:build:manage` 的平台侧：再加新建页、区块装配、结构检查、保存布局、回滚。
 *
 * 这里钉三件事，都是「不钉就会静默变回谎报」的那类：
 * 1. 建站那半的入口对缺码账号**不出现**（出现就是点了收 403）；
 * 2. 读口的请求按码发：缺建设码时 `/portal/blocks` 与 `/portal/theme-presets/tokens` 一次都不发，
 *    而页面清单照发——旧版把五个读口塞进同一个 `Promise.all`，任一 403 会让整页连列表都不加载；
 * 3. 发布/下线/版本历史对租户仍然可用（这条链的最后一拍本来就该合在客户手里）。
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

/**
 * 纯透传壳：把 props 里的文案原样吐回文本节点，否则「缺的是哪个码写在明处」
 * 这类断言测的是空气（a-alert 的 message 走 props 而不是 slot）。
 * 按模板里的写法用连字符名注册：`a-drawer` 注册成 `ADrawer` 时 stub 不生效，
 * 组件会当成未知元素渲成 `<a-drawer>`，`findAll('button')` 一条都抓不到。
 */
const PASS_THROUGH = (name: string) => ({
  name,
  props: ['title', 'message', 'type', 'description', 'label', 'size', 'spinning', 'dataSource'],
  template: `<div class="${name}-stub">{{ title }}{{ message }}{{ description }}{{ label }}`
    + '<slot /><slot name="extra" /><slot name="overlay" /></div>'
})

/** 抽屉与模态都要如实按 open 渲：版本历史那一格（回滚按钮）只有渲出来才测得到它在不在 */
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
  layoutJson: '{"blocks":[{"instanceId":"faq-1","blockKey":"faq-grid","props":{}}]}',
  themeJson: null,
  navVisible: false,
  navSort: 0
} as unknown as PortalPage

async function mountView(permissions: string[]) {
  authState.permissions = permissions
  const wrapper = mount(PageBuilderView, { global: { stubs } })
  await flushPromises()
  return wrapper
}

function buttonMap(wrapper: Awaited<ReturnType<typeof mountView>>) {
  const map = new Map<string, boolean>()
  for (const node of wrapper.findAll('button')) {
    // a-button 会给两字中文按钮插一个空格（「保 存」），比对前先抹掉空白
    map.set(node.text().replace(/\s+/g, ''), node.attributes('disabled') !== undefined)
  }
  return map
}

/** 版本历史要点开才渲：抽屉里只留最新那一格的按钮文案 */
async function openVersionsDrawer(wrapper: Awaited<ReturnType<typeof mountView>>) {
  const trigger = wrapper.findAll('button').find(node => node.text().replace(/\s+/g, '') === '版本历史')
  if (!trigger) throw new Error('版本历史按钮没渲出来')
  await trigger.trigger('click')
  await flushPromises()
  return wrapper.get('.a-drawer-stub')
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(portalPagesApi.list).mockResolvedValue([PAGE])
  vi.mocked(portalPagesApi.get).mockResolvedValue(PAGE)
  vi.mocked(portalPagesApi.statusLabels).mockResolvedValue({ draft: '草稿', published: '已发布' })
  vi.mocked(portalPagesApi.changeSourceLabels).mockResolvedValue({ manual: '人工' })
  vi.mocked(portalPagesApi.preview).mockResolvedValue({ blocks: [], theme: null, path: '/p/geo-q-1', skippedBlocks: [] } as never)
  // 两版才给 diffFrom：单版时「与 X 对比」的 X 是空的，那样这条断言测不到真文案
  vi.mocked(portalPagesApi.versions).mockResolvedValue([
    { versionNo: 3, changeSource: 'manual', note: '搭建器保存', createdAt: '2026-10-04 10:00:00' },
    { versionNo: 2, changeSource: 'manual', note: '搭建器保存', createdAt: '2026-10-03 10:00:00' }
  ] as never)
  vi.mocked(portalPagesApi.blocks).mockResolvedValue([])
  // 给一行真旋钮：清空语义那条用例要点到「清」按钮，字段清单为空时那一行根本不渲
  vi.mocked(themePresetsApi.tokens).mockResolvedValue([{ key: 'colorPrimary', kind: 'COLOR', min: 0, max: 0 }] as never)
  vi.mocked(siteThemeApi.get).mockResolvedValue(
    { id: 9, name: '演示站', themeJson: null, themePresetId: null, themeUpdatedAt: null } as never
  )
  vi.mocked(portalSitesApi.listMine).mockResolvedValue([{ id: 9, code: 'site-9', name: '演示站', domain: null }])
})

describe('页面搭建：只持读页码的租户管理员', () => {
  it('读口的请求按码发：页面清单照发，建设域那两条一次都不发', async () => {
    const wrapper = await mountView(['portal:page:manage'])
    expect(portalPagesApi.list).toHaveBeenCalledTimes(1)
    expect(portalSitesApi.listMine).toHaveBeenCalledTimes(1)
    expect(portalPagesApi.blocks).not.toHaveBeenCalled()
    expect(themePresetsApi.tokens).not.toHaveBeenCalled()
    // 旧版这里是一个五发 Promise.all：blocks 403 会让整页连列表都不加载，界面就成了「没有页面」
    expect(wrapper.text()).toContain('常见问题')
    wrapper.unmount()
  })

  it('建站那半的入口不出现，缺的是哪个码写在明处', async () => {
    const wrapper = await mountView(['portal:page:manage'])
    const labels = [...buttonMap(wrapper).keys()]
    expect(labels).not.toContain('新建页面')
    expect(labels).not.toContain('添加区块')
    expect(wrapper.text()).not.toContain('↑')
    expect(wrapper.text()).toContain('portal:build:manage')
    expect(wrapper.text()).toContain('这一页对你只到')
    wrapper.unmount()
  })

  it('保存与结构检查摆着但是禁用，而发布/下线/版本历史/页面信息照常能点', async () => {
    const wrapper = await mountView(['portal:page:manage'])
    const byLabel = buttonMap(wrapper)
    expect(byLabel.get('保存')).toBe(true)
    expect(byLabel.get('检查结构')).toBe(true)
    expect(byLabel.get('发布')).toBe(false)
    expect(byLabel.get('下线')).toBe(false)
    expect(byLabel.get('版本历史')).toBe(false)
    expect(byLabel.get('页面信息')).toBe(false)
    wrapper.unmount()
  })

  it('版本历史里没有「回滚到此版」，对比仍然给', async () => {
    const wrapper = await mountView(['portal:page:manage'])
    const drawer = await openVersionsDrawer(wrapper)
    expect(drawer.text()).toContain('与 3 对比')
    expect(drawer.text()).not.toContain('回滚到此版')
    wrapper.unmount()
  })
})

describe('页面搭建：另持建设码的平台侧', () => {
  it('区块白名单与样式变量都去取，新建页面与保存回来了', async () => {
    const wrapper = await mountView(['portal:page:manage', 'portal:build:manage'])
    expect(portalPagesApi.blocks).toHaveBeenCalledTimes(1)
    expect(themePresetsApi.tokens).toHaveBeenCalledTimes(1)
    const byLabel = buttonMap(wrapper)
    expect(byLabel.has('新建页面')).toBe(true)
    expect(byLabel.has('添加区块')).toBe(true)
    expect(byLabel.get('保存')).toBe(false)
    expect(byLabel.get('检查结构')).toBe(false)
    expect(wrapper.text()).not.toContain('这一页对你只到')

    const drawer = await openVersionsDrawer(wrapper)
    expect(drawer.text()).toContain('回滚到此版')
    wrapper.unmount()
  })

  it('区块编辑表单只在有建设码时出现', async () => {
    const withBuild = await mountView(['portal:page:manage', 'portal:build:manage'])
    // 表单挂在「选中某个区块」之后（activeBlock 为空时那一格本来就是提示语），先点区块再说
    await withBuild.get('.page-builder__block').trigger('click')
    expect(withBuild.find('.props-stub').exists()).toBe(true)
    withBuild.unmount()

    const readOnly = await mountView(['portal:page:manage'])
    await readOnly.get('.page-builder__block').trigger('click')
    expect(readOnly.find('.props-stub').exists()).toBe(false)
    expect(readOnly.text()).toContain('不给编辑')
    readOnly.unmount()
  })

  it('本页覆盖清干净后保存发的是空串：null 在那道口是「这一列不动」', async () => {
    vi.mocked(portalPagesApi.get).mockResolvedValue(
      { ...PAGE, themeJson: '{"colorPrimary":"#1B6EF3"}' } as never
    )
    vi.mocked(portalPagesApi.updateLayout).mockResolvedValue({ ...PAGE, version: 4 } as never)
    const wrapper = await mountView(['portal:page:manage', 'portal:build:manage'])
    const clearButton = wrapper.findAll('.page-builder__theme button').find(node => node.text().trim() === '清')
    if (!clearButton) throw new Error('本页主题覆盖那一行的「清」没渲出来')
    await clearButton.trigger('click')
    const saveButton = wrapper.findAll('button').find(node => node.text().replace(/\s+/g, '') === '保存')
    if (!saveButton) throw new Error('保存按钮没渲出来')
    await saveButton.trigger('click')
    await flushPromises()
    expect(portalPagesApi.updateLayout).toHaveBeenCalledWith(77, expect.objectContaining({ themeJson: '' }))
    wrapper.unmount()
  })
})
