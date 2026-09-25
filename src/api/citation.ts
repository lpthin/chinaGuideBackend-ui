import http, { AI_REQUEST_TIMEOUT } from './http'

/**
 * 品牌引用探测（决议 N10 方案 B：自己拿品牌问题去问各家模型，看有没有人引用我们）。
 *
 * 两块接口分开，权限域也分开：
 * - `/api/admin/portal/citation-probes`：超管侧，发起探测与维护题库（`portal:build:citation`，
 *   V102 只授 SUPER_ADMIN，租户令牌打这里真 403）；
 * - `/api/portal/citations`：租户侧只读，回答「我的哪些页、哪篇文章被 AI 引用了几次」＋流量来源。
 *
 * 端点按「钱在哪一步花掉」切开，和整站组装同一套纪律：`create` 一次模型都不调，
 * `estimate` 只算不调，`run` 必须带用户亲手勾上的 confirm 且只是把任务丢进线程池。
 * 所以这里没有「一键探测」的方法：轮次是「模型数 × 题数」次真实外呼，
 * 把它合成一颗按钮等于让用户在不知道价钱的情况下花租户的额度。
 *
 * 状态与命中强度的中文说法都来自后端（`/statuses`、响应里的 `matchLabel`、
 * `traffic-sources` 的 `label`），TS 里不抄一份——抄了就是下一次对不上的开始。
 */

/** 一行探测任务。它是「这一轮问了谁」的账本，不是结果；结果在 probeView 的 calls/hits 里 */
export interface CitationProbe {
  id: number
  tenantId: number | null
  siteId: number
  /** 取值见 statusLabels()；只能由动作产生 */
  status: string
  /** 这一轮真用了哪些模型（JSON 字符串快照）。空串/null 表示还没定过 */
  modelIds: string | null
  modelCount: number | null
  questionCount: number | null
  /** 参与判定的对象数（站点 + 已发布页 + 已发布文章），这就是引用率的分母 */
  targetCount: number | null
  citedTargetCount: number | null
  /** 真实发起的外呼次数 = 模型数 × 题数 */
  callCount: number | null
  failedCallCount: number | null
  estimatedTokens: number | null
  promptTokens: number | null
  completionTokens: number | null
  errorMessage: string | null
  createdBy: string | null
  createdAt: string | null
  finishedAt: string | null
}

/** 出价回执。probeEnabled 为 false 时那串数字不是「能花的钱」，notice 才是结论 */
export interface CitationEstimate {
  probeId: number
  callCount: number
  estimatedTokens: number
  remainingTokens: number
  probeEnabled: boolean
  notice: string | null
}

/** 可探的模型：清单只能来自库里的 ai_model_config 行，界面不许自己写「支持哪几家」 */
export interface CitationModelOption {
  id: number
  name: string
  provider: string
  modelName: string
  /** 后端已过滤成可对话模型；这一列留着是为了让界面能说清「为什么这个模型不在列表里」 */
  modelType: string | null
}

/** 题库一行。tenantId 为 null = 平台通用题 */
export interface CitationQuestion {
  id: number
  tenantId: number | null
  siteId: number | null
  /** 可以带 {{region}}/{{industry}}/{{brand}} 占位符，渲染时按站点画像替换 */
  questionText: string
  enabled: boolean | null
  sort: number | null
  /** seed = 建库带来的通用题；manual = 后来加的 */
  source: string | null
  createdAt: string | null
  updatedAt: string | null
}

/** 一次外呼：一次问答的完整账，包括失败的那次（失败也要看得见花了多少） */
export interface CitationCall {
  id: number
  probeId: number
  modelConfigId: number | null
  modelName: string | null
  provider: string | null
  questionId: number | null
  questionText: string | null
  brandMentioned: boolean | null
  citedCount: number | null
  success: boolean | null
  errorMessage: string | null
  promptTokens: number | null
  completionTokens: number | null
  callDurationMs: number | null
  createdAt: string | null
}

/** 一条命中：哪个对象、靠哪种强度、匹配到的字面串是什么 */
export interface CitationHit {
  id: number
  probeId: number
  callId: number | null
  targetType: string
  targetId: number | null
  targetLabel: string | null
  targetUrl: string | null
  /** 强度英文标识；中文说法在 vocabulary 的 matchKinds 里，界面不许自己翻译 */
  matchKind: string
  matchedText: string | null
  probedAt: string | null
}

export interface CitationProbeView {
  probe: CitationProbe
  calls: CitationCall[]
  hits: CitationHit[]
}

/** 一屏概览。citedTargets/totalTargets 是同一轮的分母，探得越少比率越不可信，所以两个都给 */
export interface CitationSummary {
  siteId: number
  siteName: string | null
  probeCount: number
  callCount: number
  citedCallCount: number
  distinctModels: number
  citedTargets: number
  totalTargets: number
  /**
   * 这一轮的判定真的覆盖到几个对象（轮次跑完时它已经对外可见才算被覆盖）。
   *
   * totalTargets 是「现在有多少个对外对象」，coveredTargets 是「这里头有几个真的被问过」，
   * 两者的差就是「新发了内容、还没进过任何一轮探测」。少了这一列，界面就没法把
   * 「查过，没提到」和「压根没查过」摆在同一句话里说清。
   */
  coveredTargets: number
  citedPageCount: number
  citedArticleCount: number
  citedCaseCount: number
  lastProbedAt: string | null
  lastProbeStatus: string | null
  /** 最近一轮的中文说明（比如「AI 开关没开，这一轮一条都没问」），界面原样显示 */
  lastProbeNotice: string | null
}

/** 问题三裁决要的那张表：每个页面、每篇文章各有几条引用。没被引用过 citeCount=0，行照样在 */
export interface CitationTargetStat {
  targetType: string
  targetId: number | null
  label: string | null
  url: string | null
  citeCount: number
  probeCount: number
  lastMatchKind: string | null
  lastMatchLabel: string | null
  lastProbedAt: string | null
}

/** 证据：可以指着某段字面串说「模型就是说了这几个字」，这是判定能被复核的唯一前提 */
export interface CitationEvidence {
  hitId: number
  probedAt: string | null
  provider: string | null
  modelName: string | null
  questionText: string | null
  matchKind: string
  matchLabel: string | null
  matchedText: string | null
  /** 回答里命中处的前后文片段 */
  snippet: string | null
}

/** 流量来源（问题七）：一个桶 = 一类入口，topDomains 是该桶下最具体的几个来路域名 */
export interface TrafficBucket {
  key: string
  /** 后端给的中文桶名 */
  label: string
  views: number
  visitors: number
  topDomains: string[]
}

export interface TrafficSourceResult {
  tenantId: number
  siteId: number | null
  from: string
  to: string
  totalViews: number
  buckets: TrafficBucket[]
  empty: boolean
  notice: string | null
}

export interface CitationCreateForm {
  siteId: number
  /** 空 = 「当前所有可用模型」，服务端按 max-models 截断，所以这里不写默认值 */
  modelIds?: number[]
}

/**
 * 中文词表：状态 / 对象类型 / 命中强度 / 流量来源桶名。
 *
 * 两侧接口给的是同一份内容（`/admin/portal/citation-probes/labels` 与 `/portal/citations/labels`），
 * 只是权限门不同。界面显示任何英文 key 之前先来这里查，查不到就把原 key 显示出来——
 * 编一个中文说法比显示英文更容易骗人。
 */
export interface CitationVocabulary {
  statuses: Record<string, string>
  targetTypes: Record<string, string>
  matchKinds: Record<string, string>
  trafficBuckets: Record<string, string>
}

export interface CitationRangeParams {
  siteId?: number | null
  from?: string
  to?: string
}

/**
 * 探测任务的超时。
 *
 * run 本身是「状态落库 + 丢线程池」，很快；但 estimate 与 view 都要读快照，
 * 沿用默认 30s 足够，唯一要放宽的是 view——一轮可能几十次调用 × 每条一段 MEDIUMTEXT 的回答，
 * 后端已经把 answer_text 从列表查询里剔掉了，所以这里不需要特殊超时。
 */
export const CITATION_RUN_TIMEOUT = AI_REQUEST_TIMEOUT

export const citationApi = {
  // ---------------- 超管侧：发起与题库 ----------------

  /** 中文词表（超管侧）。租户侧的 labels() 内容是同一份，只是门不同 */
  adminLabels: () => http.get<CitationVocabulary>('/admin/portal/citation-probes/labels'),

  /** 状态词表：这一发只给 status→中文，供只要状态的旧调用方用 */
  statusLabels: () => http.get<Record<string, string>>('/admin/portal/citation-probes/statuses'),

  models: (siteId?: number | null) =>
    http.get<CitationModelOption[]>('/admin/portal/citation-probes/models', { params: { siteId } }),

  list: (siteId?: number | null, limit = 30) =>
    http.get<CitationProbe[]>('/admin/portal/citation-probes', { params: { siteId, limit } }),

  /** 只建任务：把这一轮要问几个模型、几道题、参与判定的对象数拍成快照，一次模型都不调 */
  create: (form: CitationCreateForm) => http.post<CitationProbe>('/admin/portal/citation-probes', form),

  /** 只算不调：打完这一发之后 ai_call_log 不该多一行 */
  estimate: (id: number) => http.post<CitationEstimate>(`/admin/portal/citation-probes/${id}/estimate`),

  /**
   * 起跑。confirm 必须是用户勾过的那个值：false 会被后端 CITATION_CONFIRM_REQUIRED 打回，
   * 探测开关关着会被 CITATION_DISABLED 打回，所以这里不许有「默认 true」的写法。
   */
  run: (id: number, confirm: boolean) =>
    http.post<CitationProbe>(`/admin/portal/citation-probes/${id}/run`, { confirm }, {
      timeout: CITATION_RUN_TIMEOUT
    }),

  view: (id: number) => http.get<CitationProbeView>(`/admin/portal/citation-probes/${id}`),

  questions: (tenantId?: number | null) =>
    http.get<CitationQuestion[]>('/admin/portal/citation-probes/questions', { params: { tenantId } }),

  saveQuestion: (form: { tenantId?: number | null; questionText: string; sort?: number | null }) =>
    http.post<CitationQuestion>('/admin/portal/citation-probes/questions', form),

  toggleQuestion: (id: number, enabled: boolean) =>
    http.post<CitationQuestion>(`/admin/portal/citation-probes/questions/${id}/toggle`, null, {
      params: { enabled }
    }),

  // ---------------- 租户侧：只读，回答「我被引用了几次、人从哪来」 ----------------

  /** 中文词表（租户侧）：内容与 adminLabels() 同一份生产代码，只是权限门不同 */
  labels: () => http.get<CitationVocabulary>('/portal/citations/labels'),

  summary: (params: CitationRangeParams) =>
    http.get<CitationSummary>('/portal/citations/summary', { params }),

  /** targetType 传 page / article / case / site；不传给全部（词表在后端 CitationTargetTypes） */
  targets: (params: CitationRangeParams & { targetType?: string; limit?: number }) =>
    http.get<CitationTargetStat[]>('/portal/citations/targets', { params }),

  /** 某一条引用的证据：targetType + targetId 定位到页或文章 */
  evidence: (params: { siteId?: number | null; targetType: string; targetId?: number | null; limit?: number }) =>
    http.get<CitationEvidence[]>('/portal/citations/evidence', { params }),

  trafficSources: (params: CitationRangeParams) =>
    http.get<TrafficSourceResult>('/portal/citations/traffic-sources', { params })
}

/**
 * 已落定的任务状态（后端原始 key，不是中文词表）。
 *
 * 只回答「还能不能再点起跑」：done / needs_human / failed 都是终态，重探要新建任务——
 * 一笔账按 probeId 记，复用旧 id 会把两轮的调用数记成一轮。
 */
export const CITATION_SETTLED = ['done', 'needs_human', 'failed']

export function citationIsSettled(status: string | null | undefined): boolean {
  return !!status && CITATION_SETTLED.includes(status)
}

/**
 * 实际烧掉的 token。一次都没跑时返回 null 而不是 0——
 * 「还没花钱」和「花了 0 个 token」在界面上要分得开，后者会让人以为门禁把调用吞了。
 */
export function citationTokensUsed(
  probe: { promptTokens?: number | null; completionTokens?: number | null }
): number | null {
  if (probe.promptTokens === null || probe.promptTokens === undefined) return null
  return probe.promptTokens + (probe.completionTokens || 0)
}

/** modelIds 是后端存的 JSON 串，界面只用来列「这一轮问了哪几个 id」，解析失败就原样给一行 */
export function citationModelIds(probe: Pick<CitationProbe, 'modelIds'>): string[] {
  const raw = (probe.modelIds || '').trim()
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed.map((item) => String(item))
  } catch (e) {
    // 历史行可能存的是逗号分隔，不炸界面
  }
  return raw.replace(/[\[\]"]/g, '').split(',').map((item) => item.trim()).filter(Boolean)
}
