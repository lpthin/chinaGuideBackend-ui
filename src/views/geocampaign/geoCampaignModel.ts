/**
 * GEO 诊断的纯显示判据（Spec-F §11.3 P2）。
 *
 * `<script setup>` 里不许有 ES 值导出（与 geoBrandWizard.ts 同一条纪律），所以这些函数单独成文件，
 * 视图与用例认的是同一份。这里只放「怎么把接口给的数说成人话」，不放任何指标口径句子——
 * 分母口径那一句跟着数据走（每行自带 `definition`），页面再抄一份就是下一次对不上的来源（§9.2）。
 */
import { geoRunIsInFlight, type GeoEstimate, type GeoRun } from '../../api/geoCampaign'
import { formatPercent } from '../../utils/format'
import { PH_DASH, PH_NOT_MEASURED } from '../../utils/display'

/** 向导第 ⑤ 步的下标（平台与预算 = 预估与确认） */
export const PLATFORM_STEP_INDEX = 4

/** §10-2 ⑤：3 个平台是建议值，不是硬闸——只有一两家可选时也必须能跑 */
export const SUGGESTED_PLATFORM_MIN = 3

/** 每题重复次数：后端 clampRepeat 允许 1~10，默认 3 是 §5 置信区间的最低要求 */
export const REPEAT_MIN = 1
export const REPEAT_MAX = 10

/** 率：接口给的是 0~1 的四位小数，null = 分母为 0（没测过），显示成「未取到」而不是 0%（§9.6） */
export function formatRate(value: number | string | null | undefined): string {
  const n = toNumber(value)
  return n === null ? PH_NOT_MEASURED : formatPercent(n)
}

/** Wilson 区间显示成「12.3%–45.7%」；缺任一端就是没算过，界面上不许凭空出现 ±（§5 置信行） */
export function formatInterval(low: number | string | null | undefined, high: number | string | null | undefined): string | null {
  const l = toNumber(low)
  const h = toNumber(high)
  if (l === null || h === null) return null
  return `${formatPercent(l)}–${formatPercent(h)}`
}

function toNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

/** 预估那三行（§10-3）：次数 / token / 耗时，一个数都不自己乘出来——乘积是后端算的 */
export function estimateLines(estimate: GeoEstimate): Array<{ label: string; value: string; note: string }> {
  return [
    {
      label: '调用次数',
      value: `${estimate.callCount} 次`,
      note: `${estimate.questionCount} 题 × ${estimate.platformCount} 个平台 × 每题重复 ${estimate.repeatTimes} 次`,
    },
    {
      label: '预计 token',
      value: `${estimate.estimatedTokens}`,
      note: '按题面长度与单次输出上限估的，实际以这一轮真跑的数为准',
    },
    {
      label: '预计耗时',
      value: `约 ${estimate.estimatedMinutes} 分钟`,
      note: '排队与网络都在里面，跑的过程中界面每 5 秒回读一次进度',
    },
  ]
}

/**
 * 这一笔钱记在谁账上（跟 `tenantBearsCost` 走，与 V142 那条交付态闸同一份判据）。
 * 未交付租户念「平台承担」，已交付念「计入本租户额度」——念错方向等于让客户以为在花钱或以为不花钱。
 */
export function billingLine(estimate: GeoEstimate): string {
  return estimate.tenantBearsCost
    ? `这一轮的消耗计入本租户额度，本月剩余 ${estimate.remainingTokens} token。`
    : '这一轮由平台承担，不计入本租户的 token 额度（站还没交出去）。'
}

export interface RunGate {
  disabled: boolean
  /** 主按钮上的话：一眼看得出为什么按不动 */
  text: string
}

/**
 * 「开始诊断」按钮的状态（§6.2 两段式不可绕）：
 * 没看过预估 → 先去预估；这个计划已经有一轮在跑 → 等它跑完（#125 在飞闸）；
 * `notice` 非空 → 这一轮不会受理（按钮上不假装能跑）；没勾确认 → 先点头。
 * 顺序与后端 requestRun 的拒绝顺序一致（确认 → 在飞 → 成本闸），界面与闸说的是同一句话。
 */
export function runGate(input: {
  estimate: GeoEstimate | null
  confirmChecked: boolean
  starting: boolean
  /** 这个计划当前在飞的那一轮；非空 ⇒ 主按钮按不动，念的是「等它跑完」而不是「参数错误」 */
  liveRun?: GeoRun | null
}): RunGate {
  if (input.starting) return { disabled: true, text: '正在起跑' }
  if (!input.estimate) return { disabled: true, text: '请先看预估' }
  if (input.liveRun) return { disabled: true, text: '这一轮还在跑，先等它' }
  if (input.estimate.notice) return { disabled: true, text: '这一轮不会受理' }
  if (!input.confirmChecked) return { disabled: true, text: '请先勾选确认' }
  return { disabled: false, text: '确认并开始诊断' }
}

/**
 * 这个计划当前「真的在跑」的那一轮（#125）。
 *
 * 判据跟后端 `liveRunOf` 同一条：状态在飞 **且** 没有被判定为停着。`stalledReason` 非空的那一轮
 * 不算在飞——那条被重启带死的行如果一直挡着，这个计划就永久起不了第二轮，而唯一的出路是删计划重建。
 */
export function liveRunOf(runs: GeoRun[]): GeoRun | null {
  return runs.find((run) => geoRunIsInFlight(run.status) && !run.stalledReason) ?? null
}

/** 平台选得少于建议值时的提示：建议式，不拦（§10-2 ⑤） */
export function platformHint(picked: number, available: number): string | null {
  if (available === 0) {
    return '一个可选平台都没有：先去「大模型配置」启用一个聊天模型，这里才有卡片可勾。'
  }
  if (picked >= SUGGESTED_PLATFORM_MIN) return null
  return `建议至少勾 3 家（现在 ${picked} 家）：只问一家，报告上那一个数就是那一家模型的脾气，不是你在市场上的样子。少了也能跑，不拦你。`
}

/** 进度：后端写的是 floor 百分比，这里只补一个能落 0~100 的兜底 */
export function runPercent(run: GeoRun | null | undefined): number {
  const n = toNumber(run?.progress)
  if (n === null) return 0
  return Math.min(Math.max(Math.round(n), 0), 100)
}

/** 跑完之后的「没测到」三个出口（§9.6）：一个都不许省，只报率不报缺口就是把「我们没测」说成「没人提」 */
export function gapLines(input: {
  failedCallCount: number
  unmeasuredSubjects: string[]
  unmeasuredQuestions: string[]
}): Array<{ title: string; text: string }> {
  const lines: Array<{ title: string; text: string }> = []
  if (input.failedCallCount > 0) {
    lines.push({
      title: `${input.failedCallCount} 次未取到回答`,
      text: '这些次数不在任何率的分母里：它们要么超时要么报错。分母只算成功拿到的回答，抹掉它们等于把「模型没答」说成「没人提我们」。',
    })
  }
  if (input.unmeasuredSubjects.length) {
    lines.push({
      title: '判不了的对象',
      text: `这些品牌/站点短到门槛以下或落在通用词里，没法在回答里认出来：${input.unmeasuredSubjects.join('、')}。它们不进 SOV 分母，去品牌档案补词。`,
    })
  }
  if (input.unmeasuredQuestions.length) {
    lines.push({
      title: '判不了的题',
      text: `核心词短到门槛或落在通用词里，这道题在站内匹配出什么都不算数：${input.unmeasuredQuestions.join('、')}。要动的是题的核心词，不是内容。`,
    })
  }
  return lines
}

/** 「未测量」这一格在表里的显示：率没值时分子分母照样念得出来，才点得到分母（§11.3） */
export function fractionText(numerator: number | null | undefined, denominator: number | null | undefined): string {
  const n = toNumber(numerator) ?? 0
  const d = toNumber(denominator)
  if (d === null) return PH_DASH
  return `${n} / ${d}`
}

export interface CampaignDraft {
  name: string
  repeatTimes: number
  note: string
  platformIds: number[]
}

export const emptyCampaignDraft = (repeatTimes = 3): CampaignDraft => ({
  name: '',
  repeatTimes,
  note: '',
  platformIds: [],
})

/** 向导步状态进 `geo_campaign.wizard_state`：存 JSON 字符串，读回来坏了就当没有 */
export function wizardStateJson(state: { current: number; maxReached: number }): string {
  return JSON.stringify({ current: state.current, maxReached: state.maxReached })
}

export function parseWizardState(raw: string | null | undefined): { current: number; maxReached: number } | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<{ current: number; maxReached: number }>
    const current = Number(parsed.current)
    const maxReached = Number(parsed.maxReached)
    if (!Number.isInteger(current) || !Number.isInteger(maxReached) || current < 0) return null
    return { current, maxReached: Math.max(maxReached, current) }
  } catch {
    return null
  }
}

/** 计划列表那一行的摘要：没跑过的计划不许显示 0 轮（PH_NOT_RUN 与 PH_NOT_MEASURED 是两个意思） */
export function campaignRunSummary(campaign: { latestRun: GeoRun | null }): string {
  const run = campaign.latestRun
  if (!run) return '还没跑过一轮'
  const parts = [`第 ${run.id} 轮`, run.statusLabel || run.status]
  if (run.stageText) parts.push(run.stageText)
  return parts.join(' · ')
}
