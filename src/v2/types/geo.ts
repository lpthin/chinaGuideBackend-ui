export enum GeoStoreStatus {
  OPEN = 'open',
  CLOSED = 'closed',
  MAINTENANCE = 'maintenance'
}

export enum StoreType {
  DIRECT = 'direct',
  FRANCHISE = 'franchise',
  BRANCH = 'branch'
}

export enum RegionLevel {
  PROVINCE = 1,
  CITY = 2,
  DISTRICT = 3
}

export interface GeoRegion {
  id: number
  parentId: number | null
  level: number
  name: string
  code: string
  fullName: string
  pinyin: string
  lng: number
  lat: number
  sortOrder: number
  status: string
  children?: GeoRegion[]
  createdAt?: string
  updatedAt?: string
}

export interface GeoStore {
  id: number
  name: string
  storeNo: string
  type: StoreType
  address: string
  provinceId: number
  cityId: number
  districtId: number
  provinceName?: string
  cityName?: string
  districtName?: string
  fullAddress: string
  lng: number
  lat: number
  phone: string
  email: string
  businessHours: string
  coverImage: string
  images: string
  description: string
  tags: string
  tagList?: string[]
  sortOrder: number
  status: GeoStoreStatus
  managerName: string
  managerPhone: string
  distance?: number
  createdAt?: string
  updatedAt?: string
}

export interface GeoRegionQuery {
  parentId?: number | null
  level?: number
  status?: string
  keyword?: string
  page?: number
  size?: number
}

export interface GeoStoreQuery {
  provinceId?: number | null
  cityId?: number | null
  districtId?: number | null
  status?: GeoStoreStatus
  type?: StoreType
  keyword?: string
  page?: number
  size?: number
}

export interface GeoStoreForm {
  id?: number
  name: string
  storeNo: string
  type: StoreType
  address: string
  provinceId: number
  cityId: number
  districtId: number
  lng: number
  lat: number
  phone: string
  email: string
  businessHours: string
  coverImage?: string
  images?: string
  description?: string
  tags?: string
  sortOrder?: number
  status: GeoStoreStatus
  managerName: string
  managerPhone: string
}

export interface GeoRegionForm {
  id?: number
  parentId: number | null
  level: number
  name: string
  code: string
  fullName: string
  pinyin: string
  lng?: number
  lat?: number
  sortOrder?: number
  status: string
}

export interface GeoStoreStats {
  totalStores: number
  openStores: number
  closedStores: number
  maintenanceStores: number
  provinceCount: number
  cityCount: number
  districtCount: number
}

export interface PageResult<T> {
  records: T[]
  total: number
  page: number
  size: number
  pages: number
}
