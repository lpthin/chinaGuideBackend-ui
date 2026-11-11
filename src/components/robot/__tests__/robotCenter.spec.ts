import { describe, expect, it } from 'vitest'
import { createRobotCenter, robotSpokenToday, type RobotCenterDeps } from '../robotCenter'
import { defaultRobotPrefs, robotPrefsStorageKey, writeRobotPrefs, type RobotStorage } from '../robotPrefs'
import { ROBOT_SEEN_KEY, ROBOT_INTRO_KEY, type RobotNotice } from '../robotTypes'

/**
 * 中枢的固定行为（SPEC-UI-11 §5.2 / §5.3），全部按「可观察的结果」测：
 * 说了没有、说的是哪条、什么时候自己收、被挡住之后还补不补。
 *
 * 时间、存储、定时器、忙碌判定全部注入，测试里不需要真的等 12 秒，也不需要造组件树。
 */
function memoryStorage(): RobotStorage {
  const map = new Map<string, string>()
  return {
    getItem: key => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, value),
    removeItem: key => void map.delete(key)
  }
}

function createClock(start = new Date('2026-11-10T10:00:00').getTime()) {
  let time = start
  let seq = 0
  const timers = new Map<number, { at: number; fn: () => void }>()
  return {
    now: () => time,
    setTimer: (fn: () => void, ms: number) => {
      const id = (seq += 1)
      timers.set(id, { at: time + ms, fn })
      return id
    },
    clearTimer: (id: number) => void timers.delete(id),
    advance(ms: number) {
      const target = time + ms
      // 边跑边有新定时器（自动收起之后补说下一条），所以要循环取最早到期的
      for (;;) {
        const due = [...timers.entries()]
          .filter(([, item]) => item.at <= target)
          .sort((a, b) => a[1].at - b[1].at)[0]
        if (!due) break
        timers.delete(due[0])
        time = due[1].at
        due[1].fn()
      }
      time = target
    }
  }
}

interface Harness {
  center: ReturnType<typeof createRobotCenter>
  clock: ReturnType<typeof createClock>
  storage: RobotStorage
  block: (reason: string | null) => void
}

function createHarness(overrides: Partial<RobotCenterDeps> = {}): Harness {
  const clock = createClock()
  const storage = memoryStorage()
  // 自我介绍在大多数用例里是噪音，先预置成「已经说过」
  writeRobotPrefs({ ...defaultRobotPrefs(), introSeen: true }, 1, storage)
  let blocked: string | null = null
  const center = createRobotCenter({
    storage,
    now: clock.now,
    setTimer: clock.setTimer,
    clearTimer: clock.clearTimer,
    isBlocked: () => blocked,
    ...overrides
  })
  const harness: Harness = {
    center,
    clock,
    storage,
    block: reason => {
      blocked = reason
    }
  }
  return harness
}

function notice(key: string, extra: Partial<RobotNotice> = {}): RobotNotice {
  return {
    key,
    category: 'scope',
    priority: 'p2',
    text: `${key} 的一句话说明`,
    once: 'day',
    sourceId: 'page.notice',
    ...extra
  }
}

/** 进入某一页并把路由静默窗走完 */
async function enter(harness: Harness, path = '/analytics/portal'): Promise<void> {
  await harness.center.attachUser(1)
  harness.center.enterPage(path)
  harness.clock.advance(800)
}

describe('开口时机', () => {
  it('路由切过来 800ms 内不说，窗口过了才说', async () => {
    const harness = createHarness()
    await harness.center.attachUser(1)
    harness.center.enterPage('/x')
    harness.center.announce(notice('a'))
    harness.clock.advance(799)
    expect(harness.center.active.value).toBeNull()
    harness.clock.advance(1)
    expect(harness.center.active.value?.key).toBe('a')
  })

  it('同一页的第二条 p2 不再主动说（标准档每页 1 条）', async () => {
    const harness = createHarness()
    await enter(harness)
    harness.center.announce(notice('a'))
    harness.center.announce(notice('b'))
    expect(harness.center.active.value?.key).toBe('a')
    harness.center.dismiss('user')
    expect(harness.center.active.value).toBeNull()
  })

  it('同一 key 当天不重复；换一个中枢实例（刷新页面）也不重复', async () => {
    const harness = createHarness()
    await enter(harness)
    harness.center.announce(notice('a'))
    expect(harness.center.active.value?.key).toBe('a')
    harness.center.dismiss('user')
    harness.center.announce(notice('a'))
    expect(harness.center.active.value).toBeNull()

    // 模拟刷新：同一个存储、新的中枢
    const reborn = createRobotCenter({
      storage: harness.storage,
      now: harness.clock.now,
      setTimer: harness.clock.setTimer,
      clearTimer: harness.clock.clearTimer,
      isBlocked: () => null
    })
    await reborn.attachUser(1)
    reborn.enterPage('/analytics/portal')
    harness.clock.advance(800)
    reborn.announce(notice('a'))
    expect(reborn.active.value).toBeNull()
  })
})

describe('优先级与抢占', () => {
  it('p1 打断 p2，被打断的那条处理完继续说完', async () => {
    const harness = createHarness()
    await enter(harness)
    harness.center.announce(notice('guide', { category: 'scope', priority: 'p2' }))
    expect(harness.center.active.value?.key).toBe('guide')

    harness.center.announce(notice('task', { category: 'task', priority: 'p1' }))
    expect(harness.center.active.value?.key).toBe('task')

    harness.center.dismiss('user')
    expect(harness.center.active.value?.key).toBe('guide')
  })

  it('p2 不打断 p1', async () => {
    const harness = createHarness()
    await enter(harness)
    harness.center.announce(notice('task', { category: 'task', priority: 'p1' }))
    harness.center.announce(notice('guide', { priority: 'p2' }))
    expect(harness.center.active.value?.key).toBe('task')
  })
})

describe('闭嘴规则', () => {
  it('页面忙碌时压住，恢复后补说', async () => {
    const harness = createHarness()
    await enter(harness)
    harness.center.setBusy('page', true)
    harness.center.announce(notice('a'))
    expect(harness.center.active.value).toBeNull()
    expect(harness.center.badge.value).toBe(true)

    harness.center.setBusy('page', false)
    expect(harness.center.active.value?.key).toBe('a')
  })

  it('DOM 侧判定被挡（输入框聚焦/弹窗开着）时同样压住', async () => {
    const harness = createHarness()
    await enter(harness)
    harness.block('input')
    harness.center.announce(notice('a'))
    expect(harness.center.active.value).toBeNull()

    harness.block(null)
    harness.center.flush()
    expect(harness.center.active.value?.key).toBe('a')
  })

  it('临时安静期间不说，解除后补说', async () => {
    const harness = createHarness()
    await enter(harness)
    harness.center.setQuiet('hour')
    harness.center.announce(notice('a'))
    expect(harness.center.active.value).toBeNull()

    harness.center.setQuiet(null)
    expect(harness.center.active.value?.key).toBe('a')
  })

  it('页面数据未就绪时先压住，声明就绪后再说', async () => {
    const harness = createHarness()
    await enter(harness)
    harness.center.announce(notice('a'), { ready: false })
    expect(harness.center.active.value).toBeNull()
    harness.center.setReady(true)
    expect(harness.center.active.value?.key).toBe('a')
  })
})

describe('用户的控制', () => {
  it('关掉某一类之后这一类不再说，其它类不受影响', async () => {
    const harness = createHarness()
    await enter(harness)
    harness.center.setCategory('scope', false)
    harness.center.announce(notice('a', { category: 'scope' }))
    expect(harness.center.active.value).toBeNull()
  })

  it('静音一条之后不再说，恢复后可以再说', async () => {
    const harness = createHarness()
    await enter(harness)
    harness.center.muteKey('a')
    harness.center.announce(notice('a'))
    expect(harness.center.active.value).toBeNull()

    harness.center.unmuteKey('a')
    harness.center.announce(notice('a'))
    expect(harness.center.active.value?.key).toBe('a')
  })

  it('「本页不再」只静音当前这一页', async () => {
    const harness = createHarness()
    await enter(harness, '/analytics/portal')
    harness.center.mutePage()
    harness.center.announce(notice('a'))
    expect(harness.center.active.value).toBeNull()

    harness.center.enterPage('/workspace/media-storage')
    harness.clock.advance(800)
    harness.center.announce(notice('b'))
    expect(harness.center.active.value?.key).toBe('b')
  })

  it('关闭档不主动说话，但 p1 会冒角标', async () => {
    const harness = createHarness()
    await enter(harness)
    harness.center.setRate('off')
    harness.center.announce(notice('task', { category: 'task', priority: 'p1' }))
    expect(harness.center.active.value).toBeNull()
    expect(harness.center.badge.value).toBe(true)
  })

  it('关掉本体之后不再说话', async () => {
    const harness = createHarness()
    await enter(harness)
    harness.center.setAvatar(false)
    harness.center.announce(notice('a'))
    expect(harness.center.active.value).toBeNull()
  })
})

describe('自动收起与上限', () => {
  it('p2 12 秒自动收起', async () => {
    const harness = createHarness()
    await enter(harness)
    harness.center.announce(notice('a'))
    harness.clock.advance(11_999)
    expect(harness.center.active.value?.key).toBe('a')
    harness.clock.advance(1)
    expect(harness.center.active.value).toBeNull()
  })

  it('p1 不自动收起', async () => {
    const harness = createHarness()
    await enter(harness)
    harness.center.announce(notice('task', { category: 'task', priority: 'p1' }))
    harness.clock.advance(60_000)
    expect(harness.center.active.value?.key).toBe('task')
  })

  it('每日 8 条上限：当天已经说满就只冒角标', async () => {
    const harness = createHarness()
    const at = harness.clock.now()
    const seen: Record<string, { at: number; once: string }> = {}
    for (let index = 0; index < 8; index += 1) seen[`spoken-${index}`] = { at, once: 'day' }
    harness.storage.setItem(ROBOT_SEEN_KEY, JSON.stringify(seen))

    await enter(harness)
    harness.center.announce(notice('task', { category: 'task', priority: 'p1' }))
    expect(harness.center.active.value).toBeNull()
    expect(harness.center.badge.value).toBe(true)
  })

  it('过期消息直接丢弃', async () => {
    const harness = createHarness()
    await enter(harness)
    harness.center.announce(notice('old', { expiresAt: harness.clock.now() - 1 }))
    expect(harness.center.active.value).toBeNull()
  })
})

describe('自我介绍', () => {
  it('每个账号第一次进入后台只说一次，说过就记进偏好', async () => {
    const harness = createHarness()
    // 清掉预置的「已说过」
    writeRobotPrefs(defaultRobotPrefs(), 1, harness.storage)
    await enter(harness)
    expect(harness.center.active.value?.key).toBe(ROBOT_INTRO_KEY)
    expect(harness.center.prefs.value.introSeen).toBe(true)

    harness.center.dismiss('user')
    harness.center.enterPage('/another')
    harness.clock.advance(800)
    expect(harness.center.active.value).toBeNull()
  })
})

describe('登出', () => {
  it('登出清掉本机这一份，重进按默认值', async () => {
    const harness = createHarness()
    await enter(harness)
    harness.center.setRate('off')
    expect(harness.storage.getItem(robotPrefsStorageKey(1))).not.toBeNull()

    await harness.center.attachUser(null)
    expect(harness.storage.getItem(robotPrefsStorageKey(1))).toBeNull()
    expect(harness.center.prefs.value.rate).toBe('standard')
  })
})

describe('对外可见的小纯函数', () => {
  it('今日已说条数只数今天的', () => {
    const now = new Date('2026-11-10T12:00:00').getTime()
    const yesterday = new Date('2026-11-09T12:00:00').getTime()
    expect(
      robotSpokenToday(
        { a: { at: now, once: 'day' }, b: { at: yesterday, once: 'day' } },
        now
      )
    ).toBe(1)
  })
})

describe('每周提醒一次（2026-11-11）', () => {
  it('设为每周后，这一页每天记一次的消息 7 天内不再说，第八天可以说', async () => {
    const harness = createHarness()
    await enter(harness, '/workspace/ai/write')
    harness.center.announce(notice('ai.tip'))
    expect(harness.center.active.value?.key).toBe('ai.tip')
    // 用户在气泡里选「每周提醒一次」：当场收起，这一页口径抬到 7 天
    harness.center.setPageWeekly(true)
    expect(harness.center.active.value).toBeNull()
    expect(harness.center.prefs.value.weeklyPages).toContain('/workspace/ai/write')

    harness.center.announce(notice('ai.tip'))
    expect(harness.center.active.value).toBeNull()

    // 八天后换一页再回来：页级计数（标准档每页 1 条）随 enterPage 换页重置，
    // seen 里的周记录到期——这条才轮得到再说
    harness.clock.advance(8 * 24 * 60 * 60 * 1000)
    await enter(harness, '/workspace/portal/home')
    await enter(harness, '/workspace/ai/write')
    harness.center.announce(notice('ai.tip'))
    expect(harness.center.active.value?.key).toBe('ai.tip')
  })

  it('再点一次是恢复：取消每周后，新消息立刻回到每天口径（旧那条的周记录继续压 7 天）', async () => {
    const harness = createHarness()
    await enter(harness, '/workspace/ai/write')
    harness.center.announce(notice('ai.tip'))
    harness.center.setPageWeekly(true)
    harness.center.setPageWeekly(false)
    expect(harness.center.prefs.value.weeklyPages).not.toContain('/workspace/ai/write')
    // 同一条还压着「周」记录（点每周那一下当场改记的），7 天内不会重复
    harness.center.announce(notice('ai.tip'))
    expect(harness.center.active.value).toBeNull()
    // 但新消息不再抬口径：day 记录当天内不说、跨天即说——与没设过每周的页面一致
    await enter(harness, '/workspace/portal/home')
    harness.clock.advance(24 * 60 * 60 * 1000)
    await enter(harness, '/workspace/ai/write')
    harness.center.announce(notice('ai.fresh'))
    expect(harness.center.active.value?.key).toBe('ai.fresh')
  })

  it('每周与整页静音互斥：进哪边都把另一边摘掉', async () => {
    const harness = createHarness()
    await enter(harness, '/workspace/ai/write')
    harness.center.setPageWeekly(true)
    harness.center.mutePage()
    expect(harness.center.prefs.value.mutedPages).toContain('/workspace/ai/write')
    expect(harness.center.prefs.value.weeklyPages).not.toContain('/workspace/ai/write')

    harness.center.unmutePage('/workspace/ai/write')
    harness.center.setPageWeekly(true)
    expect(harness.center.prefs.value.weeklyPages).toContain('/workspace/ai/write')
    expect(harness.center.prefs.value.mutedPages).not.toContain('/workspace/ai/write')
  })

  it('全部恢复连每周清单一起清空', async () => {
    const harness = createHarness()
    await enter(harness, '/workspace/ai/write')
    harness.center.setPageWeekly(true)
    harness.center.muteKey('some.key')
    harness.center.restoreAll()
    expect(harness.center.prefs.value.weeklyPages).toEqual([])
    expect(harness.center.prefs.value.mutedKeys).toEqual([])
    expect(harness.center.prefs.value.mutedPages).toEqual([])
  })

  it('自由位置夹紧在安全范围里；选回角落会清掉自由位置', () => {
    const harness = createHarness()
    harness.center.setFreePosition({ x: 200, y: -5 })
    expect(harness.center.prefs.value.positionFree).toEqual({ x: 92, y: 15 })
    harness.center.setPosition('bl')
    expect(harness.center.prefs.value.positionFree).toBeNull()
    expect(harness.center.prefs.value.position).toBe('bl')
  })
})
