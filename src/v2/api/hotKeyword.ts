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

export const hotKeywordApi = {
  list: (params: HotKeywordQuery) =>
    http.get<PageResult<HotKeyword>>('/hot-keywords', { params }),

  dailyTop: () =>
    http.get<HotKeyword[]>('/hot-keywords/daily-top'),

  collect: (data: { sources: string[] }) =>
    http.post<{ count: number }>('/hot-keywords/collect', data),

  autoSelect: () =>
    http.post<HotKeyword[]>('/hot-keywords/auto-select'),

  select: (id: number, selected: boolean) =>
    http.put<HotKeyword>(`/hot-keywords/${id}/select`, { selected }),

  stats: () =>
    http.get<HotKeywordStats>('/hot-keywords/stats'),

  sources: () =>
    http.get<{ value: string; label: string }[]>('/hot-keywords/sources'),

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
}

export default hotKeywordApi
