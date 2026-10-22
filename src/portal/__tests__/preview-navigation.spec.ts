import { describe, it, expect, beforeEach } from 'vitest'
import { isPortalPath, rememberSitePreviewToken, sitePreviewToken, withSitePreviewToken } from '../previewNavigation'

/**
 * 整站预览翻页时「把同一枚令牌补回地址栏」那一句的规则。
 *
 * 这里锁的是两类事故：
 * ① 该补的没补——候选站在转正之前没有域名（拍板 1A/R-3），客户点一下导航就变成
 *    「该域名未绑定站点」，链接只能看首页那一屏；
 * ② 不该补的补了——把逐页预览那枚 {@code page:{id}} 令牌续到别的页面等于自动扩权，
 *    或者把令牌漏进工作台/登录/客户选择页，两种令牌混在一条 URL 上迟早自己打自己。
 */

describe('withSitePreviewToken', () => {
  beforeEach(() => {
    rememberSitePreviewToken(null)
  })

  it('没有记住整站令牌时一律不改导航', () => {
    expect(withSitePreviewToken({ path: '/services', query: {} })).toBeUndefined()
    expect(sitePreviewToken()).toBe('')
  })

  it('整站预览进行中：门户页面被补上同一条令牌，其余查询参数原样留着', () => {
    rememberSitePreviewToken('tok-site')

    expect(withSitePreviewToken({ path: '/services', query: { page: '2' }, hash: '#x' })).toEqual({
      path: '/services',
      query: { page: '2', reviewToken: 'tok-site' },
      hash: '#x'
    })
    // 首页那条裸路径（'/'）也在门户里，不该被漏掉
    expect(withSitePreviewToken({ path: '/', query: {} })).toEqual({
      path: '/',
      query: { reviewToken: 'tok-site' },
      hash: ''
    })
  })

  it('地址栏已经有令牌就不插手：补参数是给「翻页翻丢了」用的，不是给同一条链接套两层', () => {
    rememberSitePreviewToken('tok-site')

    expect(withSitePreviewToken({ path: '/cases', query: { reviewToken: 'tok-other' } })).toBeUndefined()
  })

  it('管理侧与选择页那几路面目不改：令牌各走各的通道', () => {
    rememberSitePreviewToken('tok-site')

    for (const path of ['/workspace/portal', '/login', '/admin/sites', '/brief/abc123']) {
      expect(withSitePreviewToken({ path, query: {} }), `${path} 不该被补上预览令牌`).toBeUndefined()
    }
  })

  it('记错了就整段擦干净：deactivate 之后不再给任何人补令牌', () => {
    rememberSitePreviewToken('tok-site')
    expect(withSitePreviewToken({ path: '/contact', query: {} })).toBeDefined()

    rememberSitePreviewToken(null)
    expect(sitePreviewToken()).toBe('')
    expect(withSitePreviewToken({ path: '/contact', query: {} })).toBeUndefined()
  })

  it('空串与纯空白都不算令牌：省得 URL 上多出一段 ?reviewToken= 让后端白核销一次', () => {
    rememberSitePreviewToken('   ')
    expect(sitePreviewToken()).toBe('')
    expect(withSitePreviewToken({ path: '/contact', query: {} })).toBeUndefined()
  })
})

/**
 * 「这条地址算不算门户那一路」这一句现在有两个消费者（续令牌、404 挂不挂站点壳），
 * 所以它只能有一份实现。这一档钉的是那份清单本身：
 * 管理侧四个前缀逐个走一遍，任何一侧被改宽或改窄都会在这里红——
 * 而不是等到工作台 404 上多出访客页头、或候选站的 404 又变成死路才发现。
 */
describe('isPortalPath', () => {
  it('门户那一路都算，包括裸首页与 /p/ 前缀的内置短路径', () => {
    for (const path of ['/', '/about', '/news/some-article', '/cases/12', '/p/renovation-case', '/contact']) {
      expect(isPortalPath(path), `${path} 属于门户`).toBe(true)
    }
  })

  it('管理侧与选择页那几张面都不算（与上面续令牌那条判的是同一件事）', () => {
    for (const path of ['/workspace', '/workspace/portal', '/login', '/admin/sites', '/brief/abc123']) {
      expect(isPortalPath(path), `${path} 不该带门户外壳`).toBe(false)
    }
  })

  it('空值按首页那一档算：兜底 404 与守卫读的是同一个 undefined 形状', () => {
    expect(isPortalPath('')).toBe(true)
  })
})
