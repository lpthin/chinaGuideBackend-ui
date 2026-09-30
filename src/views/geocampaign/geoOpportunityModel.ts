/**
 * 机会问题清单的纯显示判据（Spec-F §11.5 / §10-6，P4 前端）。
 *
 * 与 `geoCampaignModel.ts` 同一条纪律：`<script setup>` 里不许有 ES 值导出，所以视图与用例认的是
 * 这一份。这里只放「怎么把接口给的数说成人话」，<b>不放任何词表与判据句子</b>——缺口四档怎么说、
 * 四个动作各归哪条账、「未验证」那一句话，全部由后端跟着行发回来（§12：前端抄一份就是下一次
 * 对不上的来源）。
 *
 * 唯一在这里钉住的两个数都是从后端逐字搬来的镜像，各自都写了出处：
 * {@link DISMISS_REASON_MAX}（`GeoOpportunityService.dismiss` 的那一个 500）与
 * 「预估一次模型都不调」那一句（它决定界面上「先看价」这一发为什么可以是免费）。
 */
import type {
  GeoOpportunity,
  GeoOpportunityEstimate,
  GeoOpportunityList,
  GeoVocabulary,
} from '../../api/geoCampaign'
import { PH_DASH } from '../../utils/display'
import { UNMEASURABLE_WAY } from './geoCampaignModel'

/** 放弃理由的字符上限：逐字镜像 `GeoOpportunityService.dismiss` 里那一个 500，界面先拦住比拿一次 400 好 */
export const DISMISS_REASON_MAX = 500

/**
 * 一键成内容勾选框上那句话：花钱与写内容两件事必须一起说（§6.2 两段式同一条纪律）。
 *
 * 这里刻意不写「已发布」那三个字——它是 `GeoOpportunityStates.PUBLISHED` 的中文，词表改一次
 * 这一句就会跟着对不上（§12 词表单源）。要说的是「访客现在看不见」这一件事实。
 */
export const DRAFT_CONFIRM_TEXT =
  '我已看清这一发会真花钱：它按下面的 token 数扣账，并把产出的内容写进本站，'
  + '而产出的是草稿，访客要等内容自己走完发布才看得到'

/** 四个动作的键：顺序与取值都读后端词表（`opportunityActions` 是 LinkedHashMap，界面不列第二份） */
export function actionKeys(vocabulary: GeoVocabulary | null | undefined): string[] {
  return Object.keys(vocabulary?.opportunityActions ?? {})
}

export function actionLabel(
  vocabulary: GeoVocabulary | null | undefined,
  key: string | null | undefined,
  fallback?: string | null,
): string {
  if (!key) return PH_DASH
  return vocabulary?.opportunityActions?.[key] || fallback || key
}

export function actionDefinition(
  vocabulary: GeoVocabulary | null | undefined,
  key: string | null | undefined,
  fallback?: string | null,
): string {
  if (!key) return PH_DASH
  return vocabulary?.opportunityActionDefinitions?.[key] || fallback || PH_DASH
}

/** 状态中文名：行自带 `stateLabel` 时念行上的，词表只给「这一屏要显示别的状态」留兜底 */
export function stateLabel(
  vocabulary: GeoVocabulary | null | undefined,
  state: string | null | undefined,
  rowLabel?: string | null,
): string {
  if (!state) return PH_DASH
  return rowLabel || vocabulary?.opportunityStates?.[state] || state
}

/** 已经定论的那两格：不再给「放弃」入口（真正的闸在后端 `requireMove`，这里只是不摆假按钮） */
export function isSettledState(state: string | null | undefined): boolean {
  return state === 'PUBLISHED' || state === 'DISMISSED'
}

/**
 * 清单头部那一句账。
 *
 * 三个数分开说，因为它们是三件事：还差着的（要做事）、已达成的（闭环证据）、判不了的题
 * （要补核心词，不是要写内容）。合成一句「本轮结果」就把动作方向说反了（§9.6）。
 *
 * 「未统计」那一格是 null 而不是 0：P4 之前的老轮次压根没算过这个数。
 */
export function summarySentence(list: GeoOpportunityList): string {
  const unmeasured = list.unmeasuredQuestions === null || list.unmeasuredQuestions === undefined
    ? '判不了的题数未统计（这一轮早于 P4，没算过这个数）'
    : `另有 ${list.unmeasuredQuestions} 道题这一轮判不了`
  return `${list.opportunityCount} 条机会还差着 · ${list.resolvedCount} 条已达成 · ${unmeasured}`
}

/**
 * 这一份清单的<b>作用域</b>：机会行按【计划】跨轮存活，不是「本轮新增」。
 * 这一句必须摆在明面上——少了它，客户第二轮看到同一行会以为报告在糊弄他，
 * 而「上一轮补的内容这轮验证掉了」这条闭环证据恰恰只能靠跨轮存活来表达（§11.5 第一条）。
 */
export const SCOPE_NOTE =
  '这一份清单跟着【诊断计划】跨轮存活，不是本轮新增：上一轮产出的草稿这一轮还在同一行上，'
  + '下一轮诊断跑到这道题时会自动把它验证掉。'

/**
 * 「判不了」那一格的出路：与报告「没测到」那一卡**同一句话、同一个出处**（#152）。
 * 这里刻意不再抄一份——两处各写一遍，下一次就是一处说「补核心词」、另一处说「新建一道题」。
 */
export const UNMEASURED_NOTE =
  '判不了的题不是机会：它们没有可用核心词（没填、短到三个字以下、或落在通用标题词里），站内匹配出什么都不算数。'
  + UNMEASURABLE_WAY

/**
 * 预估面板那几行。
 *
 * 四个数全部取自接口，这里一次算术都不做（前端乘一次就是第二个真相来源，同 estimateLines）。
 * `accounting` 那一句是这一屏最要紧的一句话：四个动作里三个的账在别的流水线那边，
 * 不念出来，客户就会以为按一次动作要扣两次钱。
 */
export function estimateLines(estimate: GeoOpportunityEstimate): Array<{ label: string; value: string }> {
  return [
    { label: '模型调用', value: `${estimate.callCount} 次` },
    { label: '预计 token', value: `${estimate.estimatedTokens}` },
    { label: '这笔钱走哪条账', value: estimate.accounting || PH_DASH },
    { label: '账记在谁身上', value: billingLine(estimate) },
  ]
}

/** 跟诊断预估同一份判据（V142 交付态闸）：未交付租户念「平台承担」，念反方向等于骗人一次 */
export function billingLine(estimate: GeoOpportunityEstimate): string {
  return estimate.tenantBearsCost
    ? `计入本租户额度，本月剩余 ${estimate.remainingTokens} token。`
    : `由平台承担，不计入本租户额度（本月剩余那一格 ${estimate.remainingTokens} token 只是账上的数，不是你的上限）。`
}

/**
 * 「确认并生成」按钮的状态，顺序对着后端 `draft()`：先看价 → 价要对得上这个动作 → 闸 → 点头。
 *
 * 关键在 `estimatedAction !== selectedAction` 那一格：换过动作就必须重新预估一次。
 * 少了它，面板上会挂着「新建一页」的价、按钮按下跑的却是刚选上的「加一个案例」——
 * 那正是 §12「花钱端点要两段式确认」要防的形状：确认的是一个数，花的是另一个数。
 */
export interface DraftGate {
  disabled: boolean
  text: string
}

export function draftGate(input: {
  estimate: GeoOpportunityEstimate | null
  /** 当前面板上预估<b>那一次</b>针对的动作 */
  estimatedAction: string | null
  selectedAction: string | null
  confirmChecked: boolean
  submitting: boolean
}): DraftGate {
  if (input.submitting) return { disabled: true, text: '正在生成' }
  if (!input.selectedAction) return { disabled: true, text: '先选一个动作' }
  if (!input.estimate || input.estimatedAction !== input.selectedAction) {
    return { disabled: true, text: '请先看这个动作的预估' }
  }
  if (input.estimate.notice) return { disabled: true, text: '这一发不会受理' }
  if (!input.confirmChecked) return { disabled: true, text: '请先勾选确认' }
  return { disabled: false, text: '确认并生成草稿' }
}

/**
 * 预估旁边那句「按不动是因为什么」。
 *
 * 与诊断那一屏同一句判据：`notice` 非空就是「这一发不会受理」，界面上不许把它藏进 tooltip，
 * 也不许改写成「操作失败」——它是数据，不是异常。
 */
export function estimateNotice(estimate: GeoOpportunityEstimate | null): string | null {
  return estimate?.notice ?? null
}

/** 这一条现在挂在哪个产出对象上：`draftRef` 的前缀与 `actionType` 是同一处写的，所以念动作名不会错 */
export function draftRefText(row: GeoOpportunity): string {
  if (!row.draftRef) return PH_DASH
  return `${row.actionLabel || row.actionType || PH_DASH} · ${row.draftRef}`
}

/** 观测那一格：分子/分母 + 它属于哪一档的判据（判据句子是行自带的那一份） */
export function evidenceText(row: GeoOpportunity): string {
  if (row.evidenceDenominator === null || row.evidenceDenominator === undefined) return PH_DASH
  return `${row.evidenceNumerator ?? 0} / ${row.evidenceDenominator} 条回答引用到我们站`
}
