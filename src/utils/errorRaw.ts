/**
 * 错误原文的短期台账（拍板 Q5-A：人话做标题、原文折叠可复制）。
 *
 * `describeHttpError` 只留下中文人话，`Network Error` / `HTTP 500` / 后端原始 JSON
 * 这些「能贴进工单」的材料在抛出去那一刻就丢了。这里按人话文案记最近一次原文，
 * 供 StateBlock / EmptyListHint 在错误块里折叠展示。
 *
 * 只记最近 60 条：它是排查材料，不是日志；快照落 sessionStorage，
 * 同标签页刷新仍在、关标签即清（SPEC-UI-9 H4-3）。
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

export const ERROR_RAW_STORAGE_KEY = '__ui_error_raw_v1'

const rawDetails = new Map<string, RawRecord>()

function currentPagePath(): string {
  return typeof window !== 'undefined' ? window.location.pathname : ''
}

function persist(): void {
  try {
    if (typeof sessionStorage === 'undefined') return
    const entries = Array.from(rawDetails.entries())
    sessionStorage.setItem(ERROR_RAW_STORAGE_KEY, JSON.stringify({ entries }))
  } catch {
    // 无痕模式 / 配额满：原文台账静默留在内存
  }
}

/**
 * 刷新后恢复（SPEC-UI-9 H4-3）：错误块折叠的原文与诊断包都靠这张表，
 * 一次刷新不该把「刚发生的那一发 requestId」抹掉。坏数据直接当没有。
 */
function restore(): void {
  try {
    if (typeof sessionStorage === 'undefined') return
    const raw = sessionStorage.getItem(ERROR_RAW_STORAGE_KEY)
    if (!raw) return
    const parsed = JSON.parse(raw) as { entries?: Array<[unknown, unknown]> }
    for (const [humanText, record] of parsed.entries ?? []) {
      if (typeof humanText !== 'string' || !record || typeof record !== 'object') continue
      const candidate = record as Partial<RawRecord>
      if (typeof candidate.rawText !== 'string' || typeof candidate.at !== 'number') continue
      if (!rawDetails.has(humanText)) rawDetails.set(humanText, {
        rawText: candidate.rawText,
        at: candidate.at,
        page: typeof candidate.page === 'string' ? candidate.page : ''
      })
    }
    while (rawDetails.size > RAW_LIMIT) {
      const oldest = rawDetails.keys().next().value
      if (oldest === undefined) break
      rawDetails.delete(oldest)
    }
  } catch {
    // 坏快照当没有：下一次 rememberRawDetail 会覆盖
  }
}

restore()

export function rememberRawDetail(humanText: string, rawText: string): void {
  if (!humanText || !rawText || humanText === rawText) return
  if (rawDetails.has(humanText)) rawDetails.delete(humanText)
  rawDetails.set(humanText, { rawText, at: Date.now(), page: currentPagePath() })
  if (rawDetails.size > RAW_LIMIT) {
    const oldest = rawDetails.keys().next().value
    if (oldest !== undefined) rawDetails.delete(oldest)
  }
  persist()
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

/** 单测用：清空台账与持久化快照 */
export function resetRawDetails(): void {
  rawDetails.clear()
  try {
    if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem(ERROR_RAW_STORAGE_KEY)
  } catch {
    // 存储不可用：内存已经清干净
  }
}
