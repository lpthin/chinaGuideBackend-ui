import http from './http'
import type {
  GeoSeoConfig,
  GeoSeoCompetitor,
  GeoSeoKeywordRank,
  GeoDashboard,
} from '../types/geoseo'

// ==================== 站点配置 API ====================
export const geoConfigApi = {
  get: () => http.get<GeoSeoConfig>('/geoseo/config'),
  update: (data: GeoSeoConfig) => http.put<GeoSeoConfig>('/geoseo/config', data),
  previewRobots: () => http.get<string>('/geoseo/config/preview/robots'),
  previewLlms: () => http.get<string>('/geoseo/config/preview/llms'),
  previewSitemap: () => http.get<string>('/geoseo/config/preview/sitemap'),
}

// ==================== 竞品追踪 API ====================
export const geoCompetitorApi = {
  list: () => http.get<GeoSeoCompetitor[]>('/geoseo/competitors'),
  get: (id: number) => http.get<GeoSeoCompetitor>(`/geoseo/competitors/${id}`),
  create: (data: GeoSeoCompetitor) => http.post<GeoSeoCompetitor>('/geoseo/competitors', data),
  update: (id: number, data: GeoSeoCompetitor) => http.put<GeoSeoCompetitor>(`/geoseo/competitors/${id}`, data),
  delete: (id: number) => http.delete<void>(`/geoseo/competitors/${id}`),
}

// ==================== 关键词排名 API ====================
export const geoKeywordApi = {
  list: (params?: { searchEngine?: string }) =>
    http.get<GeoSeoKeywordRank[]>('/geoseo/keywords', { params }),
  get: (id: number) => http.get<GeoSeoKeywordRank>(`/geoseo/keywords/${id}`),
  create: (data: GeoSeoKeywordRank) => http.post<GeoSeoKeywordRank>('/geoseo/keywords', data),
  update: (id: number, data: GeoSeoKeywordRank) => http.put<GeoSeoKeywordRank>(`/geoseo/keywords/${id}`, data),
  delete: (id: number) => http.delete<void>(`/geoseo/keywords/${id}`),
}

// ==================== GEO仪表盘 API ====================
export const geoDashboardApi = {
  get: () => http.get<GeoDashboard>('/geoseo/dashboard'),
}

export default {
  config: geoConfigApi,
  competitor: geoCompetitorApi,
  keyword: geoKeywordApi,
  dashboard: geoDashboardApi,
}
