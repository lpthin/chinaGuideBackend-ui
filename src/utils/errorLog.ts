/**
 * 错误留痕单一出口（Spec-F §9.2-7）。
 * views 里现存 187 处 console.error/warn，由 P0 第二包逐页迁移到这里：
 * 界面不显示堆栈（失败走 notification.error 带原因/traceId），日志侧留一条可查的行。
 */
export function logError(code: string, err?: unknown): void {
  console.error(`[ui-error] ${code}`, err === undefined ? '' : err)
}
