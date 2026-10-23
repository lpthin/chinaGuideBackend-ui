import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  portalValidationApi,
  validationSummaryText,
  VALIDATION_NOT_RUN_TEXT,
  VALIDATION_REASK_TIMEOUT
} from '../portalValidation'
import type { ValidationRun } from '../portalValidation'

/**
 * 交付前自检接口（设计文档 §6 层 2）的形状测试。
 *
 * 钉四件事：
 * 1. 路径不带第二份 /api 前缀（http 实例已有 baseURL）；
 * 2. siteId 是必填：读口与「现在重查一遍」走查询串，「交给模型重问」走路径段——
 *    两边都是对着后端那两个方法的签名抄的。猜错一个站就是把结论记到别家账上，
 *    而那句结论要拦交付、那一发还会真的改页面；
 * 3. 中文结论句子只有一个出处（validationSummaryText），本文件不许再抄一份词表；
 * 4. latest 回 null 时念的是「还没跑过自检」，绝不允许出现「0 条拦项」——谎报正是这一族要杀的。
 */

vi.mock('../http', () => ({
  default: {
    get: vi.fn().mockResolvedValue(null),
    post: vi.fn().mockResolvedValue({}),
    put: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue({})
  },
  AI_REQUEST_TIMEOUT: 180000
}))

async function httpMock() {
  return (await import('../http')).default as any
}

function source() {
  const records = import.meta.glob('../portalValidation.ts', {
    eager: true,
    query: '?raw',
    import: 'default'
  }) as Record<string, string>
  return Object.values(records).join('')
}

function run(over: Partial<ValidationRun> = {}): ValidationRun {
  return {
    id: 41,
    tenantId: 15,
    siteId: 3,
    candidateId: 8,
    briefId: 12,
    round: 3,
    triggerSource: 'manual',
    checkerVersion: 'v1',
    pagesScanned: 12,
    blockerCount: 0,
    warnCount: 1,
    verdict: 'pass',
    createdAt: '2026-10-22T09:00:00',
    finishedAt: '2026-10-22T09:00:02',
    ...over
  }
}

describe('portalValidationApi 的请求形状', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('源码里没有带 /api 前缀的路径，也没有写页面内容的口', () => {
    const raw = source()
    expect([...raw.matchAll(/['"]\/api\/[^'"]*['"]/g)].map(m => m[0])).toEqual([])
    expect(raw).not.toMatch(/\/portal\/pages/)
    expect(raw).not.toMatch(/http\.(put|patch|delete)/)
  })

  it('三个读口都把 siteId 如实带进 query，limit 为空时不拼成 null', async () => {
    const http = await httpMock()

    await portalValidationApi.latest(3)
    expect(http.get).toHaveBeenLastCalledWith('/portal/validation/latest', { params: { siteId: 3 } })

    await portalValidationApi.runs(3)
    expect(http.get).toHaveBeenLastCalledWith('/portal/validation/runs', { params: { siteId: 3, limit: undefined } })

    await portalValidationApi.runs(3, 5)
    expect(http.get).toHaveBeenLastCalledWith('/portal/validation/runs', { params: { siteId: 3, limit: 5 } })

    await portalValidationApi.options()
    expect(http.get).toHaveBeenLastCalledWith('/portal/validation/options')
  })

  it('重查那一发只有查询串，没有请求体：siteId 在串上，后端那一个方法就是这么签的', async () => {
    const http = await httpMock()
    await portalValidationApi.scan(3)
    expect(http.post).toHaveBeenCalledWith('/portal/validation/scan', null, { params: { siteId: 3 } })
  })

  /**
   * 「交给模型重问」那一发钉三点，每一点都对应一种会出的事故：
   * 路径在 `/admin/sites/{id}/reask`（挂建站那一族，因为这一支会改页面——校验那一族的承诺是「一个字都不写」），
   * 站点号走路径段且没有请求体（对着 `reask(@PathVariable Long id)` 抄），
   * 超时必须放宽到十分钟那一档：后端是同步跑完才回的，用默认 30s 会在它还在花钱的时候掐断连接，
   * 于是「页面改了、token 扣了、界面上报请求超时」——那是最坏的一种假失败。
   */
  it('重问那一发：走建站那一族的路径、无请求体、超时放宽到 10 分钟那一档', async () => {
    const http = await httpMock()
    await portalValidationApi.reask(3)
    expect(http.post).toHaveBeenCalledWith('/admin/sites/3/reask', null, { timeout: VALIDATION_REASK_TIMEOUT })
    expect(VALIDATION_REASK_TIMEOUT).toBe(600000)
  })
})

describe('上次自检那一句（五个分支的唯一出处）', () => {
  it('pass：通过 + 页数 + 0 条拦项 + 第几跑', () => {
    expect(validationSummaryText(run({ verdict: 'pass', pagesScanned: 12, blockerCount: 0, round: 3 }))).toBe(
      '上次自检：通过，读了 12 页，0 条拦项（第 3 跑）'
    )
  })

  it('blocked：念拦项数并说「修完才能交付」', () => {
    expect(validationSummaryText(run({ verdict: 'blocked', blockerCount: 4, round: 2, pagesScanned: 9 }))).toBe(
      '上次自检：这一套有 4 条拦项，修完才能交付（第 2 跑，读了 9 页）'
    )
  })

  it('error：说的是「没能看全」，不是「没查出问题」', () => {
    expect(validationSummaryText(run({ verdict: 'error', blockerCount: 0, round: 5, pagesScanned: 7 }))).toBe(
      '上次自检：有页面读不动，这一跑没能看全，不能算通过（第 5 跑，读了 7 页）'
    )
  })

  /** 谎报的形状就是这个分支被写错：没有跑的时候一个数字都不许念 */
  it('null：只念「还没跑过自检」，不许出现「0 条拦项」', () => {
    for (const missing of [null, undefined]) {
      const text = validationSummaryText(missing)
      expect(text).toBe(VALIDATION_NOT_RUN_TEXT)
      expect(text).toBe('这个站还没跑过自检')
      expect(text).not.toContain('0 条拦项')
      expect(text).not.toContain('上次自检')
    }
  })

  it('词表外的结论原样念码，页数或拦项数没回来时不替后端补数', () => {
    expect(validationSummaryText(run({ verdict: 'weird', round: 1, pagesScanned: 4 }))).toContain(
      '结论是「weird」'
    )
    expect(validationSummaryText(run({ verdict: 'pass', blockerCount: null }))).toContain('拦项数没随这一行回来')
    expect(validationSummaryText(run({ verdict: 'pass', blockerCount: null }))).not.toContain('0 条拦项')
    expect(validationSummaryText(run({ verdict: 'blocked', pagesScanned: null }))).toContain(
      '读了几页后端没随这一行带过来'
    )
  })

  /** 界面念的是产品话，不是工程词：这一句给客户看过的那一屏 */
  it('三档句子都不带内部词，也不承诺任何 token 或花费', () => {
    const lines = [
      validationSummaryText(run({ verdict: 'pass' })),
      validationSummaryText(run({ verdict: 'blocked', blockerCount: 2 })),
      validationSummaryText(run({ verdict: 'error' })),
      validationSummaryText(null)
    ]
    for (const line of lines) {
      expect(line).not.toMatch(/token|配额|模型|verdict|blocker|后端原话/i)
    }
  })
})
