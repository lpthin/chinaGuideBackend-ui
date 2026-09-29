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
   * 五个「这一栏填了多少」的完成度比率。曾经这里还有一个 `totalScore` 与第六个维度
   * `crawlerAccessibility = robotsTxt 非空 ? 100 : 50`：Q2-A 定稿删总分，P5（§8）删那个 ternary，
   * 服务端已经不返回这两个字段了（Spec-F §5 禁令 1、§12-7）。
   * 替代物是「分平台 × 分指标」矩阵 + 可抓取性体检六项真测（`api/geoCrawlability.ts`）。
   */
  dimensions: {
    aiCitability: number
    schemaCompleteness: number
    metaCompleteness: number
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
