import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  portalReferenceApi,
  referenceIsRunning,
  referenceLabel,
  referenceModeLabel,
  designTokensOf,
  domSummaryOf,
  observedSectionsOf,
  propsSuggestionOf,
  sectionCountOf,
  tokenLayersOf,
  REFERENCE_SHOT_CATEGORY,
  type ReferenceVocabularies
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
    // 依赖体检那几句「缺什么改哪个键」的原话只在后端一处：前端抄一份就跟着配置文件漂移
    expect(source).not.toMatch(/总开关关着/)
    expect(source).not.toMatch(/把这一项改成 true/)
    // 路由清单与取证那七套词的显示名同理（GET /vocabularies 是唯一出处）。
    // 挑的是后端原话里足够具体的整串：注释里出现「人工补录」这种动作名不算抄词表
    for (const label of [
      '原文里有版面',
      '已发现，还没抓',
      '来自渲染后的版面',
      '一行文本',
      '页头滚动时吸顶',
      '这一格有一个标题'
    ]) {
      expect(source).not.toMatch(label)
    }
    // 页数上限同理：那一头是后端 clamp，这一头只许有一个常量，用它的地方一律引常量。
    // 界面写死 :max="12" 的表现是后端放宽上限后这里还在拦人，而且没人知道是谁拦的。
    expect([...source.matchAll(/^\s*export const REFERENCE_MAX_PAGES_LIMIT = \d+$/gm)]).toHaveLength(1)
    // 视图在 2026-10-10 拆成了「列表壳 + 任务抽屉 + 四栏」，所以这一发要把拆出去的每一页都扫到：
    // 只扫壳子的话，谁把上限写死在某一栏里，这条闸就正好漏掉那一处。
    // glob 的参数必须是字面量，所以两处各写一次，不封装成函数。
    const shellSource = Object.values(
      import.meta.glob('../../views/portal/Reference*.vue', { eager: true, query: '?raw', import: 'default' }) as Record<
        string,
        string
      >
    ).join('')
    const tabFiles = import.meta.glob('../../views/portal/reference/*.vue', {
      eager: true,
      query: '?raw',
      import: 'default'
    }) as Record<string, string>
    const viewSource = shellSource + Object.values(tabFiles).join('')
    expect(viewSource).toMatch(/:max="maxPagesLimit"/)
    expect(viewSource).not.toMatch(/:max="12"/)
    expect(viewSource).not.toMatch(/1–12/)
    // 拆出去的每一栏都得真的在扫描范围里：闸扫的是「扫到了几份」，少一个文件它就一直空转
    expect(Object.keys(tabFiles)).toHaveLength(4)
  })

  it('依赖体检是一个只读快照：不带 tenantId 时把参数留空，让后端按平台探', async () => {
    const http = await httpMock()
    await portalReferenceApi.capabilities()
    expect(http.get).toHaveBeenLastCalledWith('/portal/reference-sites/capabilities', {
      params: { tenantId: undefined }
    })

    await portalReferenceApi.capabilities(5)
    expect(http.get).toHaveBeenLastCalledWith('/portal/reference-sites/capabilities', { params: { tenantId: 5 } })

    // 体检不翻开关：这一发里没有 POST/PUT/DELETE
    expect(http.post).not.toHaveBeenCalled()
    expect(http.put).not.toHaveBeenCalled()
    expect(http.delete).not.toHaveBeenCalled()
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
    expect(http.post).toHaveBeenLastCalledWith('/portal/reference-sites/5/crawl', undefined)

    await portalReferenceApi.analyzeEstimate(5)
    expect(http.post).toHaveBeenLastCalledWith('/portal/reference-sites/5/analyze-estimate')

    await portalReferenceApi.analyze(5, true)
    expect(http.post).toHaveBeenLastCalledWith('/portal/reference-sites/5/analyze', { confirm: true })
  })

  /**
   * 两步走的第二步（Spec-E T2）：勾选就是「只跑这几条」，一条没勾就退回老行为。
   *
   * 这里要盯紧的是<b>空数组不能发成 {pageIds:[]}</b>：后端把「有这一段」理解成人勾过了，
   * 空集合会一路扩成「谁都别抓」，而界面上看上去像「我明明什么都没勾」。
   */
  it('抓取带了勾选才发 pageIds，空选择与不传是同一条老路径', async () => {
    const http = await httpMock()
    await portalReferenceApi.crawl(5, [11, 12])
    expect(http.post).toHaveBeenLastCalledWith('/portal/reference-sites/5/crawl', { pageIds: [11, 12] })

    await portalReferenceApi.crawl(5, [])
    expect(http.post).toHaveBeenLastCalledWith('/portal/reference-sites/5/crawl', undefined)

    await portalReferenceApi.crawl(5, null)
    expect(http.post).toHaveBeenLastCalledWith('/portal/reference-sites/5/crawl', undefined)
  })

  /** 第一步不花钱，所以它没有 confirm、也没有 estimate：多带一个都算界面替后端多做了决定 */
  it('只列路由清单是一发 POST，人工补录只带路径与可选名字', async () => {
    const http = await httpMock()
    await portalReferenceApi.discoverRoutes(5)
    expect(http.post).toHaveBeenLastCalledWith('/portal/reference-sites/5/discover-routes')

    await portalReferenceApi.addRoute(5, { path: '/appointment', pageName: null })
    expect(http.post).toHaveBeenLastCalledWith('/portal/reference-sites/5/routes', {
      path: '/appointment',
      pageName: null
    })

    expect(http.post.mock.calls[0][1]).toBeUndefined()
  })

  it('词表与模板包都是只读端点，路径不拼 tenantId', async () => {
    const http = await httpMock()
    await portalReferenceApi.vocabularies()
    expect(http.get).toHaveBeenLastCalledWith('/portal/reference-sites/vocabularies')

    await portalReferenceApi.templatePackage(5)
    expect(http.get).toHaveBeenLastCalledWith('/portal/reference-sites/5/package')

    expect(http.post).not.toHaveBeenCalled()
    expect(http.put).not.toHaveBeenCalled()
    expect(http.delete).not.toHaveBeenCalled()
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

  it('截图素材地址按分类查一次，并显式点名系统素材组（Spec-J：/media 默认不列它），且没有 DELETE 撤销任务（任务只增不删，留痕）', async () => {
    const http = await httpMock()
    await portalReferenceApi.shotMedia()
    expect(http.get).toHaveBeenLastCalledWith('/media', {
      params: { category: REFERENCE_SHOT_CATEGORY, group: 'system', page: 1, size: 200 }
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

  /**
   * 词表旧了的时候宁可显示后端原文。
   *
   * 显示空白会让人判成「这一格没有值」，而真相是「有值，只是这份词表不认识它」——
   * 后者是人要去补端点的信号，前者是会写进报告的错误结论。
   */
  it('词表查得到就用中文，查不到原样显示，只有空值才是一横', () => {
    const vocabs: ReferenceVocabularies = {
      renderMode: { static: '原文里有版面' },
      crawlState: { ok: '已抓到' },
      linkSource: {},
      requiredSignal: { 'label-star': '只有 label 上写了星号' },
      slotKind: { richtext: '一段正文' },
      contentSlot: {},
      interaction: {}
    } as ReferenceVocabularies
    expect(referenceLabel(vocabs, 'renderMode', 'static')).toBe('原文里有版面')
    expect(referenceLabel(vocabs, 'crawlState', 'new_state_from_backend')).toBe('new_state_from_backend')
    expect(referenceLabel(vocabs, 'linkSource', 'raw_html')).toBe('raw_html')
    expect(referenceLabel(vocabs, 'slotKind', null)).toBe('—')
    // 端点还没回来：不能让整张表变成空白，退回原值
    expect(referenceLabel(null, 'interaction', 'hover-lift')).toBe('hover-lift')
    // 必填那条不许被翻译成「必填」：它是取证线索，不是约束（拍板 P-1=A）。这里显的是后端那句原话
    expect(referenceLabel(vocabs, 'requiredSignal', 'label-star')).toBe('只有 label 上写了星号')
  })

  /**
   * token 的两层必须分开数（Spec-E T3 + 拍板 P-9）。
   *
   * 老代码是 Object.keys 一跑了事，结果分层之后那一格会稳定地报「2 组」——
   * 把「有 site 和 sectionHints 两个键」说成了「采到 2 项取值」，那是界面上最像真数据的假数。
   */
  it('站级取值与段级证据各算各的，分层之前的老行仍然按站级看', () => {
    const layered = tokenLayersOf({
      designTokensJson: '{"site":{"colorPrimary":"#111","radius":"12px"},"sectionHints":[{"tag":"section","tokens":{"heading":["#222"]}}]}'
    })
    expect(layered?.legacy).toBe(false)
    expect(Object.keys(layered?.site || {})).toEqual(['colorPrimary', 'radius'])
    expect(layered?.sectionHints).toHaveLength(1)

    const legacy = tokenLayersOf({ designTokensJson: '{"colorPrimary":"#111","spacingScale":1.2}' })
    expect(legacy?.legacy).toBe(true)
    expect(Object.keys(legacy?.site || {})).toHaveLength(2)
    expect(legacy?.sectionHints).toEqual([])

    // sidecar 挂了：站级那一半就是没有，别拿一个空对象冒充「采过、值是空」
    const hintsOnly = tokenLayersOf({ designTokensJson: '{"site":{},"sectionHints":[]}' })
    expect(hintsOnly?.site).toBeNull()
    expect(hintsOnly?.legacy).toBe(false)

    expect(tokenLayersOf({ designTokensJson: null })).toBeNull()
    expect(tokenLayersOf({ designTokensJson: '{oops' })).toBeNull()
  })
})
