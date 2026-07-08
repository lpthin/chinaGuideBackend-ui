import http from './http'
import type { PageResult, PageParams } from '../types'

export interface HotKeyword {
  id: number
  keyword: string
  score: number
  source: string
  category: string
  trend: 'up' | 'down' | 'stable'
  trendValue: number
  relatedKeywords: string[]
  isSelected: boolean
  rank: number
  createdAt: string
  updatedAt: string
  collectDate: string
}

export interface HotKeywordStats {
  totalCount: number
  todayNewCount: number
  topPlatform: string
  trendDistribution: {
    up: number
    down: number
    stable: number
  }
  sourceDistribution: Record<string, number>
}

export interface HotKeywordQuery extends PageParams {
  source?: string
  keyword?: string
  category?: string
  isSelected?: boolean
}

export interface CollectConfig {
  sources: string[]
  categories: string[]
  frequency: string
  autoSelect: boolean
  topN: number
}

export interface CollectionJob {
  id: number
  tenantId: number
  siteId: number
  batchNo: string
  sourceCodes: string
  candidateCount: number
  savedCount: number
  status: string
  message: string
  collectType: string
  startedAt: string
  finishedAt: string
  platformStats: string
  createdAt: string
}

export interface PlatformStats {
  [source: string]: number
}

interface RawHotKeyword {
  id: number
  tenantId: number
  keyword: string
  category: string
  source: string
  heatScore: number
  searchVolume: number
  trend: number
  relatedKeywords: string | null
  platforms: string
  collectDate: string
  isSelected: number
  isDeleted: number
  createTime: string
}

function convertHotKeyword(raw: RawHotKeyword, index: number = 0): HotKeyword {
  let trend: 'up' | 'down' | 'stable' = 'stable'
  let trendValue = 0
  
  if (raw.trend != null) {
    if (raw.trend > 0) {
      trend = 'up'
      trendValue = raw.trend
    } else if (raw.trend < 0) {
      trend = 'down'
      trendValue = Math.abs(raw.trend)
    }
  }

  let relatedKeywords: string[] = []
  if (raw.relatedKeywords) {
    if (Array.isArray(raw.relatedKeywords)) {
      relatedKeywords = raw.relatedKeywords
    } else {
      try {
        relatedKeywords = JSON.parse(raw.relatedKeywords)
      } catch {
        relatedKeywords = raw.relatedKeywords.split(',').map(s => s.trim()).filter(Boolean)
      }
    }
  }

  const heatScore = raw.heatScore != null && !isNaN(raw.heatScore) ? raw.heatScore : 0

  return {
    id: raw.id,
    keyword: raw.keyword,
    score: Math.round(heatScore * 100) / 100,
    source: raw.source,
    category: raw.category,
    trend,
    trendValue,
    relatedKeywords,
    isSelected: raw.isSelected === 1,
    rank: index + 1,
    createdAt: raw.createTime,
    updatedAt: raw.collectDate,
    collectDate: raw.collectDate,
  }
}

export const hotKeywordApi = {
  list: async (params: HotKeywordQuery & { tenantId?: number }) => {
    const res = await http.get<{ records: RawHotKeyword[]; total: number; page: number; size: number }>('/hot-keywords', { params })
    return {
      records: res.records.map((item, index) => convertHotKeyword(item, (params.page! - 1) * (params.size || 10) + index)),
      total: res.total,
    } as PageResult<HotKeyword>
  },

  dailyTop: async () => {
    const res = await http.get<RawHotKeyword[]>('/hot-keywords/daily-top')
    return res.map((item, index) => convertHotKeyword(item, index))
  },

  collect: async (data: { sources: string[] }) => {
    const res = await http.post<{ collected: number; tenantId: number; sourceStats: Record<string, number> }>('/hot-keywords/collect', data)
    return { count: res.collected, sourceStats: res.sourceStats || {} }
  },

  autoSelect: async () => {
    const res = await http.post<RawHotKeyword[]>('/hot-keywords/auto-select')
    return res.map((item, index) => convertHotKeyword(item, index))
  },

  select: async (id: number, selected: boolean) => {
    const res = await http.post<RawHotKeyword>(`/hot-keywords/${id}/select`, { selected })
    return convertHotKeyword(res)
  },

  stats: (tenantId?: number) =>
    http.get<HotKeywordStats>('/hot-keywords/stats', tenantId !== undefined ? { params: { tenantId } } : {}),

  sources: async () => {
    const res = await http.get<{ code: string; name: string }[]>('/hot-keywords/sources')
    return res.map(item => ({ value: item.code, label: item.name }))
  },

  delete: (id: number) =>
    http.delete(`/hot-keywords/${id}`),

  batchDelete: (ids: number[]) =>
    http.delete('/hot-keywords/batch', { data: ids }),

  getConfig: () =>
    http.get<CollectConfig>('/hot-keywords/config'),

  updateConfig: (data: CollectConfig) =>
    http.put<CollectConfig>('/hot-keywords/config', data),

  categories: () =>
    http.get<{ value: string; label: string }[]>('/hot-keywords/categories'),

  collectionJobs: (tenantId?: number) =>
    http.get<CollectionJob[]>('/hot-keywords/collection-jobs', tenantId !== undefined ? { params: { tenantId } } : {}),
}

export default hotKeywordApi
