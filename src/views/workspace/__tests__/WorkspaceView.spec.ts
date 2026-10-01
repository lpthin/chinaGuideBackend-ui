import { describe, it, expect, beforeEach, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import type { Router } from 'vue-router'
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
  },
  // Spec-H H-2：搜索框要能**真打字**。stub 用原生 `<input>` 并把 input 事件转成 antd 那条
  // `update:value`，这样 `setValue()` 走的仍是浏览器的事件链，父组件的 v-model 是真被驱动的，
  // 不是把查询串当 prop 塞进去（那等于用例替界面造假数据）。
  'a-input': {
    name: 'AInput',
    props: ['value', 'placeholder'],
    emits: ['update:value'],
    template: '<input class="menu-search-stub" :value="value" :placeholder="placeholder" @input="$emit(\'update:value\', $event.target.value)" />'
  },
  // Spec-H Q11：段过滤控件。stub 要渲染 options 并支持点击切换，这样用例能判「切换过滤后菜单段数变化」。
  'a-segmented': {
    name: 'ASegmented',
    props: ['value', 'options', 'size'],
    emits: ['update:value'],
    template: `
      <div class="ant-segmented">
        <div
          v-for="(opt, idx) in options"
          :key="idx"
          class="ant-segmented-item"
          :class="{ 'ant-segmented-item-selected': opt.value === value }"
          @click="$emit('update:value', opt.value)"
        >
          {{ opt.label }}
        </div>
      </div>
    `
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
  // 默认设置一个租户 ID，避免超管进入平台模式（平台模式只显示平台段）
  auth.selectedTenantId = 15
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
        'a-space': { name: 'ASpace', template: '<div class="a-space-stub"><slot /></div>' },
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

  it('平台模式（超管未选租户）：只显示平台段，不显示租户段和固定项', async () => {
    const auth = useAuthStore()
    auth.accessToken = 'token'
    auth.user = { username: 'admin', roles: ['SUPER_ADMIN'], permissions: ALL_CODES } as any
    auth.selectedTenantId = null  // 平台模式：没有选中任何租户
    const wrapper = mount(WorkspaceView, {
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
          'a-space': { name: 'ASpace', template: '<div class="a-space-stub"><slot /></div>' },
          'router-view': true,
          'router-link': true,
          TenantSwitcher: true
        }
      }
    })
    await flushPromises()
    const text = wrapper.text()
    // 平台模式：只显示平台段
    expect(text).not.toContain('租户日常')
    expect(text).toContain('平台管理')
    // 不显示固定项（工作台、联系平台/平台工单队列）
    expect(text).not.toContain('工作台')
    expect(text).not.toContain('联系平台')
    expect(text).not.toContain('平台工单队列')
    // 平台段的项应该还在
    expect(text).toContain('前采需求单')
    expect(text).toContain('站点管理')
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
    const wrapper = mountView(SUPER_USER)
    await flushPromises()
    const items = wrapper.findAll('.menu-item-stub').map(node => node.text().trim())
    // P3：钉「前采需求单」只渲染一次（原来这条钉的是已删除的「建站流水线」，守的行为不变：视图不手抄第二份清单）
    expect(items.filter(label => label === '前采需求单')).toHaveLength(1)
    expect(items.filter(label => label === '待办通知')).toHaveLength(1)
    expect(new Set(items).size).toBe(items.length)
    // 工作台（固定在最上方）+ 平台工单队列（超管固定在最下方）也在同一批渲染里。
    // 超管跳过权限检查，所以能看到需要 `portal:build:review` 的「平台工单队列」。
    expect(items).toContain('工作台')
    expect(items).toContain('平台工单队列')
  })

  it('Spec-H H-6：同一颗位置按角色换标题，超管那一屏不再有两个通向同一张表的入口', async () => {
    const superWrapper = mountView(SUPER_USER)
    await flushPromises()
    const superItems = superWrapper.findAll('.menu-item-stub').map(node => node.text().trim())
    expect(superItems).toContain('平台工单队列')
    expect(superItems).not.toContain('联系平台')
    // 队列以前同时在「平台质量」组和菜单最下方各挂一颗（同一个 SupportTicketView 的两个 mode）；
    // 现在只剩下方那一颗，「工单」这一族在界面上就是这两个不同视图、各一颗
    expect(superItems.filter(label => label.includes('工单'))).toEqual(['改版工单', '平台工单队列'])
    expect(superItems[superItems.length - 1]).toBe('平台工单队列')

    const tenantWrapper = mountView({ username: 'siteadmin', roles: ['SITE_ADMIN'], permissions: TENANT_CODES })
    await flushPromises()
    const tenantItems = tenantWrapper.findAll('.menu-item-stub').map(node => node.text().trim())
    expect(tenantItems[tenantItems.length - 1]).toBe('联系平台')
    expect(tenantItems).not.toContain('平台工单队列')
    // H-6 给这一颗补的那句 desc 是在界面上说得出话的（tooltip），不是只写进路由没人看：
    // 它同时是「租户搜『工单』能找到这一项」的命中面。
    expect(tenantWrapper.find('[data-tip*="提交工单"]').exists()).toBe(true)
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

  // ══════════════ Spec-H P2：菜单搜索框（H-2 / Q10-a）══════════════
  // 命中规则本身（哪些文字参与命中、组说明为什么不参与）在 navigation/__tests__/nav-state.spec.ts
  // 里钉纯函数；这一档只钉界面这三件事：真打字能换成命中列表、没命中要明说、命中项点得进去。

  /** 从 stub 的 input 真输入；setValue 走的是 DOM 的 input 事件 ⇒ 父组件 v-model 真被驱动 */
  async function typeIntoMenuSearch(wrapper: ReturnType<typeof mountView>, text: string) {
    await wrapper.find('input.menu-search-stub').setValue(text)
    await nextTick()
  }

  /** 读输入框里显示的那串字（判的是界面上的值，不是组件内部状态） */
  function menuSearchValue(wrapper: ReturnType<typeof mountView>): string {
    return (wrapper.find('input.menu-search-stub').element as HTMLInputElement).value
  }

  it('Spec-H H-2：输入「引用」→ 只剩含「引用」的项 + 其组名，树与别的组一起退场', async () => {
    const wrapper = mountView(SUPER_USER)
    await flushPromises()
    expect(wrapper.find('input.menu-search-stub').exists()).toBe(true)
    expect(wrapper.find('input.menu-search-stub').attributes('placeholder')).toBe('搜索栏目')
    // 搜之前是完整的树：11 个组
    expect(wrapper.findAll('.ant-submenu-stub')).toHaveLength(11)

    await typeIntoMenuSearch(wrapper, '引用')
    const items = wrapper.findAll('.menu-item-stub').map(node => node.text().trim())
    expect(items).toHaveLength(2)
    // 判据的后半句：每一项都带着它属于哪一组（不然命中两条看不出来源）
    expect(items).toContain('引用与来源效果与经营')
    expect(items).toContain('品牌引用探测平台质量')
    expect(items.every(text => text.includes('引用'))).toBe(true)
    // 「只剩」：两段树这时一项都不该在（组、组标题、段标题全部退场）
    expect(wrapper.findAll('.ant-submenu-stub')).toHaveLength(0)
    expect(wrapper.findAll('.menu-group-title')).toHaveLength(0)
    expect(wrapper.text()).not.toContain('租户日常')
  })

  it('Spec-H H-2：没有命中要明说「没有这一项」，不许留一片空白', async () => {
    const wrapper = mountView(SUPER_USER)
    await flushPromises()
    await typeIntoMenuSearch(wrapper, '一定不存在的栏目名字')
    expect(wrapper.findAll('.menu-item-stub')).toHaveLength(0)
    expect(wrapper.findAll('.ant-submenu-stub')).toHaveLength(0)
    const empty = wrapper.find('[data-testid="menu-search-empty"]')
    expect(empty.exists()).toBe(true)
    expect(empty.text()).toBe('没有「一定不存在的栏目名字」这一项')
  })

  it('Spec-H H-2：清空搜索回到树，而且开合表一个字没被搜索改过', async () => {
    localStorage.setItem('nav_open_groups', JSON.stringify(['article']))
    const wrapper = mountView(SUPER_USER)
    await flushPromises()
    await typeIntoMenuSearch(wrapper, '引用')
    await typeIntoMenuSearch(wrapper, '   ')
    // 只剩空格 = 没在搜（否则用户清了字却对着一片空白）
    expect(wrapper.findAll('.ant-submenu-stub')).toHaveLength(11)
    // 命中列表走的是「不展开组」那条路（见 WorkspaceView 里那段偏离说明）：偏好不该被一次搜索改掉
    expect(JSON.parse(localStorage.getItem('nav_open_groups') as string)).toEqual(['article'])
  })

  it('Spec-H H-2：点命中项跳得过去，跳完回到树并且把目标那一组开着', async () => {
    const wrapper = mountView(SUPER_USER)
    await flushPromises()
    await typeIntoMenuSearch(wrapper, '引用')

    // setup.ts 里那份路由是空表（`routes: []`），直接 push 会 reject；
    // 也不能再装第二只 router（vue-router 的 install 定义 `$route` 是不可重定义的，第二次 use 直接抛）。
    // 所以拿**视图正在用的那一只**补一条能吃 /workspace/** 的路由：跳的仍是组件里那条 push。
    const testRouter = (wrapper.vm as unknown as { $router: Router }).$router
    testRouter.addRoute({ path: '/workspace/:pathMatch(.*)*', name: 'spec-workspace', component: { template: '<div />' } })

    const hitsMenu = wrapper.findAllComponents({ name: 'AMenu' })
      .find(node => (node.attributes('class') || '').includes('sidebar-menu--hits'))!
    // antd 的菜单点击事件带的是那一项的 key，这里发的是真实形状（不是替界面猜一个）
    hitsMenu.vm.$emit('click', { key: 'portal/citations' })
    await flushPromises()

    expect(testRouter.currentRoute.value.path).toBe('/workspace/portal/citations')
    // 跳完不留搜索态：树回来了，而且「选中了却看不见」不能发生 ⇒ 目标组被打开
    expect(wrapper.findAll('.ant-submenu-stub').length).toBeGreaterThan(0)
    const tenant = wrapper.findAllComponents({ name: 'AMenu' })
      .find(node => node.attributes('data-domain') === 'tenant')!
    expect(tenant.attributes('data-open')).toBe('site-effect')
    expect(menuSearchValue(wrapper)).toBe('')
    testRouter.removeRoute('spec-workspace')
  })

  it('Spec-H H-2：折叠成图标轨时搜索框与命中列表一起退场（窄轨放不下输入框）', async () => {
    const wrapper = mountView(SUPER_USER)
    await flushPromises()
    await typeIntoMenuSearch(wrapper, '引用')
    expect(wrapper.findAll('.menu-item-stub')).toHaveLength(2)

    await wrapper.find('.collapse-btn').trigger('click')
    expect(wrapper.find('input.menu-search-stub').exists()).toBe(false)
    // 折叠态回到树（图标轨 + hover 弹层才是那一档的找法）：命中列表那一整块窄轨里放不下，
    // 连「没有这一项」那行也不该留在窄轨里（`.menu-item-stub` 两种形状都在用，判不出是谁，
    // 所以这里钉的是命中列表那个菜单本身退场 + 组重新数得出 11 颗）。
    expect(wrapper.find('.sidebar-menu--hits').exists()).toBe(false)
    expect(wrapper.find('[data-testid="menu-search-empty"]').exists()).toBe(false)
    expect(wrapper.findAll('.ant-submenu-stub')).toHaveLength(11)

    await wrapper.find('.collapse-btn').trigger('click')
    // 展开后那份输入还在，用户没被折叠那一下清掉搜索
    expect(menuSearchValue(wrapper)).toBe('引用')
    expect(wrapper.findAll('.menu-item-stub')).toHaveLength(2)
  })

  // ══════════════ Spec-H Q11：顶栏段过滤（只看租户 / 只看平台）══════════════
  // 判据：超管视角下可以只看租户 / 只看平台 / 全看；租户视角永远看全部（他们本来就只有租户段）。

  it('Spec-H Q11：段过滤控件只对超管可见，租户视角不出现', async () => {
    const superWrapper = mountView(SUPER_USER)
    await flushPromises()
    // 超管视角：段过滤控件应该存在
    expect(superWrapper.find('.ant-segmented').exists()).toBe(true)
    
    // 租户视角：段过滤控件不应该存在
    const tenantWrapper = mountView({ username: 'siteadmin', roles: ['SITE_ADMIN'], permissions: TENANT_CODES })
    await flushPromises()
    expect(tenantWrapper.find('.ant-segmented').exists()).toBe(false)
  })

  it('Spec-H Q11：段过滤可以只显示租户段或只显示平台段', async () => {
    const wrapper = mountView(SUPER_USER)
    await flushPromises()
    
    // 默认是「全部」：应该看到两段（租户日常 + 平台管理）
    let sections = wrapper.findAll('.menu-domain')
    expect(sections).toHaveLength(2)
    expect(sections[0].text()).toContain('租户日常')
    expect(sections[1].text()).toContain('平台管理')
    
    // 切换到「租户」：应该只看到租户段
    const segmented = wrapper.find('.ant-segmented')
    const buttons = segmented.findAll('.ant-segmented-item')
    await buttons[1].trigger('click') // 第二个是「租户」
    await nextTick()
    sections = wrapper.findAll('.menu-domain')
    expect(sections).toHaveLength(1)
    expect(sections[0].text()).toContain('租户日常')
    
    // 切换到「平台」：应该只看到平台段
    await buttons[2].trigger('click') // 第三个是「平台」
    await nextTick()
    sections = wrapper.findAll('.menu-domain')
    expect(sections).toHaveLength(1)
    expect(sections[0].text()).toContain('平台管理')
    
    // 切换回「全部」：应该看到两段
    await buttons[0].trigger('click') // 第一个是「全部」
    await nextTick()
    sections = wrapper.findAll('.menu-domain')
    expect(sections).toHaveLength(2)
  })

  it('Spec-H Q11：段过滤偏好会持久化到 localStorage', async () => {
    localStorage.removeItem('nav_domain_filter')
    
    const wrapper1 = mountView(SUPER_USER)
    await flushPromises()
    
    // 切换到「租户」
    const segmented = wrapper1.find('.ant-segmented')
    const buttons = segmented.findAll('.ant-segmented-item')
    await buttons[1].trigger('click')
    await nextTick()
    
    // 检查 localStorage
    expect(localStorage.getItem('nav_domain_filter')).toBe('"tenant"')
    
    // 重新挂载，应该保持「租户」过滤
    const wrapper2 = mountView(SUPER_USER)
    await flushPromises()
    let sections = wrapper2.findAll('.menu-domain')
    expect(sections).toHaveLength(1)
    expect(sections[0].text()).toContain('租户日常')
    
    // 清理
    localStorage.removeItem('nav_domain_filter')
  })
})
