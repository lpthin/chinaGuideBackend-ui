import { describe, it, expect, vi, beforeEach } from 'vitest'
import { portalHealthApi } from '../portalHealth'

/**
 * 巡检接口的形状测试（Spec §8.2）。
 *
 * 锁四件事：
 * 1. 路径不重复带 /api 前缀（http 实例已有 baseURL）；
 * 2. 词表只有一个来源：这一页的中文类型名/状态名只能来自 /portal/health/options，
 *    模块里不许出现第二份 labels 映射（出现过一次，结果后端改了词表前端还在显示旧名字）；
 * 3. 这一页不许有任何能改页面内容的出口：整份文件里不能出现 /portal/pages 的写路径，
 *    「巡检把页面修好了」这句话就是假的。Q5 加的那两条 apply/undo 是唯一的例外，
 *    而且写的仍然是 /portal/health/* ——由后端经 PortalPageService 落库，前端不碰页面接口；
 * 4. 花钱的 ai-fix 与闭环 patrol 必须带 confirm，且 siteId 为空时不要把 null 拼进 query。
 */

vi.mock('../http', () => ({
  default: {
    get: vi.fn().mockResolvedValue({ types: {}, statuses: {} }),
    post: vi.fn().mockResolvedValue({}),
    put: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue({})
  }
}))

async function httpMock() {
  return (await import('../http')).default as any
}

function source() {
  const records = import.meta.glob('../portalHealth.ts', {
    eager: true,
    query: '?raw',
    import: 'default'
  }) as Record<string, string>
  return Object.values(records).join('')
}

describe('portalHealthApi', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('源码里没有带 /api 前缀的路径，也没有改页面内容的出口', () => {
    const raw = source()
    expect([...raw.matchAll(/['"]\/api\/[^'"]*['"]/g)].map(m => m[0])).toEqual([])
    expect(raw).not.toMatch(/\/portal\/pages\/[^'"]*\/(meta|layout|publish|offline)/)
    expect(raw).not.toMatch(/http\.(put|patch)/)
  })

  it('类型与状态的中文名不在前端抄第二份，只有状态色这种纯展示映射', () => {
    const raw = source()
    // 出现待处理/已忽略这类中文状态名当键值对，就是抄了第二份词表
    expect(raw).not.toMatch(/:\s*'(待处理|已忽略|已消失)'/)
    expect(raw).not.toMatch(/:\s*'(站内死链|素材失效|SEO 描述缺失)'/)
  })

  it('列表默认不传 status，站点为空时也不出现在 query 里', async () => {
    const http = await httpMock()
    await portalHealthApi.findings()
    expect(http.get).toHaveBeenCalledWith('/portal/health/findings', { params: { siteId: undefined, status: undefined, type: undefined } })

    await portalHealthApi.findings({ siteId: 3, status: 'open', type: 'link_dead' })
    expect(http.get).toHaveBeenLastCalledWith('/portal/health/findings', {
      params: { siteId: 3, status: 'open', type: 'link_dead' }
    })
  })

  it('扫描与处置的请求形状：扫描带 siteId 查询串，忽略带理由，AI 出手带 confirm', async () => {
    const http = await httpMock()

    await portalHealthApi.scan(null)
    expect(http.post).toHaveBeenLastCalledWith('/portal/health/scan', null, { params: { siteId: undefined } })

    await portalHealthApi.dismiss(9, '下周整体改版')
    expect(http.post).toHaveBeenLastCalledWith('/portal/health/findings/9/dismiss', { reason: '下周整体改版' })

    await portalHealthApi.reopen(9)
    expect(http.post).toHaveBeenLastCalledWith('/portal/health/findings/9/reopen')

    await portalHealthApi.estimate(9)
    expect(http.post).toHaveBeenLastCalledWith('/portal/health/findings/9/ai-fix-estimate')

    await portalHealthApi.aiFix(9, true)
    expect(http.post).toHaveBeenLastCalledWith('/portal/health/findings/9/ai-fix', { confirm: true })
  })

  it('应用与撤销各打自己那条端点，confirm 都如实带上', async () => {
    const http = await httpMock()
    await portalHealthApi.applySuggestion(9, true)
    expect(http.post).toHaveBeenLastCalledWith('/portal/health/findings/9/apply-suggestion', { confirm: true })
    await portalHealthApi.undoApply(9, false)
    expect(http.post).toHaveBeenLastCalledWith('/portal/health/findings/9/undo-apply', { confirm: false })
  })

  /** 闭环一轮按条数花配额：confirm 只能在 body 里如实带，站点为空时不要拼成 siteId=null */
  it('闭环 patrol：confirm 进 body，空站点不进 query', async () => {
    const http = await httpMock()
    await portalHealthApi.patrol(null, true)
    expect(http.post).toHaveBeenLastCalledWith('/portal/health/patrol', { confirm: true }, { params: { siteId: undefined } })
    await portalHealthApi.patrol(3, false)
    expect(http.post).toHaveBeenLastCalledWith('/portal/health/patrol', { confirm: false }, { params: { siteId: 3 } })
  })

  /** 「可不可撤销」只有一个依据：建议 JSON 上那个 applied 节点。节点残缺时按未应用处理，不能给一个点了必错的按钮 */
  it('applied 节点认得出，缺字段的脏数据按没应用处理', async () => {
    const { suggestionAppliedOf } = await import('../portalHealth')
    expect(suggestionAppliedOf({ suggestionJson: null })).toBeNull()
    expect(suggestionAppliedOf({ suggestionJson: '{"seoTitle":"x"}' })).toBeNull()
    expect(suggestionAppliedOf({ suggestionJson: '{"applied":"不是对象"}' })).toBeNull()
    expect(suggestionAppliedOf({ suggestionJson: '{"applied":{"before":{}}}' })).toBeNull()
    expect(
      suggestionAppliedOf({
        suggestionJson: '{"applied":{"at":"2026-09-25T10:00:00","by":"admin","before":{"seoTitle":"关于我们"}}}'
      })
    ).toMatchObject({ at: '2026-09-25T10:00:00', by: 'admin' })
  })

  it('建议 JSON 坏了要能区分出来，不能当成「没有建议」', async () => {
    const { seoSuggestionOf } = await import('../portalHealth')
    expect(seoSuggestionOf({ suggestionJson: null })).toBeNull()
    expect(seoSuggestionOf({ suggestionJson: '{不是 JSON' })).toBeNull()
    expect(seoSuggestionOf({ suggestionJson: '[1,2]' })).toBeNull()
    expect(seoSuggestionOf({ suggestionJson: '{"seoTitle":"x"}' })).toEqual({ seoTitle: 'x' })
  })
})
