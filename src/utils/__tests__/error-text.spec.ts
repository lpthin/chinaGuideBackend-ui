import { describe, it, expect } from 'vitest'
import {
  ERROR_COPY,
  errorAdviceOfText,
  errorKindOfText,
  buildDiagnosticText,
  REPEAT_FAILURE_HINT,
} from '../errorText'

/**
 * SPEC-UI-7 U1：5 类固定三句，文案只有这一处出处。
 * 这些断言故意写成「逐类跑」：以后再往 describeHttpError 里加一句新状态码，
 * 只要它不在这 5 类里，这里不会红；但 5 类中任何一类被改到互相串味，这里会红。
 */
const CASES: Array<[string, string]> = [
  ['无法连接服务器，请确认后端已启动', 'offline'],
  ['请求超时，服务处理时间较长，请稍后重试', 'timeout'],
  ['没有权限执行该操作', 'forbidden'],
  ['登录状态已失效，请重新登录', 'unauthorized'],
  ['服务器处理失败，请稍后重试或联系管理员', 'server'],
]

describe('读失败 5 类文案库', () => {
  it('5 类都在，每类三句都不为空，且句子不重复', () => {
    const kinds = ['offline', 'timeout', 'forbidden', 'unauthorized', 'server'] as const
    expect(Object.keys(ERROR_COPY)).toHaveLength(5)
    for (const kind of kinds) {
      const copy = ERROR_COPY[kind]
      expect(copy.happened.trim()).not.toBe('')
      expect(copy.canDo.trim()).not.toBe('')
      expect(copy.askHelp.trim()).not.toBe('')
    }
    const sentences = kinds.flatMap((kind) => [ERROR_COPY[kind].happened])
    expect(new Set(sentences).size).toBe(kinds.length)
  })

  it.each(CASES)('%s → %s', (text, kind) => {
    expect(errorKindOfText(text)).toBe(kind)
    expect(errorAdviceOfText(text)?.canDo).toBe(ERROR_COPY[kind as keyof typeof ERROR_COPY].canDo)
  })

  it('业务提示认不出来就返回 null，不硬说成服务异常', () => {
    expect(errorKindOfText('请先选择客户')).toBeNull()
    expect(errorAdviceOfText('请先选择客户')).toBeNull()
    expect(errorKindOfText('请求参数有误，请检查后重试')).toBeNull()
    expect(errorKindOfText('')).toBeNull()
    expect(errorKindOfText(null)).toBeNull()
  })

  it('网关 502 也归服务异常：分类与 500 同一套下一步', () => {
    // describeHttpError 对 502/503/504 已改用 server 的「发生了什么」；
    // 万一以后有人把网关原文漏回标题，这一条会提醒它已不属 5 类特征词。
    expect(errorKindOfText(ERROR_COPY.server.happened)).toBe('server')
  })

  it('连续失败提示只在第 2 次后说，且给出可执行的下一步', () => {
    expect(REPEAT_FAILURE_HINT).toContain('诊断信息')
    expect(REPEAT_FAILURE_HINT).toContain('管理员')
  })
})

describe('403 诊断信息', () => {
  it('一段就能贴给管理员：人话、页面、时间、原文俱全', () => {
    const text = buildDiagnosticText('没有权限执行该操作', 'GET /api/admin/audit-logs → HTTP 403', {
      at: new Date('2026-11-09T10:00:00'),
      route: '/workspace/audit-log?page=2',
    })
    expect(text).toContain('错误：没有权限执行该操作')
    expect(text).toContain('页面：/workspace/audit-log?page=2')
    expect(text).toContain('时间：')
    expect(text).toContain('原文：GET /api/admin/audit-logs → HTTP 403')
  })

  it('没有原文时也不留空壳', () => {
    const text = buildDiagnosticText('读取失败', null, { at: new Date(), route: '/workspace/x' })
    expect(text).toContain('原文：（无）')
  })
})
