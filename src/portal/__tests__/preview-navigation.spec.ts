import { describe, it, expect, beforeEach } from 'vitest'
import { rememberSitePreviewToken, sitePreviewToken, withSitePreviewToken } from '../previewNavigation'

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
