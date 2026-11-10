/**
 * 信号源（SPEC-UI-11 §7.2 / R-7 / R-8）：待办未读、站点体检、引用探测。
 *
 * 三条纪律：
 * 1. 只走现有 `src/api` 层，不自己拼请求、不新增后端依赖；租户隔离与鉴权沿用登录态。
 * 2. 每一条都经中枢，因此天然有「类别开关 + 频率上限 + 静音」三道闸；这里只负责
 *    「取到什么、说哪一句」，不再另写一套开关判断。
 * 3. 采集失败一律静默：信号是后台能力，读不到就当没有，绝不能在界面上报错。
 *
 * `api` 用动态 `import()`：`api/http.ts` 会引 router，router 又引 views，静态引入会绕成环。
 */
import { ROBOT_SIGNAL_CARDS } from '../../copy/robot'
import { ROBOT_SOURCES } from './robotRegistry'
import type { RobotCenter } from './robotCenter'

/** 一次采集最多说几条：信号再多也只说最要紧的，其余留给页面与角标（§5.2） */
export const ROBOT_SIGNAL_LIMIT = 2

/** 采集时的登录态与权限：没有客户上下文时一律不说，避免跨租户串数据 */
export interface RobotSignalContext {
  isSuperAdmin: boolean
  selectedTenantId: number | null
  hasPermission: (code: string) => boolean
}

/** 一条待投递的信号；`to` 为站内路径，点「去看」才跳转 */
export interface RobotSignal {
  key: string
  category: 'task' | 'system'
  priority: 'p1' | 'p2'
  text: string
  detail: string
  to: string
}

export interface RobotSignalDeps {
  unreadTodos: () => Promise<number>
  openHealthFindings: () => Promise<number>
  lastCitation: () => Promise<{ citedTargets: number, totalTargets: number } | null>
}

let remoteDeps: RobotSignalDeps | null = null

function defaultDeps(): RobotSignalDeps {
  if (remoteDeps) return remoteDeps
  remoteDeps = {
    async unreadTodos() {
      const { notificationsApi } = await import('../../api/notifications')
      const result = await notificationsApi.unreadCount()
      return Number(result.total) || 0
    },
    async openHealthFindings() {
      const { portalHealthApi } = await import('../../api/portalHealth')
      const page = await portalHealthApi.findings({ status: 'open' })
      return Number(page.total) || page.records.length
    },
    async lastCitation() {
      const { citationApi } = await import('../../api/citation')
      const latest = await citationApi.summaryLatest()
      const summary = latest.summary
      if (!summary) return null
      return { citedTargets: summary.citedTargets, totalTargets: summary.totalTargets }
    }
  }
  return remoteDeps
}

/** 每一发各自收尾：任何一格读失败都只是这一条不说，不连累其他信号 */
async function safe<T>(read: () => Promise<T>): Promise<T | null> {
  try {
    return await read()
  } catch {
    return null
  }
}

/** 取到的信号按「待办 → 体检 → 引用」的顺序排，调用方只取前 `ROBOT_SIGNAL_LIMIT` 条 */
export async function collectRobotSignals(
  center: Pick<RobotCenter, 'announce'>,
  context: RobotSignalContext,
  deps: RobotSignalDeps = defaultDeps()
): Promise<RobotSignal[]> {
  // 超管没选客户时，待办是全平台的、体检与引用没有站点口径：宁可不说话，也不念一份来路不明的手数
  if (context.isSuperAdmin && context.selectedTenantId === null) return []

  const signals: RobotSignal[] = []

  const unread = await safe(deps.unreadTodos)
  if (unread !== null && unread > 0) {
    const card = ROBOT_SIGNAL_CARDS['signal.todo.unread']
    signals.push({
      key: 'signal.todo.unread',
      category: 'task',
      priority: 'p1',
      text: card.text(unread),
      detail: card.detail,
      to: '/workspace/notifications'
    })
  }

  if (context.hasPermission('portal:build:health')) {
    const open = await safe(deps.openHealthFindings)
    if (open !== null && open > 0) {
      const card = ROBOT_SIGNAL_CARDS['signal.health.open']
      signals.push({
        key: 'signal.health.open',
        category: 'system',
        priority: 'p2',
        text: card.text(open),
        detail: card.detail,
        to: '/workspace/portal/health'
      })
    }
  }

  if (context.hasPermission('analytics:view')) {
    const citation = await safe(deps.lastCitation)
    if (citation && citation.totalTargets > 0) {
      const card = ROBOT_SIGNAL_CARDS['signal.citation.latest']
      signals.push({
        key: 'signal.citation.latest',
        category: 'system',
        priority: 'p2',
        text: card.text(citation.citedTargets, citation.totalTargets),
        detail: card.detail,
        to: '/workspace/portal/citations'
      })
    }
  }

  for (const signal of signals.slice(0, ROBOT_SIGNAL_LIMIT)) {
    center.announce(
      {
        key: signal.key,
        category: signal.category,
        priority: signal.priority,
        text: signal.text,
        detail: signal.detail,
        actions: [{ label: '去看', kind: 'navigate', to: signal.to }],
        // 同一条信号一天说一次：条数会变，但「有待办要看」这件事没必要每页重复
        once: 'day',
        sourceId: signal.category === 'task' ? ROBOT_SOURCES.task : ROBOT_SOURCES.system
      },
      { ready: true }
    )
  }

  return signals
}
