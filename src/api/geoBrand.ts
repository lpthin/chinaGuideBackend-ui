import http from './http'

/**
 * GEO 品牌档案 / 竞品组 / 两类追踪题池（Spec-F §11.2 P1）。
 *
 * 后端契约是唯一的形状来源（`/api/geo/brand`，读 `geo:brand:view`、写 `geo:brand:manage`）：
 * - 品牌档案带品牌词与官网清单，向导第 ① 步写的就是这一行；
 * - 竞品 origin 分 MANUAL/AUTO，自动发现受 `app.geo.auto-competitor-max` 约束（Q13：上限可配），
 *   发现的竞品默认 enabled=false——未勾选不进 SOV 分母；
 * - 追踪题分两类：MENTION 题面不许出现品牌名、REPUTATION 题面必须出现品牌名，
 *   服务端与前端 QuestionDraftRow 判的是同一句话；
 * - tenantId 为 null 的平台通用题对租户只读（服务端原话：「平台通用题只读」）。
 */

export type GeoQuestionKind = 'MENTION' | 'REPUTATION'

export interface GeoBrandProfile {
  id: number
  tenantId: number
  siteId: number
  brandName: string
  brandWords: string[]
  officialUrls: string[]
  brandIntro: string
  status: string
  createdAt: string | null
  updatedAt: string | null
}

export interface GeoBrandCompetitor {
  id: number
  brandProfileId: number
  name: string
  words: string[]
  origin: 'MANUAL' | 'AUTO'
  sourceRunId: number | null
  enabled: boolean
}

export interface GeoBrandQuestion {
  id: number
  tenantId: number | null
  brandProfileId: number | null
  kind: GeoQuestionKind
  coreWord: string
  questionText: string
  variantSeq: number | null
  origin: 'MANUAL' | 'AI_SUGGESTED' | 'AUTO'
  enabled: boolean
  reviewState: string
}

/** 自动发现回执：discovered/kept/limit/skipped 四个数界面要原样念（§0.4 Q13 的「未纳入」要看得见） */
export interface GeoAutoDiscoverResult {
  discovered: number
  kept: number
  limit: number
  skipped: number
  items: GeoBrandCompetitor[]
}

export interface GeoBrandProfileForm {
  siteId: number | null
  brandName: string
  brandWords: string[]
  officialUrls: string[]
  brandIntro: string
}

export interface GeoQuestionDraft {
  coreWord: string
  questionText: string
}

export interface GeoPaged<T> {
  total: number
  page: number
  size: number
  records: T[]
}

export const geoBrandApi = {
  createProfile: (form: GeoBrandProfileForm) => http.post<GeoBrandProfile>('/geo/brand', form),

  /** 分页口（§7.3）：page 从 1 起、size 默认 20 */
  listProfiles: (params: { siteId?: number | null; page?: number; size?: number }) =>
    http.get<GeoPaged<GeoBrandProfile>>('/geo/brand/list', { params }),

  getProfile: (id: number) => http.get<GeoBrandProfile>(`/geo/brand/${id}`),

  updateProfile: (id: number, form: GeoBrandProfileForm) => http.put<GeoBrandProfile>(`/geo/brand/${id}`, form),

  /** 软删：行还在库里，界面不再出现 */
  deleteProfile: (id: number) => http.delete<void>(`/geo/brand/${id}`),

  competitors: (id: number) => http.get<GeoBrandCompetitor[]>(`/geo/brand/${id}/competitors`),

  addCompetitor: (id: number, form: { name: string; words: string[] }) =>
    http.post<GeoBrandCompetitor>(`/geo/brand/${id}/competitors`, form),

  deleteCompetitor: (id: number, competitorId: number) =>
    http.delete<void>(`/geo/brand/${id}/competitors/${competitorId}`),

  setCompetitorEnabled: (id: number, competitorId: number, enabled: boolean) =>
    http.put<void>(`/geo/brand/${id}/competitors/${competitorId}/enabled`, { enabled }),

  /** 竞品留空时的自动发现（§2「不填就按诊断中发现的品牌自动对比」）；runId 可不带 */
  autoDiscoverCompetitors: (id: number, runId?: number | null) =>
    http.post<GeoAutoDiscoverResult>(`/geo/brand/${id}/competitors/auto-discover`, { runId: runId ?? null }),

  /** 两类题池一起回：tenant = 本租户能改的，platform = 平台通用题（只读） */
  questions: (id: number, kind?: GeoQuestionKind) =>
    http.get<{ tenant: GeoBrandQuestion[]; platform: GeoBrandQuestion[] }>(`/geo/brand/${id}/questions`, {
      params: kind ? { kind } : {},
    }),

  addQuestion: (
    id: number,
    form: { kind: GeoQuestionKind; coreWord: string; questionText: string; variantSeq?: number | null }
  ) => http.post<GeoBrandQuestion>(`/geo/brand/${id}/questions`, form),

  updateQuestion: (
    questionId: number,
    form: { coreWord: string; questionText: string; enabled: boolean; reviewState: string }
  ) => http.put<GeoBrandQuestion>(`/geo/brand/questions/${questionId}`, form),

  deleteQuestion: (questionId: number) => http.delete<void>(`/geo/brand/questions/${questionId}`),
}
