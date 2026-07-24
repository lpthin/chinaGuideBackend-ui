// GeoSeo Types

export interface GeoSeoConfig {
  id?: number
  tenantId?: number
  siteId?: number
  robotsTxt: string
  llmsTxtTemplate: string
  defaultSeoTitle: string
  defaultSeoDescription: string
  defaultSeoKeywords: string
  defaultOgImage: string
  defaultTwitterCardType: string
  defaultSchemaJson: string
  llmsSummary: string
  geoCitationSummary: string
}

export interface GeoSeoPage {
  id?: number
  tenantId?: number
  siteId?: number
  pageType: string  // 'home' | 'category' | 'article' | 'case' | 'custom'
  pageKey: string
  seoTitle: string
  seoDescription: string
  seoKeywords: string
  canonicalUrl: string
  robotsMeta: string
  ogTitle: string
  ogDescription: string
  ogImage: string
  twitterCardType: string
  twitterTitle: string
  twitterDescription: string
  twitterImage: string
  structuredData: string
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
