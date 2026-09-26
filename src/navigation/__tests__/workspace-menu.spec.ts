import { describe, it, expect } from 'vitest'
import { routes } from '../../router'
import {
  MENU_BOTTOM_ROUTE,
  MENU_EXCLUDED,
  MENU_GROUPS,
  MENU_GROUP_BY_ROUTE,
  buildMenuSections,
  collectMenuLeaves,
  findLeaf,
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

/** 超管：全部码都有 */
const SUPER = {
  isSuperAdmin: true,
  hasPermission: () => true,
  openContentEntries: null
}

/**
 * 租户侧角色：只给「内容与日常维护」那一组码，故意一个 portal:build:* 都不给。
 *
 * 这里不抄库里那份权限表（抄了就是第二份真相，库里加一个建设码这里还得改），
 * 只列「租户确实有的那几码」——建设/站点/系统/AI 的码一律不在名单里，
 * 用例判的正是「缺码的人看不见、也进不去」这条边界。
 */
const TENANT_CODES = ['portal:siteinfo:manage', 'media:manage', 'analytics:view', 'portal:ticket:submit', 'case:manage']
const TENANT = {
  isSuperAdmin: false,
  hasPermission: (code: string) => TENANT_CODES.includes(code),
  openContentEntries: null
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

  it('P5 合并：旧的两处 SEO/GEO 页面路由绝迹，「网站信息」取代它们且成租户可见入口', () => {
    // §7 那张表：GeoSeoConfigView + GeoSeoCompanyView 并入「网站信息」，企业信息只剩 portal/company 一处。
    // 断言的是「同一件事不再有两个入口」这条行为，不是旧的菜单字符串（拍板 13：改断言不删断言）。
    const workspace = routes.find(route => route.name === 'workspace')
    const childNames = (workspace?.children ?? []).map(child => child.name)
    expect(childNames).not.toContain('workspace-geoseo-config')
    expect(childNames).not.toContain('workspace-geoseo-company')
    // 替代它的那一页在，且落在「网站信息」组、租户读得到（portal:siteinfo:manage 在租户码名单里）
    const siteInfo = grouped.find(leaf => leaf.routeName === 'workspace-portal-site-info')
    expect(siteInfo, '「网站信息」没进菜单，做完的页面没人进得去').toBeTruthy()
    expect(siteInfo?.group).toBe('site-info')
    expect(siteInfo?.permission).toBe('portal:siteinfo:manage')
    expect(leafVisible(siteInfo!, TENANT)).toBe(true)
    // 「企业信息」这一个词在菜单里只指 portal/company 一处，geoseo 那份重名异物已经没了
    const companyLeaves = grouped.filter(leaf => leaf.label === '企业信息')
    expect(companyLeaves.length).toBe(1)
    expect(companyLeaves[0].routeName).toBe('workspace-portal-company')
    // geoseo 的两条「假数据」路由仍在（竞品/关键词，改存量用），只是不进菜单
    expect(MENU_EXCLUDED['workspace-geoseo-competitors']).toBeTruthy()
    expect(MENU_EXCLUDED['workspace-geoseo-keywords']).toBeTruthy()
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
    expect(visibleNames).not.toContain('前采需求单')
    expect(visibleNames).not.toContain('栏目开通')
    expect(visibleNames).not.toContain('站点管理')
    expect(visibleNames).not.toContain('页面搭建')
    const buildLeaves = grouped.filter(leaf => leaf.permission?.startsWith('portal:build:'))
    expect(buildLeaves.length).toBeGreaterThan(0)
    buildLeaves.forEach(leaf => {
      expect(visibleNames, `建设项「${leaf.label}」漏给租户`).not.toContain(leaf.label)
    })
  })

  it('前采需求单是平台项：进「建站交付」组，与邻页同一条闸，租户既看不见也进不去', () => {
    const briefs = grouped.find(leaf => leaf.routeName === 'workspace-portal-briefs')
    expect(briefs?.label).toBe('前采需求单')
    expect(briefs?.group).toBe('build-delivery')
    expect(briefs?.superAdminOnly).toBe(true)
    expect(briefs?.permission).toBe('portal:build:manage')
    // 新建/录入页藏在列表后面：不进菜单（group 为空串），但闸与列表同一条——敲地址也不给过
    ;['workspace-portal-brief-new', 'workspace-portal-brief-intake'].forEach(routeName => {
      const leaf = leaves.find(item => item.routeName === routeName)
      expect(leaf, `${routeName} 必须还在路由表里`).toBeTruthy()
      expect(leaf!.group).toBe('')
      expect(leaf!.superAdminOnly).toBe(true)
      expect(leaf!.permission).toBe('portal:build:manage')
    })
    expect(leafVisible(briefs!, TENANT)).toBe(false)
  })

  it('P3 降级与删除：整站组装挪进「质量与效果（平台）」组，建站流水线整页从路由绝迹', () => {
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
    expect(visible).toContain('文章管理')
    expect(visible).toContain('企业信息')
    expect(visible).toContain('内容工作台')
    // 「联系平台」不在分组里，它是视图按 MENU_BOTTOM_ROUTE 固定在菜单最下方那一项（所以单独判）
    const support = findLeaf(MENU_BOTTOM_ROUTE, leaves)
    expect(support).not.toBeNull()
    expect(leafVisible(support!, TENANT)).toBe(true)
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

  it('取不到开通态时全显示；取到了就按词表隐藏没开的', () => {
    const open = { ...SUPER, openContentEntries: new Set(['article', 'case']) }
    const labels = buildMenuSections(leaves, open)
      .flatMap(section => section.groups.flatMap(group => group.items.map(item => item.label)))
    expect(labels).not.toContain('招聘管理')
    expect(labels).not.toContain('企业信息')
    expect(labels).toContain('Banner管理')
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
    expect(crumb.parent).toBe('质量与效果（平台）')
    expect(menuCrumb('categories', leaves)).toEqual({ parent: '文章管理', current: '文章分类' })
  })

  it('组名与项名撞车时只留一级：面包屑不许连着两格写同一句话', () => {
    // 「文章管理」既是组名也是那一页的标题，两级照抄就成了「文章管理 / 文章管理」
    expect(menuCrumb('articles', leaves)).toEqual({ parent: undefined, current: '文章管理' })
    // 反向对照：不同名时父级照留，别把这条修成「永远没有父级」
    expect(menuCrumb('knowledge/dashboard', leaves).parent).toBe('知识库')
  })
})
