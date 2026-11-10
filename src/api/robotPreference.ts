/**
 * 机器人偏好的后端接口（SPEC-UI-11 §6.2，R-11 的前端一半）。
 *
 * - GET  `/api/user/robot-preference`：无记录时 `data` 为 null，前端用默认值；
 * - PUT  `/api/user/robot-preference`：整体覆盖写，回写后的 version 与时间戳。
 *
 * 这一层**不抛给界面**：调用方（中枢）一律 try/catch 静默降级。
 * 接口没上线时是 404，`http.ts` 会压成一句中文，中枢只当「这次没同步上」。
 */
import http from './http'
import type { RemoteRobotPreference, RobotPrefsPayload } from '../components/robot/robotPrefs'

export interface RobotPreferenceWriteResult {
  version: number
  updatedAt: number | null
  /** 本机的 baseVersion 与服务端不一致：服务端没写，把它的那一份带回来 */
  conflict: boolean
  server: RemoteRobotPreference | null
}

interface RawRemote {
  payload?: RobotPrefsPayload | null
  version?: number | null
  updatedAt?: unknown
}

/** 时间戳统一成毫秒：后端可能回 ISO 字符串，也可能回毫秒数 */
function toMillis(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Date.parse(value)
    return Number.isNaN(parsed) ? null : parsed
  }
  return null
}

function toRemote(raw: RawRemote | null): RemoteRobotPreference {
  if (!raw) return { payload: null, version: 0, updatedAt: null }
  return {
    payload: raw.payload ?? null,
    version: typeof raw.version === 'number' ? raw.version : 0,
    updatedAt: toMillis(raw.updatedAt)
  }
}

export const robotPreferenceApi = {
  async get(): Promise<RemoteRobotPreference> {
    const data = await http.get<RawRemote | null>('/user/robot-preference')
    return toRemote(data)
  },

  async put(
    payload: RobotPrefsPayload,
    meta: { clientUpdatedAt: number; baseVersion: number }
  ): Promise<RobotPreferenceWriteResult> {
    const data = await http.put<{
      version?: number
      updatedAt?: unknown
      conflict?: boolean
      server?: RawRemote | null
    }>('/user/robot-preference', {
      payload,
      clientUpdatedAt: meta.clientUpdatedAt,
      baseVersion: meta.baseVersion
    })
    return {
      version: typeof data?.version === 'number' ? data.version : 0,
      updatedAt: toMillis(data?.updatedAt),
      conflict: data?.conflict === true,
      server: data?.server ? toRemote(data.server) : null
    }
  }
}
