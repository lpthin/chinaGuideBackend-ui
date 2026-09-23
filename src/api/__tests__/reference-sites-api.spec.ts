import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  portalReferenceApi,
  referenceIsRunning,
  referenceModeLabel,
  designTokensOf,
  domSummaryOf,
  observedSectionsOf,
  propsSuggestionOf,
  sectionCountOf,
  REFERENCE_SHOT_CATEGORY
} from '../referenceSites'

/**
 * 参考站摄取接口的形状测试（Spec §7）。
 *
 * 最要紧的三条：
 * 1. analyze 没有 confirm 就原样发 false——这一步会真的跑两次模型，漏了确认就是「点一下扣一次钱」；
 * 2. 状态中文标签只从 /portal/reference-sites/statuses 取，前端抄的第二份必然漂移；
 * 3. 截图上传必须带 viewport：挂错视口会让审阅者对着 1440 宽的图判断手机布局。
 */

vi.mock('../http', () => ({
  default: {
    get: vi.fn().mockResolvedValue({}),
    post: vi.fn().mockResolvedValue({}),
    put: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue({})
  }
}))

async function httpMock() {
  return (await import('../http')).default as any
}

describe('portalReferenceApi', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('源码里没有带 /api 前缀的路径，也没有本地抄的状态中文标签', async () => {
    const raw = import.meta.glob('../referenceSites.ts', { eager: true, query: '?raw', import: 'default' }) as Record<
      string,
      string
    >
    const source = Object.values(raw).join('')
    expect([...source.matchAll(/['"]\/api\/[^'"]*['"]/g)].map(m => m[0])).toEqual([])
    expect(source).not.toMatch(/映射已就绪/)
    expect(source).not.toMatch(/需人工处理/)
    expect(source).not.toMatch(/结构归纳中/)
  })

  it('状态词表只读后端一个端点', async () => {
    const http = await httpMock()
    await portalReferenceApi.statusLabels()
    expect(http.get).toHaveBeenCalledWith('/portal/reference-sites/statuses')
  })

  it('建任务与筛选都不带 tenantId：租户归属由后端从登录态推', async () => {
    const http = await httpMock()
    await portalReferenceApi.list('done')
    expect(http.get).toHaveBeenLastCalledWith('/portal/reference-sites', { params: { status: 'done' } })

    await portalReferenceApi.list()
    expect(http.get).toHaveBeenLastCalledWith('/portal/reference-sites', { params: { status: undefined } })

    await portalReferenceApi.create({ mode: 'url', sourceUrl: 'https://example.com', maxPages: 3, obeyRobots: true })
    const body = http.post.mock.calls[0][1]
    expect(http.post.mock.calls[0][0]).toBe('/portal/reference-sites')
    expect(body).not.toHaveProperty('tenantId')
  })

  it('抓取与 AI 摄取都是异步受理，前端不自己伪造「已完成」的端点', async () => {
    const http = await httpMock()
    await portalReferenceApi.crawl(5)
    expect(http.post).toHaveBeenLastCalledWith('/portal/reference-sites/5/crawl')

    await portalReferenceApi.analyzeEstimate(5)
    expect(http.post).toHaveBeenLastCalledWith('/portal/reference-sites/5/analyze-estimate')

    await portalReferenceApi.analyze(5, true)
    expect(http.post).toHaveBeenLastCalledWith('/portal/reference-sites/5/analyze', { confirm: true })
  })

  it('AI 摄取不带 confirm 时原样发 false，让后端去拒', async () => {
    const http = await httpMock()
    await portalReferenceApi.analyze(5, false)
    expect(http.post).toHaveBeenLastCalledWith('/portal/reference-sites/5/analyze', { confirm: false })
  })

  it('截图上传带 viewport 与可选的归属页，走 multipart', async () => {
    const http = await httpMock()
    const file = new File(['x'], 'shot.png', { type: 'image/png' })
    await portalReferenceApi.uploadShot(5, 'mobile', file, 12)
    const [url, sent, config] = http.post.mock.calls[0]
    expect(url).toBe('/portal/reference-sites/5/upload-shot')
    expect(sent).toBeInstanceOf(FormData)
    expect(config.params).toEqual({ viewport: 'mobile', referencePageId: 12 })
    expect(config.headers['Content-Type']).toBe('multipart/form-data')

    await portalReferenceApi.uploadShot(5, 'desktop', file)
    expect(http.post.mock.calls[1][2].params).toEqual({ viewport: 'desktop', referencePageId: undefined })
  })

  it('确认映射与生成草稿页是两条不同的写路径', async () => {
    const http = await httpMock()
    await portalReferenceApi.verify(5, 9, { mappedBlockKey: 'hero', humanVerified: false, note: '这一格是导航' })
    expect(http.post).toHaveBeenLastCalledWith('/portal/reference-sites/5/mappings/9/verify', {
      mappedBlockKey: 'hero',
      humanVerified: false,
      note: '这一格是导航'
    })

    await portalReferenceApi.apply(5, { referencePageId: 12, siteId: 3, slug: 'ref-home', title: '首页' })
    expect(http.post).toHaveBeenLastCalledWith('/portal/reference-sites/5/apply', {
      referencePageId: 12,
      siteId: 3,
      slug: 'ref-home',
      title: '首页'
    })
  })

  it('截图素材地址按分类查一次，且没有 DELETE 撤销任务（任务只增不删，留痕）', async () => {
    const http = await httpMock()
    await portalReferenceApi.shotMedia()
    expect(http.get).toHaveBeenLastCalledWith('/media', {
      params: { category: REFERENCE_SHOT_CATEGORY, page: 1, size: 200 }
    })
    expect(http.delete).not.toHaveBeenCalled()
  })
})

describe('参考站任务的展示辅助', () => {
  it('只有中间态算「在跑」，done/failed/needs_human 停下来等人看', () => {
    expect(referenceIsRunning('crawling')).toBe(true)
    expect(referenceIsRunning('analyzing')).toBe(true)
    expect(referenceIsRunning('done')).toBe(false)
    expect(referenceIsRunning('failed')).toBe(false)
    expect(referenceIsRunning('needs_human')).toBe(false)
    expect(referenceIsRunning(null)).toBe(false)
  })

  it('不认识的模式原样显示，不替后端编中文名', () => {
    expect(referenceModeLabel('url')).toBe('按网址抓取')
    expect(referenceModeLabel('screenshot_upload')).toBe('上传截图')
    expect(referenceModeLabel('future_mode')).toBe('future_mode')
    expect(referenceModeLabel(null)).toBe('—')
  })

  it('JSON 字段坏了就当没有，不拿半截内容充数', () => {
    expect(domSummaryOf({ domSummaryJson: null })).toBeNull()
    expect(domSummaryOf({ domSummaryJson: '{oops' })).toBeNull()
    expect(domSummaryOf({ domSummaryJson: '"a string"' })).toBeNull()
    expect(observedSectionsOf({ observedSectionsJson: '[]' })).toEqual([])
    expect(propsSuggestionOf({ propsSuggestionJson: 'bad' })).toEqual({})
    expect(designTokensOf({ designTokensJson: 'bad' })).toBeNull()
  })

  it('区分数「0 格」与「还没算过」：没摘要时返回 null 而不是 0', () => {
    expect(sectionCountOf({ domSummaryJson: null } as any)).toBeNull()
    expect(sectionCountOf({ domSummaryJson: '{"sections":[]}' } as any)).toBe(0)
    expect(sectionCountOf({ domSummaryJson: '{"sections":[{"name":"hero"},{"name":"footer"}]}' } as any)).toBe(2)
  })
})
