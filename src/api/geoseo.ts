import http from './http'
import type {
  GeoSeoCompetitor,
  GeoSeoKeywordRank,
  GeoDashboard,
} from '../types/geoseo'

// 站点级 SEO/GEO 配置的读写口已迁到 /api/portal/site-info（见 api/portalSiteInfo.ts，Spec-C §6.4 P5）；
// 这里的旧 geoConfigApi（/geoseo/config 整实体 PUT）连同唯一消费者 GeoSeoConfigView 一起删除，
// 免得留第二条「改 SEO」的写路径——I-6 只要一份真相。这里只剩 GEO 侧与 SEO 无涉的仪表盘族。

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
  competitor: geoCompetitorApi,
  keyword: geoKeywordApi,
  dashboard: geoDashboardApi,
}
