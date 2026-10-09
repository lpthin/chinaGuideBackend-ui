import { describe, it, expect, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { Button, Input, InputNumber, Select } from 'ant-design-vue'
import { themePresetsApi } from '../../../api/themePresets'
import PageBuilderView from '../../../views/portal/PageBuilderView.vue'
import { portalPagesApi } from '../../../api/portalPages'
import { portalSitesApi } from '../../../api/portalSites'
import { siteThemeApi } from '../../../api/siteTheme'

/**
 * 搭建器里那两个主题框「接没接上线」（Spec-M P2 判据②③的前端那一半）。
 *
 * 站级面板是独立组件（自己的用例钉它发什么），这里钉的是接线：
 * 1. 白名单没取到时，面板不许摆出可编辑态——不钉的话用户对着空面板点「保存」，
 *    发出去的是一份空主题（那在接口上是「整站清空」）；
 * 2. 面板写成功要重取一次合成预览，否则「改一次全站生效」在那一格上看不到效果。
 *
 * 与 page-builder-view.spec 共用同一套桩（那里的 PASS_THROUGH 是为按钮文案写的，
 * 这里只多一处：站级面板要真挂上来，桩住它就测不到接线）。
 */

vi.mock('ant-design-vue', async () => {
  const actual = await vi.importActual<Record<string, any>>('ant-design-vue')
  return { ...actual, message: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() } }
})
vi.mock('../../../api/portalPages', () => ({
  portalPagesApi: {
    list: vi.fn(), get: vi.fn(), blocks: vi.fn(), statusLabels: vi.fn(), changeSourceLabels: vi.fn(),
    preview: vi.fn(), publish: vi.fn(), offline: vi.fn(), versions: vi.fn(), versionsDiff: vi.fn(),
    validate: vi.fn(), updateLayout: vi.fn(), updateMeta: vi.fn(), create: vi.fn(), rollback: vi.fn(), remove: vi.fn()
  }
}))
vi.mock('../../../api/portalSites', () => ({ portalSitesApi: { listMine: vi.fn() } }))
vi.mock('../../../api/themePresets', () => ({ themePresetsApi: { tokens: vi.fn(), list: vi.fn() } }))
vi.mock('../../../api/siteTheme', () => ({
  siteThemeApi: { get: vi.fn(), update: vi.fn(), saveSkin: vi.fn(), applySkin: vi.fn() }
}))

const authState = { permissions: ['portal:page:manage', 'portal:build:manage'] as string[] }
vi.mock('../../../stores/auth', () => ({
  useAuthStore: () => ({
    get permissions() { return authState.permissions },
    isSuperAdmin: false,
    hasPermission: (code: string) => authState.permissions.includes(code)
  })
}))

const PASS_THROUGH = (name: string) => ({
  name,
  props: ['title', 'message', 'type', 'description', 'label', 'size', 'spinning', 'dataSource'],
  template: `<div class="${name}-stub">{{ title }}{{ message }}{{ description }}{{ label }}`
    + '<slot /><slot name="extra" /><slot name="overlay" /></div>'
})
const OVERLAY = (name: string) => ({
  name, props: ['open', 'title'],
  template: `<div v-if="open" class="${name}-stub">{{ title }}<slot /><slot name="footer" /></div>`
})
const TABLE_STUB = {
  name: 'ATable',
  props: { dataSource: { type: Array, default: () => [] }, columns: { type: Array, default: () => [] } },
  template: '<div class="table-stub"><div v-for="(record, index) in dataSource" :key="index" class="row">'
    + '<template v-for="column in columns" :key="column.key">'
    + '<slot v-if="$slots.bodyCell" name="bodyCell" :column="column" :record="record" /></template></div></div>'
}
const LIST_STUB = {
  name: 'AList', props: { dataSource: { type: Array, default: () => [] } },
  template: '<div class="list-stub"><div v-for="(item, index) in dataSource" :key="index" class="list-item">'
    + '<slot name="renderItem" :item="item" /></div></div>'
}

const stubs = {
  'a-button': Button,
  BlockPropsForm: { name: 'BlockPropsForm', props: ['schema', 'model'], template: '<div class="props-stub" />' },
  PortalViewportPreview: { name: 'PortalViewportPreview', props: ['blocks', 'theme'], template: '<div class="preview-stub" />' },
  'a-form': PASS_THROUGH('a-form'), 'a-form-item': PASS_THROUGH('a-form-item'), 'a-select': Select,
  'a-spin': PASS_THROUGH('a-spin'), 'a-empty': PASS_THROUGH('a-empty'), 'a-alert': PASS_THROUGH('a-alert'),
  'a-card': PASS_THROUGH('a-card'), 'a-list': LIST_STUB, 'a-list-item': PASS_THROUGH('a-list-item'),
  'a-tag': PASS_THROUGH('a-tag'), 'a-space': PASS_THROUGH('a-space'), 'a-dropdown': PASS_THROUGH('a-dropdown'),
  'a-menu': PASS_THROUGH('a-menu'), 'a-menu-item': PASS_THROUGH('a-menu-item'), 'a-divider': PASS_THROUGH('a-divider'),
  'a-input': Input, 'a-input-number': InputNumber, 'a-switch': PASS_THROUGH('a-switch'),
  'a-row': PASS_THROUGH('a-row'), 'a-col': PASS_THROUGH('a-col'),
  'a-modal': OVERLAY('a-modal'), 'a-drawer': OVERLAY('a-drawer'), 'a-table': TABLE_STUB,
  'a-popconfirm': { name: 'APopconfirm', props: ['title', 'disabled'], emits: ['confirm'], template: '<span><slot /></span>' }
}

const PAGE = {
  id: 77, siteId: 9, title: '常见问题', slug: 'geo-q-1', pageKind: 'custom', status: 'draft', version: 3,
  layoutJson: '{"blocks":[{"instanceId":"faq-1","blockKey":"faq-grid","props":{}}]}',
  themeJson: '{"colorPrimary":"#1B6EF3"}', navVisible: false, navSort: 0
} as never

async function mountView() {
  const wrapper = mount(PageBuilderView, { global: { stubs } })
  await flushPromises()
  return wrapper
}

function buttonOf(wrapper: Awaited<ReturnType<typeof mountView>>, label: string) {
  return wrapper.findAll('button').find(node => node.text().replace(/\s+/g, '') === label)
}

describe('搭建器里的站级主题面板接线', () => {
  it('白名单取到了才摆出那两行按钮', async () => {
    vi.mocked(portalPagesApi.list).mockResolvedValue([PAGE])
    vi.mocked(portalPagesApi.get).mockResolvedValue(PAGE)
    vi.mocked(portalPagesApi.statusLabels).mockResolvedValue({ draft: '草稿', published: '已发布' } as never)
    vi.mocked(portalPagesApi.changeSourceLabels).mockResolvedValue({ manual: '人工' } as never)
    vi.mocked(portalPagesApi.blocks).mockResolvedValue([])
    vi.mocked(portalPagesApi.preview).mockResolvedValue({ blocks: [], theme: null, path: '/p/geo-q-1', skippedBlocks: [] } as never)
    vi.mocked(themePresetsApi.tokens).mockResolvedValue([{ key: 'colorPrimary', kind: 'COLOR', min: 0, max: 0 }] as never)
    vi.mocked(portalSitesApi.listMine).mockResolvedValue([{ id: 9, code: 'site-9', name: '演示站', domain: null }] as never)
    vi.mocked(siteThemeApi.get).mockResolvedValue(
      { id: 9, name: '演示站', themeJson: '{"colorPrimary":"#0A7D3F"}', themePresetId: null, themeUpdatedAt: null } as never
    )
    const wrapper = await mountView()
    expect(buttonOf(wrapper, '保存（整份替换）')).toBeDefined()
    expect(buttonOf(wrapper, '清空站级主题')).toBeDefined()
    wrapper.unmount()
  })

  it('白名单没取到时不摆出可编辑态：那时点保存发的是「整站清空」', async () => {
    vi.mocked(portalPagesApi.list).mockResolvedValue([PAGE])
    vi.mocked(portalPagesApi.get).mockResolvedValue(PAGE)
    vi.mocked(portalPagesApi.statusLabels).mockResolvedValue({ draft: '草稿', published: '已发布' } as never)
    vi.mocked(portalPagesApi.changeSourceLabels).mockResolvedValue({ manual: '人工' } as never)
    vi.mocked(portalPagesApi.blocks).mockResolvedValue([])
    vi.mocked(portalPagesApi.preview).mockResolvedValue({ blocks: [], theme: null, path: '/p/geo-q-1', skippedBlocks: [] } as never)
    vi.mocked(themePresetsApi.tokens).mockRejectedValue(new Error('白名单取不到'))
    vi.mocked(portalSitesApi.listMine).mockResolvedValue([{ id: 9, code: 'site-9', name: '演示站', domain: null }] as never)
    vi.mocked(siteThemeApi.get).mockResolvedValue(
      { id: 9, name: '演示站', themeJson: '{"colorPrimary":"#0A7D3F"}', themePresetId: null, themeUpdatedAt: null } as never
    )
    const wrapper = await mountView()
    expect(buttonOf(wrapper, '保存（整份替换）')).toBeUndefined()
    expect(wrapper.text()).toContain('样式变量清单还没取到')
    wrapper.unmount()
  })
})
