/**
 * 可抓取性体检页的纯显示判据（Spec-F §8 / §10-7 / §11.6，P5 前端）。
 *
 * 与 `geoOpportunityModel.ts`、`geoCampaignModel.ts` 同一条纪律：视图与用例认这一份，
 * `<script setup>` 里不留可测逻辑。这里只放「怎么把接口给的六行说成人话」，
 * <b>不放任何判据句子与中文词表</b>——六项叫什么、凭什么算通过、这一格为什么是红的，
 * 全部由后端随 `vocabulary()` 与每一行自带的字段发回来（§5 单源；抄一份就是下一次对不上的来源）。
 *
 * 三条界面级红线在本文件里是可测的：
 * 1. 六项恒按词表顺序各占一行，库里缺哪项就明写「未跑过」，<b>不静悄悄少一行</b>（§11.6）；
 * 2. `NOT_MEASURED` 与「测出来是 0」分得开：分子分母为 null 是「这一项不按比例测」，
 *    渲染成空白而不是 0/0（§9.6）；
 * 3. 六档结论不许压成一个总分：这里只给各档计数，界面上没有「体检得分」那一格。
 */
import type { CrawlabilityItem, CrawlabilitySnapshot, CrawlabilityVocabulary } from '../../api/geoCrawlability'
import { PH_DASH, PH_NOT_RUN } from '../../utils/display'

/**
 * 「跑一次」按钮旁边那句话。
 *
 * 只说这一发做得到的事实：它会现测、会各写一行留痕、旧行不删。刻意不提「花钱/不花钱」——
 * 那是后端 `CrawlabilityAuditService` 的实现约定，界面替它保证一次就等于将来赖账一次。
 */
export const RUN_HINT = '跑一次会现测这六项，并各写一行留痕；上一轮的那些行不删，重跑留痕靠追加'

/** 从没跑过时那一格的话：不许把空列表渲染成六盏灯，也不许在这里替客户跑一次 */
export const NEVER_RUN_TITLE = '这一租户还没有跑过体检：下面六项都没有留痕行'

export const NEVER_RUN_NEXT = '由平台侧点「跑一次」产这六行；读这一页不触发测量，所以也不会替你补上'

/** 一行的显示形态：真行，或词表里有、库里还没有的那一项 */
export type CrawlabilityRow =
  | { kind: 'item'; checkKey: string; label: string; item: CrawlabilityItem }
  | { kind: 'absent'; checkKey: string; label: string }

/**
 * 六行按词表顺序摊开，库里缺的项补成 absent 行。
 *
 * 顺序读 `vocabulary.checks` 而不是 items 自己的顺序：后端读历史时也是按词表排的，
 * 但词表到手之前（或有人往库里塞了第六项之外的键时）界面不能跟着漂。
 * items 里出现词表外的 checkKey 时原样追加在末尾——那是一条真观测，藏掉就是替库里说谎。
 */
export function displayRows(
  vocabulary: CrawlabilityVocabulary | null | undefined,
  snapshot: CrawlabilitySnapshot | null | undefined,
): CrawlabilityRow[] {
  const items = snapshot?.items ?? []
  const byKey = new Map<string, CrawlabilityItem>()
  for (const item of items) {
    // 同键多行只留第一行：latestRows 已经是「每项取自己最新那一行」，重复就是上游出了两个真相
    if (!byKey.has(item.checkKey)) {
      byKey.set(item.checkKey, item)
    }
  }
  const order = vocabulary?.checks?.length ? vocabulary.checks : items.map(item => item.checkKey)
  const rows: CrawlabilityRow[] = []
  for (const checkKey of order) {
    const item = byKey.get(checkKey)
    if (item) {
      rows.push({ kind: 'item', checkKey, label: labelOf(vocabulary, item), item })
      byKey.delete(checkKey)
    } else {
      rows.push({ kind: 'absent', checkKey, label: vocabulary?.checkLabels?.[checkKey] || checkKey })
    }
  }
  // 词表数不到的行也摆出来，否则库里那一行在界面上不存在
  for (const item of byKey.values()) {
    rows.push({ kind: 'item', checkKey: item.checkKey, label: labelOf(vocabulary, item), item })
  }
  return rows
}

/** 中文名优先念行上那一份（后端 decorate 随行走），词表只作兜底 */
function labelOf(vocabulary: CrawlabilityVocabulary | null | undefined, item: CrawlabilityItem): string {
  return item.label || vocabulary?.checkLabels?.[item.checkKey] || item.checkKey
}

/** 结论那一只标签的文案：行自带 verdictLabel 时念行上的，absent 行走「未跑过」这一档占位符 */
export function verdictLabelOf(
  vocabulary: CrawlabilityVocabulary | null | undefined,
  row: CrawlabilityRow,
): string {
  if (row.kind === 'absent') {
    return PH_NOT_RUN
  }
  return row.item.verdictLabel || vocabulary?.verdicts?.[String(row.item.verdict)] || row.item.verdict || PH_DASH
}

/** 结论那一只标签的状态码：absent 行没有状态，落进 StatusTag 的兜底而不是冒充 NOT_MEASURED */
export function verdictOf(row: CrawlabilityRow): string | null {
  return row.kind === 'absent' ? null : row.item.verdict
}

/**
 * 分子/分母那一串。
 *
 * `denominator == null` 返回 null：它说的是「这一项不按分子分母测」（robots 那两项就是这样），
 * 与「测出来分母是 0」是两件事，都渲染成 0/0 就是把前者说成了后者（§9.6）。
 */
export function fractionText(item: CrawlabilityItem | null | undefined): string | null {
  if (!item || item.denominator === null || item.denominator === undefined) {
    return null
  }
  return `${item.numerator ?? PH_DASH} / ${item.denominator}`
}

/** 为什么是这个灯：那一句因果来自留痕里的 detail.reason，界面不许自己编（SSR 那行念的就是服务端那句因果句） */
export function reasonText(item: CrawlabilityItem | null | undefined): string | null {
  const reason = item?.detail?.reason
  return typeof reason === 'string' && reason ? reason : null
}

/**
 * 证据：把 detail 里除 reason 之外的键摊成逐行读数。
 *
 * 值一律原样字符串化——robots 的分组结构、真请求条数、lastmod 分布都在里面。
 * 界面不挑键、不解释键名，因为解释一份就等于再抄一份判据；读不懂的那一行点开看后端那句 whatWasProbed。
 */
export function evidenceLines(item: CrawlabilityItem | null | undefined): Array<{ key: string; value: string }> {
  const detail = item?.detail
  if (!detail) {
    return []
  }
  return Object.entries(detail)
    .filter(([key]) => key !== 'reason')
    .map(([key, value]) => ({ key, value: stringifyEvidence(value) }))
}

function stringifyEvidence(value: unknown): string {
  if (value === null || value === undefined) {
    return PH_DASH
  }
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  try {
    return JSON.stringify(value)
  } catch {
    // 循环引用一类的怪值不该让整页崩：原样说一句读不出，比静悄悄少一行诚实
    return '（这一份证据读不出来，看留痕里的 detail_json）'
  }
}

/** 四档各有几行：分开数、分开摆，绝不加权（§5 禁令 1 —— 合并成一条数那一步没人做） */
export function verdictCounts(rows: CrawlabilityRow[]): Record<string, number> {
  const counts: Record<string, number> = { PASS: 0, WARN: 0, FAIL: 0, NOT_MEASURED: 0, ABSENT: 0 }
  for (const row of rows) {
    const verdict = verdictOf(row)
    if (verdict === null) {
      counts.ABSENT += 1
      continue
    }
    counts[verdict] = (counts[verdict] ?? 0) + 1
  }
  return counts
}

/**
 * 头部那一句账：这一轮是什么时候测的、测的是哪一套站。
 *
 * `siteId` 为 null 时说的是「这一租户今天没有对公众开着的站点」，各行为什么测不到写在行上，
 * 这里不替它们总结成一句失败。
 */
export function headline(snapshot: CrawlabilitySnapshot): string {
  const measuredAt = snapshot.measuredAt ? `最近一轮测于 ${snapshot.measuredAt}` : '最近一轮没有时间戳'
  return snapshot.siteId === null || snapshot.siteId === undefined
    ? `${measuredAt}；这一租户没有对公众开着的站点，能测的项各测各的`
    : `${measuredAt}；站点 #${snapshot.siteId}`
}

/** 那一格的颜色与「凭什么」是一对：判据句子在跑之前也要读得到，所以 absent 行回落词表 */
export function howMeasuredOf(
  vocabulary: CrawlabilityVocabulary | null | undefined,
  row: CrawlabilityRow,
): string | null {
  if (row.kind === 'item' && row.item.howMeasured) {
    return row.item.howMeasured
  }
  return vocabulary?.howMeasured?.[row.checkKey] || null
}

export function passCriterionOf(
  vocabulary: CrawlabilityVocabulary | null | undefined,
  row: CrawlabilityRow,
): string | null {
  if (row.kind === 'item' && row.item.passCriterion) {
    return row.item.passCriterion
  }
  return vocabulary?.passCriteria?.[row.checkKey] || null
}

export function whyItMattersOf(
  vocabulary: CrawlabilityVocabulary | null | undefined,
  row: CrawlabilityRow,
): string | null {
  if (row.kind === 'item' && row.item.whyItMatters) {
    return row.item.whyItMatters
  }
  return vocabulary?.whyItMatters?.[row.checkKey] || null
}

/** 结论这一档本身怎么说（PASS/WARN/FAIL/NOT_MEASURED 四句口径），行上没有就回落词表 */
export function verdictDefinitionOf(
  vocabulary: CrawlabilityVocabulary | null | undefined,
  row: CrawlabilityRow,
): string | null {
  if (row.kind === 'item' && row.item.verdictDefinition) {
    return row.item.verdictDefinition
  }
  const verdict = verdictOf(row)
  return verdict ? vocabulary?.verdictDefinitions?.[verdict] || null : null
}
