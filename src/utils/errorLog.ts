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

/**
 * 中性事件留痕（SPEC-UI-8 G1）：页面浏览、重试、恢复这类「不是错误但要有账」的计数走这一档。
 * 单独一条理由：这些事件量比错误大，混进 error 通道会把真错误淹掉，也让人误以为整页在报错。
 */
export function logInfo(code: string, ...rest: unknown[]): void {
  console.info(`[ui-info] ${code}`, ...rest)
}
