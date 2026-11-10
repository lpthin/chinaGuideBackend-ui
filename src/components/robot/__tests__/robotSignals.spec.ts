import { describe, expect, it, vi } from 'vitest'
import { collectRobotSignals, ROBOT_SIGNAL_LIMIT, type RobotSignalContext, type RobotSignalDeps } from '../robotSignals'
import type { RobotCenter } from '../robotCenter'
import { ROBOT_SIGNAL_CARDS } from '../../../copy/robot'

/**
 * 信号源（SPEC-UI-11 §7.2 / P5）的约定。
 *
 * 这里不测中枢的频率与静音——那是 `robotCenter.spec.ts` 的事。这一份只钉信号源自己的四条：
 * 1. 说法与去处固定，上限生效（一次最多说 `ROBOT_SIGNAL_LIMIT` 条）；
 * 2. 超管没选客户时一个字都不念，也不发请求（避免跨租户串数据）；
 * 3. 任何一格读失败都静默，不连累其他信号；
 * 4. 页面侧的上线清单与任务回执只登记 key，正文只在 `copy/robot.ts` 写一份。
 */
const sources = import.meta.glob(
  [
    '../../../copy/robot.ts',
    '../../../composables/useRobotNotices.ts',
    '../../../views/workspace/NotificationInboxView.vue',
    '../../../views/workspace/ArticleGeneratePanel.vue',
    '../../../views/onboarding/PortalLaunchView.vue'
  ],
  { query: '?raw', import: 'default', eager: true }
) as Record<string, string>

function source(suffix: string): string {
  const path = Object.keys(sources).find(key => key.endsWith(suffix))
  if (!path) throw new Error(`没找到源码：${suffix}`)
  return sources[path]
}

function fakeCenter() {
  const announced: Parameters<RobotCenter['announce']>[0][] = []
  const center = {
    announce: (input: Parameters<RobotCenter['announce']>[0]) => {
      announced.push(input)
    }
  } as unknown as Pick<RobotCenter, 'announce'>
  return { center, announced }
}

const CONTEXT: RobotSignalContext = {
  isSuperAdmin: false,
  selectedTenantId: 3,
  hasPermission: () => true
}

function okDeps(overrides: Partial<RobotSignalDeps> = {}): RobotSignalDeps {
  return {
    unreadTodos: async () => 5,
    openHealthFindings: async () => 2,
    lastCitation: async () => ({ citedTargets: 3, totalTargets: 10 }),
    ...overrides
  }
}

describe('信号源只报条数与去处', () => {
  it('待办、体检、引用各一条，但一次最多说两条', async () => {
    const { center, announced } = fakeCenter()
    const signals = await collectRobotSignals(center, CONTEXT, okDeps())

    expect(signals.map(signal => signal.key)).toEqual([
      'signal.todo.unread',
      'signal.health.open',
      'signal.citation.latest'
    ])
    expect(announced).toHaveLength(ROBOT_SIGNAL_LIMIT)
    expect(announced.map(item => item.key)).toEqual(['signal.todo.unread', 'signal.health.open'])
    expect(announced[0].text).toContain('5')
    expect(announced[1].text).toContain('2')
  })

  it('每条信号都登记了文案、走一天一次、带上「去看」', async () => {
    const { center, announced } = fakeCenter()
    await collectRobotSignals(center, CONTEXT, okDeps())

    for (const notice of announced) {
      expect(Object.keys(ROBOT_SIGNAL_CARDS)).toContain(notice.key)
      expect(notice.once).toBe('day')
      expect(notice.actions?.[0]?.kind).toBe('navigate')
      expect(notice.actions?.[0]?.to).toMatch(/^\/workspace\//)
    }
    expect(announced.map(item => item.category)).toEqual(['task', 'system'])
  })

  it('超管没选客户时一个字都不念，也不发请求', async () => {
    const { center, announced } = fakeCenter()
    const deps = okDeps({
      unreadTodos: vi.fn(okDeps().unreadTodos),
      openHealthFindings: vi.fn(okDeps().openHealthFindings),
      lastCitation: vi.fn(okDeps().lastCitation)
    })
    const signals = await collectRobotSignals(
      center,
      { ...CONTEXT, isSuperAdmin: true, selectedTenantId: null },
      deps
    )

    expect(signals).toEqual([])
    expect(announced).toEqual([])
    expect(deps.unreadTodos).not.toHaveBeenCalled()
    expect(deps.openHealthFindings).not.toHaveBeenCalled()
    expect(deps.lastCitation).not.toHaveBeenCalled()
  })

  it('读失败静默：一格挂了不影响其他信号', async () => {
    const { center, announced } = fakeCenter()
    const signals = await collectRobotSignals(
      center,
      CONTEXT,
      okDeps({
        unreadTodos: async () => {
          throw new Error('500')
        }
      })
    )

    expect(signals.map(signal => signal.key)).toEqual([
      'signal.health.open',
      'signal.citation.latest'
    ])
    expect(announced).toHaveLength(2)
  })

  it('没有权限的格子不发请求', async () => {
    const { center, announced } = fakeCenter()
    const deps = okDeps({
      openHealthFindings: vi.fn(okDeps().openHealthFindings),
      lastCitation: vi.fn(okDeps().lastCitation)
    })
    await collectRobotSignals(center, { ...CONTEXT, hasPermission: () => false }, deps)

    expect(announced.map(item => item.key)).toEqual(['signal.todo.unread'])
    expect(deps.openHealthFindings).not.toHaveBeenCalled()
    expect(deps.lastCitation).not.toHaveBeenCalled()
  })
})

describe('页面侧的上线清单与任务回执', () => {
  it('待办页不再留常驻说明，口径只在 copy/robot.ts 登记一次', () => {
    const view = source('workspace/NotificationInboxView.vue')
    expect(view).not.toContain('<a-alert')
    expect(view).toContain("ROBOT_PAGE_CARDS['workspace.notifications.intro']")
    expect(source('copy/robot.ts')).toContain("'workspace.notifications.intro'")
  })

  it('上线清单播报只报下一步，正文读同一份 copy', () => {
    const view = source('onboarding/PortalLaunchView.vue')
    expect(view).toContain("ROBOT_SIGNAL_CARDS['signal.launch.next']")
    expect(view).toContain('checklistProgress')
    expect(view).toContain("key: 'signal.launch.next'")
  })

  it('任务回执由 composable 统一归到 task 来源，生成完成处只登记 key', () => {
    const composable = source('composables/useRobotNotices.ts')
    expect(composable).toContain('sourceId: ROBOT_SOURCES.task')
    expect(composable).toContain("category: 'task'")
    const panel = source('workspace/ArticleGeneratePanel.vue')
    expect(panel).toContain('robot.taskResult')
    expect(panel).toContain("ROBOT_SIGNAL_CARDS['task.article.generated']")
  })
})
