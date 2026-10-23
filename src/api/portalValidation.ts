import http, { AI_REQUEST_TIMEOUT } from './http'
import type { HealthFinding, HealthType } from './portalHealth'

/**
 * 交付前自检（设计文档 §6 层 2）的管理端接口，落在巡检那一屏上。
 *
 * 三条与巡检接口一致的纪律：
 * 1. 结论、触发口径、级别、类型名的中文说法只认 `GET /portal/validation/options` 那一份，
 *    这一头不抄第二份名单——抄了就不跟着后端变；
 * 2. 这些口都没有请求体能伪造的租户号：站点归属由登录态推定，而 `siteId` 是**必填**
 *    （`SiteValidationController` 三条读口都先过 `requireTargetSite`：猜错一个站就是把结论
 *    记到别家账上，而那句结论要拦交付）；
 * 3. 界面不推进状态：`latest` 回 null 就是「没跑过」，绝不能演成「跑过了、0 条拦项」——
 *    谎报正是这一族要杀掉的东西。
 *
 * 最后那一支 `reask` 走的是 `/admin/sites/{id}/reask`（建站那一族），不是本文件的 `/portal/validation/*`：
 * 校验那一族的承诺是「一个页面都不写」，而这一支会真的改页、真的花 token，挂进去就等于把那句
 * 承诺说假。放在这里是因为**它和这几支是同一屏、同一个人点的**，界面不必为了一颗按钮再引第二个模块。
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

/**
 * `POST /admin/sites/{id}/reask` 的回执（与后端 `SiteProposalOrchestrator.ReaskResult` 逐字同名）。
 *
 * 这几格全是「本次动作的账」，不是状态：改了几处（`slotsAligned`，这一档一次模型都不调）、
 * 问了模型几轮（`roundsRun`，上界 2）、改之前几条拦项、改之后剩几条。
 * 过程那几句（`notices`）由后端原样给出，界面只念、不自己拼第二份文案。
 */
export interface ValidationReaskResult {
  blockersBefore: number
  slotsAligned: number
  roundsRun: number
  blockersAfter: number
  verdict: string | null
  runIdBefore: number | null
  runIdAfter: number | null
  notices: string[]
}

/**
 * 「交给模型重问」这一发的超时。
 *
 * 后端是同步跑完才回的：一个有拦项的页就问一次、最多两轮，每一问都是一发真模型调用，
 * 几十秒到几分钟都正常。用默认的 30s 会在后端还在花钱的时候先把连接掐掉——
 * 那时页面已经改了、token 已经扣了，界面上却只能报「请求超时」，那是最坏的一种假失败。
 * 取 AI_REQUEST_TIMEOUT 与 10 分钟里更大的那个（与组装那一发同一条口径）。
 */
export const VALIDATION_REASK_TIMEOUT = Math.max(AI_REQUEST_TIMEOUT, 600000)

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
    http.post<ValidationScanResult>('/portal/validation/scan', null, { params: { siteId } }),

  /**
   * 交给模型重问（2026-10-23 拍板「加一个只有超管能点的按钮」）：
   * 后端先查这一站的跨页拦项，能自己改齐的自己改齐（一次模型都不调），改不动的那些页逐页问模型、
   * 最多两轮，最后再查一遍并落账（触发口径 `manual_reask`）。
   *
   * 与上面那一支的分别是这一屏最容易念错的地方：`scan` 一个字都不改、一个模型都不调；
   * 这一支会真的改写页面（每一页都有版本历史可逐页退回去）、会真的花 token。
   * 所以它只在「上一次那一跑真有拦项」时才给按钮，界面上那句提醒也不许省。
   */
  reask: (siteId: number) =>
    http.post<ValidationReaskResult>(`/admin/sites/${siteId}/reask`, null, {
      timeout: VALIDATION_REASK_TIMEOUT
    })
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
