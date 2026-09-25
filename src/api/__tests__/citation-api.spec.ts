import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * 品牌引用探测（决议 N10 方案 B）的接口契约，两类：
 * 1. 请求形状——两侧权限域不混：发起与题库只在 /admin/portal/citation-probes，
 *    租户侧 /portal/citations 全是 GET（问题七给的是「看」，不是「改」）；
 *    estimate 不带 body，run 的 confirm 原样是调用方给的那个布尔值——「先出价后花一分钱」
 *    这条纪律在后端是 CITATION_CONFIRM_REQUIRED，在前端就是不许有默认 true 的写法；
 * 2. I-1 单源——状态、对象类型、命中强度的中文说法只能来自 /labels，
 *    扫这三个新文件时任何一份第二来源都算红灯（抄一次，下一次后端改词表界面就不跟着变）。
 */

const httpMock = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }))

vi.mock('../http', () => ({ default: httpMock, AI_REQUEST_TIMEOUT: 180000 }))

import {
  citationIsSettled,
  citationModelIds,
  citationTokensUsed,
  citationApi
} from '../citation'

function lastCall(spy: { mock: { calls: unknown[][] } }): unknown[] {
  const calls = spy.mock.calls
  return calls[calls.length - 1] || []
}

beforeEach(() => {
  httpMock.get.mockReset()
  httpMock.post.mockReset()
  httpMock.get.mockResolvedValue([])
  httpMock.post.mockResolvedValue({})
})

describe('超管侧：发起探测的端点形状', () => {
  it('词表与列表都在 /admin 下，路径不带 /api，列表不传 tenantId', async () => {
    await citationApi.adminLabels()
    expect(httpMock.get).toHaveBeenLastCalledWith('/admin/portal/citation-probes/labels')

    await citationApi.list(7)
    expect(httpMock.get).toHaveBeenLastCalledWith('/admin/portal/citation-probes', {
      params: { siteId: 7, limit: 30 }
    })
    // 租户归属由后端从登录态推；这里能塞 tenantId，就等于把越权做成一个可选项
    expect(JSON.stringify(lastCall(httpMock.get))).not.toContain('tenantId')
  })

  it('建任务只带（站点、模型），没有 confirm', async () => {
    await citationApi.create({ siteId: 7, modelIds: [3, 11] })
    expect(httpMock.post).toHaveBeenLastCalledWith('/admin/portal/citation-probes', {
      siteId: 7,
      modelIds: [3, 11]
    })
    expect(lastCall(httpMock.post)[1]).not.toHaveProperty('confirm')
  })

  it('estimate 一发不带 body：它的验收点就是「一次模型都不调」', async () => {
    await citationApi.estimate(12)
    expect(httpMock.post).toHaveBeenLastCalledWith('/admin/portal/citation-probes/12/estimate')
    expect(lastCall(httpMock.post).length).toBe(1)
    expect(JSON.stringify(httpMock.post.mock.calls)).not.toContain('confirm')
  })

  it('run 的 confirm 不会被前端改成 true：false 就原样发 false', async () => {
    await citationApi.run(12, false)
    expect(httpMock.post).toHaveBeenLastCalledWith(
      '/admin/portal/citation-probes/12/run',
      { confirm: false },
      { timeout: expect.any(Number) }
    )
    await citationApi.run(12, true)
    expect((lastCall(httpMock.post)[1] as { confirm: boolean }).confirm).toBe(true)
  })

  it('题库的启用开关走 params，不走 body', async () => {
    await citationApi.toggleQuestion(4, false)
    expect(httpMock.post).toHaveBeenLastCalledWith(
      '/admin/portal/citation-probes/questions/4/toggle',
      null,
      { params: { enabled: false } }
    )
  })

  it('没有「一键全站探测」这种批量口子：起跑只按 probeId 一发一发来', () => {
    const riskyNames = Object.keys(citationApi).filter((name) =>
      /apply|publish|online|runAll|batch|probeAll/i.test(name)
    )
    expect(riskyNames).toEqual([])
  })
})

describe('租户侧：只读，回答「我被引用了几次、人从哪来」', () => {
  it('四个读口都在 /portal/citations 下，用的是 http.get', async () => {
    const params = { siteId: 7, from: '2026-09-01', to: '2026-09-25' }
    await citationApi.summary(params)
    expect(httpMock.get).toHaveBeenLastCalledWith('/portal/citations/summary', { params })
    await citationApi.labels()
    expect(httpMock.get).toHaveBeenLastCalledWith('/portal/citations/labels')
    await citationApi.trafficSources(params)
    expect(httpMock.get).toHaveBeenLastCalledWith('/portal/citations/traffic-sources', { params })
    await citationApi.targets({ ...params, targetType: 'article' })
    expect(httpMock.get).toHaveBeenLastCalledWith('/portal/citations/targets', {
      params: { ...params, targetType: 'article' }
    })
    // 问题七交付的是可见性，不是控制权：这一族一个写口都不许有
    expect(httpMock.post.mock.calls).toHaveLength(0)
  })

  it('证据按（对象类型 + 对象 id）定位，缺 targetId 也发得出去（整站行就是 null）', async () => {
    await citationApi.evidence({ siteId: 7, targetType: 'site', targetId: null })
    expect(httpMock.get).toHaveBeenLastCalledWith('/portal/citations/evidence', {
      params: { siteId: 7, targetType: 'site', targetId: null }
    })
  })
})

describe('账目口径', () => {
  it('落定只认后端那三个终态 key，新状态一律按「还能再跑」处理', () => {
    expect(citationIsSettled('done')).toBe(true)
    expect(citationIsSettled('needs_human')).toBe(true)
    expect(citationIsSettled('failed')).toBe(true)
    expect(citationIsSettled('pending')).toBe(false)
    expect(citationIsSettled('running')).toBe(false)
    expect(citationIsSettled(null)).toBe(false)
    expect(citationIsSettled('reviewing')).toBe(false)
  })

  it('实耗 token：没跑过是 null，跑了 0 个是 0——「没花钱」和「白花钱」得分得开', () => {
    expect(citationTokensUsed({ promptTokens: null, completionTokens: null })).toBeNull()
    expect(citationTokensUsed({ promptTokens: undefined, completionTokens: undefined })).toBeNull()
    expect(citationTokensUsed({ promptTokens: 0, completionTokens: 0 })).toBe(0)
    expect(citationTokensUsed({ promptTokens: 900, completionTokens: 100 })).toBe(1000)
  })

  it('modelIds 快照解析不炸界面：坏 JSON 退回逗号分隔，空值是没有模型', () => {
    expect(citationModelIds({ modelIds: null })).toEqual([])
    expect(citationModelIds({ modelIds: '[3,11]' })).toEqual(['3', '11'])
    expect(citationModelIds({ modelIds: '3, 11' })).toEqual(['3', '11'])
    expect(citationModelIds({ modelIds: '{oops' })).toEqual(['{oops'])
  })
})

/**
 * 扫这三个新文件（问题一 / 问题七 新写的）：源码当文本读回来逐条对单源纪律。
 * 按 basename 过滤，glob 的键在 VTU 下可能是绝对路径，写死键名会静默空转。
 */
const scanned = import.meta.glob(
  [
    '../citation.ts',
    '../../views/portal/CitationProbeView.vue',
    '../../views/analytics/PortalCitationView.vue'
  ],
  { eager: true, query: '?raw', import: 'default' }
) as Record<string, string>

function readSources(include: string, expected: number): string {
  const hits = Object.entries(scanned).filter(([path]) => path.includes(include))
  if (hits.length !== expected) {
    throw new Error(`源码扫描没命中「${include}」：找到 ${hits.length} 个，应有 ${expected} 个`)
  }
  return hits.map(([, text]) => text).join('\n')
}

const scannedNames = Object.keys(scanned)
  .map((path) => path.split(/[\\/]/).pop() as string)
  .sort()

describe('I-1：前端不抄第二份词表', () => {
  it('扫到的就是这三个新文件（文件名写错时这里先红）', () => {
    expect(scannedNames).toEqual([
      'PortalCitationView.vue',
      'citation.ts',
      'CitationProbeView.vue'
    ].sort())
  })

  it('后端词表的中文说法在这三个文件里一份都没有（说法只来自 /labels）', () => {
    const raw =
      readSources('citation.ts', 1) +
      readSources('CitationProbeView.vue', 1) +
      readSources('PortalCitationView.vue', 1)
    for (const label of ['排队中', '探测中', '需人工处理', '完整链接', '站内路径', '品牌名']) {
      expect(raw, `「${label}」来自后端词表，不该在这里出现第二份`).not.toContain(label)
    }
  })

  it('状态英文 key 也没有被就地映射成中文常量（映射表在 CitationStatuses）', () => {
    const raw =
      readSources('citation.ts', 1) +
      readSources('CitationProbeView.vue', 1) +
      readSources('PortalCitationView.vue', 1)
    expect(
      new RegExp("(pending|running|needs_human|done|failed)\\s*:\\s*['\"][^'\"]*[\u4e00-\u9fa5]").test(
        raw
      )
    ).toBe(false)
  })

  it('请求路径没有多余的 /api 前缀（axios baseURL 已经带 /api）', () => {
    // 注释里写全 `/api/...` 是在说明后端真实端点，那是文档不是请求；扫之前先把注释剥掉
    const code = readSources('citation.ts', 1)
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '')
    expect([...code.matchAll(/['"`]\/api\/[^'"`]*['"`]/g)].map((match) => match[0])).toEqual([])
  })

  it('租户那一屏不引 admin 路径：admin 端点只出现在 api 层和超管视图里', () => {
    expect(readSources('PortalCitationView.vue', 1)).not.toContain('/admin/portal/citation-probes')
  })
})
