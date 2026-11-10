import { describe, expect, it } from 'vitest'
import {
  ROBOT_AUTO_DOWNGRADE_RATE,
  ROBOT_TELEMETRY_DAYS,
  ROBOT_TELEMETRY_KEY,
  clearRobotTelemetry,
  recordRobotTelemetry,
  robotTelemetrySummary,
  shouldAutoDowngrade,
  type RobotTelemetryOptions
} from '../robotTelemetry'

/**
 * 度量（SPEC-UI-11 §12 / R-10）的约定：
 * 只记 key / 动作 / 页面路径；7 天窗口；最多 500 条；存储坏了不许抛。
 */
const NOW = new Date('2026-11-10T12:00:00Z').getTime()
const DAY = 24 * 3600 * 1000

function memoryStorage() {
  const map = new Map<string, string>()
  return {
    map,
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value)
    }
  }
}

function options(storage: ReturnType<typeof memoryStorage>, now = NOW): RobotTelemetryOptions {
  return { storage, now: () => now }
}

describe('本机度量只收三样', () => {
  it('按类型累计，并算出关闭率', () => {
    const storage = memoryStorage()
    recordRobotTelemetry({ type: 'show', key: 'a', page: '/workspace/a' }, options(storage))
    recordRobotTelemetry({ type: 'show', key: 'b', page: '/workspace/b' }, options(storage))
    recordRobotTelemetry({ type: 'dismiss', key: 'a', page: '/workspace/a' }, options(storage))
    recordRobotTelemetry({ type: 'detail', key: 'b', page: '/workspace/b' }, options(storage))

    const summary = robotTelemetrySummary(options(storage))
    expect(summary).toMatchObject({ show: 2, dismiss: 1, detail: 1, total: 4, dismissRate: 50 })
  })

  it('事件里没有正文、账号与输入', () => {
    const storage = memoryStorage()
    recordRobotTelemetry({ type: 'action', key: 'task.article.generated', page: '/workspace/articles', action: '去看' }, options(storage))

    const stored = JSON.parse(storage.map.get(ROBOT_TELEMETRY_KEY) || '[]')
    expect(Object.keys(stored[0]).sort()).toEqual(['action', 'at', 'key', 'page', 'type'])
  })

  it('超过 7 天的事件不参与统计，也会被下一次写入清掉', () => {
    const storage = memoryStorage()
    storage.setItem(
      ROBOT_TELEMETRY_KEY,
      JSON.stringify([
        { type: 'show', key: 'old', page: '/old', at: NOW - (ROBOT_TELEMETRY_DAYS + 1) * DAY },
        { type: 'show', key: 'new', page: '/new', at: NOW - DAY }
      ])
    )

    expect(robotTelemetrySummary(options(storage)).show).toBe(1)
    recordRobotTelemetry({ type: 'show', key: 'third', page: '/third' }, options(storage))
    const stored = JSON.parse(storage.map.get(ROBOT_TELEMETRY_KEY) || '[]')
    expect(stored.map((item: { key: string }) => item.key)).toEqual(['new', 'third'])
  })

  it('最多留 500 条，超出丢最旧的', () => {
    const storage = memoryStorage()
    for (let index = 0; index < 510; index += 1) {
      recordRobotTelemetry({ type: 'show', key: `k${index}`, page: '/p' }, options(storage))
    }
    const stored = JSON.parse(storage.map.get(ROBOT_TELEMETRY_KEY) || '[]')
    expect(stored).toHaveLength(500)
    expect(stored[0].key).toBe('k10')
  })

  it('关闭率超四成且样本够才自动降档（§15）', () => {
    const base = { show: 20, dismiss: 8, detail: 0, action: 0, mute: 0, error: 0, total: 28 }
    expect(shouldAutoDowngrade({ ...base, dismissRate: ROBOT_AUTO_DOWNGRADE_RATE })).toBe(true)
    // 样本太少：头两条被关就降档会是误判
    expect(shouldAutoDowngrade({ ...base, show: 19, dismissRate: 80 })).toBe(false)
    expect(shouldAutoDowngrade({ ...base, dismissRate: 39 })).toBe(false)
  })

  it('存储坏了不抛，读到脏数据当没有', () => {
    const storage = memoryStorage()
    storage.setItem(ROBOT_TELEMETRY_KEY, '{oops')
    expect(robotTelemetrySummary(options(storage))).toMatchObject({ show: 0, total: 0 })
    expect(() => recordRobotTelemetry({ type: 'show', key: 'a', page: '/a' }, options(storage))).not.toThrow()
    clearRobotTelemetry(options(storage))
    expect(storage.map.get(ROBOT_TELEMETRY_KEY)).toBe('[]')
  })
})
