import http from './http'
import type {
  GeoRegion,
  GeoStore,
  GeoStoreStats,
  GeoRegionQuery,
  GeoStoreQuery,
  GeoRegionForm,
  GeoStoreForm,
  PageResult
} from '../types/geo'

export const geoRegionApi = {
  list: (params: GeoRegionQuery) =>
    http.get<PageResult<GeoRegion>>('/geo/regions', { params }),

  get: (id: number) =>
    http.get<GeoRegion>(`/geo/regions/${id}`),

  tree: () =>
    http.get<GeoRegion[]>('/geo/regions/tree'),

  provinces: () =>
    http.get<GeoRegion[]>('/geo/regions/provinces'),

  cities: (provinceId: number) =>
    http.get<GeoRegion[]>(`/geo/regions/provinces/${provinceId}/cities`),

  districts: (cityId: number) =>
    http.get<GeoRegion[]>(`/geo/regions/cities/${cityId}/districts`),

  create: (data: GeoRegionForm) =>
    http.post<GeoRegion>('/geo/regions', data),

  update: (id: number, data: GeoRegionForm) =>
    http.put<GeoRegion>(`/geo/regions/${id}`, data),

  delete: (id: number) =>
    http.delete(`/geo/regions/${id}`),

  batchDelete: (ids: number[]) =>
    http.delete('/geo/regions/batch', { data: ids })
}

export const geoStoreApi = {
  list: (params: GeoStoreQuery) =>
    http.get<PageResult<GeoStore>>('/geo/stores', { params }),

  get: (id: number) =>
    http.get<GeoStore>(`/geo/stores/${id}`),

  create: (data: GeoStoreForm) =>
    http.post<GeoStore>('/geo/stores', data),

  update: (id: number, data: GeoStoreForm) =>
    http.put<GeoStore>(`/geo/stores/${id}`, data),

  delete: (id: number) =>
    http.delete(`/geo/stores/${id}`),

  batchDelete: (ids: number[]) =>
    http.delete('/geo/stores/batch', { data: ids }),

  nearby: (lng: number, lat: number, radius: number = 5000) =>
    http.get<GeoStore[]>('/geo/stores/nearby', { params: { lng, lat, radius } }),

  statistics: () =>
    http.get<GeoStoreStats>('/geo/stores/statistics')
}

export const geoLocationApi = {
  getByIp: (ip?: string) =>
    http.get<{ province: string; city: string; district: string; lng: number; lat: number; isp: string }>('/geo/location/ip', { params: { ip } }),

  getCurrent: () =>
    http.get<{ province: string; city: string; district: string; lng: number; lat: number; isp: string }>('/geo/location/current'),
}
