import http from './http'

/**
 * GEO 诊断计划 / 轮次 / 报告（Spec-F §11.3 P2）。
 *
 * 形状逐字跟后端 `GeoCampaignDtos`（`/api/geo/campaign`）：读与预估挂 `geo:campaign:view`，
 * 建改删与起跑挂 `geo:campaign:run`。三件事在这里钉住，界面不再各写一份：
 * - 状态与指标的中文名来自 `vocabulary()`，不在 TS 里抄第二份词表；
 * - `estimate.notice` 非空 = 这一轮不会受理，它是数据而不是错误码（预估一次模型都不调）；
 * - 指标行的 `value` 为 null = 分母为 0，也就是「没测过」，界面显示「未取到」而不是 0%（§9.6）。
 */

export interface GeoCampaignForm {
  siteId: number | null
  brandProfileId: number | null
  name: string
  platformIds: number[]
  questionIds: number[]
  repeatTimes: number | null
  wizardState: string | null
  note: string
}

/** 改计划：只改还没跑过的中间态；null 字段表示「这一项不动」（后端按 null 判） */
export type GeoCampaignUpdateForm = Partial<Omit<GeoCampaignForm, 'siteId' | 'brandProfileId'>>

export interface GeoCampaign {
  id: number
  tenantId: number
  siteId: number
  brandProfileId: number
  name: string
  platformIds: number[]
  questionIds: number[]
  questionCount: number
  platformCount: number
  repeatTimes: number
  costEstimateCalls: number
  costEstimateTokens: number
  confirmState: string
  confirmStateLabel: string
  wizardState: string | null
  note: string | null
  createdBy: string | null
  createdAt: string | null
  updatedAt: string | null
  latestRun: GeoRun | null
}

export interface GeoEstimate {
  campaignId: number
  questionCount: number
  platformCount: number
  repeatTimes: number
  callCount: number
  estimatedTokens: number
  estimatedMinutes: number
  remainingTokens: number
  campaignEnabled: boolean
  tenantBearsCost: boolean
  notice: string | null
}

export interface GeoRun {
  id: number
  campaignId: number
  tenantId: number
  brandProfileId: number
  siteId: number
  status: string
  statusLabel: string
  stageText: string | null
  progress: number | null
  accessChannel: string | null
  questionCount: number | null
  platformCount: number | null
  repeatTimes: number | null
  callCount: number | null
  failedCallCount: number | null
  promptTokens: number | null
  completionTokens: number | null
  errorMessage: string | null
  /**
   * 「这一轮停着不动」的那句实话，只在轮次还在跑却太久没进度时非空（#108 判据：
   * 卡住的病是「没人知道它停着」，所以治它的是把话说清楚，不是给它加一个新状态词）。
   * 界面对它只做一件事——原样念出来，不许改写成「失败」。
   */
  stalledReason: string | null
  startedAt: string | null
  finishedAt: string | null
  createdBy: string | null
  createdAt: string | null
}

/** 一行指标 + 它自带的中文名与分母口径：口径句子跟着数据走（§5 单源） */
export interface GeoMetricRow {
  id: number
  scope: 'BRAND' | 'COMPETITOR' | string
  subject: string
  modelConfigId: number | null
  modelLabel: string | null
  metric: string
  metricLabel: string | null
  definition: string | null
  numerator: number
  denominator: number
  value: number | null
  ciLow: number | null
  ciHigh: number | null
  computedAt: string | null
}

export interface GeoReport {
  run: GeoRun
  platforms: string[]
  mentionRate: GeoMetricRow[]
  sovShare: GeoMetricRow[]
  promptCoverage: GeoMetricRow | null
  callCount: number
  failedCallCount: number
  unmeasuredSubjects: string[]
  unmeasuredQuestions: string[]
  accessChannelNote: string
  generatedAt: string | null
}

/** 平台卡片唯一出处：后端 `ai_model_config` 的启用聊天模型行，界面不许自己列「支持哪几家」 */
export interface GeoPlatformOption {
  id: number
  name: string
  provider: string | null
  modelName: string | null
  modelType: string | null
}

export interface GeoVocabulary {
  runStatuses: Record<string, string>
  metrics: Record<string, string>
  metricDefinitions: Record<string, string>
  confirmStates: Record<string, string>
  accessChannelNote: string
}

export interface GeoPaged<T> {
  total: number
  page: number
  size: number
  records: T[]
}

export const geoCampaignApi = {
  createCampaign: (form: GeoCampaignForm) => http.post<GeoCampaign>('/geo/campaign', form),

  updateCampaign: (id: number, form: GeoCampaignUpdateForm) => http.put<GeoCampaign>(`/geo/campaign/${id}`, form),

  deleteCampaign: (id: number) => http.delete<void>(`/geo/campaign/${id}`),

  listCampaigns: (params: { brandProfileId?: number | null; page?: number; size?: number }) =>
    http.get<GeoPaged<GeoCampaign>>('/geo/campaign/list', { params }),

  getCampaign: (id: number) => http.get<GeoCampaign>(`/geo/campaign/${id}`),

  /** 只算不调：打完这一发，`ai_call_log` 不该多一行（§11.3 的验收点） */
  estimate: (id: number) => http.get<GeoEstimate>(`/geo/campaign/${id}/estimate`),

  platforms: (siteId: number) => http.get<GeoPlatformOption[]>('/geo/campaign/platforms', { params: { siteId } }),

  /** confirm 一律由调用方给真值：默认 true 就等于把「先看价再点头」这条闸在前端拆掉 */
  run: (id: number, confirm: boolean) => http.post<GeoRun>(`/geo/campaign/${id}/run`, { confirm }),

  runs: (id: number) => http.get<GeoRun[]>(`/geo/campaign/${id}/runs`),

  getRun: (runId: number) => http.get<GeoRun>(`/geo/campaign/run/${runId}`),

  getReport: (runId: number) => http.get<GeoReport>(`/geo/campaign/run/${runId}/report`),

  /**
   * 按【当前竞品勾选】重算这一轮的 SOV（§11.3 的验收点：勾 2 个与勾 5 个各算一次）。
   * 它一次模型都不调用——SOV 判的是「回答里有没有出现这个名字」，那些回答已经存在库里，
   * 换勾选只是换一遍计数。所以它挂 `geo:campaign:run` 却不烧额度，也不新增轮次。
   * 情感判定不在这一条路上：那条要重新过模型，见 Spec §11.4。
   */
  recalculateSov: (runId: number) => http.post<GeoReport>(`/geo/campaign/run/${runId}/sov`),

  vocabulary: () => http.get<GeoVocabulary>('/geo/campaign/vocabulary'),
}

/** 轮次终态：进度轮询到这里就可以停手（判据跟后端 GeoRunStatuses.isTerminal 同一条） */
export function geoRunIsSettled(status: string | null | undefined): boolean {
  return status === 'SUCCEEDED' || status === 'PARTIAL' || status === 'FAILED'
}

export function geoRunIsInFlight(status: string | null | undefined): boolean {
  return status === 'PENDING' || status === 'RUNNING'
}

/** 起跑失败时的排队出口：后端队列满会抛 GEO_CAMPAIGN_QUEUE_FULL，那句话本身就写了重按不会重复扣钱 */
export const GEO_QUEUE_FULL_CODE = 'GEO_CAMPAIGN_QUEUE_FULL'
