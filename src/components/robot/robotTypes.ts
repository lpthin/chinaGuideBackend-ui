/**
 * 引导机器人的消息契约与常量（SPEC-UI-11 §4.3 / §5）。
 *
 * 这一份是「页面」与「机器人」之间**唯一**的耦合点：
 * - `views/` 只认识 `RobotNotice` 与 `useRobotNotices()`，不认识气泡与形象；
 * - `components/robot/` 只认识这一份契约，不允许 import 任何 `views/` 下的东西。
 *
 * 两侧的边界由 `src/components/robot/__tests__/robot-boundary.spec.ts` 扫描 import 守住。
 * 改这里的字段等于改两侧的约定，先改文档再改代码。
 */

/** 内容来源分类：决定它归到设置面板的哪一个开关下 */
export type RobotCategory = 'scope' | 'guide' | 'task' | 'system' | 'announce'

/** 优先级只影响排序与是否可自动收起，与页内 `a-alert` 的 type 不是一回事 */
export type RobotPriority = 'p0' | 'p1' | 'p2' | 'p3'

/** 频率四档（§5.1），默认「标准」 */
export type RobotFrequency = 'off' | 'quiet' | 'standard' | 'active'

/**
 * 去重口径。v1 的四档全部落 `localStorage`：
 * - 跨标签页要求「开 8 个标签也只说一次」，只记内存或 sessionStorage 做不到；
 * - 验收 #2 要求「刷新同一页不再重复说」，`page` 档也必须跨刷新。
 * 因此 `session` / `page` 在存储层按「当天」记，语义上仍按一次会话 / 一次页面访问解释。
 */
export type RobotDedupe = 'session' | 'page' | 'day' | 'ever'

/** 形象位置：右下（默认）/ 左下，记忆用户选择 */
export type RobotPosition = 'br' | 'bl'

/** 气泡里的动作，最多两个（§4.3） */
export interface RobotAction {
  label: string
  kind: 'navigate' | 'dismiss'
  /** `kind === 'navigate'` 时的站内路径 */
  to?: string
}

/** 页面投递给中枢的一条消息 */
export interface RobotNotice {
  /** 去重与静音的稳定标识，如 'analytics.scope'。改了文案不要改 key */
  key: string
  category: RobotCategory
  priority: RobotPriority
  /** 一句话，建议 ≤ 60 字；长解释放 detail，点开才看 */
  text: string
  detail?: string
  /** 已经有文档或手册时优先指向它，`detail` 不再抄全文（§10「不另写一份」） */
  docUrl?: string
  /** 最多两个：去看 / 知道了 */
  actions?: RobotAction[]
  once?: RobotDedupe
  /** 失效条件：过期即不再说，避免旧口径长期挂着 */
  expiresAt?: number
  /** 来源标识，用于开关与度量归因 */
  sourceId: string
}

/** 设置面板里五个内容开关的顺序与含义（文案在 copy/robot.ts） */
export const ROBOT_CATEGORIES: RobotCategory[] = ['scope', 'guide', 'task', 'system', 'announce']

/** 数字越小越优先；p0 留给「失败后的下一步」，v1 不使用 */
export const ROBOT_PRIORITY_ORDER: Record<RobotPriority, number> = {
  p0: 0,
  p1: 1,
  p2: 2,
  p3: 3
}

/** 频率四档的排布顺序（设置面板的单选项） */
export const ROBOT_FREQUENCIES: RobotFrequency[] = ['off', 'quiet', 'standard', 'active']

/**
 * 每一档的硬边界（§5.1 那张表）。
 * `categories: null` / `priorities: null` 表示不额外收紧，只受下面的条数限制。
 */
export interface RobotRateRule {
  /** 每页首访最多主动说几条 */
  perPage: number
  /** 每日上限 */
  daily: number
  /** 允许主动说的分类 */
  categories: RobotCategory[] | null
  /** 允许主动说的优先级 */
  priorities: RobotPriority[] | null
}

export const ROBOT_RATE_RULES: Record<RobotFrequency, RobotRateRule> = {
  off: { perPage: 0, daily: 0, categories: null, priorities: null },
  // 安静：只说任务结果与系统提醒，且只说的 p1
  quiet: { perPage: 1, daily: 3, categories: ['task', 'system'], priorities: ['p0', 'p1'] },
  // 标准：p1 + p2 的第一条，每页 1 条、每日 8 条
  standard: { perPage: 1, daily: 8, categories: null, priorities: ['p0', 'p1', 'p2'] },
  // 积极：都主动说，每页 2 条、每日 15 条
  active: { perPage: 2, daily: 15, categories: null, priorities: ['p0', 'p1', 'p2', 'p3'] }
}

/** 队列上限：超过只留角标，不排队（§5.2） */
export const ROBOT_QUEUE_LIMIT = 3

/** p2 / p3 自动收起时长；p1 不自动收（§9） */
export const ROBOT_AUTO_HIDE_MS = 12000

/** 路由切换后延迟再说话，避免打断首屏加载（§5.2） */
export const ROBOT_ROUTE_DELAY_MS = 800

/** 静音清单上限，超限淘汰最久未命中的（§5.4） */
export const ROBOT_MUTE_LIMIT = 200

/** 跨标签去重记录；key → { at, once } */
export const ROBOT_SEEN_KEY = 'robot_seen_v1'

/** 偏好存储前缀，实际键为 `robot_prefs_v1:<userId>`，未登录时用 `anon`（§5.4） */
export const ROBOT_PREFS_KEY = 'robot_prefs_v1'

/** 偏好结构版本：结构变了就抬这个数，旧结构整体回落默认值 */
export const ROBOT_PREFS_SCHEMA = 1

/** 自我介绍这一条的 key：每个账号只说一次，之后不再说 */
export const ROBOT_INTRO_KEY = 'robot.intro'
