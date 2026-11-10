import { describe, expect, it } from 'vitest'
import { createRobotCenter } from '../robotCenter'
import type { RobotStorage } from '../robotPrefs'
import type { RobotNotice } from '../robotTypes'

/**
 * 页头问号的数据源（SPEC-UI-11 §3 场景 4 / R-5）。
 *
 * 三件事必须成立，否则「把说明条删掉」就是不可逆的：
 * 1. 口径卡在被静音、被分类开关关掉之后，仍然留在 `helpEntries` 里；
 * 2. 任务结果与系统提醒不进这里——问号只回答「这一页怎么读」；
 * 3. 换页之后不残留上一页的口径。
 */
function memoryStorage(): RobotStorage {
  const map = new Map<string, string>()
  return {
    getItem: key => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, value),
    removeItem: key => void map.delete(key)
  }
}

function createCenter() {
  return createRobotCenter({
    storage: memoryStorage(),
    now: () => new Date('2026-11-10T10:00:00').getTime(),
    setTimer: () => 1,
    clearTimer: () => {},
    isBlocked: () => null
  })
}

function notice(key: string, extra: Partial<RobotNotice> = {}): RobotNotice {
  return {
    key,
    category: 'scope',
    priority: 'p2',
    text: `${key} 的一句话`,
    detail: `${key} 的全文`,
    once: 'session',
    sourceId: 'page.notice',
    ...extra
  }
}

describe('页头问号的说明清单', () => {
  it('口径卡登记之后能在问号里读到全文', async () => {
    const center = createCenter()
    await center.attachUser(1)
    center.enterPage('/analytics/portal')

    center.announce(notice('analytics.scope'), { ready: true })

    expect(center.helpEntries.value).toHaveLength(1)
    expect(center.helpEntries.value[0].detail).toBe('analytics.scope 的全文')
  })

  it('把这类消息关掉之后，问号里仍然读得到', async () => {
    const center = createCenter()
    await center.attachUser(1)
    center.enterPage('/analytics/portal')

    center.setCategory('scope', false)
    center.announce(notice('analytics.scope'), { ready: true })

    // 不主动说话
    expect(center.active.value).toBeNull()
    // 但手动复看仍在
    expect(center.helpEntries.value.map(item => item.key)).toEqual(['analytics.scope'])
  })

  it('任务结果与系统提醒不进问号', async () => {
    const center = createCenter()
    await center.attachUser(1)
    center.enterPage('/analytics/portal')

    center.announce(notice('task.done', { category: 'task', priority: 'p1' }), { ready: true })
    center.announce(notice('system.health', { category: 'system', priority: 'p1' }), { ready: true })
    center.announce(notice('analytics.scope'), { ready: true })

    expect(center.helpEntries.value.map(item => item.key)).toEqual(['analytics.scope'])
  })

  it('同一个 key 再说一次只更新，不重复占位', async () => {
    const center = createCenter()
    await center.attachUser(1)
    center.enterPage('/analytics/portal')

    center.announce(notice('analytics.scope'), { ready: true })
    center.announce(notice('analytics.scope', { detail: '改过的全文' }), { ready: true })

    expect(center.helpEntries.value).toHaveLength(1)
    expect(center.helpEntries.value[0].detail).toBe('改过的全文')
  })

  it('换一页之后不挂着上一页的口径', async () => {
    const center = createCenter()
    await center.attachUser(1)
    center.enterPage('/analytics/portal')
    center.announce(notice('analytics.scope'), { ready: true })

    center.enterPage('/media-storage')

    expect(center.helpEntries.value).toEqual([])
  })
})
