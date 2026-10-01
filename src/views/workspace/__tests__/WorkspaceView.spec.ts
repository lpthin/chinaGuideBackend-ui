import { describe, it, expect, beforeEach, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import WorkspaceView from '../WorkspaceView.vue'
import { useAuthStore } from '../../../stores/auth'
import { portalSectionsApi } from '../../../api/portalSections'
import { routes } from '../../../router'
import { MENU_GROUPS, collectMenuLeaves } from '../../../navigation/workspaceMenu'

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
  // Spec-H H-1b：视图把「哪几组开着」按段喂给两个 `<a-menu>`，所以 stub 要把 openKeys 收成 prop
  // 并落到 data-open 上——这样用例能直接读出「租户段开了哪几组」，而不是靠整页文字猜。
  'a-menu': {
    name: 'AMenu',
    props: ['openKeys', 'selectedKeys', 'inlineCollapsed'],
    template: '<div class="menu-stub" :data-open="(openKeys || []).join(\',\')"><slot /></div>'
  },
  'a-menu-item': { name: 'AMenuItem', template: '<div class="menu-item-stub"><slot /></div>' },
  // Spec-H H-1a：组从 `<a-menu-item-group>`（静态标题）换成 `<a-sub-menu>`（可收合）。
  // stub 同样要渲染 title 槽 + 默认槽，否则组名与组里的项在这份用例里一起消失。
  'a-sub-menu': {
    name: 'ASubMenu',
    props: ['title'],
    template: '<div class="menu-group-stub ant-submenu-stub"><div class="menu-group-title"><slot name="title" /></div><slot /></div>'
  },
  // Spec-H Q6-a / Q5-a：组头小字与「热词库（搜索联想）」那半句都换成 tooltip。
  // stub 必须把默认槽渲出来（否则界面上的组名与项名在这份用例里直接消失），
  // 并把 title 落到 data-tip 上，好让用例能判「说明确实还在，只是换了地方」。
  'a-tooltip': {
    name: 'ATooltip',
    props: ['title', 'placement'],
    template: '<span class="tooltip-stub" :data-tip="title"><slot /></span>'
  }
}

const TENANT_CODES = ['portal:siteinfo:manage', 'media:manage', 'analytics:view', 'portal:ticket:submit', 'case:manage']

/**
 * 「满权限」那份码表：从路由 meta 现取，不手抄。
 * 用来把 11 个组全部渲出来数一颗不少的 SubMenu（Spec-H H-1a 的判据是「组数 = 轨道图标数」）。
 */
const ALL_CODES = Array.from(
  new Set(collectMenuLeaves(routes).map(leaf => leaf.permission).filter(Boolean) as string[])
)

const SUPER_USER = { username: 'admin', roles: ['SUPER_ADMIN'], permissions: ALL_CODES }

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
    // 开合与整栏折叠现在会读写 localStorage（H-1b / Q3-a）：不清的话，上一条留下的偏好会决定这一条的默认态
    localStorage.removeItem('nav_open_groups')
    localStorage.removeItem('nav_sider_collapsed')
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
    expect(text).toContain('租户日常')
    expect(text).toContain('平台管理')
    // Spec-H Q7-a：两行域标题收成一行，说明句进 tooltip（这里判的是「说明没丢，只是不在标签里」）
    expect(text).not.toContain('日常：填内容、看效果')
    expect(wrapper.find('[data-tip="日常：填内容、看效果"]').exists()).toBe(true)
    expect(wrapper.find('[data-tip="超管动作：建站、开栏目、改样式、跑探测"]').exists()).toBe(true)
    // Spec-C P3：「建站流水线」整页删除（主线收进需求单详情），菜单里它必须随之绝迹——
    // 留着就是一条点了 404 的假入口
    expect(text).not.toContain('建站流水线')
    expect(text).toContain('前采需求单')
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
    expect(text).not.toContain('平台管理')
    expect(items).not.toContain('前采需求单')
    expect(items).not.toContain('栏目开通')
    expect(items).not.toContain('页面搭建')
    expect(items).not.toContain('站点管理')
    expect(items).not.toContain('大模型配置')
    // 该看的还在：AI 写稿那组、企业信息、以及固定在菜单最下方的「联系平台」
    expect(text).toContain('AI 写稿')
    expect(items).toContain('企业信息')
    expect(items).toContain('联系平台')
  })

  it('栏目没开通时，招聘与企业信息这两项从菜单里退场（词表驱动，不是前端常量）', async () => {
    ;(portalSectionsApi.list as any).mockResolvedValue([
      { key: 'news', contentEntry: 'article', enabled: true }
    ])
    const wrapper = mountView({ username: 'siteadmin', roles: ['SITE_ADMIN'], permissions: TENANT_CODES })
    await flushPromises()
    // 只判菜单项本身：组标题的 tooltip 里也写着「企业信息」，用整页 text() 判会自欺欺人
    const items = wrapper.findAll('.menu-item-stub').map(node => node.text().trim())
    expect(items).not.toContain('招聘管理')
    expect(items).not.toContain('企业信息')
    expect(items).toContain('文章列表')
    expect(items).toContain('横幅')
    // Q5-a：括号那半句现在只在 tooltip 上，项名就是干净的三个字
    expect(items).not.toContain('热词库（搜索联想）')
    expect(items).toContain('热词库')
    expect(wrapper.find('[data-tip*="搜索联想"]').exists()).toBe(true)
  })

  it('每一项只渲染一次，且渲染出来的项数等于可见叶子数（视图不再手抄第二份清单）', async () => {
    const wrapper = mountView({
      username: 'admin',
      roles: ['SUPER_ADMIN'],
      permissions: ['portal:build:manage', 'portal:siteinfo:manage', 'portal:ticket:submit']
    })
    await flushPromises()
    const items = wrapper.findAll('.menu-item-stub').map(node => node.text().trim())
    // P3：钉「前采需求单」只渲染一次（原来这条钉的是已删除的「建站流水线」，守的行为不变：视图不手抄第二份清单）
    expect(items.filter(label => label === '前采需求单')).toHaveLength(1)
    expect(items.filter(label => label === '待办通知')).toHaveLength(1)
    expect(new Set(items).size).toBe(items.length)
    // 工作台（固定在最上方）+ 联系平台（固定在最下方）也在同一批渲染里
    expect(items).toContain('工作台')
    expect(items).toContain('联系平台')
  })

  it('Spec-H H-1a：组渲成可收合的 SubMenu，颗数 = 组数（超管 11 / 租户 5）', async () => {
    const wrapper = mountView(SUPER_USER)
    await flushPromises()
    const rails = wrapper.findAll('.ant-submenu-stub')
    expect(rails).toHaveLength(11)
    // 组标题必须还在，而且顺序 = MENU_GROUPS 的顺序（收起只藏子项，组名一颗不许少）
    expect(wrapper.findAll('.menu-group-title').map(node => node.text().trim())).toEqual(
      MENU_GROUPS.map(group => group.label)
    )
    // 租户这一侧：真实那份码表（TENANT_CODES）判完权限后只剩租户段的组。
    // 这里不写死「5」：组数随栏目开通态与授权而变（上一档用例已经在钉「平台项一项都不出现」），
    // 这一条要钉的是「租户看到的每一组都属于租户段」+「一颗组名都不许是平台段的」。
    const tenantWrapper = mountView({ username: 'siteadmin', roles: ['SITE_ADMIN'], permissions: TENANT_CODES })
    await flushPromises()
    const tenantLabels = MENU_GROUPS.filter(group => group.domain === 'tenant').map(group => group.label)
    const rendered = tenantWrapper.findAll('.menu-group-title').map(node => node.text().trim())
    expect(rendered.length).toBeGreaterThan(0)
    expect(rendered.filter(label => !tenantLabels.includes(label))).toEqual([])
    expect(tenantWrapper.text()).not.toContain('平台管理')
  })

  it('Spec-H H-1b：开合按段喂给两个菜单，一段的事件不许把另一段已开的组抹掉', async () => {
    localStorage.setItem('nav_open_groups', JSON.stringify(['article', 'billing']))
    const wrapper = mountView(SUPER_USER)
    await flushPromises()
    const menus = wrapper.findAllComponents({ name: 'AMenu' })
    const tenant = menus.find(node => node.attributes('data-domain') === 'tenant')!
    const platform = menus.find(node => node.attributes('data-domain') === 'platform')!
    expect(tenant.attributes('data-open')).toBe('article')
    expect(platform.attributes('data-open')).toBe('billing')

    // antd 的 update:openKeys 只带**那一个菜单**认识的键。直接拿它覆盖全局开合表 = 平台段被清空。
    tenant.vm.$emit('update:openKeys', ['content'])
    await nextTick()
    expect(tenant.attributes('data-open')).toBe('content')
    expect(platform.attributes('data-open'), '租户段的点击把平台段的开合抹掉了').toBe('billing')
    // 落盘那份按组表顺序，不按点击顺序（否则用例钉不住、刷新后顺序还会漂）
    expect(JSON.parse(localStorage.getItem('nav_open_groups') as string)).toEqual(['content', 'billing'])
  })

  it('Spec-H Q3-a：整栏折叠是偏好，按一下就记住；组开合没存过时才用默认策略', async () => {
    const wrapper = mountView(SUPER_USER)
    await flushPromises()
    // 没存过 → 首屏一组都不开（路由是 '/'，不在任何组里；进了某一组才会开那一组）
    expect(wrapper.findAllComponents({ name: 'AMenu' })
      .filter(node => node.attributes('data-domain'))
      .every(node => node.attributes('data-open') === '')).toBe(true)

    await wrapper.find('.collapse-btn').trigger('click')
    expect(localStorage.getItem('nav_sider_collapsed')).toBe('1')
    await wrapper.find('.collapse-btn').trigger('click')
    expect(localStorage.getItem('nav_sider_collapsed')).toBe('0')
  })
})
