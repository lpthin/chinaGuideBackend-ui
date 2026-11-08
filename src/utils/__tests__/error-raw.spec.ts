import { describe, it, expect } from 'vitest'
import { rememberRawDetail, errorRawDetail, listRawDetails } from '../errorRaw'

/**
 * SPEC-UI-8 G2：原文台账从「人话 → 一段串」升级为带时间与页面的记录，
 * 现有两个读法的语义不变，页面零改动。
 */
describe('原文台账', () => {
  it('errorRawDetail 仍只回原文串（错误块显示不变）', () => {
    rememberRawDetail('读口断了', 'GET /api/audit-logs → HTTP 500')
    expect(errorRawDetail('读口断了')).toBe('GET /api/audit-logs → HTTP 500')
  })

  it('每条记录带发生时间与页面，供诊断包按时间线导出', () => {
    rememberRawDetail('读口断了-2', 'requestId: req-2')
    const entry = listRawDetails().find((item) => item.humanText === '读口断了-2')
    expect(entry).toBeTruthy()
    expect(entry?.rawText).toBe('requestId: req-2')
    expect(entry?.at).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    expect(entry?.page).toBe(typeof window !== 'undefined' ? window.location.pathname : '')
  })

  it('最近记录排在最前：重记一条会从旧位置挪到队首', () => {
    rememberRawDetail('甲', '原文甲')
    rememberRawDetail('乙', '原文乙')
    rememberRawDetail('甲', '原文甲-新')
    const entries = listRawDetails()
    expect(entries[0].humanText).toBe('甲')
    expect(entries[0].rawText).toBe('原文甲-新')
  })

  it('空串与「人和原文恰好相同」不记（不在错误块里摆空壳）', () => {
    const before = listRawDetails().length
    rememberRawDetail('', '原文')
    rememberRawDetail('同一句', '同一句')
    expect(listRawDetails().length).toBe(before)
    expect(errorRawDetail('同一句')).toBeNull()
  })
})
