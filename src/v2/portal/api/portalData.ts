import axios from 'axios'

// API 响应的接口类型
export interface ApiHeroData {
  title: string
  subtitle: string
  description: string
  primaryButtonText?: string
  secondaryButtonText?: string
  backgroundImage?: string
}

export interface ApiService {
  id: number
  title: string
  description: string
  icon?: string
  features?: string[]
}

export interface ApiCase {
  id: number
  title: string
  category: string
  description: string
  imageUrl: string
  tags?: string[]
}

export interface ApiNews {
  id: number
  title: string
  summary: string
  category: string
  date: string
  coverImage: string
  views?: number
}

export interface ApiContactInfo {
  title: string
  subtitle?: string
  address: string
  phone: string
  email: string
  workingHours?: string
  mapLocation?: { lat: number; lng: number }
}

export interface ApiCompanyInfo {
  name: string
  slogan?: string
  icp?: string
  copyright?: string
}

export interface ApiTeamMember {
  id: number
  name: string
  position: string
  avatar: string
  bio: string
  socialLinks?: { platform: string; url: string }[]
}

export interface ApiTestimonial {
  id: number
  content: string
  author: string
  position: string
  company: string
  avatar: string
  rating: number
}

export interface ApiFAQ {
  id: number
  question: string
  answer: string
}

// API 返回的整体数据结构
export interface PortalDataResponse {
  heroData: ApiHeroData
  services: ApiService[]
  cases: ApiCase[]
  news: ApiNews[]
  contactInfo: ApiContactInfo
  companyInfo: ApiCompanyInfo
  teamMembers?: ApiTeamMember[]
  testimonials?: ApiTestimonial[]
  faqList?: ApiFAQ[]
}

// 获取门户数据的函数
export async function getPortalData(): Promise<PortalDataResponse> {
  const tenantId = localStorage.getItem('tenantId') || ''

  try {
    const response = await axios.get<PortalDataResponse>('/api/v2/portal/data', {
      headers: {
        'X-Tenant-Id': tenantId
      }
    })

    return response.data
  } catch (error) {
    console.error('获取门户数据失败:', error)
    throw error
  }
}

// 将 API 的 Service 数据转换为前端使用的格式
export function transformServiceData(apiServices: ApiService[]): any[] {
  return apiServices.map(service => ({
    id: service.id,
    icon: service.icon || 'AppstoreOutlined',
    title: service.title,
    description: service.description,
    features: service.features || []
  }))
}

// 将 API 的 Case 数据转换为前端使用的格式
export function transformCaseData(apiCases: ApiCase[]): any[] {
  return apiCases.map(caseItem => ({
    id: caseItem.id,
    title: caseItem.title,
    category: caseItem.category,
    description: caseItem.description,
    imageUrl: caseItem.imageUrl,
    tags: caseItem.tags || []
  }))
}

// 将 API 的 News 数据转换为前端使用的格式
export function transformNewsData(apiNews: ApiNews[]): any[] {
  return apiNews.map(news => ({
    id: news.id,
    title: news.title,
    summary: news.summary,
    category: news.category,
    date: news.date,
    coverImage: news.coverImage,
    views: news.views || 0
  }))
}

// 将 API 的新闻数据转换为 SimpleTemplate 的作品展示格式
export function transformArticleToWork(apiNews: ApiNews[]): any[] {
  return apiNews.map(news => ({
    id: news.id,
    title: news.title,
    category: news.category,
    imageUrl: news.coverImage,
    description: news.summary
  }))
}