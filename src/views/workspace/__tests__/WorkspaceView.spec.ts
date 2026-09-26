import { describe, it, expect, beforeEach, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import WorkspaceView from '../WorkspaceView.vue'
import { useAuthStore } from '../../../stores/auth'
import { portalSectionsApi } from '../../../api/portalSections'

/**
 * 侧边菜单（Spec-C §3.1）。
 *
 * 这个视图以前手写 19 个 portal 菜单项 + 两张中文映射表，视图与路由各写一份真相，
 * 于是改一处忘另一处。现在它只渲染 `navigation/workspaceMenu.ts` 生成的段，
 * 用例要钉的是**渲染结果真的按身份分了家**（模块级的规则在 workspace-menu.spec.ts 里钉）：
 * 超管看到两段、租户只看到自己那段，而且界面上不再有「两个栏目管理」。
 */

vi.mock('../../../api/portalSections', () => ({
  portalSectionsApi: { list: vi.fn(), summary: vi.fn(), adminList: vi.fn(), adminUpdate: vi.fn() }
}))

// 布局类 stub 必须渲染默认插槽并带上组件名，否则嵌套的 header/sider/content/breadcrumb 既不会出现在 wrapper 里，也无法按名称查找到
const layoutStub = (name: string) => ({ name, template: '<div><slot /></div>' })

const MENU_STUBS = {
  'a-menu': { name: 'AMenu', template: '<div class="menu-stub"><slot /></div>' },
  'a-menu-item': { name: 'AMenuItem', template: '<div class="menu-item-stub"><slot /></div>' },
  'a-menu-item-group': {
    name: 'AMenuItemGroup',
    template: '<div class="menu-group-stub"><div class="menu-group-title"><slot name="title" /></div><slot /></div>'
  }
}

const TENANT_CODES = ['portal:siteinfo:manage', 'media:manage', 'analytics:view', 'portal:ticket:submit', 'case:manage']

function mountView(user: Record<string, any>) {
  const auth = useAuthStore()
  auth.accessToken = 'token'
  auth.user = user as any
  auth.selectedTenantId = null
  return mount(WorkspaceView, {
    global: {
      stubs: {
        'a-layout': layoutStub('ALayout'),
        'a-layout-header': layoutStub('ALayoutHeader'),
        'a-layout-content': layoutStub('ALayoutContent'),
        'a-layout-sider': layoutStub('ALayoutSider'),
        'a-breadcrumb': layoutStub('ABreadcrumb'),
        'a-breadcrumb-item': { name: 'ABreadcrumbItem', template: '<span><slot /></span>' },
        ...MENU_STUBS,
        'a-button': true,
        'a-dropdown': true,
        'a-divider': true,
        'a-tooltip': true,
        'a-avatar': true,
        'a-space': true,
        'router-view': true,
        'router-link': true,
        TenantSwitcher: true
      }
    }
  })
}

describe('WorkspaceView 侧边菜单', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(portalSectionsApi.list as any).mockResolvedValue([
      { key: 'news', contentEntry: 'article', enabled: true },
      { key: 'cases', contentEntry: 'case', enabled: true },
      { key: 'about', contentEntry: 'company', enabled: true },
      { key: 'jobs', contentEntry: 'job', enabled: true }
    ])
  })

  it('超管看到两段，且没有「两个栏目管理」这种重名异物', async () => {
    const wrapper = mountView({
      username: 'admin',
      roles: ['SUPER_ADMIN'],
      permissions: ['portal:build:manage', 'portal:build:section', 'portal:siteinfo:manage', 'media:manage', 'analytics:view']
    })
    await flushPromises()
    const text = wrapper.text()
    expect(text).toContain('内容与维护')
    expect(text).toContain('平台 · 建站与治理')
    expect(text).toContain('建站流水线')
    expect(text).toContain('栏目开通')
    expect(text).toContain('文章分类')
    expect(text).not.toContain('栏目管理')
    expect(text).not.toContain('建站工作台')
  })

  it('租户只看到自己那一段：建设项与系统项一项都不出现', async () => {
    const wrapper = mountView({ username: 'siteadmin', roles: ['SITE_ADMIN'], permissions: TENANT_CODES })
    await flushPromises()
    const text = wrapper.text()
    const items = wrapper.findAll('.menu-item-stub').map(node => node.text().trim())
    expect(text).not.toContain('平台 · 建站与治理')
    expect(items).not.toContain('建站流水线')
    expect(items).not.toContain('栏目开通')
    expect(items).not.toContain('页面搭建')
    expect(items).not.toContain('站点管理')
    expect(items).not.toContain('大模型配置')
    // 该看的还在：内容生产、企业信息、以及固定在菜单最下方的「联系平台」
    expect(text).toContain('内容生产')
    expect(items).toContain('企业信息')
    expect(items).toContain('联系平台')
  })

  it('栏目没开通时，招聘与企业信息这两项从菜单里退场（词表驱动，不是前端常量）', async () => {
    ;(portalSectionsApi.list as any).mockResolvedValue([
      { key: 'news', contentEntry: 'article', enabled: true }
    ])
    const wrapper = mountView({ username: 'siteadmin', roles: ['SITE_ADMIN'], permissions: TENANT_CODES })
    await flushPromises()
    // 只判菜单项本身：组标题那行小字里也写着「企业信息」，用整页 text() 判会自欺欺人
    const items = wrapper.findAll('.menu-item-stub').map(node => node.text().trim())
    expect(items).not.toContain('招聘管理')
    expect(items).not.toContain('企业信息')
    expect(items).toContain('文章管理')
    expect(items).toContain('Banner管理')
  })

  it('每一项只渲染一次，且渲染出来的项数等于可见叶子数（视图不再手抄第二份清单）', async () => {
    const wrapper = mountView({
      username: 'admin',
      roles: ['SUPER_ADMIN'],
      permissions: ['portal:build:manage', 'portal:siteinfo:manage', 'portal:ticket:submit']
    })
    await flushPromises()
    const items = wrapper.findAll('.menu-item-stub').map(node => node.text().trim())
    expect(items.filter(label => label === '建站流水线')).toHaveLength(1)
    expect(items.filter(label => label === '待办通知')).toHaveLength(1)
    expect(new Set(items).size).toBe(items.length)
    // 工作台（固定在最上方）+ 联系平台（固定在最下方）也在同一批渲染里
    expect(items).toContain('工作台')
    expect(items).toContain('联系平台')
  })
})
