import http from './http'
import { resolvePreviewUrl } from './siteBriefDelivery'
import {
  geoCampaignApi,
  type GeoAnswerTrace,
  type GeoJudgment,
  type GeoReport,
  type GeoRun,
  type GeoVocabulary,
} from './geoCampaign'

/**
 * 诊断报告的两种读法（Spec-G G6）。
 *
 * 这个文件存在的唯一理由是：<b>「登录态读这一轮」与「客户拿只读链接读这一轮」必须共用同一份形状</b>。
 * 报告页与溯源抽屉不该各自 if-else 一遍 URL——两份分支就是下一次「外链页少一列 / 抽屉点不开原文」
 * 的来源。岔口只在这里打一次，视图拿到的永远是同一个 `GeoReportAccess`。
 *
 * 三条跟后端对齐的口径：
 * 1. <b>公开 URL 上没有轮次号</b>：`/api/geo/public/{令牌}/report`，「这一条链接只开哪一轮」
 *    由令牌的作用域说（后端 `GeoReportPublicController` 的类注释同一条）。所以 `publicAccess`
 *    不收 runId，也<em>不许</em>把 runId 拼进参数里——拼了就是承认「换号能试」。
 * 2. <b>六个口子全是 GET</b>：这一页想提意见走的是后台的改版工单，公开面多一条写入口就是多一个攻击面。
 * 3. <b>失效输入收敛成同一句话</b>：无效/过期/撤销/脏作用域/门户预览令牌都回同一句 404
 *    （`链接无效或已过期`），界面原样念，不许在这里替它分成「过期了」与「不存在」两句话——
 *    一分就会把这条口变成有效令牌探测器。
 */

/** 链接顶栏那一格（后端 `LinkContext`）：只有轮次号与到期时刻，没有签发人，也没有令牌 */
export interface GeoReportLinkContext {
  runId: number
  expiresAt: string | null
}

/**
 * 访客侧的六个读口。
 *
 * `token` 走 `encodeURIComponent`：它是 64 位十六进制，本来不需要转义，但这一发是公网入口，
 * 手抄链接时带进来的空白与半个字符不该变成路径分段（那会被当成另一条链接）。
 */
export const geoPublicApi = (token: string) => {
  const base = `/geo/public/${encodeURIComponent(token.trim())}`
  return {
    report: () => http.get<GeoReport>(`${base}/report`),
    run: () => http.get<GeoRun>(`${base}/run`),
    judgments: () => http.get<GeoJudgment[]>(`${base}/judgments`),
    answer: (callId: number) => http.get<GeoAnswerTrace>(`${base}/answer/${callId}`),
    vocabulary: () => http.get<GeoVocabulary>(`${base}/vocabulary`),
    context: () => http.get<GeoReportLinkContext>(`${base}/context`),
  }
}

/**
 * 报告页与抽屉要的最低一套读动作。
 *
 * 刻意<em>不含</em>「重算 SOV」「判定这一轮」「一键成内容」：那三个都会写库（判定那一个还要一条一条
 * 送进模型），它们属于登录态那一侧。形状上没有那几个方法，界面就点不出那几个按钮——
 * 比「按钮摆着、按下去报 403」诚实，也比在模板里散落三个 `v-if="!token"` 可靠。
 */
export interface GeoReportAccess {
  readonly kind: 'authed' | 'public'
  report(): Promise<GeoReport>
  judgments(): Promise<GeoJudgment[]>
  answer(callId: number): Promise<GeoAnswerTrace>
  vocabulary(): Promise<GeoVocabulary>
}

export function authedReportAccess(runId: number): GeoReportAccess {
  return {
    kind: 'authed',
    report: () => geoCampaignApi.getReport(runId),
    judgments: () => geoCampaignApi.judgments(runId),
    answer: (callId) => geoCampaignApi.answer(callId),
    vocabulary: () => geoCampaignApi.vocabulary(),
  }
}

export function publicReportAccess(token: string): GeoReportAccess {
  const api = geoPublicApi(token)
  return {
    kind: 'public',
    report: api.report,
    judgments: api.judgments,
    answer: api.answer,
    vocabulary: api.vocabulary,
  }
}

/**
 * 这一屏的读法：给了令牌就走公开口，否则按轮次走登录态那一条。
 *
 * 两个都给时<em>令牌优先</em>：外链页是把同一份报告交给拿不到账号的人看的那一条路，
 * 而公开口读的是「令牌绑定的那一轮」，比界面传进来的轮次号更可信（后者可以是被改过的地址）。
 */
export function reportAccessOf(input: {
  runId?: number | string | null
  token?: string | null
}): GeoReportAccess | null {
  const token = (input.token ?? '').trim()
  if (token) return publicReportAccess(token)
  const runId = Number(input.runId)
  return Number.isFinite(runId) && runId > 0 ? authedReportAccess(runId) : null
}

/**
 * 把后端回的相对路径 `/geo-report/{token}` 拼成能点开的地址。
 *
 * 复用候选站预览那条链的同一份拼法（`resolvePreviewUrl`）：管理端 UI 与 API 同源部署时按当前
 * origin 拼，dev 下界面跑在 5190 也照这一条走。绝对地址原样透传——万一哪天把这一页挪到
 * 另一个域，改的是后端那一句，不是前端再抄一份规则。
 */
export function reportLinkUrl(path: string | null | undefined, origin?: string): string {
  return resolvePreviewUrl(path, origin)
}
