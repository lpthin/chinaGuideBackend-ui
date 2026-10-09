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
  FieldTimeOutlined,
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
  ShopOutlined,
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
 *   结构上不可能再分家）；被砍掉的补充说明走 `meta.desc` → `MenuLeaf.tip`（Spec-H §4.2 规则 3/4）；
 * - **分组**是菜单独有的关注点，留在本文件那张表里（一个路由名只出现一次，用例钉住）；
 * - **域**（租户日常 / 平台管理）挂在组上，用来把两拨东西物理分开。
 */

export type MenuDomain = 'tenant' | 'platform'

export interface MenuGroupDef {
  key: string
  label: string
  domain: MenuDomain
  /** 组标题的图标；取不到不报错，但用例要求它必须是注册表里的键 */
  icon: string
  /**
   * 这一组是干什么的。Spec-H §4.2 规则 6 + Q6-a：这句话**不再摊在导航上占第二行**，
   * 只作为组标题的 tooltip 存在（说明不许消失，只许换地方）。
   */
  hint?: string
}

/**
 * 组的唯一真相：顺序 = 菜单里的上下顺序。
 *
 * Spec-H（后台左侧导航整理）L1 的归组表：16 组 → 11 组，**这一期一项页面都没动、一项都没删**，
 * 只把「一个组名包一个入口」（C-1）和「组名与项名同一句话」（C-2）这两种形状消掉。
 * 硬规则由 `workspace-menu.spec.ts` 钉住：组名 ≤5 字、每组 ≥2 项、组名不与组内项名相同。
 *
 * P3（L2）往下才动入口：H-6 摘掉重复的工单队列（`build-quality` 5 → 4），
 * H-5 把报警三件收成一颗「报警中心」，H-4 把 GEO 三入口收成一颗「诊断工作台」。
 * 每一次摘都在**这里**留一行理由、并在 `MENU_EXCLUDED` 留一条——地址不断，菜单不再重复。
 */
export const MENU_GROUPS: MenuGroupDef[] = [
  // ===== 租户日常（5 组 39 项）=====
  { key: 'content', label: 'AI 写稿', domain: 'tenant', icon: 'funnel', hint: '从热词到发布的一条流水线' },
  { key: 'article', label: '文章与案例', domain: 'tenant', icon: 'file-text', hint: '文章、分类、模板、素材库与案例' },
  { key: 'knowledge', label: '知识库', domain: 'tenant', icon: 'book', hint: 'AI 写作与答疑的资料来源' },
  { key: 'site-content', label: '网站内容', domain: 'tenant', icon: 'global', hint: '你站点上访客看到的东西，含企业信息与站点设置' },
  { key: 'site-effect', label: '效果与经营', domain: 'tenant', icon: 'chart', hint: '流量、引用、GEO 体检与客户经营' },
  // ===== 平台管理（6 组 34 项）=====
  { key: 'build', label: '建站', domain: 'platform', icon: 'rocket', hint: '新建网站向导（需求单 → 说明书 → 出方案 → 候选 → 转正），含提示词、区块与骨架' },
  { key: 'build-assets', label: '站点与租户', domain: 'platform', icon: 'database', hint: '站点、租户与栏目开通' },
  { key: 'build-quality', label: '平台质量', domain: 'platform', icon: 'safety', hint: '页面巡检、引用探测、整站组装与改版工单' },
  { key: 'billing', label: '计费', domain: 'platform', icon: 'account-book', hint: '账单、订单、钱包与发票' },
  { key: 'ai', label: 'AI 配置', domain: 'platform', icon: 'robot', hint: '模型、向量化、用量与生成模板' },
  { key: 'system', label: '系统与告警', domain: 'platform', icon: 'setting', hint: '账号权限、系统设置、报警与待办' }
]

/**
 * 路由名 → 组。菜单只渲染出现在这里的路由；没在这里、也没写进 `MENU_EXCLUDED`、也不是
 * `meta.hidden` 的可见路由会被用例判为「漏挂菜单」（那等于页面做完了但没人进得去）。
 */
export const MENU_GROUP_BY_ROUTE: Record<string, string> = {
  // AI 写稿（原「内容生产」，一项没动：这条本来就是关键词 → 生成 → 审 → 发布六步）
  'workspace-keywords': 'content',
  // P9-B（G-04）：自动写稿是这条流水线的第一环的自动化版，跟着热词库进「AI 写稿」组
  'workspace-daily-output': 'content',
  'workspace-cluster': 'content',
  'workspace-article-generate': 'content',
  'workspace-review': 'content',
  'workspace-publish': 'content',
  'workspace-publish-config': 'content',
  // 文章与案例（原「文章管理」4 项 + 原「客户案例」那个单项组 C-1，案例并入内容对象）
  'workspace-articles': 'article',
  'workspace-categories': 'article',
  'workspace-article-templates': 'article',
  'workspace-media-library': 'article',
  'workspace-case-list': 'article',
  // 知识库
  'workspace-knowledge-dashboard': 'knowledge',
  'workspace-knowledge-documents': 'knowledge',
  'workspace-knowledge-cards': 'knowledge',
  'workspace-knowledge-categories': 'knowledge',
  'workspace-knowledge-tags': 'knowledge',
  'workspace-knowledge-graph': 'knowledge',
  'workspace-knowledge-search': 'knowledge',
  // 网站内容（原「网站内容维护」8 项 + 原「网站信息」2 项；C-2 那个「组名=项名」在这里消掉）
  'workspace-portal-content': 'site-content',
  // 「门户上线」是一页检查清单：超管在这一格灌演示包，租户在这一格看还差什么（视图里两条分支都有），
  // 所以它留在租户可见的一组，不因为「名字像建站」就挪进平台段——那会让租户丢掉唯一一个上线自检入口。
  'workspace-portal-launch': 'site-content',
  'workspace-portal-banners': 'site-content',
  // Spec-D D2：展示内容（团队/历程/标志/指标/评价/资质/FAQ）是租户填的，进内容维护组，
  // 绝不进任何 build-* 组（Spec-C §2.1 记过建站项与租户内容混排的老病）。
  'workspace-portal-showcase': 'site-content',
  // 门店是「联系我们」那张地图的数据源，和展示内容同一条命：有渲染口就得有录入页，
  // 而且它归租户——平台侧不需要一家家替客户录实体网点。
  'workspace-portal-stores': 'site-content',
  'workspace-portal-jobs': 'site-content',
  'workspace-portal-guestbook': 'site-content',
  // P9-C（G-08）：文章底下的读者评论与点赞。跟「留言管理」进同一组，因为这一组回答的是
  // 「访客写进来的话在哪里处理」；评论的录入方是访客本人，租户这一侧只有队列与开关。
  'workspace-interaction': 'site-content',
  'workspace-portal-messages': 'site-content',
  // 企业信息一处、站点级 SEO/GEO 与 robots 一处（P5 合并后）；项名「站点设置」，组名不再与它同名
  'workspace-portal-company': 'site-content',
  'workspace-portal-site-info': 'site-content',
  // Q-P7-3：页面搭建挪进租户可见的「网站内容」组。后端把这条控制器拆成两档之后，
  // 这一页对 SITE_ADMIN 是「读自己的页、改页面信息、发布/下线」——那是网站内容，不是建站；
  // 建站那半（新建页、区块装配、检查结构、回滚）在视图里按 `portal:build:manage` 守卫。
  // 同一视图两种分支的先例是上面的「门户上线」：一项入口按谁能用它归组，不按名字像不像建站归组
  // （Spec-C §2.1 记过「建站项与租户内容混排」的老病，把它留在 build 组才是复发）。
  'workspace-portal-pages': 'site-content',
  // 效果与经营（原「效果与引用」7 项 + 原「运营管理」4 项：都是看结果、跟客户）
  'workspace-portal-analytics': 'site-effect',
  'workspace-portal-citations': 'site-effect',
  'workspace-geoseo-dashboard': 'site-effect',
  // 可抓取性体检（Spec-F §8）：读码 seo:audit:view 已授 SITE_ADMIN（V153），租户进得来这一页，
  // 所以它跟总览同组。「跑一次」那一码在按钮上不在路由上，组归属不因它挪进平台段。
  'workspace-geoseo-crawlability': 'site-effect',
  // GEO 诊断工作台（Spec-H P3 / H-4）：品牌档案/诊断向导/诊断工作台三颗收成一颗，页内三 tab
  'workspace-geo-diagnostic': 'site-effect',
  'workspace-operation-dashboard': 'site-effect',
  'workspace-operation-cases': 'site-effect',
  'workspace-operation-reports': 'site-effect',
  'workspace-operation-customers': 'site-effect',
  // 建站（Spec-M §7.1 / M-P4：第一项换成「新建网站」这条五步向导，正是回答他那句「没找到入口」。
  // 「前采需求单」这一项从组表里摘出来、路由改成 hidden——地址不断，只是入口收进向导第一步，
  // 同一个动作不再有两个名字（项数账 71 颗：一加一减，平台段还是 31）。
  // 原「建站交付」2 项 + 原「参考与样式」3 项 + 骨架库；Spec-C §7：「建站流水线」整页删除，
  // 主线收进需求单详情。骨架库跟着它服务的「造一个站」走，不再单列一组）
  'workspace-portal-wizard': 'build',
  // 平台默认提示词（Spec-M D2/P1）：建站那一族八份的写口。跟着「造一个站」那一组，
  // 不与系统管理里那颗「提示词」（article 那条链的 prompt 表）混在同一组——两页读的不是同一张表。
  'workspace-portal-prompts': 'build',
  'workspace-portal-reference-sites': 'build',
  'workspace-portal-blocks': 'build',
  'workspace-portal-presets': 'build',
  'workspace-portal-skeletons': 'build',
  // 站点与租户（治理三件）
  'workspace-sites': 'build-assets',
  'workspace-tenant': 'build-assets',
  'workspace-portal-sections': 'build-assets',
  // 平台质量（原样保留；**「整站组装」不挪回建站**——Spec-C N-2 已定它服务的是已上线站改版，
  // 挪回去等于推翻拍板）
  'workspace-portal-health': 'build-quality',
  'workspace-portal-assemble-jobs': 'build-quality',
  'workspace-portal-citation-probes': 'build-quality',
  'workspace-portal-tickets': 'build-quality',
  // Spec-H P3 的 H-6：「平台工单队列」原来在这一组、菜单最下方又有一颗「联系平台」，
  // 两项是同一个视图 `SupportTicketView` 的两个 mode ⇒ 超管在同一侧边栏里看到两个入口、
  // 点进去是同一张表。现在队列挪去下方那一颗（按角色取标题），这里摘掉。
  // 「改版工单」`portal/tickets` 是另一个视图（`RevisionTicketView`），**不许跟着一起收**。
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
  // 系统与告警（原「系统管理」7 + 原「报警与待办」4）
  // Spec-H P3 / H-5：报警三件收成一颗「报警中心」（页内三 tab），10 → 8
  'workspace-system-prompt': 'system',
  'workspace-roles': 'system',
  'workspace-permissions': 'system',
  'workspace-users': 'system',
  'workspace-settings': 'system',
  'workspace-audit-log': 'system',
  'workspace-media-storage': 'system',
  'workspace-alert-center': 'system',
  'workspace-notifications': 'system'
}

/**
 * 有路由但故意不进分组的，逐条写理由（`findMenuOrphanRoutes` 拿这张表放行）。
 * 固定渲染在菜单上/下两端的那些项（工作台、联系平台 / 平台工单队列）也在这里——
 * 它们不是漏挂，是别处渲染。
 */
export const MENU_EXCLUDED: Record<string, string> = {
  'workspace-dashboard': '它是面包屑的「首页」与登录落点，固定在菜单最上方单独渲染，不分组',
  'workspace-portal-support': '租户的「联系平台」：与内容/建站两域都不属于，固定在菜单最下方单独渲染',
  'workspace-portal-support-queue':
    '超管的「平台工单队列」：与上面那颗是同一个视图的另一个 mode（Spec-H H-6），同一颗位置按角色取其一，不再单列一组',
  'workspace-user-profile': '从右上角头像进，不占侧边栏',
  // geoseo/competitors 与 geoseo/keywords 那两条不再需要排除理由——路由与视图整体删除了
  // （Spec-F Q6/Q7-A：排名与竞品数字全是人工抄录，`/keywords/{id}/check` 现在返回 501）。
  // 排除表里留一条指向不存在路由的记录，本身就是第二份假真相（与上面 geoseo/company 同一判据）。
}

/** 菜单上下两端各固定一项：路由名写死在这里，视图只认这两个名字，不再手抄标签 */
export const MENU_TOP_ROUTE = 'workspace-dashboard'

/**
 * 菜单最下方那一颗（Spec-H H-6：两颗工单入口收成一颗，按角色显示不同标题）。
 *
 * **顺序即优先级**，取这条名单里第一个「这个人看得见」的项：
 * - `portal:build:review` 只授 SUPER_ADMIN（V93），队列排在前面 ⇒ 超管拿到「平台工单队列」，
 *   他是处理方，同一侧边栏里不再有两个通向同一张表的入口；
 * - `portal:ticket:submit` 授 SUPER_ADMIN + SITE_ADMIN ⇒ 租户拿到的还是「联系平台」。
 * 两条地址都还在路由表里（`MENU_EXCLUDED` 那两行），老收藏夹与文档链接不断。
 */
export const MENU_BOTTOM_ROUTES: string[] = ['workspace-portal-support-queue', 'workspace-portal-support']

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
  /** 「每日产出」那颗：到点跑一次的语义用时钟，不用 calendar（这一页管的是自动排产，不是日历） */
  clock: FieldTimeOutlined,
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
  shop: ShopOutlined,
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
  /**
   * 这一项的补充说明（来自路由 `meta.desc`）。Spec-H §4.2 规则 3/4：菜单标签只留 ≤6 个字，
   * 被砍掉的那半句（括号语、中英混排的全称）换到 tooltip 里说，不许直接消失。
   */
  tip?: string
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
  desc?: string
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
      tip: meta.desc,
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
  /**
   * 已开通栏目的 contentEntry 集合；`null` = 还没取到或取失败。
   * 没取到时**照样藏**那些声明了 contentEntry 的项（这一项的存在依据就是那份开通态，
   * 依据拿不到就宁可少摆一项）——以前 null 时全摆，用户点到的是必然空白的一页。
   */
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
  // 超管跳过细粒度权限检查（超管默认有所有权限，但 permissions 数组可能没列全）
  if (!view.isSuperAdmin && leaf.permission && !view.hasPermission(leaf.permission)) return false
  // 栏目没开通就藏这一项；读不到开通态（null）也藏——依据不在，就不摆这一项
  if (leaf.contentEntry && !view.openContentEntries?.has(leaf.contentEntry)) return false
  return true
}

export interface MenuSection {
  domain: MenuDomain
  label: string
  hint: string
  groups: Array<{ def: MenuGroupDef; items: MenuLeaf[] }>
}

/**
 * 两段的标题（Spec-H Q7-a：一行，不再摊出第二行说明）。
 * `hint` 留着当 tooltip——「说明不许消失，只许换地方」（§4.2 规则 6）。
 */
const DOMAINS: Array<{ domain: MenuDomain; label: string; hint: string }> = [
  { domain: 'tenant', label: '租户日常', hint: '日常：填内容、看效果' },
  { domain: 'platform', label: '平台管理', hint: '超管动作：建站、开栏目、改样式、跑探测' }
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
  // 固定项（工作台、联系平台）没有组：面包屑只留它自己那一级，不硬凑一个「父级」。
  //
  // Spec-H C-2 收口：以前这里打过一条补丁——组名与项名相同时把父级藏掉，免得面包屑连着两格
  // 写同一句话。那是给「文章管理组里有一项也叫文章管理」这种归组错误擦屁股。现在组表与项名
  // 都不许撞车（`workspace-menu.spec.ts` 有硬断言），补丁没有存在的病人，删掉；
  // 留着它反而会把「父级真的该显示」的那些档一起藏掉。
  const def = MENU_GROUPS.find(group => group.key === leaf.group)
  return { parent: def?.label, current: leaf.label }
}

/** 按路由名取叶子（视图用它渲染菜单上下两端，标签与图标仍不抄第二份） */
export function findLeaf(routeName: string, leaves: MenuLeaf[]): MenuLeaf | null {
  return leaves.find(leaf => leaf.routeName === routeName) ?? null
}

/**
 * 菜单最下方那一项该给这个人看哪一颗（Spec-H H-6）。
 *
 * 判据还是 `leafVisible`，也就是路由 meta 上那一条权限码 —— 与守卫同一份，
 * 所以「队列给拿不到 review 码的人露出来」这种形状不可能再出现。
 * 全都不可见时返回 null（比如 CONTENT_EDITOR 两码都没有，V93 明确「编辑不代提」）：
 * 下方那一格整行不渲染，而不是留一行点了 403 的假入口。
 */
export function bottomMenuLeaf(leaves: MenuLeaf[], view: MenuVisibility): MenuLeaf | null {
  for (const routeName of MENU_BOTTOM_ROUTES) {
    const leaf = findLeaf(routeName, leaves)
    if (leaf && leafVisible(leaf, view)) return leaf
  }
  return null
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
