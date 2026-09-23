import axios from 'axios'

/**
 * 门户数据类型严格对齐 GET /api/portal/data 的真实返回（PortalDataDTO）。
 * 后端没有对应字段的（服务图标、案例标签、新闻浏览量、团队/评价/FAQ）一律不声明，
 * 模板也就没有机会把 undefined 渲染成编造出来的内容。
 */
export interface ApiHeroData {
  title: string | null
  description: string | null
  buttonText?: string | null
  buttonLink?: string | null
}

export interface ApiServiceItem {
  id: number
  title: string | null
  summary: string | null
  icon?: string | null
  link?: string | null
}

export interface ApiCaseItem {
  id: number
  title: string | null
  customerName: string | null
  industry: string | null
  summary: string | null
  coverImage: string | null
  link?: string | null
}

export interface ApiNewsItem {
  id: number
  title: string | null
  summary: string | null
  category: string | null
  publishedAt: string | null
  coverImage: string | null
  link?: string | null
}

export interface ApiContactInfo {
  phone: string | null
  email: string | null
  website: string | null
  address: string | null
  description: string | null
  serviceHotline: string | null
  wechat: string | null
  weibo: string | null
  douyin: string | null
  linkedin: string | null
  github: string | null
}

export interface ApiSeoMeta {
  seoTitle: string | null
  seoDescription: string | null
  seoKeywords: string | null
  canonicalUrl: string | null
  robotsMeta: string | null
  ogTitle: string | null
  ogDescription: string | null
  ogImage: string | null
  twitterCardType: string | null
  twitterTitle: string | null
  twitterDescription: string | null
  twitterImage: string | null
  schemaJson: string | null
  defaultSchemaJson: string | null
}

export interface ApiFeatureProject {
  name: string
  description?: string
  image?: string
  url?: string
}

export interface ApiCompanyInfo {
  name: string | null
  logo: string | null
  slogan: string | null
  copyright: string | null
  description: string | null
}

export interface ApiTeamMember {
  id: number
  name: string
  position: string
  avatar: string
  bio: string
}

export interface ApiBanner {
  id: number
  title: string | null
  subtitle: string | null
  imageUrl: string | null
  linkUrl: string | null
  linkType: string | null
  sort: number | null
}

export interface ApiFooterLink {
  title: string
  url: string
  type: string
  children: ApiFooterLink[]
}

export interface PortalDataResponse {
  heroData: ApiHeroData
  services: ApiServiceItem[]
  cases: ApiCaseItem[]
  newsList: ApiNewsItem[]
  contactInfo: ApiContactInfo
  companyInfo: ApiCompanyInfo
  teamMembers: ApiTeamMember[]
  banners: ApiBanner[]
  footerLinks: ApiFooterLink[]
  seoMeta?: ApiSeoMeta
  faviconUrl?: string | null
  coreProducts?: string | null
  featureProjects?: ApiFeatureProject[] | null
}

/**
 * 门户属于哪个站点由访问域名决定，前端不再声明租户身份。
 * 本地/预览用 ?site={租户代码} 显式指定，该参数只在后端开启
 * app.portal.allow-site-param 时才生效（生产关闭）。
 *
 * <p>?site= 只会出现在入口那一个 URL 上，点进内页后地址栏就没有了；缓存一份到本次会话，
 * 否则访客从首页进详情页就变成「查不到站点」。生产环境后端根本不读这个参数，留着无害。</p>
 */
const SITE_SESSION_KEY = 'portal.site'

export function resolveSiteCode(): string {
  const fromUrl = new URLSearchParams(window.location.search).get('site')
  if (fromUrl) {
    try {
      sessionStorage.setItem(SITE_SESSION_KEY, fromUrl)
    } catch {
      // 隐私模式下写不进去，这一页还能用，下一页退回按域名解析
    }
    return fromUrl
  }
  try {
    return sessionStorage.getItem(SITE_SESSION_KEY) || ''
  } catch {
    return ''
  }
}

/**
 * 首页聚合走公开端点：访客没有登录态，旧的 /api/portal/data 依赖管理员浏览器里的
 * 租户身份，所以那边已改成按域名解析，前端切到这里后不再使用它。
 */
export async function getPortalData(): Promise<PortalDataResponse> {
  const siteCode = resolveSiteCode()
  const params = siteCode ? { site: siteCode } : undefined

  try {
    const response = await axios.get('/api/portal/public/home', { params })

    // 后端返回 { success, code, message, data }，取 data 字段
    const body = response.data
    if (body && body.success && body.data) {
      return body.data as PortalDataResponse
    }
    throw new Error(body?.message || '获取门户数据失败')
  } catch (error) {
    console.error('获取门户数据失败:', error)
    throw error
  }
}
