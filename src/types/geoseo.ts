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

// 旧 GeoSeoCompetitor / GeoSeoKeywordRank 两个形状已随 geoseo/competitors、geoseo/keywords 两页删除
// （Spec-F Q6/Q7-A）：表还在库里（存量不动），但前端不再声明「能读回来」的形状。

export interface GeoDashboard {
  /**
   * 后端 GeoDashboardController 当场用「配置字段填没填」算出来的加权数
   * （`:90` crawlerAccessibility = robotsTxt 非空 ? 100 : 50 那一族）。
   * Spec-F Q2-A 定稿删总分：界面上不再渲染这两个字段，替代物是「分平台 × 分指标」矩阵 + 体检清单。
   */
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
}
