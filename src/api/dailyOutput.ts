import http from './http'

/** 产出之后怎么办：只有这两档，别的一个都不认（判据在后端 `TenantDailyOutputConfig`） */
export type DailyOutputPublishMode = 'review' | 'auto_publish'

/**
 * 「每天自动产出」的两口，对应后端 `DailyOutputController`（P9-B）。
 *
 * 这一页只有四项可填，而且一项都不许界面自己发明第五项：开关、每天几点、每天几篇、产出之后怎么办。
 * 判据（1~20、HH:mm、发布方式只有两档）全在后端 `DailyOutputService.saveConfig` 一处，
 * 界面上的 min/max 只是「别让人白点一次」的提前提示——存不存得下以接口返回为准，
 * 后端拒绝时回的那句中文原样念出来，不在前端抄第二份话术。
 *
 * 留痕那一口的 `skipReasonText` 也是后端发的：闸是哪一道、为什么今天没出字，
 * 数据库 / 站内信 / 界面三处念的是同一句话。前端不再按 `skipReason` 拼一份中文。
 */
export interface DailyOutputConfig {
  id: number | null
  tenantId: number
  /** 1 = 开，0 = 关。后端只存这两个数，别的形状它不认 */
  enabled: number
  /** HH:mm 24 小时制（后端会补齐「3:00 → 03:00」，因为起跑是按字符串相等比对的） */
  runTime: string
  dailyCount: number
  publishMode: DailyOutputPublishMode | string
  /** 最后一次改这行的人；系统开通时写的是 null，那一行不是谁改的 */
  updatedBy: number | null
  updatedAt: string | null
}

/** 一天的留痕。null 在这里全都有含义：`skipReason` 为 null 是「没有被闸拦」，不是「不知道」 */
export interface DailyOutputRun {
  runDate: string
  status: string
  planned: number | null
  produced: number | null
  autoPublished: number | null
  skipReason: string | null
  skipReasonText: string | null
  note: string | null
  updatedAt: string | null
}

export interface DailyOutputForm {
  enabled?: number
  runTime?: string
  dailyCount?: number
  publishMode?: string
}

export const dailyOutputApi = {
  /** 读这一家的配置（没配过时后端补一行「关着」的默认值，不会回 null） */
  config: (tenantId?: number) =>
    http.get<DailyOutputConfig>('/workspace/daily-output/config', { params: { tenantId } }),

  /** 只提交改过的那几项：后端对没带的字段一律不动 */
  save: (form: DailyOutputForm, tenantId?: number) =>
    http.put<DailyOutputConfig>('/workspace/daily-output/config', form, { params: { tenantId } }),

  /** 最近几天的留痕，默认 14 天 */
  runs: (tenantId?: number, limit = 14) =>
    http.get<DailyOutputRun[]>('/workspace/daily-output/runs', { params: { tenantId, limit } })
}
