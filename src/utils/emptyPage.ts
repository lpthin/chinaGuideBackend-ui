/**
 * 分页读口回的空态在界面上该做哪两件事（M-P53 拍板「两个：翻过头自动跳回 + 没有时给个新建按钮」）。
 *
 * 为什么单开一份：这几屏（报警记录 / 报警规则 / 通知渠道 / 客户案例）各自都要判同一件事，
 * 而判据只应该有一处。抄四份的话，「翻过头」那一档自动跳回这件事就会在某一屏漏掉。
 *
 * 话术的分工要说清楚：`emptyLine` 是后端那份唯一的成因原文（`EmptyResultReasons`），
 * 这里只写界面自己的动作（「已经替你翻回第一页」），不重抄那句成因。
 */

/** 后端 `emptyReason` 那一个格子的取值；null 或没有这一格 = 这一发后端没答是哪一种空 */
export type EmptyReason = 'NONE' | 'NOT_VISIBLE' | 'OUT_OF_RANGE' | null | undefined

const CODES: readonly EmptyReason[] = ['NONE', 'NOT_VISIBLE', 'OUT_OF_RANGE'] as const

/**
 * 把后端回的那一格收成界面认得的三种，别的一律当「没答」。
 *
 * 后端以后加一档（或这一发根本回的是别的东西）时，界面宁可退回自己那句兜底话，
 * 也不许把一个不认识的码当成某一种已知的空念出去。
 */
export function asEmptyReason(raw: string | null | undefined): EmptyReason {
  return CODES.includes(raw as EmptyReason) ? (raw as EmptyReason) : null
}

/**
 * 「这一页翻过了头」要不要自动翻回第一页。
 *
 * `current > 1` 这一条不是防呆而是防死循环：翻回第一页之后 `current` 就是 1，
 * 判据自然再也不会成立，所以最多只会多发一发。第一页本身没行是「真的没有」那一档，
 * 后端不会回 `OUT_OF_RANGE`（总条数为 0 时判的是 `NONE`）。
 */
export function shouldJumpBackToFirstPage(reason: EmptyReason, current: number): boolean {
  return reason === 'OUT_OF_RANGE' && current > 1
}

/**
 * 「真的没有」那一档要不要摆新建的入口。
 *
 * 只认后端答了 `NONE` 的那一发：读不到（`NOT_VISIBLE`）与翻过头（`OUT_OF_RANGE`）都不许摆，
 * 因为那两种空不是说「这一档还空着」，摆出来就是让人去补一份根本不缺的东西。
 * 后端没答（null）同样不摆——界面不知道它是哪一种，就不该替它决定。
 */
export function offersCreateOnEmpty(reason: EmptyReason): boolean {
  return reason === 'NONE'
}

/** 界面自己的动作说明：它不解释数据为什么空，只说刚刚替你做了什么 */
export const JUMP_BACK_NOTICE = '刚才那一页超出总页数了，已自动翻回第一页。'
