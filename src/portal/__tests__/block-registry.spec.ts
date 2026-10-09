import { describe, it, expect, vi, beforeEach } from 'vitest'
import { registeredRendererKeys, resolveRenderer } from '../blocks/registry'
import { isInternalPath, resolveLink, safeExternal } from '../blocks/linkPolicy'
import { slugOfPath } from '../portalPath'

/**
 * 这份清单必须与后端下发的 rendererKey 逐个对齐。
 * 两边各写一份看起来重复，但正因为重复才能挡住「后端加区块、前端没组件」——
 * 那种页面在访客侧就是一串空白区块，而后端校验还会判它合法。
 *
 * 从 Spec-M §8 第 2 步起分两族：前 26 支来自代码声明（`PortalBlockCatalogue`），
 * 最后那支 `genericCard` 是界面手工新增那一族唯一可用的渲染器（后端同名闸 `RendererKeys.java`）。
 * 也就是说这里多出「人工那一族」这一栏不是排版：它的成立条件是「后端不会把别的键发下来」，
 * 而那一头由 `RendererKeysTest` 钉住。
 */
const CODE_RENDERER_KEYS = [
  'siteHeader', 'utilityBar', 'breadcrumb', 'hero', 'pageHero', 'bannerCarousel', 'serviceCards', 'caseGrid', 'caseList',
  'newsList', 'relatedContent', 'jobList', 'aboutRich', 'textBand', 'teamGrid', 'statsBand', 'logoWall',
  'testimonialCards', 'milestoneTimeline', 'awardGrid', 'faqAccordion', 'mapBlock',
  'ctaBand', 'contactBlock', 'inquiryForm', 'siteFooter'
]
const MANUAL_RENDERER_KEYS = ['genericCard']
const RENDERER_KEYS = [...CODE_RENDERER_KEYS, ...MANUAL_RENDERER_KEYS]

describe('区块渲染器注册表', () => {
  it('渲染器键与后端区块白名单一一对应', () => {
    expect([...registeredRendererKeys()].sort()).toEqual([...RENDERER_KEYS].sort())
  })

  it('每个已登记的渲染器都能拿到组件', () => {
    RENDERER_KEYS.forEach(key => {
      expect(resolveRenderer(key), `渲染器 ${key} 未注册`).not.toBeNull()
    })
  })

  it('代码那一族 26 支、人工那一族只有 genericCard 一支', () => {
    // 数字写死是有意的：想加第二支通用渲染器，就得同时改后端的 RendererKeys 与这里的分族
    expect(CODE_RENDERER_KEYS).toHaveLength(26)
    expect(MANUAL_RENDERER_KEYS).toEqual(['genericCard'])
  })

  describe('未知渲染器：宁缺不滥', () => {
    // 同一个 console.error 被反复 spyOn 时拿到的是同一个 spy，不清零就会把上一个用例的调用算进来
    let errorSpy: ReturnType<typeof vi.spyOn>
    beforeEach(() => {
      errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      errorSpy.mockClear()
    })

    it('返回 null 并留下中文错误，绝不降级成原始 HTML', () => {
      expect(resolveRenderer('evilRawHtml')).toBeNull()
      expect(console.error).toHaveBeenCalledWith(expect.stringContaining('evilRawHtml'))
      expect(console.error).toHaveBeenCalledWith(expect.stringContaining('未注册'))
    })

    it('同一个未知键只记一次，免得刷屏', () => {
      resolveRenderer('ghostBlock')
      resolveRenderer('ghostBlock')
      expect(console.error).toHaveBeenCalledTimes(1)
    })

    it('空键（后端没给 rendererKey）不报错也不渲染', () => {
      expect(resolveRenderer(null)).toBeNull()
      expect(resolveRenderer('')).toBeNull()
      expect(console.error).not.toHaveBeenCalled()
    })
  })
})

describe('区块链接规则', () => {
  it('站内路径交给 router，并带上查询串', () => {
    expect(isInternalPath('/news')).toBe(true)
    expect(resolveLink('/news?category=%E5%85%AC%E5%8F%B8%E5%8A%A8%E6%80%81')).toEqual({
      kind: 'route',
      target: { path: '/news', query: { category: '公司动态' } }
    })
  })

  it('协议相对路径 //host 不算站内', () => {
    expect(isInternalPath('//evil.example.com/x')).toBe(false)
    expect(resolveLink('//evil.example.com/x')).toEqual({ kind: 'none', target: null })
  })

  it('只放行 http(s) 外链，危险协议判为无链接', () => {
    expect(safeExternal('https://example.com')).toBe('https://example.com')
    expect(safeExternal('javascript:alert(1)')).toBe('')
    expect(safeExternal('data:text/html,<script>1</script>')).toBe('')
    expect(resolveLink('javascript:alert(1)').kind).toBe('none')
  })

  it('空值一律按无链接处理', () => {
    expect(resolveLink(null).kind).toBe('none')
    expect(resolveLink('   ').kind).toBe('none')
  })
})

describe('slugOfPath（必须与后端 PortalUrls 同源）', () => {
  it('首页与六个内置栏目各自对应一个 slug', () => {
    expect(slugOfPath('/')).toBe('home')
    expect(slugOfPath('')).toBe('home')
    expect(slugOfPath('/about')).toBe('about')
    expect(slugOfPath('/contact/')).toBe('contact')
  })

  it('自定义页去掉 /p/ 前缀，中文 slug 还原', () => {
    expect(slugOfPath('/p/my-page')).toBe('my-page')
    expect(slugOfPath('/p/%E5%85%B3%E4%BA%8E%E6%88%91%E4%BB%AC')).toBe('关于我们')
  })

  it('详情页路径不会被误当成页面 slug', () => {
    expect(slugOfPath('/news/2026-review')).toBe('news')
  })
})
