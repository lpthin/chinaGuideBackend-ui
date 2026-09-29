/**
 * 错误留痕单一出口（Spec-F §9.2-7）。
 * views 里原先 180 处 console.error/warn 已全部改走这里（P0）：
 * 界面不显示堆栈（失败该走 notification.error 带原因/traceId），日志侧留一条带页面代号的可查行。
 * code 用「目录/页面名」，同一页面的多个调用点共用一个代号。
 */
/** 可变参数：原来 console.error 带「消息 + 对象 + 上下文」的调用点不该被压成两个 */
export function logError(code: string, ...rest: unknown[]): void {
  console.error(`[ui-error] ${code}`, ...rest)
}

/** 严重度分开留痕：原本写 console.warn 的那些不该被升级成错误行 */
export function logWarn(code: string, ...rest: unknown[]): void {
  console.warn(`[ui-warn] ${code}`, ...rest)
}
