/**
 * 灰度与熔断（SPEC-UI-11 §15 / R-10）。
 *
 * `off`：整块不渲染，页面回到接入前；`whitelist`：只给名单里的账号开；`all`：全开。
 *
 * 远端优先：能取到远端就听远端的，取不到（还没有接口、网络失败、返回值不合法）退构建期常量。
 * 本地没有开关：偏好里能把形象藏起来、把频率降下来，但改不了这一档——
 * 「团队关掉」就是关掉，本机不能自行把能力打开。
 *
 * 远端加载器由调用方注入（`resolveRobotRollout(remote)`）。目前还没有专门的配置接口，
 * 运维接上之后往这里塞一个取数函数即可，判定逻辑不用再改。
 */
export type RobotRolloutMode = 'off' | 'whitelist' | 'all'

export interface RobotRollout {
  mode: RobotRolloutMode
  /** 白名单模式下的账号 id；其他模式忽略 */
  allowUserIds: number[]
}

function envValue(name: string): string {
  const env = import.meta.env as Record<string, unknown>
  return String(env[name] ?? '').trim()
}

function buildAllowList(): number[] {
  return envValue('VITE_ROBOT_ROLLOUT_USERS')
    .split(',')
    .map(item => Number(item.trim()))
    .filter(id => Number.isFinite(id) && id > 0)
}

function readBuildRollout(): RobotRollout {
  const mode = envValue('VITE_ROBOT_ROLLOUT').toLowerCase()
  // 默认 all：机器人已经全量上线，构建期不加变量不应把它关掉
  if (mode === 'off' || mode === 'whitelist') return { mode, allowUserIds: buildAllowList() }
  return { mode: 'all', allowUserIds: [] }
}

const BUILD_ROLLOUT = readBuildRollout()

/** 构建期那一档：同步可用，首屏不等远端 */
export function buildRobotRollout(): RobotRollout {
  return BUILD_ROLLOUT
}

/** 远端返回值不合规时返回 null，交给调用方退构建期常量 */
export function parseRobotRollout(raw: unknown): RobotRollout | null {
  if (!raw || typeof raw !== 'object') return null
  const value = raw as { mode?: unknown; allowUserIds?: unknown }
  const mode = String(value.mode ?? '').toLowerCase()
  if (mode !== 'off' && mode !== 'whitelist' && mode !== 'all') return null
  const ids = Array.isArray(value.allowUserIds)
    ? value.allowUserIds.map(Number).filter(id => Number.isFinite(id) && id > 0)
    : []
  return { mode, allowUserIds: ids }
}

export function isRobotRolloutEnabled(rollout: RobotRollout, userId: number | null): boolean {
  if (rollout.mode === 'off') return false
  if (rollout.mode === 'all') return true
  return userId !== null && rollout.allowUserIds.includes(userId)
}

/** 远端优先、失败退构建期；返回的永远是能直接判定的那一档 */
export async function resolveRobotRollout(
  remote?: (() => Promise<unknown>) | null
): Promise<RobotRollout> {
  if (!remote) return BUILD_ROLLOUT
  try {
    return parseRobotRollout(await remote()) ?? BUILD_ROLLOUT
  } catch {
    return BUILD_ROLLOUT
  }
}
