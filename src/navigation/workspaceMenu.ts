import type { Component } from 'vue'
import type { RouteRecordRaw } from 'vue-router'
import {
  AccountBookOutlined,
  AimOutlined,
  AlertOutlined,
  ApartmentOutlined,
  ApiOutlined,
  AppstoreOutlined,
  AuditOutlined,
  BankOutlined,
  BarChartOutlined,
  BellOutlined,
  BgColorsOutlined,
  BookOutlined,
  CloudServerOutlined,
  ClusterOutlined,
  DashboardOutlined,
  DatabaseOutlined,
  EditOutlined,
  FileSearchOutlined,
  FileTextOutlined,
  FolderOutlined,
  FormOutlined,
  FunnelPlotOutlined,
  GlobalOutlined,
  IdcardOutlined,
  MessageOutlined,
  NotificationOutlined,
  PictureOutlined,
  PieChartOutlined,
  ProfileOutlined,
  PropertySafetyOutlined,
  RobotOutlined,
  RocketOutlined,
  SafetyOutlined,
  SearchOutlined,
  SettingOutlined,
  ShareAltOutlined,
  ShoppingOutlined,
  TagsOutlined,
  TeamOutlined,
  UploadOutlined,
  UserAddOutlined,
  UserOutlined,
  WalletOutlined
} from '@ant-design/icons-vue'

/**
 * 侧边菜单的唯一真相。
 *
 * 为什么要收成一个模块（Spec「建站流程重构」§3.1 硬规则 3）：这一页以前是**手写**的
 * `a-menu-item` 清单，与 `router/index.ts` 各写一份，于是长期养出三类真缺陷——
 * 1. 「栏目管理」「企业信息」各有两个同名异物入口（一个是超管栏目开通，一个是文章分类）；
 * 2. 区块画廊菜单判 `portal:build:preset`、路由守卫要 `portal:build:manage`，看得见点进去 403；
 * 3. 建站项与租户内容维护项并排在一起，用户不知道哪一步、哪个入口。
 *
 * 现在的分工：
 * - **标签、图标、权限码**只来自路由 meta（与守卫读的是同一条 `meta.requiredPermission`，
 *   结构上不可能再分家）；
 * - **分组**是菜单独有的关注点，留在本文件那张表里（一个路由名只出现一次，用例钉住）；
 * - **域**（租户内容维护 / 平台建设治理）挂在组上，用来把两拨东西物理分开。
 */

export type MenuDomain = 'tenant' | 'platform'

export interface MenuGroupDef {
  key: string
  label: string
  domain: MenuDomain
  /** 组标题的图标；取不到不报错，但用例要求它必须是注册表里的键 */
  icon: string
  /** 组下面那行小字：告诉用户这一组是干什么的，不写「请自行理解」 */
  hint?: string
}

/** 组的唯一真相：顺序 = 菜单里的上下顺序 */
export const MENU_GROUPS: MenuGroupDef[] = [
  { key: 'content', label: '内容生产', domain: 'tenant', icon: 'funnel', hint: '关键词 → 生成 → 审核 → 发布' },
  { key: 'article', label: '文章管理', domain: 'tenant', icon: 'file-text', hint: '文章、分类、模板与图片素材' },
  { key: 'knowledge', label: '知识库', domain: 'tenant', icon: 'book', hint: 'AI 写作与答疑的资料来源' },
  { key: 'case', label: '客户案例', domain: 'tenant', icon: 'case', hint: '案例内容与它的 SEO 都在这里' },
  { key: 'site-content', label: '网站内容维护', domain: 'tenant', icon: 'global', hint: '你站点上访客看到的东西' },
  { key: 'site-info', label: '网站信息', domain: 'tenant', icon: 'building', hint: 'AI 填好的企业信息与站点配置，可审可改' },
  { key: 'site-effect', label: '效果与引用', domain: 'tenant', icon: 'chart', hint: '流量来源与被 AI 引用的情况' },
  { key: 'operation', label: '运营管理', domain: 'tenant', icon: 'pie-chart' },
  { key: 'build-delivery', label: '建站交付', domain: 'platform', icon: 'rocket', hint: '前采需求单 → 出方案（详情页门禁） → 页面搭建' },
  { key: 'build-assets', label: '站点资产', domain: 'platform', icon: 'database', hint: '站点、租户、栏目开通与骨架' },
  { key: 'build-style', label: '参考与样式', domain: 'platform', icon: 'bg-colors', hint: '参考站摄取、区块与皮肤' },
  { key: 'build-quality', label: '质量与效果（平台）', domain: 'platform', icon: 'safety', hint: '巡检、引用探测、改版工单与整站组装（已上线站改版）' },
  { key: 'billing', label: '计费系统', domain: 'platform', icon: 'account-book' },
  { key: 'ai', label: 'AI 配置', domain: 'platform', icon: 'robot' },
  { key: 'system', label: '系统管理', domain: 'platform', icon: 'setting' },
  { key: 'alert', label: '报警与待办', domain: 'platform', icon: 'bell' }
]

/**
 * 路由名 → 组。菜单只渲染出现在这里的路由；没在这里、也没写进 `MENU_EXCLUDED`、也不是
 * `meta.hidden` 的可见路由会被用例判为「漏挂菜单」（那等于页面做完了但没人进得去）。
 */
export const MENU_GROUP_BY_ROUTE: Record<string, string> = {
  // 内容生产
  'workspace-keywords': 'content',
  'workspace-cluster': 'content',
  'workspace-article-generate': 'content',
  'workspace-review': 'content',
  'workspace-publish': 'content',
  'workspace-publish-config': 'content',
  // 文章管理
  'workspace-articles': 'article',
  'workspace-categories': 'article',
  'workspace-article-templates': 'article',
  'workspace-media-library': 'article',
  // 知识库
  'workspace-knowledge-dashboard': 'knowledge',
  'workspace-knowledge-documents': 'knowledge',
  'workspace-knowledge-cards': 'knowledge',
  'workspace-knowledge-categories': 'knowledge',
  'workspace-knowledge-tags': 'knowledge',
  'workspace-knowledge-graph': 'knowledge',
  'workspace-knowledge-search': 'knowledge',
  // 客户案例
  'workspace-case-list': 'case',
  // 网站内容维护（租户侧）
  'workspace-portal-content': 'site-content',
  // 「门户上线」是一页检查清单：超管在这一格灌演示包，租户在这一格看还差什么（视图里两条分支都有），
  // 所以它留在租户可见的一组，不因为「名字像建站」就挪进平台段——那会让租户丢掉唯一一个上线自检入口。
  'workspace-portal-launch': 'site-content',
  'workspace-portal-banners': 'site-content',
  'workspace-portal-jobs': 'site-content',
  'workspace-portal-guestbook': 'site-content',
  'workspace-portal-messages': 'site-content',
  // 网站信息（租户审改 AI 填的内容）：企业信息一处、站点级 SEO/GEO 与 robots 一处（P5 合并后）
  'workspace-portal-company': 'site-info',
  'workspace-portal-site-info': 'site-info',
  // 效果与引用
  'workspace-portal-analytics': 'site-effect',
  'workspace-portal-citations': 'site-effect',
  'workspace-geoseo-dashboard': 'site-effect',
  // 运营管理
  'workspace-operation-dashboard': 'operation',
  'workspace-operation-cases': 'operation',
  'workspace-operation-reports': 'operation',
  'workspace-operation-customers': 'operation',
  // 平台：建站交付（Spec-C §7 P3：「建站流水线」整页删除，主线收进需求单详情；
  // 「整站组装」按 N-2 挪去「质量与效果」——它今天的服务对象是已上线站的改版，不是出候选）
  'workspace-portal-briefs': 'build-delivery',
  'workspace-portal-pages': 'build-delivery',
  // 平台：站点资产
  'workspace-sites': 'build-assets',
  'workspace-tenant': 'build-assets',
  'workspace-portal-sections': 'build-assets',
  'workspace-portal-skeletons': 'build-assets',
  // 平台：参考与样式
  'workspace-portal-reference-sites': 'build-style',
  'workspace-portal-blocks': 'build-style',
  'workspace-portal-presets': 'build-style',
  // 平台：质量与效果
  'workspace-portal-health': 'build-quality',
  'workspace-portal-assemble-jobs': 'build-quality',
  'workspace-portal-citation-probes': 'build-quality',
  'workspace-portal-tickets': 'build-quality',
  'workspace-portal-support-queue': 'build-quality',
  // 计费
  'workspace-billing-manage': 'billing',
  'workspace-billing-stats': 'billing',
  'workspace-billing-wallet': 'billing',
  'workspace-billing-invoices': 'billing',
  'workspace-billing-orders': 'billing',
  // AI 配置
  'workspace-ai-models': 'ai',
  'workspace-ai-embedding': 'ai',
  'workspace-ai-usage': 'ai',
  'workspace-ai-article-templates': 'ai',
  // 系统管理
  'workspace-users': 'system',
  'workspace-roles': 'system',
  'workspace-permissions': 'system',
  'workspace-system-prompt': 'system',
  'workspace-settings': 'system',
  'workspace-audit-log': 'system',
  'workspace-media-storage': 'system',
  // 报警与待办
  'workspace-alert-rules': 'alert',
  'workspace-alert-records': 'alert',
  'workspace-alert-channels': 'alert',
  'workspace-notifications': 'alert'
}

/**
 * 有路由但故意不进分组的，逐条写理由（`findMenuOrphanRoutes` 拿这张表放行）。
 * 固定渲染在菜单上/下两端的「工作台」「联系平台」也在这里——它们不是漏挂，是别处渲染。
 */
export const MENU_EXCLUDED: Record<string, string> = {
  'workspace-dashboard': '它是面包屑的「首页」与登录落点，固定在菜单最上方单独渲染，不分组',
  'workspace-portal-support': '租户的「联系平台」：与内容/建站两域都不属于，固定在菜单最下方单独渲染',
  'workspace-user-profile': '从右上角头像进，不占侧边栏',
  // 这两条是「假功能」下线：菜单里挂着就等于承诺看得到数（Spec-A §13.4 的「下线并注明」）。
  // geoseo/company 不再列在这里——它与 geoseo/config 已在 P5 随「网站信息」合并一起删了路由与视图，
  // 排除表里留一条指向不存在路由的记录，本身就是第二份假真相。
  'workspace-geoseo-competitors': '排名与竞品数字全是人工抄录，不进菜单（路由留着改存量）',
  'workspace-geoseo-keywords': '同上：没有真数据源就不摆一个看着能用的入口'
}

/** 菜单上下两端各固定一项：路由名写死在这里，视图只认这两个名字，不再手抄标签 */
export const MENU_TOP_ROUTE = 'workspace-dashboard'
export const MENU_BOTTOM_ROUTE = 'workspace-portal-support'

/**
 * 图标注册表：路由 meta 里那个字符串 → 组件。
 *
 * 只登记界面上真的会出现的键：以前视图里各处直接 import 组件，加一项就改一次文件；
 * 现在标签来自路由，图标也来自路由（一个字符串），所以这张表必须齐——
 * 缺一个键的后果是「菜单项没了图标但没人报错」，`workspace-menu.spec.ts` 逐条钉住。
 */
const ICONS: Record<string, Component> = {
  'account-book': AccountBookOutlined,
  ai: RobotOutlined,
  aim: AimOutlined,
  alert: AlertOutlined,
  apartment: ApartmentOutlined,
  api: ApiOutlined,
  appstore: AppstoreOutlined,
  article: FileTextOutlined,
  audit: AuditOutlined,
  bell: BellOutlined,
  'bg-colors': BgColorsOutlined,
  book: BookOutlined,
  building: BankOutlined,
  card: IdcardOutlined,
  case: ProfileOutlined,
  category: FolderOutlined,
  chart: BarChartOutlined,
  cloud: CloudServerOutlined,
  cluster: ClusterOutlined,
  dashboard: DashboardOutlined,
  database: DatabaseOutlined,
  edit: EditOutlined,
  file: FileTextOutlined,
  'file-invoice': FileTextOutlined,
  'file-search': FileSearchOutlined,
  'file-text': FileTextOutlined,
  folder: FolderOutlined,
  form: FormOutlined,
  funnel: FunnelPlotOutlined,
  global: GlobalOutlined,
  grid: AppstoreOutlined,
  guestbook: FormOutlined,
  image: PictureOutlined,
  job: UserAddOutlined,
  message: MessageOutlined,
  notification: NotificationOutlined,
  permission: PropertySafetyOutlined,
  'pie-chart': PieChartOutlined,
  profile: ProfileOutlined,
  prompt: EditOutlined,
  report: FileSearchOutlined,
  robot: RobotOutlined,
  rocket: RocketOutlined,
  role: TeamOutlined,
  safety: SafetyOutlined,
  search: SearchOutlined,
  setting: SettingOutlined,
  share: ShareAltOutlined,
  shopping: ShoppingOutlined,
  tag: TagsOutlined,
  team: TeamOutlined,
  /**
   * 骨架库/页面搭建/样式沉淀那条用 'template'：ant-design-vue 没有「模板」这颗图标，形态上最接近的是 appstore。
   * 单列一行而不是直接把 meta 改成 appstore，是为了让路由里那个字符串读得出语义（皮肤 vs 栅格不是一回事）。
   */
  template: AppstoreOutlined,
  upload: UploadOutlined,
  user: UserOutlined,
  wallet: WalletOutlined
}

export function menuIcon(key: string | undefined): Component | null {
  if (!key) return null
  return ICONS[key] ?? null
}

export interface MenuLeaf {
  routeName: string
  /** 相对 `/workspace` 的路径：点击跳转与选中态都用它，与路由定义同源 */
  key: string
  label: string
  /** 组键；'' = 不进分组（固定项、被摘掉的、meta.hidden 的都是它） */
  group: string
  icon: Component | null
  /** 原始图标键，仅给用例报错时能指出「是哪个字符串没注册」 */
  iconKey: string
  permission?: string
  superAdminOnly: boolean
  /** 栏目开通态门控（Spec-A §7.1）：后端词表里 contentEntry 的取值 */
  contentEntry?: string
  /** 组内顺序，取路由定义顺序 */
  order: number
}

interface MenuRouteMeta {
  title?: string
  icon?: string
  hidden?: boolean
  requiresSuperAdmin?: boolean
  requiredPermission?: string
  contentEntry?: string
}

/**
 * 从路由表收集菜单叶子。
 *
 * 参数是 `/workspace` 的那组 children（原样传 `routes` 也行，内部自己找）。
 * 只看**定义顺序**，不用 `router.getRoutes()`：后者按路径权重排过序，组的上下顺序会变成谜。
 * 没名字的纯 redirect 项（`publish-queue`、`ai/vector-db`）被跳过——它们不是入口，是旧地址。
 */
export function collectMenuLeaves(input: readonly RouteRecordRaw[]): MenuLeaf[] {
  const children = workspaceChildren(input)
  const leaves: MenuLeaf[] = []
  children.forEach((child, index) => {
    const name = typeof child.name === 'string' ? child.name : ''
    if (!name || !child.path) return
    const meta = (child.meta ?? {}) as MenuRouteMeta
    leaves.push({
      routeName: name,
      key: child.path,
      label: meta.title || name,
      group: MENU_GROUP_BY_ROUTE[name] ?? '',
      icon: menuIcon(meta.icon),
      iconKey: meta.icon || '',
      permission: meta.requiredPermission,
      superAdminOnly: meta.requiresSuperAdmin === true,
      contentEntry: meta.contentEntry,
      order: index
    })
  })
  return leaves.sort((left, right) => left.order - right.order)
}

function workspaceChildren(input: readonly RouteRecordRaw[]): readonly RouteRecordRaw[] {
  const workspace = input.find(route => route.name === 'workspace')
  return workspace?.children ?? input
}

export interface MenuVisibility {
  isSuperAdmin: boolean
  hasPermission: (code: string) => boolean
  /** 已开通栏目的 contentEntry 集合；`null` = 还没取到或取失败，此时不做任何隐藏 */
  openContentEntries: Set<string> | null
}

/**
 * 这一项给不给这个人看。
 *
 * 判据全部来自路由 meta，和路由守卫读的是同一份：菜单里没有的项，敲地址也进不去（守卫挡）；
 * 菜单里有的项，点进去必然不 403（同一条码）。这一句就是 §2.1 那两处「看得见点不着」的根治。
 */
export function leafVisible(leaf: MenuLeaf, view: MenuVisibility): boolean {
  if (leaf.superAdminOnly && !view.isSuperAdmin) return false
  if (leaf.permission && !view.hasPermission(leaf.permission)) return false
  // 栏目没开通就藏这一项：挡的是「点进去一片空白」，权限不由这里判（三个只读端点各有码）
  if (leaf.contentEntry && view.openContentEntries && !view.openContentEntries.has(leaf.contentEntry)) return false
  return true
}

export interface MenuSection {
  domain: MenuDomain
  label: string
  hint: string
  groups: Array<{ def: MenuGroupDef; items: MenuLeaf[] }>
}

const DOMAINS: Array<{ domain: MenuDomain; label: string; hint: string }> = [
  { domain: 'tenant', label: '内容与维护', hint: '日常：填内容、看效果' },
  { domain: 'platform', label: '平台 · 建站与治理', hint: '超管动作：建站、开栏目、改样式、跑探测' }
]

/**
 * 生成给模板渲染的两段菜单。空的组不留标题（一个标题下没有可点的项，比没有这个标题更让人困惑）。
 *
 * 「平台」段整体不渲染给没有建设权限的人：不是藏起来，而是它的组逐项判完权限/超管之后必然为空。
 */
export function buildMenuSections(leaves: MenuLeaf[], view: MenuVisibility): MenuSection[] {
  return DOMAINS.flatMap(entry => {
    const groups = MENU_GROUPS
      .filter(def => def.domain === entry.domain)
      .map(def => ({ def, items: leaves.filter(leaf => leaf.group === def.key && leafVisible(leaf, view)) }))
      .filter(group => group.items.length > 0)
    if (!groups.length) return []
    return [{ ...entry, groups }]
  })
}

/**
 * 当前路径该点亮哪一项。
 *
 * 旧实现取「路径首段」并手抄一份前缀白名单，于是 `media/library` 与 `media-storage`
 * 抢同一个 key（图片库高亮跑到素材存储上）。这里改成**最长前缀匹配**：
 * 详情页（`articles/12`、`knowledge/cards/3`）自动归到它的列表项，不需要再抄一份映射。
 */
export function selectedMenuKey(path: string, leaves: MenuLeaf[]): string {
  const relative = path.replace(/^\/workspace\/?/, '').split('?')[0]
  if (!relative) return ''
  const segments = relative.split('/')
  for (let take = segments.length; take > 0; take -= 1) {
    const candidate = segments.slice(0, take).join('/')
    if (leaves.some(leaf => leaf.key === candidate)) return candidate
  }
  return ''
}

/** 面包屑要的两级：组标题与项标题。都不再手抄第二份（`currentParentMenu` 那张 60 行的表就是这么烂掉的） */
export function menuCrumb(key: string, leaves: MenuLeaf[]): { parent?: string; current?: string } {
  const leaf = leaves.find(item => item.key === key)
  if (!leaf) return {}
  // 固定项（工作台、联系平台）没有组：面包屑只留它自己那一级，不硬凑一个「父级」
  const def = MENU_GROUPS.find(group => group.key === leaf.group)
  // 组名与项名撞车时（「文章管理」既是组也是项）只留一级：面包屑连着两格同一句话，
  // 看着像渲染坏了，而且它本来也没多说出任何信息。
  return { parent: def && def.label !== leaf.label ? def.label : undefined, current: leaf.label }
}

/** 按路由名取叶子（视图用它渲染菜单上下两端，标签与图标仍不抄第二份） */
export function findLeaf(routeName: string, leaves: MenuLeaf[]): MenuLeaf | null {
  return leaves.find(leaf => leaf.routeName === routeName) ?? null
}

/**
 * 「做完页面却进不去」的漏网路由（Spec §3.1 硬规则 7）。
 *
 * 返回应当出现在菜单里却既没分组、也没写排除理由、也不是 meta.hidden 的路由名。
 * 视图不 call 它，它只给用例用——把它放在本文件里是为了让「三张表」在同一处对账。
 */
export function findMenuOrphanRoutes(input: readonly RouteRecordRaw[]): string[] {
  return workspaceChildren(input)
    .filter(child => {
      const name = typeof child.name === 'string' ? child.name : ''
      if (!name) return false
      const meta = (child.meta ?? {}) as MenuRouteMeta
      if (meta.hidden) return false
      return !MENU_GROUP_BY_ROUTE[name] && !MENU_EXCLUDED[name]
    })
    .map(child => String(child.name))
}
