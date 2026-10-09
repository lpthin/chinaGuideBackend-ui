import { describe, it, expect } from 'vitest'
import { routes } from '../../router'
import {
  MENU_BOTTOM_ROUTES,
  MENU_EXCLUDED,
  MENU_GROUPS,
  MENU_GROUP_BY_ROUTE,
  bottomMenuLeaf,
  buildMenuSections,
  collectMenuLeaves,
  findMenuOrphanRoutes,
  leafVisible,
  menuCrumb,
  menuIcon,
  selectedMenuKey
} from '../workspaceMenu'

/**
 * 菜单唯一真相（Spec-C §3.1）。
 *
 * 这个文件要钉的不是「今天有哪几项」，而是那三条会让菜单再次烂掉的路径：
 * 1. 第二份菜单清单（视图手抄一遍 → 改名只改一处）；
 * 2. 菜单显隐判的权限码与路由守卫判的不是同一个（看得见、点进去 403）；
 * 3. 建设项与租户内容项混排在同一组（用户不知道哪一步、哪个入口）。
 *
 * 断言全部从**路由表**出发反推，不写死「应当有哪几项」的清单：加了页面就必然进菜单，
 * 忘了分组会被「漏挂」用例判红（问题八裁决：视图做完了得有人进得去）。
 */

const leaves = collectMenuLeaves(routes)
const grouped = leaves.filter(leaf => leaf.group)

/**
 * 「词表说这些栏目都开着」那一份读到的结果。
 *
 * 组表里的每一项都要能真的点进去，所以凡声明了 contentEntry 的项都得给上对应的开通值；
 * 故意不留 null——null 现在表示「没读到」，而没读到是要少摆几项的（另一条用例单独钉）。
 */
const ALL_OPEN = new Set(grouped.flatMap(leaf => (leaf.contentEntry ? [leaf.contentEntry] : [])))

/** 超管：全部码都有 */
const SUPER = {
  isSuperAdmin: true,
  hasPermission: () => true,
  openContentEntries: ALL_OPEN
}

/**
 * 租户侧角色：只给「内容与日常维护」那一组码，故意一个 portal:build:* 都不给。
 *
 * 这里不抄库里那份权限表（抄了就是第二份真相，库里加一个建设码这里还得改），
 * 只列「租户确实有的那几码」——建设/站点/系统/AI 的码一律不在名单里，
 * 用例判的正是「缺码的人看不见、也进不去」这条边界。
 *
 * `portal:page:manage` 在这一串里：V93 曾把它连同另外三码从 SITE_ADMIN 收回，
 * Q-P7-3 拆完权限码后由 V161 只恢复这一码（读页/改信息/发布/下线），实测现网 SITE_ADMIN 确实持它。
 */
const TENANT_CODES = ['portal:siteinfo:manage', 'portal:page:manage', 'media:manage', 'analytics:view', 'portal:ticket:submit', 'case:manage']
const TENANT = {
  isSuperAdmin: false,
  hasPermission: (code: string) => TENANT_CODES.includes(code),
  openContentEntries: ALL_OPEN
}

describe('菜单从路由单源生成', () => {
  it('每一条分组都真的存在于组表，且一个路由只属于一个组', () => {
    const groupKeys = new Set(MENU_GROUPS.map(group => group.key))
    Object.entries(MENU_GROUP_BY_ROUTE).forEach(([routeName, group]) => {
      expect(groupKeys.has(group), `${routeName} 挂在不存在的组 ${group}`).toBe(true)
      // 名字必须能在路由里找到：路由改名而组表没跟着改，就是「菜单少一项」
      const exists = leaves.some(leaf => leaf.routeName === routeName)
      expect(exists, `组表里的 ${routeName} 在路由表里找不到`).toBe(true)
    })
  })

  it('没有「做完页面却进不去」的漏挂路由', () => {
    expect(findMenuOrphanRoutes(routes)).toEqual([])
  })

  it('被摘掉菜单的路由仍然存在于路由表里（下线不等于删了地址）', () => {
    Object.keys(MENU_EXCLUDED).forEach(routeName => {
      const workspace = routes.find(route => route.name === 'workspace')
      const child = (workspace?.children ?? []).find(item => item.name === routeName)
      expect(child, `${routeName} 既不进菜单也不存在，就是纯 404`).toBeTruthy()
    })
  })

  it('每一项要渲染的图标都登记了：不许静默丢图标', () => {
    grouped.forEach(leaf => {
      expect(leaf.icon, `${leaf.label} 的图标键「${leaf.iconKey}」没在注册表里`).not.toBeNull()
    })
    MENU_GROUPS.forEach(group => {
      expect(menuIcon(group.icon), `组「${group.label}」的图标键没登记`).not.toBeNull()
    })
  })

  it('菜单项名字不重名（曾有「栏目管理」两个、「企业信息」两个）', () => {
    const seen = new Map<string, string>()
    grouped.forEach(leaf => {
      const previous = seen.get(leaf.label)
      expect(previous, `「${leaf.label}」出现在 ${previous} 与 ${leaf.routeName} 两项上`).toBeUndefined()
      seen.set(leaf.label, leaf.routeName)
    })
  })

  it('「文章分类」与「栏目开通」是两项：名字不再互相冒充', () => {
    const labels = grouped.map(leaf => leaf.label)
    expect(labels).toContain('文章分类')
    expect(labels).toContain('栏目开通')
    expect(labels).not.toContain('栏目管理')
    expect(labels).not.toContain('建站工作台')
  })

  it('P5 合并：旧的两处 SEO/GEO 页面路由绝迹，「站点设置」取代它们且成租户可见入口', () => {
    // §7 那张表：GeoSeoConfigView + GeoSeoCompanyView 并入这一页，企业信息只剩 portal/company 一处。
    // 断言的是「同一件事不再有两个入口」这条行为，不是旧的菜单字符串（拍板 13：改断言不删断言）。
    const workspace = routes.find(route => route.name === 'workspace')
    const childNames = (workspace?.children ?? []).map(child => child.name)
    expect(childNames).not.toContain('workspace-geoseo-config')
    expect(childNames).not.toContain('workspace-geoseo-company')
    // 替代它的那一页在，且落在「网站内容」组（Spec-H §4.3：原 site-info 组并进 site-content），
    // 租户读得到（portal:siteinfo:manage 在租户码名单里）
    const siteInfo = grouped.find(leaf => leaf.routeName === 'workspace-portal-site-info')
    expect(siteInfo, '「站点设置」没进菜单，做完的页面没人进得去').toBeTruthy()
    expect(siteInfo?.label).toBe('站点设置')
    expect(siteInfo?.group).toBe('site-content')
    expect(siteInfo?.permission).toBe('portal:siteinfo:manage')
    expect(leafVisible(siteInfo!, TENANT)).toBe(true)
    // 「企业信息」这一个词在菜单里只指 portal/company 一处，geoseo 那份重名异物已经没了
    const companyLeaves = grouped.filter(leaf => leaf.label === '企业信息')
    expect(companyLeaves.length).toBe(1)
    expect(companyLeaves[0].routeName).toBe('workspace-portal-company')
    // geoseo 那两条「假数据」页已从路由表绝迹（Spec-F Q6/Q7-A）：菜单不用摘，因为地址本身没了。
    // 排除表里也不留记录——留一条指向不存在路由的理由，本身就是第二份假真相。
    expect(childNames).not.toContain('workspace-geoseo-competitors')
    expect(childNames).not.toContain('workspace-geoseo-keywords')
    expect(MENU_EXCLUDED['workspace-geoseo-competitors']).toBeUndefined()
    expect(MENU_EXCLUDED['workspace-geoseo-keywords']).toBeUndefined()
  })
})

describe('平台段与租户段分家', () => {
  it('平台段每一项都带闸：要么超管专属，要么挂着权限码', () => {
    const platformGroups = new Set(MENU_GROUPS.filter(g => g.domain === 'platform').map(g => g.key))
    grouped
      .filter(leaf => platformGroups.has(leaf.group))
      .forEach(leaf => {
        const gated = leaf.superAdminOnly || Boolean(leaf.permission)
        expect(gated, `平台项「${leaf.label}」既没有权限码也不是超管专属`).toBe(true)
      })
  })

  it('租户视角：平台段一项都不出现，建设七码一项都不出现', () => {
    const sections = buildMenuSections(leaves, TENANT)
    expect(sections.map(section => section.domain)).toEqual(['tenant'])
    const visibleNames = sections.flatMap(section => section.groups.flatMap(g => g.items.map(i => i.label)))
    expect(visibleNames).not.toContain('新建网站')
    expect(visibleNames).not.toContain('栏目开通')
    expect(visibleNames).not.toContain('站点清单')
    // Q-P7-3：「页面搭建」这一项不再属于建设段——它的闸是 portal:page:manage，
    // 租户管理员确实能读页、改页面信息、发布与下线（视图里建站那半按码藏着）
    expect(visibleNames).toContain('页面搭建')
    const buildLeaves = grouped.filter(leaf => leaf.permission?.startsWith('portal:build:'))
    expect(buildLeaves.length).toBeGreaterThan(0)
    buildLeaves.forEach(leaf => {
      expect(visibleNames, `建设项「${leaf.label}」漏给租户`).not.toContain(leaf.label)
    })
  })

  /**
   * Q-P7-3 那一刀的菜单侧形状：一条路由、两档能力。
   *
   * 页面搭建的闸是 portal:page:manage（读页/改信息/发布/下线），组是租户可见的「网站内容」；
   * 建站那半（新建页、区块装配、检查结构、保存布局、回滚）由视图按 portal:build:manage 守卫。
   * 这里钉的是「租户进得来这一页」，同时「只有建设码、没有读页码」的账号不能从菜单进——
   * 那条组合在库里不存在，但它正是「菜单与后端两档各挂一头」会长出假入口的地方。
   */
  it('页面搭建挂在读页码上，归租户可见的「网站内容」组', () => {
    const pages = grouped.find(leaf => leaf.routeName === 'workspace-portal-pages')
    expect(pages, '「页面搭建」必须还在菜单里').toBeTruthy()
    expect(pages?.permission).toBe('portal:page:manage')
    expect(pages?.group).toBe('site-content')
    expect(leafVisible(pages!, TENANT)).toBe(true)
    const buildOnly = { isSuperAdmin: false, hasPermission: (code: string) => code === 'portal:build:manage', openContentEntries: ALL_OPEN }
    expect(leafVisible(pages!, buildOnly)).toBe(false)
  })

  /**
   * Spec-M §7.1：超管侧从「新建网站」这一个入口走五步，需求单列表不再是菜单项。
   *
   * 列表的路由必须留着——老收藏夹、文档里的链接、以及从别的页面跳过来都指着它；
   * 从菜单摘掉要求 `hidden: true` 与组表删除**同时**改，只改一边要么留下孤儿要么留下假入口。
   */
  it('「新建网站」向导是建站组第一项；需求单列表退出菜单但路由不断', () => {
    const wizard = grouped.find(leaf => leaf.routeName === 'workspace-portal-wizard')
    expect(wizard?.label).toBe('新建网站')
    expect(wizard?.group).toBe('build')
    expect(wizard?.superAdminOnly).toBe(true)
    expect(wizard?.permission).toBe('portal:build:manage')
    // 向导排在建站组最前：进「建站」第一眼就是它，不是那张列表
    expect(grouped.filter(leaf => leaf.group === 'build')[0].routeName).toBe('workspace-portal-wizard')
    expect(leafVisible(wizard!, TENANT)).toBe(false)

    const briefs = leaves.find(leaf => leaf.routeName === 'workspace-portal-briefs')
    expect(briefs, '需求单列表的路由必须还在，老地址与文档链接不断').toBeTruthy()
    expect(briefs!.group).toBe('')
    expect(briefs!.superAdminOnly).toBe(true)
    expect(briefs!.permission).toBe('portal:build:manage')
    // 新建/录入页藏在向导后面：不进菜单（group 为空串），但闸与向导同一条——敲地址也不给过
    ;['workspace-portal-brief-new', 'workspace-portal-brief-intake'].forEach(routeName => {
      const leaf = leaves.find(item => item.routeName === routeName)
      expect(leaf, `${routeName} 必须还在路由表里`).toBeTruthy()
      expect(leaf!.group).toBe('')
      expect(leaf!.superAdminOnly).toBe(true)
      expect(leaf!.permission).toBe('portal:build:manage')
    })
  })

  it('P3 降级与删除：整站组装留在「平台质量」组，建站流水线整页从路由绝迹', () => {
    // §7 那行「不再是一级菜单入口（建站段）」+ N-2「能力留着给已上线站改版」：组要挪、码不许动
    const assemble = grouped.find(leaf => leaf.routeName === 'workspace-portal-assemble-jobs')
    expect(assemble?.group).toBe('build-quality')
    expect(assemble?.permission).toBe('portal:build:assemble')
    // 「建站流水线」被需求单详情替代：路由删了就要删干净，留着菜单项就是点了 404 的假入口
    expect(leaves.some(leaf => leaf.routeName === 'workspace-portal-build')).toBe(false)
    // 候选画廊是详情页的下钻页：meta.hidden，不占一级菜单（入口太多的病灶不许复发）
    const gallery = leaves.find(leaf => leaf.routeName === 'workspace-portal-brief-candidates')
    expect(gallery, '候选画廊路由必须存在').toBeTruthy()
    expect(gallery!.group).toBe('')
    expect(gallery!.superAdminOnly).toBe(true)
    expect(gallery!.permission).toBe('portal:build:manage')
    // 详情页同样 hidden：一行需求单的落点从列表进，不额外占一个菜单位
    const detail = leaves.find(leaf => leaf.routeName === 'workspace-portal-brief-detail')
    expect(detail?.group).toBe('')
  })

  it('租户视角仍看得见自己该做的事：内容、企业信息与联系平台', () => {
    const visible = buildMenuSections(leaves, TENANT)
      .flatMap(section => section.groups.flatMap(group => group.items.map(item => item.label)))
    expect(visible).toContain('文章列表')
    expect(visible).toContain('企业信息')
    expect(visible).toContain('内容工作台')
    // 「联系平台」不在分组里：它是视图按 `bottomMenuLeaf` 固定在菜单最下方那一项（所以单独判）
    const support = bottomMenuLeaf(leaves, TENANT)
    expect(support, '租户下方那一颗没了：他唯一的平台沟通口被摘掉了').not.toBeNull()
    expect(support!.routeName).toBe('workspace-portal-support')
    expect(support!.label).toBe('联系平台')
    expect(visible).not.toContain('联系平台')
  })

  it('超管视角两个段都在，且平台段排在租户段之后', () => {
    const sections = buildMenuSections(leaves, SUPER)
    expect(sections.map(section => section.domain)).toEqual(['tenant', 'platform'])
  })

  it('超管一项都不该漏：组表里的每一项对他都渲染', () => {
    const visible = buildMenuSections(leaves, SUPER)
      .flatMap(section => section.groups.flatMap(group => group.items.map(item => item.label)))
    expect([...visible].sort()).toEqual(grouped.map(leaf => leaf.label).sort())
  })

  it('没有可点项的组不留标题（空标题比没有标题更让人困惑）', () => {
    const noCodes = { isSuperAdmin: false, hasPermission: () => false, openContentEntries: null }
    buildMenuSections(leaves, noCodes).forEach(section => {
      section.groups.forEach(group => {
        expect(group.items.length, `组「${group.def.label}」空了还留着标题`).toBeGreaterThan(0)
      })
    })
  })
})

describe('栏目开通态只影响显隐，不影响权限', () => {
  const jobs = grouped.find(leaf => leaf.routeName === 'workspace-portal-jobs')
  const company = grouped.find(leaf => leaf.routeName === 'workspace-portal-company')

  it('招聘/企业信息的门控值来自后端词表的 contentEntry，不是前端常量', () => {
    expect(jobs?.contentEntry).toBe('job')
    expect(company?.contentEntry).toBe('company')
  })

  it('取到了就按词表隐藏没开的', () => {
    const open = { ...SUPER, openContentEntries: new Set(['article', 'case']) }
    const labels = buildMenuSections(leaves, open)
      .flatMap(section => section.groups.flatMap(group => group.items.map(item => item.label)))
    expect(labels).not.toContain('招聘管理')
    expect(labels).not.toContain('企业信息')
    expect(labels).toContain('横幅')
  })

  it('取不到开通态（null）时宁可少摆：声明了 contentEntry 的一律不摆，其余照旧（D4）', () => {
    const labels = buildMenuSections(leaves, { ...SUPER, openContentEntries: null })
      .flatMap(section => section.groups.flatMap(group => group.items.map(item => item.label)))
    expect(labels).not.toContain('招聘管理')
    expect(labels).not.toContain('企业信息')
    // 没声明 contentEntry 的项不受这次读取影响：它们的可见性只由码决定，不该被连坐
    expect(labels).toContain('横幅')
    expect(labels).toContain('内容工作台')
  })
})

describe('选中态与面包屑', () => {
  it('最长前缀匹配：图片库与素材存储不再抢同一个 key', () => {
    expect(selectedMenuKey('/workspace/media/library', leaves)).toBe('media/library')
    expect(selectedMenuKey('/workspace/media-storage', leaves)).toBe('media-storage')
  })

  it('详情页归到它的列表项，不需要再抄一份映射', () => {
    expect(selectedMenuKey('/workspace/articles/12', leaves)).toBe('articles')
    expect(selectedMenuKey('/workspace/knowledge/cards/3', leaves)).toBe('knowledge/cards')
    expect(selectedMenuKey('/workspace/portal/pages/7/blocks', leaves)).toBe('portal/pages')
  })

  it('面包屑的两级来自组与项本身（不再有第二份 parent 表）', () => {
    // P3 后拿「整站组装」验这条：它换了组（build-quality），面包屑父级跟着换——
    // 正好证明父级是从组表现算的，不是哪里手抄的第二份（原来这条用的是已删除的建站流水线）
    const crumb = menuCrumb('portal/assemble-jobs', leaves)
    expect(crumb.current).toBe('整站组装')
    expect(crumb.parent).toBe('平台质量')
    expect(menuCrumb('categories', leaves)).toEqual({ parent: '文章与案例', current: '文章分类' })
  })

  it('Spec-H C-2：两级面包屑永远是两句不同的话（撞名的补丁已经删掉，靠归组表保证）', () => {
    // 以前这里有一条「组名 == 项名时把父级藏掉」的补丁，专门给「文章管理组里有一项也叫文章管理」
    // 「网站信息组里有一项也叫网站信息」擦屁股。Spec-H §4.2 规则 2 把这两个撞名都修掉了，
    // 补丁跟着删——留着它等于允许撞名继续发生，还会把该显示的父级一起藏掉。
    grouped.forEach(leaf => {
      const crumb = menuCrumb(leaf.key, leaves)
      expect(crumb.current, `${leaf.routeName} 的当前级应当是它的菜单标签`).toBe(leaf.label)
      expect(crumb.parent, `「${leaf.label}」这一项算不出父级组名`).toBeTruthy()
      expect(crumb.parent, `组名与项名又撞车了：${crumb.parent}`).not.toBe(leaf.label)
    })
    // 反向对照：不同名时父级照留，别把这条修成「永远没有父级」
    expect(menuCrumb('knowledge/dashboard', leaves).parent).toBe('知识库')
  })

  it('Q10-A：路由 meta 里那批死面包屑删干净了，面包屑仍然只从菜单树算出来', () => {
    const workspace = routes.find(route => route.name === 'workspace')
    const children = workspace?.children ?? []
    expect(children.length).toBeGreaterThan(0)
    // 逐条判 meta，而不是拿源码字符串数：以后谁再往 meta 里塞 breadcrumb 就直接红
    children.forEach(child => {
      const meta = (child.meta ?? {}) as Record<string, unknown>
      expect(meta, `${String(child.name)} 的 meta 又长出 breadcrumb`).not.toHaveProperty('breadcrumb')
    })
    // 删了那批字符串之后，界面那一行还是算得出来：当前级 = meta.title，父级 = 组表
    expect(menuCrumb('keywords', leaves)).toEqual({ parent: 'AI 写稿', current: '热词库' })
    expect(menuCrumb('geoseo/dashboard', leaves)).toEqual({ parent: '效果与经营', current: '总览仪表盘' })
    // 跨组再验一条（巡检项挪过组）：父级跟着组表走，不是跟着某个写死的数组走
    expect(menuCrumb('portal/health', leaves).parent).toBe('平台质量')
  })

  it('Spec-H Q5-a：菜单里这一项叫「热词库」，被砍掉的括号语活在 tooltip 里（推翻 Spec-F Q11-A）', () => {
    const keywords = grouped.find(leaf => leaf.routeName === 'workspace-keywords')
    expect(keywords, '热词库没进菜单').toBeTruthy()
    expect(keywords?.label).toBe('热词库')
    // 说明不许消失，只许换地方（§4.2 规则 6）：搜索联想这个用途点仍在 desc → tip 里
    expect(keywords?.tip, '「搜索联想」那半句被删掉了，界面开始说谎').toContain('搜索联想')
    // 组还是原来那一组：只改名，没挪位置（挪组会让用户找不到它）
    expect(keywords?.group).toBe('content')
    expect(grouped.map(leaf => leaf.label)).not.toContain('关键词库')
    // 全仓菜单标签里不再有任何带括号的项（规则 3）
    expect(grouped.filter(leaf => /[（）()]/.test(leaf.label))).toEqual([])
  })

  it('G1：SEO/GEO 这一族每一项都带读码——「看得见、点进去 403」不再可能发生', () => {
    const geoFamily = grouped.filter(leaf =>
      /^(workspace-geoseo-|workspace-geo-)/.test(leaf.routeName) || leaf.routeName === 'workspace-portal-citations')
    // H-4 把品牌档案/诊断向导/诊断工作台三颗收成一颗「诊断工作台」，所以从 ≥6 降到 ≥4
    expect(geoFamily.length).toBeGreaterThanOrEqual(4)
    geoFamily.forEach(leaf => {
      // 这一族一项都不靠「没写权限要求 = 人人可见」兜底：
      // 之前 geoseo/dashboard 正是因为 meta 里没有 requiredPermission，被 collectMenuLeaves
      // 当成公开项渲染进租户菜单，而后端 GeoDashboardController 要 geo:overview:view（V143 只授超管）。
      expect(leaf.permission, `${leaf.label}（${leaf.routeName}）的 meta 没有 requiredPermission`).toBeTruthy()
    })

    // SITE_ADMIN 的真实权限形状：库里除 SUPER_ADMIN 之外没有任何一档授过 geo:overview:view
    const siteAdmin = {
      isSuperAdmin: false,
      hasPermission: (code: string) =>
        ['seo:audit:view', 'geo:brand:view', 'geo:campaign:view', 'geo:report:view', 'analytics:view'].includes(code),
      openContentEntries: null
    }
    const dashboard = grouped.find(leaf => leaf.routeName === 'workspace-geoseo-dashboard')
    expect(dashboard && leafVisible(dashboard, siteAdmin), '总览仪表盘仍挂在租户菜单里').toBe(false)
    // 反向对照：同一份视图下真授了码的项照常可见，别把这条修成「整族都藏」
    // H-4 后诊断工作台是 workspace-geo-diagnostic（读码 geo:brand:view）
    const diagnostic = grouped.find(leaf => leaf.routeName === 'workspace-geo-diagnostic')!
    const crawlability = grouped.find(leaf => leaf.routeName === 'workspace-geoseo-crawlability')!
    expect(leafVisible(diagnostic, siteAdmin)).toBe(true)
    expect(leafVisible(crawlability, siteAdmin)).toBe(true)
    // 超管进得去这一页（菜单是藏入口，不是把页拆了）
    expect(dashboard && leafVisible(dashboard, SUPER)).toBe(true)
  })
})

/**
 * Spec-H（后台左侧导航整理）§4.2 / §4.3 的硬规则。
 *
 * 这些不是「今天长这样」的快照，而是**下一轮加页面时必须遵守的规则**（Q4-a 拍的是「写进用例」）：
 * 项名超长、括号语、一个组只包一个入口、组名与项名撞车——这四件事以前是靠人盯，现在靠用例。
 * 判据用 `grouped`（组表里定义过的全部项），不用「某人视角可见项」：
 * 归组合规性与登录者是谁无关，用可见集合会让平台段在租户视角下自动免检。
 */
describe('Spec-H 硬规则：组数、字数、不成单项组、不撞名', () => {
  const itemsOf = (key: string) => grouped.filter(leaf => leaf.group === key)

  it('组数 = 11：租户 5 组 + 平台 6 组（16 → 11，靠归组治「栏目太多」，不靠删页面）', () => {
    expect(MENU_GROUPS).toHaveLength(11)
    expect(MENU_GROUPS.filter(g => g.domain === 'tenant')).toHaveLength(5)
    expect(MENU_GROUPS.filter(g => g.domain === 'platform')).toHaveLength(6)
    // 顺序 = 界面上的上下顺序：租户段整体在前，平台段整体在后（两段分家这条不许被插队打破）
    const domains = MENU_GROUPS.map(g => g.domain)
    expect(domains.slice(0, 5).every(d => d === 'tenant')).toBe(true)
    expect(domains.slice(5).every(d => d === 'platform')).toBe(true)
  })

  it('项数账：73 项 −H-6(1) −H-5(2) −H-4(2) +P9-B(1) +P9-C(1) +M-P1(1) = 71（租户 40 + 平台 31）', () => {
    // 16 组时是 39 + 34 = 73 项（再加固定两项 = 75）。P0 归组一个页面都没动；
    // P3 往下每摘一颗都要在这里减一个数，并且 `MENU_EXCLUDED` 里要多一行理由——
    // 以后谁借着「合并栏目」把页面从菜单里摘掉却不留地址、不留理由，这条会直接问他要。
    // Q-P7-3a 把「页面搭建」从建站组挪进内容与维护组：总数不变，只是同一颗换了桶（37/31 → 38/30）。
    // P9-B 加的是新页「每日产出」（G-04 那条自动链的设置与留痕），挂 content:output:view，
    // V166 已把这一码发给 SITE_ADMIN ⇒ 它是租户段的新项，不是平台段多出来的入口。
    // P9-C 再加一颗「读者互动」（G-08：评论队列 + 两个开关），挂 interaction:view（V169 发给
    // SITE_ADMIN/SUPER_ADMIN，是可分配码）⇒ 同样是租户段的新项，进的是「网站内容」那一组。
    // M-P1 加的是「建站提示词」（Spec-M D2 那半张「读得到也写得到」的平台默认写口），
    // 挂 prompt:template:manage，V173 只发给 SUPER_ADMIN ⇒ 多的是平台段那一颗，不是租户多一个入口。
    // M-P4 把「新建网站」向导放进建站组、同时把「前采需求单」从菜单摘掉（路由留着，见上那条用例）：
    // 一加一减，总数照旧 71。这一条钉的就是「收入口不等于删页面」——摘掉的那颗必须仍有地址可达。
    expect(grouped).toHaveLength(71)
    expect(grouped.filter(leaf => MENU_GROUPS.some(g => g.domain === 'tenant' && g.key === leaf.group))).toHaveLength(40)
    expect(grouped.filter(leaf => MENU_GROUPS.some(g => g.domain === 'platform' && g.key === leaf.group))).toHaveLength(31)
  })

  it('项名 ≤6 个字：超一个字就是导航在替页面写说明书（Q4-a）', () => {
    // 按字符数算，中英混排同理：「Banner管理」是 8 个字符，所以它必须改叫「横幅」。
    // 旧实现取路径首段并手抄白名单那类问题与此无关，这一条只管标签长度。
    const tooLong = grouped.filter(leaf => leaf.label.length > 6)
    expect(tooLong.map(leaf => `${leaf.label}(${leaf.label.length}) ${leaf.routeName}`), '有菜单项超过 6 个字').toEqual([])
  })

  it('组名 ≤5 个字，且组名与项名都不带括号补充语（规则 1/3）', () => {
    const longGroups = MENU_GROUPS.filter(g => g.label.length > 5)
    expect(longGroups.map(g => `${g.label}(${g.label.length})`), '有组名超过 5 个字').toEqual([])
    const withParen = [...MENU_GROUPS.map(g => g.label), ...grouped.map(leaf => leaf.label)]
      .filter(text => /[（）()]/.test(text))
    expect(withParen, '括号补充语该进 tooltip，不该进菜单').toEqual([])
  })

  it('没有单项组（C-1）：每组至少两项，一个组名加一句说明只为包一个入口是不成的', () => {
    MENU_GROUPS.forEach(group => {
      expect(itemsOf(group.key).length, `组「${group.label}」只剩一项，应该并到隔壁去`).toBeGreaterThanOrEqual(2)
    })
  })

  it('组名不与组内任何项名撞车（C-2：菜单里不许连着两行同一句话）', () => {
    MENU_GROUPS.forEach(group => {
      const sameName = itemsOf(group.key).filter(leaf => leaf.label === group.label)
      expect(sameName.map(leaf => leaf.routeName), `组「${group.label}」里又出现同名的项`).toEqual([])
    })
  })

  it('说明不许消失，只许换地方（规则 6）：每组一句 hint 给 tooltip，被砍掉的那半句在 leaf.tip 里', () => {
    MENU_GROUPS.forEach(group => {
      expect(group.hint, `组「${group.label}」没有说明：折叠后用户只能猜这一组是干什么的`).toBeTruthy()
    })
    // 名字被砍短的那些项，砍掉的信息必须还在（否则界面就开始说谎：看得见的名词认不出是哪个页面）
    // H-4 把品牌档案/诊断向导/诊断工作台三颗收成一颗「诊断工作台」，所以只保留 workspace-geo-diagnostic
    const renamed = ['workspace-keywords', 'workspace-portal-banners', 'workspace-portal-site-info',
      'workspace-system-prompt', 'workspace-geo-diagnostic',
      'workspace-knowledge-dashboard', 'workspace-case-list', 'workspace-operation-cases']
    renamed.forEach(routeName => {
      const leaf = grouped.find(item => item.routeName === routeName)
      expect(leaf, `${routeName} 不在菜单里了`).toBeTruthy()
      expect(leaf!.tip, `「${leaf!.label}」是被改短的名字，但说明没地方去了`).toBeTruthy()
    })
  })

  it('两段的标题是一行话（Q7-a：「内容与维护 / 日常：…」那种两行域标题不再出现）', () => {
    const sections = buildMenuSections(leaves, SUPER)
    expect(sections.map(section => section.label)).toEqual(['租户日常', '平台管理'])
    // 一行 = 标签本身不含换行，且长度 ≤4；说明句还在（走 tooltip）
    sections.forEach(section => {
      expect(section.label).not.toMatch(/\n/)
      expect(section.label.length).toBeLessThanOrEqual(4)
      expect(section.hint).toBeTruthy()
    })
  })
})

/**
 * Spec-H P3 / H-6：`portal/support` 与 `portal/support-queue` 是同一个视图
 * （`SupportTicketView`，只差 `props.mode`）的两颗入口，以前一颗固定在菜单最下方、
 * 一颗挂在「平台质量」组里 ⇒ 超管在同一侧边栏看到两个名字、点进去是同一张表。
 *
 * 拍板是「租户看到联系平台、超管看到工单队列、同一颗位置」（§4.1 H-6），所以这里判的是：
 * 组里那一颗真的没了（项数 −1）、下方那一颗按角色取到的正是该给他的那颗、
 * 两条老地址都还在（摘的是入口，不是页面）、隔壁那颗「改版工单」没被顺手一起收
 * （它是另一个视图 `RevisionTicketView`，收进来就是把两个东西当同一个）。
 */
describe('Spec-H P3 / H-6：工单两颗收成一颗，按角色显示不同标题', () => {
  const queue = leaves.find(leaf => leaf.routeName === 'workspace-portal-support-queue')
  const support = leaves.find(leaf => leaf.routeName === 'workspace-portal-support')

  it('队列摘出分组，且在排除表里留了理由（地址没断，只是不再单列一颗）', () => {
    expect(queue, '队列那条路由不能删：收藏夹与文档里的链接要还能翻开').toBeTruthy()
    expect(queue!.group, '队列还挂在某个组里，超管就还是看到两颗').toBe('')
    expect(MENU_GROUP_BY_ROUTE['workspace-portal-support-queue']).toBeUndefined()
    expect(MENU_EXCLUDED['workspace-portal-support-queue'], '摘掉菜单项必须留理由').toBeTruthy()
    expect(MENU_BOTTOM_ROUTES).toContain('workspace-portal-support-queue')
    // 一个词只指一个东西：菜单里「工单」两颗只剩一颗，另一颗是改版工单
    expect(grouped.filter(leaf => leaf.label.includes('工单')).map(leaf => leaf.label)).toEqual(['改版工单'])
  })

  it('同一颗位置按角色取标题：超管 = 平台工单队列，租户 = 联系平台', () => {
    // V93 的授权形状：portal:build:review 只授 SUPER_ADMIN，portal:ticket:submit 授 SUPER_ADMIN + SITE_ADMIN
    expect(bottomMenuLeaf(leaves, SUPER)?.label).toBe('平台工单队列')
    expect(bottomMenuLeaf(leaves, SUPER)?.routeName).toBe('workspace-portal-support-queue')
    expect(bottomMenuLeaf(leaves, TENANT)?.routeName).toBe('workspace-portal-support')
    // 两码都没有的人（CONTENT_EDITOR：V93 写明「编辑不代提」）：那一行整颗不渲染，
    // 而不是留一行点了 403 的假入口
    const nobody = { isSuperAdmin: false, hasPermission: () => false, openContentEntries: null }
    expect(bottomMenuLeaf(leaves, nobody)).toBeNull()
  })

  it('判权仍走同一条 meta：可见性与守卫不会分家', () => {
    // 队列只认 portal:build:review，联系平台只认 portal:ticket:submit——
    // 万一以后有人把下方那颗改成「isSuperAdmin 硬判」，这条会红：那是第二份真相。
    expect(queue!.permission).toBe('portal:build:review')
    expect(support!.permission).toBe('portal:ticket:submit')
    const submitOnly = { isSuperAdmin: false, hasPermission: (code: string) => code === 'portal:ticket:submit', openContentEntries: null }
    expect(leafVisible(queue!, submitOnly)).toBe(false)
    expect(bottomMenuLeaf(leaves, submitOnly)?.routeName).toBe('workspace-portal-support')
  })

  it('「改版工单」没被跟着一起收：它是另一个视图，不是同一件事的另一个 mode', () => {
    const revision = grouped.find(leaf => leaf.routeName === 'workspace-portal-tickets')
    expect(revision, '改版工单是独立一页，仍在平台质量组里').toBeTruthy()
    expect(revision!.label).toBe('改版工单')
    expect(revision!.permission).toBe('portal:build:review')
  })
})

/**
 * Spec-H P3 / H-5：报警三件收成一颗「报警中心」。
 *
 * `alert/rules`、`alert/records`、`alert/channels` 三个路由以前各自占一颗菜单项，
 * 但它们是同一主题（报警这件事的 CRUD / 列表 / 配置）的不同面。现在：
 * - 容器 `alert/center` 挂一颗「报警中心」，页内三 tab；
 * - 三个老地址变成无名 redirect，带 `?tab=…` 落到对应 tab（收藏夹与文档链接不断）；
 * - 系统与告警 10 → 8（−2）。
 *
 * 判据：
 * - 老三个路由名不在分组里（它们是无名 redirect，collectMenuLeaves 跳过）；
 * - 新的 `workspace-alert-center` 在「系统与告警」组里，requiresSuperAdmin；
 * - 老三个地址在路由表里还在（redirect 也是路由定义），但没名字 ⇒ 不进菜单。
 */
describe('Spec-H P3 / H-5：报警三件收成一颗「报警中心」', () => {
  it('老三个路由名不在分组里，新的「报警中心」在「系统与告警」组', () => {
    const center = grouped.find(leaf => leaf.routeName === 'workspace-alert-center')
    expect(center, '报警中心没进菜单').toBeTruthy()
    expect(center!.label).toBe('报警中心')
    expect(center!.group).toBe('system')
    expect(center!.superAdminOnly).toBe(true)
    expect(center!.tip, '「报警中心」是被改短的名字，说明该进 tooltip').toBeTruthy()
    // 老三个路由名不在 grouped 里（它们是无名 redirect，collectMenuLeaves 跳过）
    const oldNames = ['workspace-alert-rules', 'workspace-alert-records', 'workspace-alert-channels']
    oldNames.forEach(name => {
      expect(grouped.find(leaf => leaf.routeName === name), `${name} 还在菜单里`).toBeUndefined()
    })
  })

  it('老三个地址在路由表里还在（redirect），收藏夹与文档链接不断', () => {
    const workspace = routes.find(route => route.name === 'workspace')
    const childPaths = (workspace?.children ?? []).map(child => child.path)
    expect(childPaths).toContain('alert/rules')
    expect(childPaths).toContain('alert/records')
    expect(childPaths).toContain('alert/channels')
    expect(childPaths).toContain('alert/center')
    // 老三个没名字（无名 redirect）
    const childNames = (workspace?.children ?? []).map(child => child.name)
    expect(childNames).not.toContain('workspace-alert-rules')
    expect(childNames).not.toContain('workspace-alert-records')
    expect(childNames).not.toContain('workspace-alert-channels')
    expect(childNames).toContain('workspace-alert-center')
  })

  it('系统与告警组从 11 降到 9（−2）', () => {
    const systemItems = grouped.filter(leaf => leaf.group === 'system')
    expect(systemItems).toHaveLength(9)
    const labels = systemItems.map(leaf => leaf.label)
    expect(labels).toContain('报警中心')
    expect(labels).not.toContain('报警规则')
    expect(labels).not.toContain('报警记录')
    expect(labels).not.toContain('通知渠道')
  })
})

/**
 * Spec-H P3 / H-4：GEO 诊断工作台三收一。
 *
 * `geo/brand`、`geo/diagnosis`、`geo/campaign` 三个路由以前各自占一颗菜单项，
 * 但它们是同一主题（GEO 品牌诊断的档案 / 向导 / 计划与轮次）的不同面。现在：
 * - 容器 `geo/diagnostic` 挂一颗「诊断工作台」，页内三 tab；
 * - 三个老地址变成无名 redirect，带 `?tab=…` 落到对应 tab（收藏夹与文档链接不断）；
 * - 效果与经营 11 → 9（−2）。
 *
 * 判据：
 * - 老三个路由名不在分组里（它们是无名 redirect，collectMenuLeaves 跳过）；
 * - 新的 `workspace-geo-diagnostic` 在「效果与经营」组里，requiresPermission: geo:brand:view；
 * - 老三个地址在路由表里还在（redirect 也是路由定义），但没名字 ⇒ 不进菜单。
 */
describe('Spec-H P3 / H-4：GEO 诊断工作台三收一', () => {
  it('老三个路由名不在分组里，新的「诊断工作台」在「效果与经营」组', () => {
    const diagnostic = grouped.find(leaf => leaf.routeName === 'workspace-geo-diagnostic')
    expect(diagnostic, '诊断工作台没进菜单').toBeTruthy()
    expect(diagnostic!.label).toBe('诊断工作台')
    expect(diagnostic!.group).toBe('site-effect')
    expect(diagnostic!.permission).toBe('geo:brand:view')
    expect(diagnostic!.tip, '「诊断工作台」是被改短的名字，说明该进 tooltip').toBeTruthy()
    // 老三个路由名不在 grouped 里（它们是无名 redirect，collectMenuLeaves 跳过）
    const oldNames = ['workspace-geo-brand', 'workspace-geo-brand-wizard', 'workspace-geo-campaign']
    oldNames.forEach(name => {
      expect(grouped.find(leaf => leaf.routeName === name), `${name} 还在菜单里`).toBeUndefined()
    })
  })

  it('老三个地址在路由表里还在（redirect），收藏夹与文档链接不断', () => {
    const workspace = routes.find(route => route.name === 'workspace')
    const childPaths = (workspace?.children ?? []).map(child => child.path)
    expect(childPaths).toContain('geo/brand')
    expect(childPaths).toContain('geo/diagnosis')
    expect(childPaths).toContain('geo/campaign')
    expect(childPaths).toContain('geo/diagnostic')
    // 老三个没名字（无名 redirect）
    const childNames = (workspace?.children ?? []).map(child => child.name)
    expect(childNames).not.toContain('workspace-geo-brand')
    expect(childNames).not.toContain('workspace-geo-brand-wizard')
    expect(childNames).not.toContain('workspace-geo-campaign')
    expect(childNames).toContain('workspace-geo-diagnostic')
  })

  it('效果与经营组从 11 降到 9（−2）', () => {
    const siteEffectItems = grouped.filter(leaf => leaf.group === 'site-effect')
    expect(siteEffectItems).toHaveLength(9)
    const labels = siteEffectItems.map(leaf => leaf.label)
    expect(labels).toContain('诊断工作台')
    expect(labels).not.toContain('品牌档案')
    expect(labels).not.toContain('诊断向导')
  })
})
