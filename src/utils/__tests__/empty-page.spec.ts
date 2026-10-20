import { describe, expect, it } from 'vitest'
import {
  JUMP_BACK_NOTICE,
  asEmptyReason,
  offersCreateOnEmpty,
  shouldJumpBackToFirstPage,
} from '../emptyPage'

/**
 * 「列表这一格没行」那两件事的判据出处（M-P53 拍板「两个动作：翻过头自动跳回 + 真的没有给新建按钮」）。
 *
 * 钉三件：
 * 1. **只认后端词表里那三档**——`NOT_ANSWERED` 这一档本轮已从后端删掉（「后端没答」是一种缺答案，
 *    不是一种成因）。界面对认识不出的取值一律当「没答」，不许自己补一档、也不许蒙成「真的没有」。
 * 2. **自动跳回要有防来回跳的那一半**——判据带 current>1，回到第一页那一发不可能再触发它。
 * 3. **「读不到」与「翻过头」都不摆新建入口**——那两种空不是说「这一档还空着」，
 *    在这两格下劝人去新建，等于帮人攒重复行。
 */

describe('asEmptyReason：只认后端那三档', () => {
  it.each(['NONE', 'NOT_VISIBLE', 'OUT_OF_RANGE'] as const)('%s 原样收下', (code) => {
    expect(asEmptyReason(code)).toBe(code)
  })

  it('已被删掉的 NOT_ANSWERED 不再是一档，当成「后端没答」', () => {
    expect(asEmptyReason('NOT_ANSWERED')).toBeNull()
  })

  it('认不出的取值、空串、null、undefined 都当「后端没答」，不替它挑一种成因', () => {
    expect(asEmptyReason('SOMETHING_ELSE')).toBeNull()
    expect(asEmptyReason('')).toBeNull()
    expect(asEmptyReason(null)).toBeNull()
    expect(asEmptyReason(undefined)).toBeNull()
  })
})

describe('shouldJumpBackToFirstPage：只有翻过头才翻页', () => {
  it('后端说翻过头、且人现在不在第一页 → 自己翻回第一页', () => {
    expect(shouldJumpBackToFirstPage('OUT_OF_RANGE', 3)).toBe(true)
  })

  it('已经在第一页时不再触发：这一条挡的就是来回跳', () => {
    expect(shouldJumpBackToFirstPage('OUT_OF_RANGE', 1)).toBe(false)
  })

  it.each(['NONE', 'NOT_VISIBLE', null, undefined] as const)('%s 不翻页', (reason) => {
    expect(shouldJumpBackToFirstPage(reason, 7)).toBe(false)
  })
})

describe('offersCreateOnEmpty：只有「真的没有」才给新建入口', () => {
  it('真的没有 → 摆新建', () => {
    expect(offersCreateOnEmpty('NONE')).toBe(true)
  })

  it.each(['NOT_VISIBLE', 'OUT_OF_RANGE', null, undefined] as const)('%s → 不摆', (reason) => {
    expect(offersCreateOnEmpty(reason)).toBe(false)
  })
})

describe('翻过头那一句提示', () => {
  it('界面上摆的是这一句（它说的是界面刚做的动作，不进后端那句表）', () => {
    expect(JUMP_BACK_NOTICE).toBe('刚才那一页超出总页数了，已自动翻回第一页。')
  })
})
