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

/** 门户是公开页面，租户身份靠 X-Tenant-Id 头传递，取自管理端登录/切换租户时写入的 localStorage。 */
export function resolvePortalTenantId(): string {
  return (
    localStorage.getItem('selected_tenant_id') ||
    localStorage.getItem('geocms_tenant_id') ||
    localStorage.getItem('tenantId') ||
    ''
  )
}

export async function getPortalData(): Promise<PortalDataResponse> {
  const tenantId = resolvePortalTenantId()

  if (!tenantId) {
    throw new Error('无法确定站点所属租户，请先在管理端选择租户')
  }

  try {
    const response = await axios.get('/api/portal/data', {
      headers: {
        'X-Tenant-Id': tenantId
      }
    })

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
