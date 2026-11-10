/**
 * 度量（SPEC-UI-11 §12 / R-10）。
 *
 * 只记三样：key、动作、页面路径。事件类型本身就没有正文、账号与表单内容这几个字段，
 * 所以「不记正文与用户输入」不是靠调用方自觉，而是这里根本没有地方放。
 *
 * 数据留在本机（localStorage），7 天滚动窗口，最多 500 条；超限丢最旧的。
 * 本机统计只用来回答「说了几次、关掉几次」，不承担跨端汇总——那要等后端有账目再说。
 */
import type { RobotTelemetryEvent } from './robotCenter'

export const ROBOT_TELEMETRY_KEY = 'robot.telemetry.v1'
export const ROBOT_TELEMETRY_DAYS = 7
/** 关闭率降档的两道门槛（§15）：样本太少不降，免得头两条被关就误判 */
export const ROBOT_AUTO_DOWNGRADE_MIN_SHOWS = 20
export const ROBOT_AUTO_DOWNGRADE_RATE = 40
const MAX_EVENTS = 500
const DAY_MS = 24 * 3600 * 1000

interface StoredEvent extends RobotTelemetryEvent {
  at: number
}

export interface RobotTelemetrySummary {
  show: number
  dismiss: number
  detail: number
  action: number
  mute: number
  error: number
  total: number
  /** 关掉 ÷ 展示，四舍五入到整数百分比；没有展示时记 0 */
  dismissRate: number
}

export interface RobotTelemetryOptions {
  now?: () => number
  storage?: Pick<Storage, 'getItem' | 'setItem'> | null
}

function resolveStorage(options: RobotTelemetryOptions): Pick<Storage, 'getItem' | 'setItem'> | null {
  if (options.storage !== undefined) return options.storage
  try {
    return globalThis.localStorage ?? null
  } catch {
    return null
  }
}

function readEvents(options: RobotTelemetryOptions): StoredEvent[] {
  const storage = resolveStorage(options)
  if (!storage) return []
  try {
    const raw = storage.getItem(ROBOT_TELEMETRY_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? (parsed as StoredEvent[]) : []
  } catch {
    // 存储里是脏数据：当作没有，不让度量把页面带崩
    return []
  }
}

function inWindow(event: StoredEvent, now: number): boolean {
  return Number.isFinite(event.at) && now - event.at <= ROBOT_TELEMETRY_DAYS * DAY_MS
}

/** 记一条；任何异常都吞掉——度量失败不能影响提示本身 */
export function recordRobotTelemetry(event: RobotTelemetryEvent, options: RobotTelemetryOptions = {}): void {
  const now = (options.now ?? Date.now)()
  const storage = resolveStorage(options)
  if (!storage) return
  try {
    const kept = readEvents(options)
      .filter(item => inWindow(item, now))
      .slice(-(MAX_EVENTS - 1))
    kept.push({ ...event, at: now })
    storage.setItem(ROBOT_TELEMETRY_KEY, JSON.stringify(kept))
  } catch {
    // 配额满或隐私模式禁用存储：丢掉这一条，不抛
  }
}

/** 近 7 天的本机统计：设置面板那一行与排查时都读它 */
export function robotTelemetrySummary(options: RobotTelemetryOptions = {}): RobotTelemetrySummary {
  const now = (options.now ?? Date.now)()
  const summary: RobotTelemetrySummary = {
    show: 0,
    dismiss: 0,
    detail: 0,
    action: 0,
    mute: 0,
    error: 0,
    total: 0,
    dismissRate: 0
  }
  for (const event of readEvents(options)) {
    if (!inWindow(event, now)) continue
    summary[event.type] += 1
    summary.total += 1
  }
  summary.dismissRate = summary.show > 0 ? Math.round((summary.dismiss / summary.show) * 100) : 0
  return summary
}

/** 关闭率超四成且展示样本够，才认为「这类话太吵」，自动降一档（§15） */
export function shouldAutoDowngrade(summary: RobotTelemetrySummary): boolean {
  return (
    summary.show >= ROBOT_AUTO_DOWNGRADE_MIN_SHOWS &&
    summary.dismissRate >= ROBOT_AUTO_DOWNGRADE_RATE
  )
}

/** 清空本机统计：设置面板里「全部恢复」不该顺带清这个，留给排查时手动调用 */
export function clearRobotTelemetry(options: RobotTelemetryOptions = {}): void {
  const storage = resolveStorage(options)
  try {
    storage?.setItem(ROBOT_TELEMETRY_KEY, '[]')
  } catch {
    // 同上：存储不可用就当已经清空
  }
}
