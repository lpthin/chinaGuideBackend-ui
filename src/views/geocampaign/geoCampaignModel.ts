/**
 * GEO 诊断的纯显示判据（Spec-F §11.3 P2）。
 *
 * `<script setup>` 里不许有 ES 值导出（与 geoBrandWizard.ts 同一条纪律），所以这些函数单独成文件，
 * 视图与用例认的是同一份。这里只放「怎么把接口给的数说成人话」，不放任何指标口径句子——
 * 分母口径那一句跟着数据走（每行自带 `definition`），页面再抄一份就是下一次对不上的来源（§9.2）。
 */
import {
  geoJudgeIsInFlight,
  geoRunIsInFlight,
  geoRunIsSettled,
  type GeoEstimate,
  type GeoMetricRow,
  type GeoRun,
} from '../../api/geoCampaign'
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

/**
 * 预估那几行（§10-3 + §11.4 两段式）：提问与判定<b>各归各的账</b>，所以各占自己的两行。
 *
 * 这里刻意不自己乘：`callCount / judgeCallCount / total*` 全是后端 `priceOf` 给的数，
 * 前端做一次乘法就是第二个真相来源。也把两段合成一行「预计 token 60000」——那正是
 * §11.4 反对的形状：判定第二段花多少钱必须看得见它是单独一笔，否则「我先只跑提问」
 * 就变成了替用户偷偷多点一次模型。
 */
export function estimateLines(estimate: GeoEstimate): Array<{ label: string; value: string; note: string }> {
  return [
    {
      label: '提问 · 调用次数',
      value: `${estimate.callCount} 次`,
      note: `${estimate.questionCount} 题 × ${estimate.platformCount} 个平台 × 每题重复 ${estimate.repeatTimes} 次`,
    },
    {
      label: '提问 · 预计 token',
      value: `${estimate.estimatedTokens}`,
      note: '按题面长度与单次输出上限估的，实际以这一轮真跑的数为准',
    },
    {
      label: '判定 · 调用次数',
      value: `${estimate.judgeCallCount} 次`,
      note: '一条成功回答送进模型一次，一次把本品牌与勾选竞品全判了；这一轮一条回答都没取到时它是 0',
    },
    {
      label: '判定 · 预计 token',
      value: `${estimate.judgeEstimatedTokens}`,
      note: '推荐位与情感三档要的是语义判定，不是后处理，所以它单独记一笔（AI_GEO_CAMPAIGN_JUDGE）',
    },
    {
      label: '两段合计',
      value: `${estimate.totalCallCount} 次 / ${estimate.totalEstimatedTokens} token`,
      note: '合计只是给你看总价；点「确认并开始诊断」只花提问那一段，判定要另外点头',
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

/** 那一块的小标题：中文只有这一份，视图不抄 */
export const UNMEASURABLE_TITLE = '跑完也拿不到覆盖率的那几道题'

/**
 * 那一块底下那句界面级的话。
 *
 * 只说一句界面做得到且必须说清的事：<b>它不改变受理</b>。判据本身（哪几道题、为什么、出路是什么）
 * 全在后端发回的那句里，这里不重复一遍——重复一份就是下一次对不上的来源。
 */
export const UNMEASURABLE_HINT =
  '这一句不拦住你：这一轮照样受理、按钮照样能点。它只是把「花出去的哪一段拿不到数」在花之前讲清楚。'

/**
 * 这一句要不要摆出来（#142）。
 *
 * 两个条件缺一不可：
 * 1. 后端真报了那一句话（一道题都判得了时它是 null，界面不许无事生非地警告）；
 * 2. 这一轮<b>会被受理</b>。`notice` 非空时按钮本来就按不动，再把「不拦住你」念一遍就是自相矛盾。
 */
export function unmeasurableNoticeOf(estimate: GeoEstimate | null | undefined): string | null {
  if (!estimate || estimate.notice) return null
  return estimate.unmeasurableNotice || null
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
 *
 * <p>{@code unmeasurableNotice}（#142）<b>刻意不在这里出现</b>：那一句话说的是「跑完有几道题拿不到覆盖率」，
 * 它不是拒绝受理的理由，也不该变成按钮状态。它由 {@link unmeasurableNoticeOf} 单独摆在预估表下面念出来，
 * 谁要是哪天把它接到闸上，「减题到全部题都判得了为止」就成了界面替客户做的决定。</p>
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
  // 排队那一轮说「还在跑」就是替它多报了一笔钱（#143）：它一次模型都没调
  if (input.liveRun) {
    return {
      disabled: true,
      text: input.liveRun.queuedReason ? '前面还有一轮在排队，先等它' : '这一轮还在跑，先等它',
    }
  }
  if (input.estimate.notice) return { disabled: true, text: '这一轮不会受理' }
  if (!input.confirmChecked) return { disabled: true, text: '请先勾选确认' }
  return { disabled: false, text: '确认并开始诊断' }
}

/**
 * 这个计划当前「真的在跑」的那一轮（#125）。
 *
 * 判据跟后端 `liveRunOf` 同一条：状态在飞 **且** 没有被判定为停着。`stalledReason` 非空的那一轮
 * 不算在飞——那条被重启带死的行如果一直挡着，这个计划就永久起不了第二轮，而唯一的出路是删计划重建。
 *
 * <p>{@code queuedReason} 非空的那一轮<b>算在飞</b>（#143）：它还排在队列里，线程一空出来就起跑，
 * 所以轮询不能停手，主按钮也不能说「这一轮没在跑」。这里判的是后端那两句哪个非空，
 * 前端绝不自己拿时钟猜「多久没进度」——那份判据有两份就会对不上。</p>
 */
export function liveRunOf(runs: GeoRun[]): GeoRun | null {
  return runs.find((run) => geoRunIsInFlight(run.status) && !run.stalledReason) ?? null
}

/** 提问那一段跑完了没有（判定只有在它跑完之后才有的东西可判） */
function askSettled(run: GeoRun): boolean {
  return geoRunIsSettled(run.status)
}

/**
 * 「判定这一轮」按钮的状态，顺序逐条对着后端 `requestJudge` 的拒绝顺序（§11.4）。
 *
 * 三条不能省的差别：
 * - `judgeState === 'DONE'` ⇒ 按不动并说「同一轮不原地重判」，因为覆盖掉上一版就没法按当时的判据解释了；
 * - `JUDGING` 且没有 `judgeStalledReason` ⇒ 还在判，重按就是两次判定抢同一批回答；
 * - `JUDGING` 但停着 ⇒ <b>放行</b>：重按只补缺的那几条（后端「只剔不删」），已判过的不重判、不重复扣钱。
 */
export function judgeGate(input: {
  run: GeoRun | null
  confirmChecked: boolean
  submitting: boolean
}): RunGate {
  const run = input.run
  if (input.submitting) return { disabled: true, text: '正在提交判定' }
  if (!run) return { disabled: true, text: '还没有可判定的轮次' }
  if (!askSettled(run)) return { disabled: true, text: '这一轮还在提问，先等它' }
  if (run.judgeState === 'DONE') return { disabled: true, text: '这一轮判过了' }
  if (geoJudgeIsInFlight(run.judgeState) && !run.judgeStalledReason) {
    // 判定派的也是那一个池（#143）：排队里的一条都还没判，说「正在判定」等于让人以为钱在花
    return { disabled: true, text: run.queuedReason ? '判定还在排队，先等它' : '正在判定，等它跑完' }
  }
  if ((run.callCount ?? 0) <= 0) return { disabled: true, text: '这一轮没有可判的回答' }
  if (!input.confirmChecked) return { disabled: true, text: '请先勾选确认' }
  return { disabled: false, text: '确认并判定这一轮' }
}

/**
 * 判定按钮旁边那一句实话：跟 `runGate` 的放行判据同源，所以「能按」与「怎么说」不会各说一套。
 * 停着的那一条要说清重按只补缺——那句出路是 #108 那条判据在这一屏的落点。
 */
export function judgeHint(run: GeoRun | null): string {
  if (!run) return '先看一轮跑完的账，再来判定。'
  if (!askSettled(run)) return '提问那一段还没跑完：判定要的是这一轮最终那批回答，半批判出来的推荐率没有分母可解释。'
  if (run.judgeState === 'DONE') {
    return `这一轮已经按提示词版本 ${run.judgePromptVersion || '（未记录）'} 判过 ${run.judgeCallCount ?? 0} 条。同一轮不原地重判：想换一套判据请新建一轮，两轮各留各的行。`
  }
  if (run.judgeState === 'JUDGING' && run.judgeStalledReason) {
    return `${run.judgeStalledReason} 重按这一发只补还缺的那几条，已经判过的不会重判，也不会重复扣钱。`
  }
  if (run.judgeState === 'JUDGING' && run.queuedReason) {
    // 排队里（#143）：出路是等，不是补按——两条判定任务抢同一批回答，后那一笔不在任何预估里
    return `${run.queuedReason}`
  }
  if (run.judgeState === 'FAILED') {
    return '上一回判定没跑成。修好模型配置或额度再按一次：这一次从头补判缺的那些，提问那一段一次都不会重跑。'
  }
  if ((run.callCount ?? 0) <= 0) return '这一轮库里一次成功的回答都没有，判定没有东西可判——先重跑提问那一段。'
  return '判定是第二段花钱的动作：一条成功回答送进模型一次，一次把本品牌与勾选竞品全判了。它不会重跑提问，也不会新增轮次。'
}

export interface SentimentSegment {
  key: string
  label: string
  numerator: number
  /** 0~100 的条宽：直接对着分母算，不是把三档自己归一化（归一化会把「判不了」抹平掉） */
  percent: number
}

export interface SentimentBar {
  segments: SentimentSegment[]
  denominator: number
  /** 三档之外的那一段 = 分母 - 三档分子之和，也就是「判不了、降级成未测量」的那些 */
  unmeasured: { count: number; percent: number } | null
  /** 三档加起来的百分比：不足 100 正是那句诚实话的数值形态 */
  measuredPercent: number
}

/**
 * 情感三档那一根条（§5 口径 + §11.4 第四条）。
 *
 * 行的顺序与档位名都照接口给的（后端按 {@code GeoSentiments.ordered()} 排），这里不再列一份词表。
 * 关键在 `unmeasured` 那一段：三档加起来不到 100% 时，界面上必须看得见「另有 N 条判不了」，
 * 否则就是把模型的判据缺口画成了一次成功观测。
 */
export function sentimentBar(rows: GeoMetricRow[]): SentimentBar | null {
  const tiers = rows.filter((row) => row.sentiment)
  if (!tiers.length) return null
  const denominator = toNumber(tiers[0]?.denominator) ?? 0
  const segments = tiers.map((row) => {
    const numerator = toNumber(row.numerator) ?? 0
    return {
      key: row.sentiment as string,
      label: row.sentimentLabel || (row.sentiment as string),
      numerator,
      percent: denominator > 0 ? roundTenth((numerator / denominator) * 100) : 0,
    }
  })
  const measured = segments.reduce((sum, segment) => sum + segment.numerator, 0)
  const rest = Math.max(denominator - measured, 0)
  return {
    segments,
    denominator,
    unmeasured: rest > 0 ? { count: rest, percent: roundTenth((rest / denominator) * 100) } : null,
    measuredPercent: denominator > 0 ? roundTenth((measured / denominator) * 100) : 0,
  }
}

function roundTenth(value: number): number {
  return Math.round(value * 10) / 10
}

/**
 * 「提及率」与「推荐率」是两个数，不是一个数的两半（§11.4 第三条）。
 * 这一句只在这里写一次，报告那一屏把它摆在两卡之间，界面别处不许把它们相加或合并成一格。
 * 档位名（那三档叫什么）一律念接口给的 label，这里不抄——抄一遍就归不了版本。
 */
export const MENTION_VS_RECOMMEND_NOTE =
  '「提及率」与「推荐率」各占一格、共用同一个分母（该平台成功拿到回答的总次数），所以这两个数永远不相加：'
  + '提到 12 次里有 4 次是被推荐的那一档，12 已经包含 4。'

/**
 * 这一行摆的是谁：本品牌还是哪一家竞品（§11.3「每行点得到分母」的同一条纪律的左半）。
 *
 * 真跑 run 6 的报告上，推荐率那六行的「平台」格全是同一个模型名——一家模型判本品牌加五家竞品，
 * 接口把 `scope` 与 `subject` 都给了出来，界面上不念出来就等于把它扔了：读的人分不出哪一行是自家。
 * 词只在这里列一次，推荐率与 SOV 两卡共用，别处再写一份「本品牌 / 竞品」就是下一次对不上的来源。
 */
export function metricObjectText(row: Pick<GeoMetricRow, 'scope' | 'subject'>): string {
  const subject = (row.subject ?? '').trim() || PH_DASH
  if (row.scope === 'BRAND') return `本品牌 · ${subject}`
  if (row.scope === 'COMPETITOR') return `竞品 · ${subject}`
  return `${(row.scope ?? '').trim() || '未知对象'} · ${subject}`
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

/**
 * 「判不了的题」出路那半句，唯一出处（报告那一卡与机会面板共用，#152）。
 *
 * 为什么它得点名平台通用题：判据在后端（`GeoCoverageJudge`），题面之所以判不了有三种——没填、
 * 短到三个字以下、落在「首页 / 关于我们」这类通用标题词里。而现场那一批（商用规模轮 run 5 的 12 道）
 * 全是**平台通用题**：`tenant_id IS NULL` 的行在题池里租户读得到、改不动（后端回「平台通用题只读」）。
 * 过去这一句只写「去补核心词」，客户点进题池撞上的就是一个灰掉的输入框——本轮花掉的钱连一条出路
 * 都没换来。所以出路要分两头写，一头是新建，一头是补。
 */
export const UNMEASURABLE_WAY =
  '要动的是题的核心词，不是内容：平台通用题（题面带 {{region}}、{{industry}} 这类占位符，由平台维护）'
  + '在题池里只读、改不动，请新建一道自己的题、把品牌名或竞品名填进「核心词」那一栏；'
  + '自己建的题直接在题池补核心词就行。'

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
      // #152：题面已经是后端按这一轮的站渲染过的那一句（不再是 {{region}} 原文），
      // 出路那半句要落在客户真点得动的地方——所以它点名了「平台通用题改不动」这一条。
      text: `这些题没有可用核心词，跑完也算不出覆盖率：${input.unmeasuredQuestions.join('、')}。${UNMEASURABLE_WAY}`,
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

export interface HighlightPart {
  text: string
  hit: boolean
}

/**
 * 把回答原文切成「高亮段 / 普通段」交替的序列（溯源抽屉用）。
 *
 * 这里刻意不用 v-html：回答文本是第三方模型产出的内容，拼进 HTML 就是把不可信内容当标记解析。
 * `needle` 是确定性匹配命中的那一段字（后端保证它在这段原文里，§11.4 的 containsVerbatim），
 * 所以匹配走大小写敏感的直连查找即可；找不到就整段返回，界面上不留「凭空亮起来的一块」。
 */
export function highlightParts(text: string | null | undefined, needle: string | null | undefined): HighlightPart[] {
  const body = text ?? ''
  const want = (needle ?? '').trim()
  if (!body) return []
  if (!want) return [{ text: body, hit: false }]
  const parts: HighlightPart[] = []
  let cursor = 0
  let found = body.indexOf(want)
  while (found >= 0) {
    if (found > cursor) parts.push({ text: body.slice(cursor, found), hit: false })
    parts.push({ text: want, hit: true })
    cursor = found + want.length
    found = body.indexOf(want, cursor)
  }
  if (cursor < body.length) parts.push({ text: body.slice(cursor), hit: false })
  return parts
}

/**
 * 档位 → 色块类名后缀（界面唯一的三处色值在 CSS 里）。
 * 认不出来的档位落 `other`：宁可画成中性灰，也不许借「正面/负面」那两色把没词表的值说成有态度。
 */
export function sentimentSegmentClass(key: string | null | undefined): string {
  if (key === 'POS') return 'pos'
  if (key === 'NEU') return 'neu'
  if (key === 'NEG') return 'neg'
  return 'other'
}

/** 这一轮判定那一段花掉的钱（报告头部念的那一行，两个 token 数各归各的账） */
export function judgeCostText(run: GeoRun): string {
  const judged = run.judgeCallCount ?? 0
  if (judged <= 0 && !run.judgeState) return '判定那一段一次都没跑过'
  const tokens = (run.judgePromptTokens ?? 0) + (run.judgeCompletionTokens ?? 0)
  return `判定 ${judged} 条 · ${tokens} token${run.judgePromptVersion ? ` · 提示词版本 ${run.judgePromptVersion}` : ''}`
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

/**
 * 计划列表那一行的摘要：没跑过的计划不许显示 0 轮（PH_NOT_RUN 与 PH_NOT_MEASURED 是两个意思）
 *
 * <p>排队那一轮要说「还在排队」（#143）：卡片上只有「诊断中 · 准备提问」时，读的人会以为
 * 已经在调模型了。这一句不新增状态词，它说的是后端 {@code queuedReason} 那一件事实的短版。</p>
 *
 * <p>G14（Spec-G P0 现场挖出）：跑完的那一轮会念成「第 10 轮 · 已完成 · 已完成」——
 * 后端的 {@code stageText} 在收尾时写的就是 {@code "已完成"}（GeoCampaignWorker:216），
 * 与状态标签撞成同一句。重复不是谎报，但客户截图上这一行看着像没写完的话，
 * 所以两处字面一样时只留一次；一旦 stageText 带出别的口径（「部分完成（判定那一段没跑成）」）
 * 它照旧要念出来，那种时候两个词说的是两件事。</p>
 */
export function campaignRunSummary(campaign: { latestRun: GeoRun | null }): string {
  const run = campaign.latestRun
  if (!run) return '还没跑过一轮'
  const status = run.statusLabel || run.status
  const parts = [`第 ${run.id} 轮`, status]
  if (run.queuedReason) parts.push('还在排队，没开始提问')
  if (run.stageText && run.stageText !== status) parts.push(run.stageText)
  return parts.join(' · ')
}
