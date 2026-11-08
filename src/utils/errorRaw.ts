/**
 * 错误原文的短期台账（拍板 Q5-A：人话做标题、原文折叠可复制）。
 *
 * `describeHttpError` 只留下中文人话，`Network Error` / `HTTP 500` / 后端原始 JSON
 * 这些「能贴进工单」的材料在抛出去那一刻就丢了。这里按人话文案记最近一次原文，
 * 供 StateBlock / EmptyListHint 在错误块里折叠展示。
 *
 * 只记最近 60 条：它是排查材料，不是日志；页面刷新或重启进程后就没了也算正常。
 */
const RAW_LIMIT = 60
const rawDetails = new Map<string, string>()

export function rememberRawDetail(humanText: string, rawText: string): void {
  if (!humanText || !rawText || humanText === rawText) return
  if (rawDetails.has(humanText)) rawDetails.delete(humanText)
  rawDetails.set(humanText, rawText)
  if (rawDetails.size > RAW_LIMIT) {
    const oldest = rawDetails.keys().next().value
    if (oldest !== undefined) rawDetails.delete(oldest)
  }
}

/** 这一句人话背后有没有可展示的原文；没有就返回 null（错误块里不摆空壳） */
export function errorRawDetail(humanText: string | null | undefined): string | null {
  if (!humanText) return null
  return rawDetails.get(humanText) ?? null
}
