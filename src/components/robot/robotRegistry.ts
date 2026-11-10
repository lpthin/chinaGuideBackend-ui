/**
 * 来源注册表与优先级表（SPEC-UI-11 §4.1 的 sources 层）。
 *
 * 每条消息都带 `sourceId`，中枢按这张表判定它的默认分类与默认优先级——
 * 页面投递时可以显式覆盖，但「这条属于谁、出事时归因给谁」只在这里登记一次。
 *
 * 新增一类来源时改这一张表，不要在页面里另起一个字符串。
 */
import { ROBOT_MODULE_CARDS } from '../../copy/robot'
import type { RobotCategory, RobotNotice, RobotPriority } from './robotTypes'

export const ROBOT_SOURCES = {
  /** 页面自己注册的提示（口径、前置条件、操作引导） */
  page: 'page.notice',
  /** 待办未读、上线清单 */
  task: 'signal.task',
  /** 站点体检、任务结果 */
  system: 'signal.system',
  /** 首访模块知识卡与自我介绍 */
  onboarding: 'source.onboarding'
} as const

export type RobotSourceId = typeof ROBOT_SOURCES[keyof typeof ROBOT_SOURCES]

export interface RobotSourceDef {
  id: string
  /** 出现在设置面板「已静音」列表里的来源名 */
  label: string
  category: RobotCategory
  priority: RobotPriority
}

export const ROBOT_SOURCE_DEFS: RobotSourceDef[] = [
  { id: ROBOT_SOURCES.page, label: '页面说明', category: 'scope', priority: 'p2' },
  { id: ROBOT_SOURCES.task, label: '任务与待办', category: 'task', priority: 'p1' },
  { id: ROBOT_SOURCES.system, label: '系统提醒', category: 'system', priority: 'p1' },
  { id: ROBOT_SOURCES.onboarding, label: '上手引导', category: 'guide', priority: 'p2' }
]

export function robotSource(sourceId: string): RobotSourceDef | null {
  return ROBOT_SOURCE_DEFS.find(item => item.id === sourceId) ?? null
}

/**
 * 模块知识卡 → 一条消息。
 *
 * 首访某模块时讲一次「这里能做什么、前提是什么」（§7.1）。`once: 'session'` 而不是 `'ever'`：
 * 用户每天回来上班时值得再被提醒一次这一组是干什么的，而同一场会话里不重复。
 * 模块 key 不在表里时返回 null——宁可不说，也不现编一句。
 */
export function moduleNotice(moduleKey: string, now: number): RobotNotice | null {
  const card = ROBOT_MODULE_CARDS[moduleKey]
  if (!card) return null
  return {
    key: `module.${moduleKey}`,
    category: 'guide',
    priority: 'p2',
    text: card.text,
    detail: card.detail,
    once: 'session',
    // 模块卡是会过期的口径：写文案的那一天起 180 天，之后要重新评审一遍
    expiresAt: now + 180 * 24 * 60 * 60 * 1000,
    sourceId: ROBOT_SOURCES.onboarding
  }
}

/** 页面投递消息时允许省略 sourceId / 分类 / 优先级，由注册表补默认值 */
export type RobotNoticeInput = Omit<RobotNotice, 'sourceId' | 'category' | 'priority'> & {
  sourceId?: string
  category?: RobotCategory
  priority?: RobotPriority
}

export function withSourceDefaults(notice: RobotNoticeInput): RobotNotice {
  const def = robotSource(notice.sourceId ?? ROBOT_SOURCES.page)
  return {
    ...notice,
    category: notice.category ?? def?.category ?? 'guide',
    priority: notice.priority ?? def?.priority ?? 'p2',
    sourceId: def?.id ?? ROBOT_SOURCES.page
  }
}
