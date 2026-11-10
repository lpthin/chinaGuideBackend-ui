import { describe, expect, it } from 'vitest'
import {
  clearRobotPrefs,
  defaultRobotPrefs,
  isRobotQuiet,
  mergeRobotPreference,
  muteRobotKey,
  normalizeRobotPrefsPayload,
  readRobotPrefs,
  robotPrefsStorageKey,
  robotQuietUntil,
  unmuteRobotKey,
  writeRobotPrefs,
  type RobotStorage
} from '../robotPrefs'
import { ROBOT_MUTE_LIMIT } from '../robotTypes'

/**
 * 偏好这层的四条硬事（SPEC-UI-11 §5.4 / §6）：
 *
 * 1. 任何一处不合法都**整体回落**默认值，不允许出现「频率读到了、内容开关丢了」的半坏状态。
 * 2. 键按账号分，换号不继承上一个人的静音清单。
 * 3. 静音清单有上限，超限淘汰最久没命中的那条（刚点的那条永远排最前）。
 * 4. 合并时标量取服务端、清单取并集、临时安静取较晚的那个。
 */
function memoryStorage(): RobotStorage & { dump: () => Record<string, string> } {
  const map = new Map<string, string>()
  return {
    getItem: key => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, value),
    removeItem: key => void map.delete(key),
    dump: () => Object.fromEntries(map)
  }
}

describe('默认值', () => {
  it('默认标准档、五类全开、右下、显示本体、还没自我介绍过', () => {
    const prefs = defaultRobotPrefs()
    expect(prefs.rate).toBe('standard')
    expect(Object.values(prefs.categories).every(Boolean)).toBe(true)
    expect(prefs.position).toBe('br')
    expect(prefs.avatar).toBe(true)
    expect(prefs.introSeen).toBe(false)
    expect(prefs.mutedKeys).toEqual([])
  })

  it('每次返回新对象：改一份不会污染下一份', () => {
    const first = defaultRobotPrefs()
    first.categories.scope = false
    expect(defaultRobotPrefs().categories.scope).toBe(true)
  })
})

describe('读写与整体回落', () => {
  it('写进去的能原样读出来', () => {
    const storage = memoryStorage()
    const prefs = { ...defaultRobotPrefs(), rate: 'quiet' as const, mutedKeys: ['a'] }
    writeRobotPrefs(prefs, 7, storage)
    expect(readRobotPrefs(7, storage).rate).toBe('quiet')
    expect(readRobotPrefs(7, storage).mutedKeys).toEqual(['a'])
  })

  it('按账号分键：7 号的偏好不会被 8 号读到', () => {
    const storage = memoryStorage()
    writeRobotPrefs({ ...defaultRobotPrefs(), rate: 'off' }, 7, storage)
    expect(readRobotPrefs(8, storage).rate).toBe('standard')
    expect(robotPrefsStorageKey(7)).toBe('robot_prefs_v1:7')
    expect(robotPrefsStorageKey(null)).toBe('robot_prefs_v1:anon')
  })

  it('手改坏了 JSON → 回落默认值，不抛异常', () => {
    const storage = memoryStorage()
    storage.setItem(robotPrefsStorageKey(1), '{ 这不是 JSON')
    expect(readRobotPrefs(1, storage).rate).toBe('standard')
  })

  it('结构版本对不上 → 回落默认值（宁可重置一次，也不要按旧结构硬读）', () => {
    const storage = memoryStorage()
    storage.setItem(
      robotPrefsStorageKey(1),
      JSON.stringify({ v: 999, prefs: defaultRobotPrefs(), serverVersion: 3, clientUpdatedAt: 1 })
    )
    const prefs = readRobotPrefs(1, storage)
    expect(prefs.rate).toBe('standard')
    expect(prefs.serverVersion).toBe(0)
  })

  it('任何一处不合法都整体回落，而不是逐项兜底', () => {
    const base = defaultRobotPrefs()
    const broken = { ...base, categories: { ...base.categories, scope: 'no' } }
    expect(normalizeRobotPrefsPayload(broken)).toBeNull()

    expect(normalizeRobotPrefsPayload({ ...base, rate: 'loud' })).toBeNull()
    expect(normalizeRobotPrefsPayload({ ...base, mutedKeys: 'a,b' })).toBeNull()
    expect(normalizeRobotPrefsPayload({ ...base, position: 'center' })).toBeNull()
    expect(normalizeRobotPrefsPayload({ ...base, quietUntil: '明天' })).toBeNull()
  })

  it('老客户端没带 avatar / introSeen 不算损坏，按默认值补齐', () => {
    const { avatar: _avatar, introSeen: _introSeen, ...legacy } = defaultRobotPrefs()
    const normalized = normalizeRobotPrefsPayload(legacy)
    expect(normalized?.avatar).toBe(true)
    expect(normalized?.introSeen).toBe(false)
  })

  it('登出清掉本机这一份', () => {
    const storage = memoryStorage()
    writeRobotPrefs({ ...defaultRobotPrefs(), rate: 'off' }, 7, storage)
    clearRobotPrefs(7, storage)
    expect(readRobotPrefs(7, storage).rate).toBe('standard')
  })
})

describe('静音清单', () => {
  it('再次静音同一条会把它移到最前（最近命中）', () => {
    let prefs = { ...defaultRobotPrefs(), mutedKeys: ['a', 'b', 'c'] }
    prefs = muteRobotKey(prefs, 'b')
    expect(prefs.mutedKeys).toEqual(['b', 'a', 'c'])
  })

  it('超过上限时淘汰末尾那条（最久没命中的）', () => {
    const full = Array.from({ length: ROBOT_MUTE_LIMIT }, (_, index) => `key-${index}`)
    const next = muteRobotKey({ ...defaultRobotPrefs(), mutedKeys: full }, 'newest')
    expect(next.mutedKeys).toHaveLength(ROBOT_MUTE_LIMIT)
    expect(next.mutedKeys[0]).toBe('newest')
    expect(next.mutedKeys).not.toContain(`key-${ROBOT_MUTE_LIMIT - 1}`)
  })

  it('恢复一条只去掉它自己', () => {
    const prefs = unmuteRobotKey({ ...defaultRobotPrefs(), mutedKeys: ['a', 'b'] }, 'a')
    expect(prefs.mutedKeys).toEqual(['b'])
  })
})

describe('合并（登录后一次）', () => {
  it('标量取服务端、清单取并集、临时安静取较晚的、自我介绍取或', () => {
    const local = {
      ...defaultRobotPrefs(),
      rate: 'off' as const,
      mutedKeys: ['local-only'],
      quietUntil: 2_000,
      introSeen: false,
      clientUpdatedAt: 100
    }
    const remote = {
      payload: {
        ...defaultRobotPrefs(),
        rate: 'active' as const,
        mutedKeys: ['remote-only'],
        quietUntil: 5_000,
        introSeen: true
      },
      version: 4,
      updatedAt: 300
    }
    const merged = mergeRobotPreference(local, remote)
    expect(merged.rate).toBe('active')
    expect(merged.mutedKeys).toEqual(['remote-only', 'local-only'])
    expect(merged.quietUntil).toBe(5_000)
    expect(merged.introSeen).toBe(true)
    expect(merged.serverVersion).toBe(4)
    expect(merged.clientUpdatedAt).toBe(300)
  })

  it('服务端没有记录时保留本地那一份，只记版本号', () => {
    const local = { ...defaultRobotPrefs(), rate: 'quiet' as const }
    const merged = mergeRobotPreference(local, { payload: null, version: 0, updatedAt: null })
    expect(merged.rate).toBe('quiet')
    expect(merged.serverVersion).toBe(0)
  })
})

describe('临时安静', () => {
  it('一小时 = 现在 + 3600000', () => {
    const now = new Date('2026-11-10T10:00:00').getTime()
    expect(robotQuietUntil('hour', now)).toBe(now + 60 * 60 * 1000)
  })

  it('今天 = 明天 0 点，而不是 24 小时后', () => {
    const now = new Date('2026-11-10T23:30:00').getTime()
    const until = robotQuietUntil('today', now)
    const end = new Date(until)
    expect(end.getHours()).toBe(0)
    expect(end.getDate()).toBe(11)
  })

  it('截止时间之前算安静，过了就不再算', () => {
    const prefs = { ...defaultRobotPrefs(), quietUntil: 1_000 }
    expect(isRobotQuiet(prefs, 999)).toBe(true)
    expect(isRobotQuiet(prefs, 1_000)).toBe(false)
  })
})
