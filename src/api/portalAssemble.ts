import http, { AI_REQUEST_TIMEOUT } from './http'
import type { PortalPage } from './portalPages'

/**
 * AI 整站组装（Spec §6.3，决策 N4：只有平台能发起）的管理端接口。
 *
 * 端点是按「钱在哪一步花掉」切开的，前端不许把它们合回一颗按钮：
 * `create` 只把当时的站点画像与骨架页面清单拍成快照存下来、一次模型都不调；
 * `estimate` 只算不调（验收点就是打完这一发之后 ai_call_log 不许多行）；
 * `run` 必须带超管看过预估之后亲手勾上的 confirm:true，且产出仍然只是逐页草稿；
 * 整条链里唯一让访客看到内容的是 `apply-page`，一页一次，没有批量入口。
 * 所以这个文件不提供「一键整站上线」那种方法——写不出一个不撒谎的批量口子。
 *
 * 状态的中文说法只有 `/admin/portal/assemble-jobs/statuses` 这一处来源：
 * 在 TS 里替 running 抄一个中文叫法，后端改词表时界面不会跟着变，
 * 而 `portal-assemble-api.spec.ts` 的源码扫描用例会红。
 */

/** 一行 portal_assemble_job：任务不是结果，结果在 detail() 的 drafts 里 */
export interface PortalAssembleJob {
  id: number
  /** 由后端从登录态推，前端不许往 body 里塞 tenantId */
  tenantId: number | null
  siteId: number
  /** 按哪套骨架组装：软引用，骨架后来退役也不影响本任务读自己的快照 */
  skeletonKey: string
  skeletonVersion: number | null
  /** 可空：给了就把这个参考站的摄取结果当作额外语料 */
  referenceSiteId: number | null
  /** 取值见 statusLabels()；只能由动作产生，界面不自己「推进状态」 */
  status: string
  /** 站点画像 + 栏目清单 + 逐页区块摘要（JSON 字符串），事后回答「当时模型看到了什么」 */
  inputJson: string | null
  /** 第一步的产物（JSON 字符串）：整站排布方案 */
  planJson: string | null
  /** 第二步的产物索引（JSON 字符串）；逐页的现在时状态要看 detail() 的 drafts，别读快照 */
  draftPagesJson: string | null
  estimatedTokens: number | null
  promptTokens: number | null
  completionTokens: number | null
  /** 失败或被拦下的中文原因，原样透出，不替后端编 */
  errorMessage: string | null
  createdBy: string | null
  createdAt: string | null
  updatedAt: string | null
}

/** 草稿表的一行（后端 PortalAssembleService.DraftRow）。null 与 false 在界面上的意思不一样，见 draftRowState */
export interface AssembleDraftRow {
  /** null = 这一页压根没被建出来（规划里的页面在站点上已经找不到了） */
  pageId: number | null
  /** null = 没有草稿可谈：与「有草稿但被门禁拒」是两件事，话术不能混 */
  draftId: number | null
  pageKey: string
  title: string | null
  /** true = 草稿留了档但不可应用（模型确实被调用了，钱花了，租户拿不到东西） */
  rejected: boolean
  /** 被拒的原因，后端原文 */
  error: string | null
  /** 素材来源/照抄嫌疑：过了门禁但必须让超管看见的提示，不许静悄悄落地 */
  warnings: string[]
  /** 只有点过「应用这一页」才为真——这是全链路唯一见客的动作留下的痕迹 */
  applied: boolean
}

/** 出价回执。aiEnabled 为 false 时那串数字不是「能花的钱」，notice 才是结论 */
export interface AssembleEstimate {
  jobId: number
  estimatedTokens: number
  remainingTokens: number
  aiEnabled: boolean
  /** 后端给的那句「当前未开启，确认也不会调用」原话，界面上不重写一遍 */
  notice: string | null
}

export interface AssembleCreateForm {
  siteId: number
  skeletonKey: string
  referenceSiteId?: number | null
}

/** 详情：job 是任务行快照，drafts 是逐页草稿的现在时（点完应用再刷新，这里要跟着变） */
export interface AssembleJobView {
  job: PortalAssembleJob
  drafts: AssembleDraftRow[]
}

/**
 * 草稿行的四种落点。界面对它们说不同的话，是因为「这一页没动过」和「这一页白烧了 token」
 * 是两种要交代的账：
 * - no-draft：压根没产出草稿（页面在站点上找不到、或整轮被拒），钱没花在这一页上；
 * - rejected：草稿在但门禁不让用，error 里是后端的中文原因；
 * - applied：已经由本任务应用过，访客能看到，也在 rollback-all 的射程里；
 * - applicable：唯一允许点「应用这一页」的状态。
 *
 * 返回的是英文标识，中文说法配在界面里；后端词表（status→中文）不在这儿，也不该在这儿。
 */
export type AssembleDraftState = 'no-draft' | 'rejected' | 'applied' | 'applicable'

export function draftRowState(
  row: Pick<AssembleDraftRow, 'draftId' | 'rejected' | 'applied'>
): AssembleDraftState {
  if (row.draftId === null) return 'no-draft'
  if (row.rejected) return 'rejected'
  if (row.applied) return 'applied'
  return 'applicable'
}

/**
 * 已落定的状态（后端的原始状态 key，不是中文词表；显示一律走 statusLabels()）。
 *
 * 只用来回答「还能不能再点组装」这一件事：组装是同步跑完的一步动作，
 * done / needs_human / failed 都是终态，重跑要新建任务——一笔账按 jobId 记，
 * 复用旧 id 会把两次的钱记成一笔（见后端 AssembleStatuses 的说明）。
 */
export const ASSEMBLE_SETTLED = ['done', 'needs_human', 'failed']

export function assembleIsSettled(status: string | null | undefined): boolean {
  return !!status && ASSEMBLE_SETTLED.includes(status)
}

/** 后端那两个 Integer 分量可能整个不出现（不保证序列化 null），按「可能没有」读 */
export interface AssembleTokenTally {
  promptTokens?: number | null
  completionTokens?: number | null
}

/**
 * 实际烧掉的 token：prompt + completion 两个分量相加。
 * 一次都没跑时返回 null 而不是 0——「还没花钱」和「花了 0 个 token」在界面上要分得开，
 * 后者会让人以为门禁把调用吞了。
 */
export function assembleTokensUsed(job: AssembleTokenTally): number | null {
  if (job.promptTokens === null || job.promptTokens === undefined) return null
  return job.promptTokens + (job.completionTokens || 0)
}

/**
 * 组装这一发的超时。
 *
 * run 是同步的：后端要在一次请求里逐页调模型（规划一步 + 每页文案一步），几分钟很正常。
 * 用默认的 30s、甚至用蒸馏那档 AI_REQUEST_TIMEOUT 都会在后端还在花钱的时候先把连接掐掉——
 * 那时配额已经扣了、草稿已经落了库，界面上却只能报「请求超时」，这是最坏的一种假失败。
 * 所以这一发单独放宽，取 AI_REQUEST_TIMEOUT 与 10 分钟里更大的那个。
 */
export const ASSEMBLE_RUN_TIMEOUT = Math.max(AI_REQUEST_TIMEOUT, 600000)

export const portalAssembleApi = {
  /** 状态词表：中文说法只有这一个来源，界面不许再抄一份 */
  statusLabels: () => http.get<Record<string, string>>('/admin/portal/assemble-jobs/statuses'),

  /** 一个站点的组装历史（倒序）：要回答的是「上次跑到哪一步了、这次和上次差在哪」 */
  list: (siteId: number) =>
    http.get<PortalAssembleJob[]>('/admin/portal/assemble-jobs', { params: { siteId } }),

  /** 建任务：只存快照、不调模型，所以这里没有任何 confirm 可言 */
  create: (form: AssembleCreateForm) => http.post<PortalAssembleJob>('/admin/portal/assemble-jobs', form),

  /** 只算不调：这一步之后 ai_call_log 不该出现新行（后端把 status 推到 estimating 并写下预估） */
  estimate: (id: number) => http.post<AssembleEstimate>(`/admin/portal/assemble-jobs/${id}/estimate`),

  /**
   * 跑两步。confirm 必须是用户勾过的那个值：false 会被后端 ASSEMBLE_CONFIRM_REQUIRED 打回，
   * 已经落定的任务再点一次会被 ASSEMBLE_ALREADY_DONE 打回——所以这里不许有「默认 true」的写法。
   */
  run: (id: number, confirm: boolean) =>
    http.post<PortalAssembleJob>(`/admin/portal/assemble-jobs/${id}/run`, { confirm }, {
      timeout: ASSEMBLE_RUN_TIMEOUT
    }),

  detail: (id: number) => http.get<AssembleJobView>(`/admin/portal/assemble-jobs/${id}`),

  /** 逐页应用，一次一页：整条链里唯一把内容推给访客的动作 */
  applyPage: (id: number, pageId: number) =>
    http.post<PortalPage>(`/admin/portal/assemble-jobs/${id}/apply-page`, { pageId }),

  /** 回滚只退回本任务应用过的那几页（别的改动不背这个锅），回执是回滚页数 */
  rollbackAll: (id: number) => http.post<number>(`/admin/portal/assemble-jobs/${id}/rollback-all`)
}
