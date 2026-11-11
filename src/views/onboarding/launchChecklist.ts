import type { CompanyInfo } from '../../types'
import type { DemoStatusResult } from '../../api/onboarding'
import type { ChecklistStep } from '../../components/checklistPageModel'

/**
 * 「站点能不能上线」这五步的唯一算法（Spec-Q §4.1 D 型 + §4.4，P4）。
 *
 * 为什么收在一个模块而不是留在门户上线那一屏里：Q7 拍的是「租户不该进那一页，
 * 但租户真正需要的『还差什么才能上线』要并进内容工作台」。两处要念的是同一件事——
 * 收在两处迟早一份说「已绑定域名」、另一份说「域名没绑」，或者一份把「没取到数」
 * 算进「还差」而另一份不算。所以两处都调这一个函数，只差「喂进去几格读数」。
 *
 * 三条纪律：
 * 1. 每步的 level 只由后端真回的东西决定；没发请求 / 没权限 / 读挂了统一是 unknown，
 *    不许演成「取到了、确实缺」（I-8 点名的假绿，改前那两个统计数就停在「未取到」上没下一步）。
 * 2. unknown 那一档一律带「下一步」（刷新或去哪儿看），这是 §4.1 对「未取到」的要求。
 * 3. 界面上念的中文只在这一处拼一份，页面不再各写一句。
 */

/** 站点那一格用到的字段（读的是 /api/portal/sites，租户侧自己的口） */
export interface LaunchSiteBrief {
  id?: number
  code: string
  name: string
  domain: string
  /** 站点状态（enabled / disabled…）；旧数据没带这一位时按「照常探测」处理 */
  status?: string
}

export interface LaunchReadings {
  /** 超管还没选客户：整屏一格都没去取。它既不是「读失败」也不是「这家什么都没有」 */
  tenantNotSelected: boolean
  /**
   * 「没取到数」那几步念的下一步。为什么由外面传：这一份算法两处用——
   * 门户上线那一屏页头有一颗「刷新」，内容工作台那条完成度带没有页头按钮，
   * 两处都写「点页头的刷新」就有一处在指一个不存在的东西。
   */
  refreshHint: string
  site: LaunchSiteBrief | null
  /** 站点这一格为什么没数：denied = 这个账号本来就读不到，failed = 读了但失败 */
  siteIssue: 'denied' | 'failed' | null
  /** 站点那一发的后端原话（没有就留空） */
  siteError?: string
  company: CompanyInfo | null
  companyError?: string
  /** 演示内容包只有超管读得到；租户那一屏这一格是「这一屏没有这个动作」 */
  demoReadable: boolean
  demo: DemoStatusResult | null
  demoError?: string
  /** 门户公开口读回来的「访客实际能看到的条数」；null = 没取到，不等于 0 */
  visibility: { articles: number | null, cases: number | null }
  visibilityError?: string
}

/**
 * 「去哪儿补」那几条站内路的唯一出处（页面里不许再抄一遍路由名）。
 *
 * 链接的**文字**为什么不写成「联系平台」：内容工作台那一屏的页头本来就有一颗「联系平台」，
 * 那一页的用例钉的是全屏只许出现一次这两个字（portal-content-workbench.spec.ts）。
 * 清单这一侧说的是「为哪件事找平台」，写具体反而更好认。
 */
export const LAUNCH_LINK_ROUTES = {
  company: 'workspace-portal-company',
  articles: 'workspace-articles',
  cases: 'workspace-case-list',
  analytics: 'workspace-portal-analytics',
  support: 'workspace-portal-support',
} as const

/** 站点那一格的大字（第 1 步的正文第一行念的就是它） */
export function siteNameText(readings: LaunchReadings): string {
  if (readings.tenantNotSelected) {
    // 还没选租户，这一格根本没去问过——写「该租户还没有站点」就是凭空报一个缺
    return '未选客户，未取数'
  }
  if (readings.siteIssue === 'denied') {
    return '没有站点信息的查看权限，这一项请平台侧确认'
  }
  if (!readings.site) {
    return readings.siteIssue ? '未取到' : '该客户还没有站点'
  }
  return `${readings.site.name}${readings.site.id ? `（ID ${readings.site.id}）` : ''}`
}

/**
 * 站点那一格里每个字段的说法。
 * 没读到就是没读到，不许把「读不到」演成「未绑定」——那会让人去找一个根本不存在的域名问题。
 */
export function siteFieldValue(readings: LaunchReadings, value: string | null | undefined, blankText: string): string {
  if (value) {
    return value
  }
  if (readings.tenantNotSelected) {
    return '—'
  }
  return readings.siteIssue ? '未取到' : blankText
}

/**
 * 站点现在对访客开着没有（词表与 active 同义词在后端 SiteStatuses，前端不抄第二份判断标准）。
 *
 * <p>停用的站，门户公开面对访客是整站 404——这时去打公开口数「访客能看到几条」，
 * 拿回来的只会是一对没人能处理的红色 404。调用方应先看这一位：关着就别发请求。
 * status 缺省（旧数据 / mock 没带）按开着处理，行为与从前一致。</p>
 */
export function siteOpenToPublic(status?: string): boolean {
  if (!status) {
    return true
  }
  const normalized = status.trim().toLowerCase()
  return normalized === 'enabled' || normalized === 'active'
}

/** 联系方式那一格：三个口子里有几个念几个，一个都没有才说未填写 */
export function contactText(company: CompanyInfo | null): string {
  const values = [company?.phone, company?.email, company?.serviceHotline]
    .filter((value): value is string => !!value)
  return values.length ? values.join(' / ') : '未填写'
}

function demoTotal(demo: DemoStatusResult | null): number {
  const counts = demo?.demo
  if (!counts) {
    return 0
  }
  return Object.values(counts).reduce((sum, n) => sum + Number(n || 0), 0)
}

/**
 * 五步清单。顺序就是上线的依赖顺序（先有站点，再有企业信息，内容能被读到，最后才是出口）。
 *
 * 第 3 步「演示内容」不是上线的必要条件：一套真站可以不灌演示包，只要正式内容已经发布。
 * 所以它没有内容时给的是 todo + 一句「不灌也可以」，而不是「挡住上线了」。
 */
export function buildLaunchSteps(readings: LaunchReadings): ChecklistStep[] {
  return [
    siteStep(readings),
    companyStep(readings),
    demoStep(readings),
    readersStep(readings),
    seoStep(readings),
  ]
}

function siteStep(readings: LaunchReadings): ChecklistStep {
  const base = { key: 'site', title: '站点与访问域名' }
  if (readings.tenantNotSelected) {
    return {
      ...base,
      level: 'unknown',
      stateText: '未取数',
      gap: '还没选客户，这一格一个字都没取。',
      links: [{ label: '先在右上角选择客户' }],
    }
  }
  if (readings.siteIssue === 'denied') {
    return {
      ...base,
      level: 'unknown',
      stateText: '无查看权限',
      gap: '这个账号读不到站点信息，这一项请平台侧确认；读不到时下面几格也跟着没数。',
      links: [{ label: '找平台确认', to: { name: LAUNCH_LINK_ROUTES.support } }],
    }
  }
  if (readings.siteIssue === 'failed') {
    return {
      ...base,
      level: 'unknown',
      stateText: '读取失败',
      gap: readings.siteError
        ? `这一发没读回来：${readings.siteError}`
        : '这一发没读回来。',
      links: [{ label: readings.refreshHint }],
    }
  }
  if (!readings.site) {
    return {
      ...base,
      level: 'blocked',
      stateText: '缺少站点',
      gap: '这一家还没有站点，门户上没有可打开的东西，后面几步都落不了地。',
      links: [{ label: '找平台开通', to: { name: LAUNCH_LINK_ROUTES.support } }],
    }
  }
  if (!readings.site.domain) {
    return {
      ...base,
      level: 'todo',
      stateText: '未绑定域名',
      gap: '域名由平台管理员在「平台管理 → 站点与客户 → 站点清单」绑定。没绑域名时门户仍能按站点编码预览，但 sitemap.xml 不输出任何 URL。',
      links: [{ label: '要绑域名找平台', to: { name: LAUNCH_LINK_ROUTES.support } }],
    }
  }
  return {
    ...base,
    level: 'ready',
    stateText: '已绑定域名',
    links: [{ label: '打开门户预览', href: portalPreviewUrl(readings) }],
  }
}

function companyStep(readings: LaunchReadings): ChecklistStep {
  const base = { key: 'company', title: '企业信息' }
  const links = [{ label: '去填写企业信息', to: { name: LAUNCH_LINK_ROUTES.company } }]
  if (readings.companyError) {
    return {
      ...base,
      level: 'unknown',
      stateText: '读取失败',
      gap: `这一发没读回来：${readings.companyError}`,
      links: [{ label: readings.refreshHint }, ...links],
    }
  }
  const info = readings.company
  if (!info?.companyName) {
    return { ...base, level: 'blocked', stateText: '未填写', gap: '门户的站名、页脚和 llms.txt 的站点摘要都读这张表，名称空着这三处都没有内容。', links }
  }
  if (!info.introduction || !(info.phone || info.email)) {
    return {
      ...base,
      level: 'todo',
      stateText: '信息不完整',
      gap: '名称有了，但简介或联系方式还缺：页脚与 llms.txt 的摘要用的就是这两段。',
      links,
    }
  }
  return { ...base, level: 'ready', stateText: '已填写', links }
}

function demoStep(readings: LaunchReadings): ChecklistStep {
  const base = { key: 'demo', title: '演示内容' }
  if (!readings.demoReadable) {
    return {
      ...base,
      level: 'unknown',
      stateText: '超级管理员功能',
      gap: '演示内容包由平台管理员在开通客户时生成。需要一套演示门户，请联系平台管理员。',
      links: [{ label: '演示内容找平台', to: { name: LAUNCH_LINK_ROUTES.support } }],
    }
  }
  if (readings.demoError) {
    return {
      ...base,
      level: 'unknown',
      stateText: '读取失败',
      gap: `这一发没读回来：${readings.demoError}`,
      links: [{ label: readings.refreshHint }],
    }
  }
  if (!readings.demo) {
    return {
      ...base,
      level: 'unknown',
      stateText: '未读取',
      gap: '演示包的条数还没取回来。',
      links: [{ label: readings.refreshHint }],
    }
  }
  if (demoTotal(readings.demo) === 0) {
    return {
      ...base,
      level: 'todo',
      stateText: '尚无演示内容',
      gap: '这一家还没有演示内容包。不灌也可以上线——只要第 4 步那些正式发布的内容已经能读到；灌一套的作用是门户先有东西可看。',
    }
  }
  return {
    ...base,
    level: 'ready',
    stateText: '已有演示内容',
    gap: '演示行不带正式内容，访客列表读不到它们；要让访客读到还得走审核 → 发布，或按第 3 步的「转为正式内容」去掉演示标记。',
  }
}

function readersStep(readings: LaunchReadings): ChecklistStep {
  const base = { key: 'readers', title: '访客实际能看到的内容' }
  const links = [
    { label: '去文章列表', to: { name: LAUNCH_LINK_ROUTES.articles } },
    { label: '去内容案例', to: { name: LAUNCH_LINK_ROUTES.cases } },
  ]
  // 站点停用（或任何不对公众开放的取值）时公开口整站 404，这一格不该去发那两发探测——
  // 直接说「站点没上线」：这不是「读取失败」，也不是「门户上没有内容」
  if (readings.site && !siteOpenToPublic(readings.site.status)) {
    return {
      ...base,
      level: 'blocked',
      stateText: '站点未上线',
      gap: `站点现在是「${readings.site.status}」状态，门户公开面对访客是关闭的，谈「访客能看到几条」还早。上线由平台管理员操作。`,
      links: [{ label: '找平台启用站点', to: { name: LAUNCH_LINK_ROUTES.support } }, ...links],
    }
  }
  if (readings.visibilityError) {
    return {
      ...base,
      level: 'unknown',
      stateText: '未取到',
      gap: `门户的公开列表口没读回来：${readings.visibilityError}`,
      links: [{ label: readings.refreshHint }, ...links],
    }
  }
  if (readings.visibility.articles === null) {
    return {
      ...base,
      level: 'unknown',
      stateText: '未取到',
      gap: '这两个数是直接调门户公开口取的，没取回来时不等于「门户上没有内容」。',
      links: [{ label: readings.refreshHint }, ...links],
    }
  }
  if (readings.visibility.articles === 0) {
    return {
      ...base,
      level: 'blocked',
      stateText: '门户上还没有已发布内容',
      gap: '访客打开门户的列表页现在是一片空：文章要走完审核 → 发布才会出现在这里。',
      links,
    }
  }
  return {
    ...base,
    level: 'ready',
    stateText: '门户已有可读内容',
    gap: `公开口现在回文章 ${readings.visibility.articles} 条、案例 ${readings.visibility.cases ?? '未取到'} 条，和访客打开列表页看到的是同一份结果。`,
    links,
  }
}

/**
 * 第 5 步：门户预览与 SEO / GEO 出口。
 *
 * 这一步不给 ready 也不给 blocked：四个出口文件是后端直接返回的，界面这里只能确认
 * 「链接给不给出、站点编码有没有」，不能证明 robots 与 sitemap 的内容对。
 * 所以它说的是「四个出口已列出」或「没有站点编码，只能列路径」，其余交给可抓取性体检那一屏。
 */
function seoStep(readings: LaunchReadings): ChecklistStep {
  const base = { key: 'seo', title: '门户预览与 SEO / GEO 出口' }
  const links = [{ label: '访问统计', to: { name: LAUNCH_LINK_ROUTES.analytics } }]
  if (!readings.site?.code) {
    return {
      ...base,
      level: 'unknown',
      stateText: '没有站点编码，无法预览',
      gap: '站点编码没读回来，这一格只能列路径、给不出可点开的地址；先把第 1 步补齐。',
      links,
    }
  }
  return {
    ...base,
    level: 'ready',
    stateText: '四个出口已列出',
    gap: '这一格只确认四个出口文件给得出地址，不替你判断 robots 与 sitemap 的内容对不对——那一份在「可抓取性体检」。',
    links: [{ label: '打开门户预览', href: portalPreviewUrl(readings) }, ...links],
  }
}

/** 门户是 SPA，本地按站点编码定位租户；线上由域名决定，这个链接只用于开发/验收 */
export function portalPreviewUrl(readings: LaunchReadings): string {
  const code = readings.site?.code
  if (!code) {
    return ''
  }
  return `${window.location.origin}/?site=${encodeURIComponent(code)}`
}
