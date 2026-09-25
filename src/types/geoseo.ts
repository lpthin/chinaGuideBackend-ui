// GeoSeo Types

export interface GeoSeoConfig {
  id?: number
  tenantId?: number
  siteId?: number
  robotsTxt: string
  llmsTxtTemplate: string
  llmsSummary: string
  geoCitationSummary: string
}

export interface GeoSeoCompetitor {
  id?: number
  tenantId?: number
  domain: string
  name: string
  trackingKeywords: string
  notes: string
}

export interface GeoSeoKeywordRank {
  id?: number
  tenantId?: number
  keyword: string
  searchEngine: string  // 'google' | 'baidu'
  currentRank: number | null
  previousRank: number | null
  bestRank: number | null
  trackedUrl: string
  competitorRank: string
  checkedAt: string | null
}

export interface GeoDashboard {
  totalScore: number
  dimensions: {
    aiCitability: number
    schemaCompleteness: number
    metaCompleteness: number
    crawlerAccessibility: number
    contentQuality: number
    brandAuthority: number
  }
  articleCount: number
  publishedCount: number
  competitorCount: number
  keywordCount: number
  suggestions: Array<{
    severity: string  // 'high' | 'medium' | 'low'
    message: string
  }>
  rankChanges?: Array<{
    keyword: string
    currentRank: number
    previousRank: number
    searchEngine: string
  }>
}
