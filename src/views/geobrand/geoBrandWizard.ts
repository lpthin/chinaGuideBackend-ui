/**
 * GEO 品牌诊断向导的纯逻辑（独立文件：`<script setup>` 里不许有 ES 值导出，见 wizardModel.ts 同一纪律）。
 *
 * 这里放三样东西，视图与用例认的都是这一份：
 * 1. 五步定义（§10-2 的 ①~⑤：第 ⑤ 步是平台与预算，P2 起接上预估与确认）；
 * 2. 两类题的判据与警告文案（与后端的拒绝理由是同一句话，不许两边各写一份）；
 * 3. 步骤状态的 localStorage 落盘/回读（本机那一份优先）；P2 起第⑤步存计划时把同一份
 *    写进 `geo_campaign.wizard_state`，换浏览器时用它兜底（§10-2「落库」那一半）。
 */
import { createWizardState, type WizardState, type WizardStepDef } from '../../components/wizardModel'
import type { GeoBrandProfileForm, GeoQuestionDraft, GeoQuestionKind } from '../../api/geoBrand'

export const GEO_WIZARD_STEPS: WizardStepDef[] = [
  { key: 'brand', title: '品牌设置' },
  { key: 'competitors', title: '同类竞品' },
  { key: 'mention', title: '可见度问题' },
  { key: 'reputation', title: '口碑问题' },
  { key: 'platform', title: '平台与预算' },
]

/** 两类题的标题（§11-1：一个词只指一个东西，可见度/口碑不混叫） */
export const QUESTION_KIND_LABEL: Record<GeoQuestionKind, string> = {
  MENTION: '可见度问题',
  REPUTATION: '口碑问题',
}

/**
 * 判据文案（§10-2 ③④ 的红字警告）。
 * 两句是后端 `GeoQuestionKinds.MENTION_RULE_MESSAGE` / `REPUTATION_RULE_MESSAGE` 的逐字镜像——
 * 同一条红线在服务端拒绝时念的也是这一句，界面换个说法就是两份真相（§9.7 文案冻结）。
 */
export const MENTION_QUESTION_WARNING = '可见度问题的题面不能出现品牌名：这样几乎一定会被提到，看不出与同行差距'
export const REPUTATION_QUESTION_WARNING = '口碑问题的题面必须出现品牌名，否则测不出别人怎么评价我们'

/** 品牌词三段式说明（§2 步骤① 的本地文案，不抄第三方界面原话） */
export const BRAND_WORDS_GUIDE: string[] = [
  '先让系统知道你是谁：诊断拿这些词去 AI 的回答里找你。',
  '品牌词只影响「谁被算作品牌」，不影响问什么问题。',
  '填写建议：加简称、英文名/拼音、常见错写；只填品牌自己的词，不要加行业通用词——行业词会让「提及率」变成谁都被提到。',
]

/** 参与判定的品牌令牌：品牌名 + 品牌词，忽略大小写 */
export function brandTokens(form: { brandName?: string; brandWords?: string[] } | null | undefined): string[] {
  if (!form) return []
  return [form.brandName || '', ...(form.brandWords || [])]
    .map((token) => token.trim())
    .filter(Boolean)
}

function containsToken(text: string, tokens: string[]): boolean {
  const lower = text.toLowerCase()
  return tokens.some((token) => lower.includes(token.toLowerCase()))
}

/**
 * 单题判据（与后端拒绝条件同一条）：
 * - MENTION：题面出现品牌名/品牌词 ⇒ 拦；
 * - REPUTATION：题面没出现品牌名 ⇒ 拦。
 * 返回 null = 合格。
 */
export function questionViolation(kind: GeoQuestionKind, questionText: string, tokens: string[]): string | null {
  const text = questionText.trim()
  if (!text) return null
  if (kind === 'MENTION' && containsToken(text, tokens)) return MENTION_QUESTION_WARNING
  if (kind === 'REPUTATION' && !containsToken(text, tokens)) return REPUTATION_QUESTION_WARNING
  return null
}

/**
 * 自动发现回执的那句话（§0.4 Q13：上限要看得见、要说明在哪改）。
 * 三种情形分开说，不许拼成「发现 0 个，纳入 0 个，另外 0 个未纳入」这种既正确又没用的话（§9.6）：
 * - 一个都没发现：今天几乎所有租户都在这里（引用探测还没命中过共现品牌），要说清为什么是 0；
 * - 发现但没截断：只报数，不提上限；
 * - 发现且被上限截断：把 skipped 与 limit 原样念出来，并说明上限归平台配置管。
 */
export function autoDiscoverSummary(result: {
  discovered: number
  kept: number
  limit: number
  skipped: number
}): string {
  if (result.discovered === 0) {
    return '本轮没有发现可对比的共现品牌：引用探测还没跑出过命中别家的回答，先去跑一轮探测再回来点这个按钮。'
  }
  const head = `本轮发现 ${result.discovered} 个，纳入 ${result.kept} 个。`
  return result.skipped > 0
    ? `${head}另外 ${result.skipped} 个未纳入，纳入上限 ${result.limit} 可在平台配置里改。`
    : head
}

export interface WizardAdvanceInput {
  /** 正要离开的步（0 起） */
  from: number
  brandName: string
  mentionDraft: GeoQuestionDraft
  reputationDraft: GeoQuestionDraft
  tokens: string[]
}

/**
 * 「下一步」能不能走（WizardSteps 的 beforeNext 用）：
 * ① 品牌名必填；③④ 题面有未通过判据的草稿就拦在原地，并把警告原文递回去。
 * 返回 true = 放行，返回字符串 = 拦下并念出原因。
 */
export function validateStepAdvance(input: WizardAdvanceInput): string | true {
  if (input.from === 0) {
    if (!input.brandName.trim()) return '请填写品牌名'
    return true
  }
  if (input.from === 2) {
    return questionViolation('MENTION', input.mentionDraft.questionText, input.tokens) ?? true
  }
  if (input.from === 3) {
    return questionViolation('REPUTATION', input.reputationDraft.questionText, input.tokens) ?? true
  }
  return true
}

/** 步骤状态落 localStorage：命名空间键带档案 id，没有档案时用 draft 槽 */
const WIZARD_STORAGE_PREFIX = 'geobrand.wizard.'

export function wizardStorageKey(profileId: number | null | undefined): string {
  return `${WIZARD_STORAGE_PREFIX}${profileId ?? 'draft'}`
}

export function loadWizardState(
  profileId: number | null | undefined,
  fallback?: { current: number; maxReached: number } | null,
): WizardState {
  const fresh = createWizardState()
  try {
    const raw = localStorage.getItem(wizardStorageKey(profileId))
    if (!raw) {
      // 本机没走过这一步时，才认 `geo_campaign.wizard_state` 里那份（换电脑/换浏览器的续走）
      return fallback && fallback.current >= 0 ? { current: fallback.current, maxReached: Math.max(fallback.maxReached, fallback.current) } : fresh
    }
    const parsed = JSON.parse(raw) as Partial<WizardState>
    const current = Number(parsed.current)
    const maxReached = Number(parsed.maxReached)
    if (!Number.isInteger(current) || !Number.isInteger(maxReached)) return fresh
    if (current < 0 || current >= GEO_WIZARD_STEPS.length) return fresh
    return { current, maxReached: Math.max(maxReached, current) }
  } catch (e) {
    return fresh
  }
}

export function saveWizardState(profileId: number | null | undefined, state: WizardState): void {
  try {
    localStorage.setItem(wizardStorageKey(profileId), JSON.stringify({ current: state.current, maxReached: state.maxReached }))
  } catch (e) {
    // 隐私模式/配额满：步骤状态丢了不算业务数据丢失，不弹错
  }
}

export const emptyProfileForm = (): GeoBrandProfileForm => ({
  siteId: null,
  brandName: '',
  brandWords: [],
  officialUrls: [],
  brandIntro: '',
})

export const emptyQuestionDraft = (): GeoQuestionDraft => ({ coreWord: '', questionText: '' })
