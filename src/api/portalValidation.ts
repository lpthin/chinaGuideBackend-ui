import http from './http'
import type { HealthFinding, HealthType } from './portalHealth'

/**
 * 交付前自检（设计文档 §6 层 2）的管理端接口，落在巡检那一屏上。
 *
 * 三条与巡检接口一致的纪律：
 * 1. 结论、触发口径、级别、类型名的中文说法只认 `GET /portal/validation/options` 那一份，
 *    这一头不抄第二份名单——抄了就不跟着后端变；
 * 2. 四个口都没有请求体能伪造的租户号：站点归属由登录态推定，而 `siteId` 是**必填**
 *    （`SiteValidationController` 三条读口都先过 `requireTargetSite`：猜错一个站就是把结论
 *    记到别家账上，而那句结论要拦交付）；
 * 3. 界面不推进状态：`latest` 回 null 就是「没跑过」，绝不能演成「跑过了、0 条拦项」——
 *    谎报正是这一族要杀掉的东西。
 */

/** 结论三档，字面量与后端 `SiteValidationRun.VERDICT_*` 同名 */
export const VALIDATION_PASS = 'pass'
export const VALIDATION_BLOCKED = 'blocked'
export const VALIDATION_ERROR = 'error'

/** 一行 site_validation_run（V197 那张账表），界面只念后端给了的那几格 */
export interface ValidationRun {
  id: number
  tenantId: number | null
  siteId: number
  /** 这一跑属于哪一轮候选；站点不是候选轮次生出来的时候是 null */
  candidateId: number | null
  briefId: number | null
  /** 同一个站点第几跑，从 1 起：「第 2 轮比第 1 轮少几条」的唯一凭据 */
  round: number | null
  triggerSource: string | null
  checkerVersion: string | null
  /** 真读了几个页（读不动而跳过的不计） */
  pagesScanned: number | null
  /** 拦级条数：交付闸读的就是这一格 */
  blockerCount: number | null
  /** 提醒级条数：念得出来，但不拦交付 */
  warnCount: number | null
  verdict: string | null
  createdAt: string | null
  finishedAt: string | null
}

/** `GET /portal/validation/options`：三份词表 + 巡检那一族的类型（含 aiFixMode） */
export interface ValidationOptions {
  verdicts: Record<string, string>
  triggers: Record<string, string>
  levels: Record<string, string>
  types: Record<string, HealthType>
}

/** `POST /portal/validation/scan` 的回执：刚落账的那一行 + 本次合并后的 finding 行 */
export interface ValidationScanResult {
  run: ValidationRun
  findings: HealthFinding[]
}

export const portalValidationApi = {
  /** 最近一次跑的那一行；从没跑过回 null（界面上那一句必须念「还没跑过」） */
  latest: (siteId: number) =>
    http.get<ValidationRun | null>('/portal/validation/latest', { params: { siteId } }),

  /** 这个站的历史跑，倒序（后端默认 20 条） */
  runs: (siteId: number, limit?: number | null) =>
    http.get<ValidationRun[]>('/portal/validation/runs', {
      params: { siteId, limit: limit ?? undefined }
    }),

  /** 词表：结论、触发口径、级别，外加巡检那一条族的类型名单 */
  options: () => http.get<ValidationOptions>('/portal/validation/options'),

  /**
   * 人工重查一遍：只读页面与布局，不改任何内容，落一行 `trigger_source=manual` 的账。
   * siteId 走查询串、没有请求体（对着后端 `scan(@RequestParam Long siteId)` 那一行抄）。
   */
  scan: (siteId: number) =>
    http.post<ValidationScanResult>('/portal/validation/scan', null, { params: { siteId } })
}

/** 「这个站还没跑过自检」：`latest` 回 null 时唯一允许出现的那一句 */
export const VALIDATION_NOT_RUN_TEXT = '这个站还没跑过自检'

function roundPart(run: ValidationRun): string {
  return typeof run.round === 'number' ? `第 ${run.round} 跑` : '第几跑后端没随这一行带过来'
}

function pagesPart(run: ValidationRun): string {
  return typeof run.pagesScanned === 'number' ? `读了 ${run.pagesScanned} 页` : '读了几页后端没随这一行带过来'
}

/**
 * 上次自检那一句的拼法（界面与用例共用这一个出处）。
 *
 * 三档结论的句子逐字对着设计文档 §6 的口径：`pass` 才说「0 条拦项」，
 * `blocked` 说「修完才能交付」，`error` 说的是「没能看全」而不是「没查出问题」——
 * 后者的原话讲的就是这一档是诚实位，念成通过就是谎报。
 * 数字一个都不自己补：后端那一格是 null 就照实说没带过来，不含拦项数也不含页数。
 */
export function validationSummaryText(run: ValidationRun | null | undefined): string {
  if (!run) return VALIDATION_NOT_RUN_TEXT

  if (run.verdict === VALIDATION_PASS) {
    // 缺这一格时不替后端补一个 0：那正是「没数也念成 0 条」的谎报形状
    if (typeof run.blockerCount !== 'number') {
      return `上次自检：这一跑回的是通过，但拦项数没随这一行回来，所以这句不作数（${roundPart(run)}，${pagesPart(run)}）`
    }
    return `上次自检：通过，${pagesPart(run)}，${run.blockerCount} 条拦项（${roundPart(run)}）`
  }
  if (run.verdict === VALIDATION_BLOCKED) {
    if (typeof run.blockerCount !== 'number') {
      return `上次自检：这一套有拦项，修完才能交付，但拦了几条没随这一行回来（${roundPart(run)}，${pagesPart(run)}）`
    }
    return `上次自检：这一套有 ${run.blockerCount} 条拦项，修完才能交付（${roundPart(run)}，${pagesPart(run)}）`
  }
  if (run.verdict === VALIDATION_ERROR) {
    return `上次自检：有页面读不动，这一跑没能看全，不能算通过（${roundPart(run)}，${pagesPart(run)}）`
  }
  // 词表里没有的结论原样念码，不替后端编一句中文——编出来的那一句没人能核对
  return `上次自检：后端这一行回的结论是「${run.verdict ?? '（空的）'}」，这不在名单里（${roundPart(run)}，${pagesPart(run)}）`
}
