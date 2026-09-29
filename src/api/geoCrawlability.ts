import http from './http'

/**
 * 可抓取性体检的三个口（Spec-F §8、§10-7，P5 前端）。
 *
 * 形状逐字跟后端 `GeoCrawlabilityController` + `CrawlabilityAuditService.decorate`：
 * - 读挂 `seo:audit:view`（租户读得到自己那一轮），`run` 挂 `seo:audit:run`（V153 只授 SUPER_ADMIN）；
 * - 六项的名字、判据、取数句子、四种结论的口径全部来自 `vocabulary()` 与每一行自带的字段，
 *   TS 里不抄第二份中文（§5 单源：抄一份就是下一次「界面说旧话」的来源）；
 * - `verdict = NOT_MEASURED` 是一等公民：它带着「为什么测不到」那句话（`observedValue`），
 *   不是 0 分，也不是空。
 *
 * 没有 `?tenantId=` 这一参：租户只从登录上下文取（后端 `GeoCrawlabilityController:24-28` 写明了理由），
 * 前端传一个上来只会造成「读按 A、写按 B」的错位留痕。
 */

/** 六项体检的结论四档（值域唯一出处是后端 `CrawlabilityVocabulary`） */
export type CrawlabilityVerdict = 'PASS' | 'WARN' | 'FAIL' | 'NOT_MEASURED'

export interface CrawlabilityVocabulary {
  checks: string[]
  checkLabels: Record<string, string>
  checkGroups: Record<string, string>
  howMeasured: Record<string, string>
  passCriteria: Record<string, string>
  whyItMatters: Record<string, string>
  verdicts: Record<string, string>
  verdictDefinitions: Record<string, string>
  aiSearchUserAgents: string[]
  trainingUserAgents: string[]
}

export interface CrawlabilityItem {
  id: number | null
  siteId: number | null
  checkKey: string
  /** 中文名随行下发：读历史与刚跑完那六行走同一个装饰函数，界面只念这一份 */
  label: string | null
  groupCode: string | null
  verdict: CrawlabilityVerdict | string | null
  verdictLabel: string | null
  verdictDefinition: string | null
  observedValue: string | null
  /** 只有「按比例测」的那两项有值；null = 这一项不按分子分母测，不是测出来是 0 */
  numerator: number | null
  denominator: number | null
  measuredAt: string | null
  /** 证据：robots 的分组结构、真请求条数、sitemap 的 lastmod 分布……点开看的就是这一份 */
  detail: Record<string, unknown> | null
  howMeasured: string | null
  passCriterion: string | null
  whyItMatters: string | null
}

export interface CrawlabilitySnapshot {
  items: CrawlabilityItem[]
  /** 这一轮六行共同的时间戳；从没跑过时为 null */
  measuredAt: string | null
  siteId: number | null
  neverRun: boolean
}

export const geoCrawlabilityApi = {
  vocabulary: () => http.get<CrawlabilityVocabulary>('/geoseo/crawlability/vocabulary'),
  latest: () => http.get<CrawlabilitySnapshot>('/geoseo/crawlability/latest'),
  /** 跑一次：`siteId` 省略就取这一租户里对公众开着的那一套站（多站时优先配了域名的） */
  run: (siteId?: number | null) =>
    http.post<CrawlabilitySnapshot>('/geoseo/crawlability/run', null, {
      params: siteId == null ? undefined : { siteId },
    }),
}

export default {
  crawlability: geoCrawlabilityApi,
}
