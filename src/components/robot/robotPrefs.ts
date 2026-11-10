/**
 * 机器人偏好的读写与合并（SPEC-UI-11 §5.4 / §6 / §6.1 / §6.2）。
 *
 * 分层：本地 `localStorage` 是缓存与离线队列，后端 `/api/user/robot-preference` 是跨设备真源。
 * 本地键按账号分：`robot_prefs_v1:<userId>`，未登录用 `robot_prefs_v1:anon`——
 * 换号不继承上一个人的频率与静音清单。
 *
 * 容错只有一条纪律（§6）：**读不出或任何一处不合法 → 整体回落默认值**，
 * 不允许出现「频率读到了、内容开关丢了」这种半坏状态。
 */
import {
  ROBOT_CATEGORIES,
  ROBOT_FREQUENCIES,
  ROBOT_MUTE_LIMIT,
  ROBOT_PREFS_KEY,
  ROBOT_PREFS_SCHEMA,
  type RobotCategory,
  type RobotFrequency,
  type RobotPosition
} from './robotTypes'

/** 只依赖三个方法，测试里给一个内存实现就够 */
export interface RobotStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

/** 真正上传给后端的那一份（设备本地的版本号与时间戳不在里面） */
export interface RobotPrefsPayload {
  rate: RobotFrequency
  categories: Record<RobotCategory, boolean>
  mutedKeys: string[]
  mutedPages: string[]
  quietUntil: number | null
  position: RobotPosition
  avatar: boolean
  introSeen: boolean
}

export interface RobotPrefs extends RobotPrefsPayload {
  /** 服务端版本号；本地改动不递增，收到后端回包时才更新 */
  serverVersion: number
  /** 本机最后一次改动时间，后写胜出用 */
  clientUpdatedAt: number
}

/** 后端 GET 回的形状（无记录时 payload 为 null） */
export interface RemoteRobotPreference {
  payload: RobotPrefsPayload | null
  version: number
  updatedAt: number | null
}

function allCategoriesOn(): Record<RobotCategory, boolean> {
  const value = {} as Record<RobotCategory, boolean>
  for (const category of ROBOT_CATEGORIES) value[category] = true
  return value
}

export function defaultRobotPrefs(): RobotPrefs {
  return {
    rate: 'standard',
    categories: allCategoriesOn(),
    mutedKeys: [],
    mutedPages: [],
    quietUntil: null,
    position: 'br',
    avatar: true,
    introSeen: false,
    serverVersion: 0,
    clientUpdatedAt: 0
  }
}

/** 未登录也要有一个稳定的键：登录前的偏好先存在这里，登录后再按账号合并 */
export function robotPrefsStorageKey(userId: number | string | null): string {
  const scope = userId === null || userId === undefined || userId === '' ? 'anon' : String(userId)
  return `${ROBOT_PREFS_KEY}:${scope}`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function normalizeStringList(value: unknown, limit: number): string[] | null {
  if (!Array.isArray(value)) return null
  const out: string[] = []
  for (const item of value) {
    if (typeof item !== 'string' || item.trim() === '') return null
    if (!out.includes(item)) out.push(item)
    if (out.length >= limit) break
  }
  return out
}

/**
 * 校验并收窄上传 payload。
 *
 * 返回 `null` = 这一份整体不可信（不是「某几项用默认值顶掉」）：
 * 半坏状态在设置面板上表现为「明明关了这一类，它还在说」，比整体回落难查得多。
 */
export function normalizeRobotPrefsPayload(value: unknown): RobotPrefsPayload | null {
  if (!isRecord(value)) return null

  const rate = value.rate
  if (typeof rate !== 'string' || !ROBOT_FREQUENCIES.includes(rate as RobotFrequency)) return null

  const rawCategories = value.categories
  if (!isRecord(rawCategories)) return null
  const categories = allCategoriesOn()
  for (const [key, raw] of Object.entries(rawCategories)) {
    if (!ROBOT_CATEGORIES.includes(key as RobotCategory)) continue
    if (typeof raw !== 'boolean') return null
    categories[key as RobotCategory] = raw
  }

  const mutedKeys = normalizeStringList(value.mutedKeys, ROBOT_MUTE_LIMIT)
  const mutedPages = normalizeStringList(value.mutedPages, ROBOT_MUTE_LIMIT)
  if (!mutedKeys || !mutedPages) return null

  const quietUntil = value.quietUntil
  if (quietUntil !== null && quietUntil !== undefined) {
    if (typeof quietUntil !== 'number' || !Number.isFinite(quietUntil)) return null
  }

  const position = value.position
  if (position !== 'br' && position !== 'bl') return null

  // 这两个字段是后加的：老客户端不传时按默认值，不算损坏
  const avatar = value.avatar === undefined ? true : value.avatar
  const introSeen = value.introSeen === undefined ? false : value.introSeen
  if (typeof avatar !== 'boolean' || typeof introSeen !== 'boolean') return null

  return {
    rate: rate as RobotFrequency,
    categories,
    mutedKeys,
    mutedPages,
    quietUntil: typeof quietUntil === 'number' ? quietUntil : null,
    position,
    avatar,
    introSeen
  }
}

/** 本地读出来的永远是完整的默认值或完整的用户值，没有第三条路 */
export function readRobotPrefs(
  userId: number | string | null,
  storage: RobotStorage
): RobotPrefs {
  const raw = storage.getItem(robotPrefsStorageKey(userId))
  if (!raw) return defaultRobotPrefs()
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return defaultRobotPrefs()
  }
  if (!isRecord(parsed) || parsed.v !== ROBOT_PREFS_SCHEMA) return defaultRobotPrefs()
  const payload = normalizeRobotPrefsPayload(parsed.prefs)
  if (!payload) return defaultRobotPrefs()
  const serverVersion = typeof parsed.serverVersion === 'number' && parsed.serverVersion >= 0
    ? parsed.serverVersion
    : 0
  const clientUpdatedAt = typeof parsed.clientUpdatedAt === 'number' && parsed.clientUpdatedAt > 0
    ? parsed.clientUpdatedAt
    : 0
  return { ...payload, serverVersion, clientUpdatedAt }
}

export function writeRobotPrefs(
  prefs: RobotPrefs,
  userId: number | string | null,
  storage: RobotStorage
): void {
  const { serverVersion, clientUpdatedAt, ...payload } = prefs
  storage.setItem(
    robotPrefsStorageKey(userId),
    JSON.stringify({ v: ROBOT_PREFS_SCHEMA, prefs: payload, serverVersion, clientUpdatedAt })
  )
}

export function clearRobotPrefs(userId: number | string | null, storage: RobotStorage): void {
  storage.removeItem(robotPrefsStorageKey(userId))
}

/** 并集，去重，保留前者顺序，末尾按上限裁掉——静音清单冲突时的合并口径（§6.2 第 3 条） */
export function unionRobotList(primary: string[], secondary: string[]): string[] {
  const out: string[] = []
  for (const item of [...primary, ...secondary]) {
    if (!out.includes(item)) out.push(item)
    if (out.length >= ROBOT_MUTE_LIMIT) break
  }
  return out
}

/**
 * 登录后的那一次合并。
 *
 * 标量以前者（服务端）为准：多端同时改频率时，刷新的那一台应该看到服务端记着的那一档；
 * 静音清单取并集，宁可少打扰，也不要让用户在被静音的设备上再被念一遍；
 * 临时安静的截止时间取较晚的那个——两处都点了「今天别打扰」时不该被早的那个提前叫醒。
 */
export function mergeRobotPreference(
  local: RobotPrefs,
  remote: RemoteRobotPreference
): RobotPrefs {
  if (!remote.payload) {
    return { ...local, serverVersion: remote.version }
  }
  const quietUntil = Math.max(local.quietUntil ?? 0, remote.payload.quietUntil ?? 0)
  return {
    ...remote.payload,
    quietUntil: quietUntil > 0 ? quietUntil : null,
    mutedKeys: unionRobotList(remote.payload.mutedKeys, local.mutedKeys),
    mutedPages: unionRobotList(remote.payload.mutedPages, local.mutedPages),
    introSeen: local.introSeen || remote.payload.introSeen,
    serverVersion: remote.version,
    clientUpdatedAt: Math.max(local.clientUpdatedAt, remote.updatedAt ?? 0)
  }
}

/** 静音一条：已存在则移到最前（最近命中），保证超限时淘汰的是最久没碰过的 */
export function muteRobotKey(prefs: RobotPrefs, key: string): RobotPrefs {
  const rest = prefs.mutedKeys.filter(item => item !== key)
  return { ...prefs, mutedKeys: [key, ...rest].slice(0, ROBOT_MUTE_LIMIT) }
}

export function unmuteRobotKey(prefs: RobotPrefs, key: string): RobotPrefs {
  return { ...prefs, mutedKeys: prefs.mutedKeys.filter(item => item !== key) }
}

export function muteRobotPage(prefs: RobotPrefs, pageKey: string): RobotPrefs {
  const rest = prefs.mutedPages.filter(item => item !== pageKey)
  return { ...prefs, mutedPages: [pageKey, ...rest].slice(0, ROBOT_MUTE_LIMIT) }
}

export function unmuteRobotPage(prefs: RobotPrefs, pageKey: string): RobotPrefs {
  return { ...prefs, mutedPages: prefs.mutedPages.filter(item => item !== pageKey) }
}

export function unmuteAllRobot(prefs: RobotPrefs): RobotPrefs {
  return { ...prefs, mutedKeys: [], mutedPages: [] }
}

/** 临时安静的截止时间：`hour` = 1 小时，`today` = 今天 24:00 */
export function robotQuietUntil(choice: 'hour' | 'today', now: number): number {
  if (choice === 'hour') return now + 60 * 60 * 1000
  const end = new Date(now)
  end.setHours(24, 0, 0, 0)
  return end.getTime()
}

export function isRobotQuiet(prefs: RobotPrefs, now: number): boolean {
  return typeof prefs.quietUntil === 'number' && prefs.quietUntil > now
}
