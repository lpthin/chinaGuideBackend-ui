import type { RouteLocationRaw } from 'vue-router'

/**
 * D 型「检查清单」页的判定（Spec-Q §4.1 D 型，P4 落地；与 ChecklistPage.vue 同一份契约）。
 *
 * 收在文件里而不是组件里的原因和 C 型那份一样：完成度读数最容易被写歪。
 * 这一型的歪法有两种——把「没取到数」和「取到了、确实缺」混成一格，
 * 或者把「齐了几步」的分母抄成当下渲染出来的行数。所以分子、分母、还差哪几步，
 * 全部由下面两个纯函数从**页面声明的步骤清单**算出来，页面不许另写一个数。
 */

/**
 * 一行现在的形状。四档是穷举，不是可选：
 * - ready 取到了、齐了；todo 取到了、确实缺；
 * - blocked 取到了、这一条现在就把上线挡住；
 * - unknown 这一格根本没取到数（没读回来、没权限、没选客户都算它）。
 *
 * unknown 单独一档是这一型的关键：门户上线那一屏现场就有两格停在「未取到」上，
 * 把它们算进「还差」等于替后端说了一句它没说过的话。
 */
export type ChecklistLevel = 'ready' | 'todo' | 'blocked' | 'unknown'

/** 档位 → antd 角标的颜色（界面上唯一的颜色出处，页面不再各写一个） */
export const CHECKLIST_LEVEL_COLOR: Record<ChecklistLevel, string> = {
  ready: 'green',
  todo: 'orange',
  blocked: 'red',
  unknown: 'default',
}

/** 「去哪儿补」那一个链接：给 to 走站内路由，给 href 走外部地址，两个都不给就只念文字 */
export interface ChecklistLink {
  label: string
  to?: RouteLocationRaw
  href?: string
}

export interface ChecklistStep {
  /** 锚点与「去哪儿补」定位用；也是步骤的唯一身份 */
  key: string
  /** 这一行说的那件事（「站点与访问域名」），大字与缺项清单念的都是它 */
  title: string
  level: ChecklistLevel
  /**
   * 角标那句中文，必须来自后端原话或按后端字段算出的那一句（I-1）。
   * 模板不许自己造「未完成」这种词。
   */
  stateText: string
  /** 差什么 / 为什么是这一档。空串 = 这一行不摆那句补充 */
  gap?: string
  /** 去哪儿补。unknown 那一档必须带一条，否则「未取到」就只是一个 24px 大字 */
  links?: ChecklistLink[]
}

export interface ChecklistProgress {
  /** 声明了几步（分母） */
  total: number
  /** 其中齐了的（分子） */
  ready: number
  /** 没齐的（todo 与 blocked），带标题，点了跳过去 */
  pending: { key: string; title: string }[]
  /** 没取到数的（unknown）单独一组：它不是「还差」，是「还不知道」 */
  notMeasured: { key: string; title: string }[]
}

/**
 * 整页读数。只有 ready 进分子；
 * todo/blocked 进「还差」，unknown 进「没取到」——三组各说各的，不合并。
 */
export function checklistProgress(steps: readonly ChecklistStep[]): ChecklistProgress {
  const pending: { key: string; title: string }[] = []
  const notMeasured: { key: string; title: string }[] = []
  let ready = 0
  for (const step of steps) {
    if (step.level === 'ready') {
      ready += 1
      continue
    }
    if (step.level === 'unknown') {
      notMeasured.push({ key: step.key, title: step.title })
      continue
    }
    pending.push({ key: step.key, title: step.title })
  }
  return { total: steps.length, ready, pending, notMeasured }
}

/**
 * 读数那句中文（只在这一处拼）。
 *
 * 「齐了几步」不说「完成度百分之几」：这一屏的五步不是等权的，
 * 20% 会把人引导去算「还剩多少活」，而真正要说的是哪几步没齐、哪几步还不知道。
 */
export function checklistProgressText(progress: ChecklistProgress): string {
  return `${progress.total} 步里齐了 ${progress.ready} 步`
}

/** 还差哪几步那句（中文只在这一处拼）；一步都不差时返回空串，界面就不摆这一句 */
export function checklistPendingText(progress: ChecklistProgress): string {
  return progress.pending.length ? `还差：${progress.pending.map(step => step.title).join('、')}` : ''
}

/** 没取到数的那几步那句；没有就返回空串 */
export function checklistNotMeasuredText(progress: ChecklistProgress): string {
  return progress.notMeasured.length
    ? `还不知道：${progress.notMeasured.map(step => step.title).join('、')}`
    : ''
}

/** 锚点 id：模板里那一排的 href 和每一行的 id 都从这一个函数来 */
export function checklistAnchorId(key: string): string {
  return `checklist-step-${key}`
}
