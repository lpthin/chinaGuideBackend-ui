/**
 * 错误原文的短期台账（拍板 Q5-A：人话做标题、原文折叠可复制）。
 *
 * `describeHttpError` 只留下中文人话，`Network Error` / `HTTP 500` / 后端原始 JSON
 * 这些「能贴进工单」的材料在抛出去那一刻就丢了。这里按人话文案记最近一次原文，
 * 供 StateBlock / EmptyListHint 在错误块里折叠展示。
 *
 * 只记最近 60 条：它是排查材料，不是日志；页面刷新或重启进程后就没了也算正常。
 *
 * SPEC-UI-8 G2 起每条再带 `at`（发生时间）与 `page`（当时的页面路由），
 * 供诊断包按时间线导出；`rememberRawDetail / errorRawDetail` 的签名保持不变，页面零改动。
 */
const RAW_LIMIT = 60

interface RawRecord {
  rawText: string
  /** 记下这一刻的毫秒时间戳；导出诊断包时再格式化 */
  at: number
  /** 当时所在的页面路由（只取 pathname：查询串里可能带令牌，诊断包不收敏感材料） */
  page: string
}

/** 一条可导出的原文记录（诊断包按最近优先排列） */
export interface RawDetailEntry {
  humanText: string
  rawText: string
  /** ISO 时间串，直接进 JSON */
  at: string
  page: string
}

const rawDetails = new Map<string, RawRecord>()

function currentPagePath(): string {
  return typeof window !== 'undefined' ? window.location.pathname : ''
}

export function rememberRawDetail(humanText: string, rawText: string): void {
  if (!humanText || !rawText || humanText === rawText) return
  if (rawDetails.has(humanText)) rawDetails.delete(humanText)
  rawDetails.set(humanText, { rawText, at: Date.now(), page: currentPagePath() })
  if (rawDetails.size > RAW_LIMIT) {
    const oldest = rawDetails.keys().next().value
    if (oldest !== undefined) rawDetails.delete(oldest)
  }
}

/** 这一句人话背后有没有可展示的原文；没有就返回 null（错误块里不摆空壳） */
export function errorRawDetail(humanText: string | null | undefined): string | null {
  if (!humanText) return null
  return rawDetails.get(humanText)?.rawText ?? null
}

/** 诊断包用：最近记录优先（Map 按写入时顺序，重新记一条会挪到末尾） */
export function listRawDetails(): RawDetailEntry[] {
  return Array.from(rawDetails.entries())
    .map(([humanText, record]) => ({
      humanText,
      rawText: record.rawText,
      at: new Date(record.at).toISOString(),
      page: record.page
    }))
    .reverse()
}
