import http from './http'
import type { GeoDashboard } from '../types/geoseo'

// 站点级 SEO/GEO 配置的读写口已迁到 /api/portal/site-info（见 api/portalSiteInfo.ts，Spec-C §6.4 P5）；
// 这里的旧 geoConfigApi（/geoseo/config 整实体 PUT）连同唯一消费者 GeoSeoConfigView 一起删除，
// 免得留第二条「改 SEO」的写路径——I-6 只要一份真相。这里只剩 GEO 侧与 SEO 无涉的仪表盘族。
// 旧 geoCompetitorApi / geoKeywordApi 两组已删除（Spec-F Q6/Q7-A）：那两条路由与视图整体下线，
// 后端 `/api/geoseo/keywords/{id}/check` 现在返回 501 NOT_IMPLEMENTED，前端不留可调用的形状。

// ==================== GEO仪表盘 API ====================
export const geoDashboardApi = {
  get: () => http.get<GeoDashboard>('/geoseo/dashboard'),
}

export default {
  dashboard: geoDashboardApi,
}
