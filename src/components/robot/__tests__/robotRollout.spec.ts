import { describe, expect, it } from 'vitest'
import {
  buildRobotRollout,
  isRobotRolloutEnabled,
  parseRobotRollout,
  resolveRobotRollout
} from '../robotRollout'

/**
 * 灰度/熔断（SPEC-UI-11 §15 / R-10）：
 * off 一定关、whitelist 只认名单、远端不合法就退构建期常量，本机没有提权路径。
 */
describe('灰度档位', () => {
  it('off 对谁都不开', () => {
    expect(isRobotRolloutEnabled({ mode: 'off', allowUserIds: [1, 2] }, 1)).toBe(false)
  })

  it('whitelist 只认名单里的账号', () => {
    const rollout = { mode: 'whitelist' as const, allowUserIds: [7, 9] }
    expect(isRobotRolloutEnabled(rollout, 7)).toBe(true)
    expect(isRobotRolloutEnabled(rollout, 8)).toBe(false)
    expect(isRobotRolloutEnabled(rollout, null)).toBe(false)
  })

  it('all 全开', () => {
    expect(isRobotRolloutEnabled({ mode: 'all', allowUserIds: [] }, null)).toBe(true)
  })
})

describe('远端配置优先、不合法退构建期', () => {
  it('远端值合法时以远端为准', async () => {
    const rollout = await resolveRobotRollout(async () => ({ mode: 'whitelist', allowUserIds: ['3', 4] }))
    expect(rollout).toEqual({ mode: 'whitelist', allowUserIds: [3, 4] })
  })

  it('远端抛错或返回不合法时退回构建期那一档', async () => {
    expect(await resolveRobotRollout(async () => { throw new Error('offline') })).toEqual(buildRobotRollout())
    expect(await resolveRobotRollout(async () => ({ mode: 'half' }))).toEqual(buildRobotRollout())
    expect(await resolveRobotRollout(null)).toEqual(buildRobotRollout())
  })

  it('解析器不认识的模式一律 null', () => {
    expect(parseRobotRollout('off')).toBeNull()
    expect(parseRobotRollout({ mode: 'off' })).toEqual({ mode: 'off', allowUserIds: [] })
    expect(parseRobotRollout({ mode: 'ALL' })).toEqual({ mode: 'all', allowUserIds: [] })
  })
})
