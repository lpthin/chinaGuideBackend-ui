import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import SiteHeaderBlock from '../blocks/SiteHeaderBlock.vue'
import type { PortalSiteShell } from '../api/portalPublic'

/**
 * 页头那张标志图取哪一份（2026-10-22 产品口径）。
 *
 * 原话是两条：「如果用户提供 logo，就用用户的；没有的话就用 AI 生成的」、「可以有一些页面不带 logo」。
 * 改之前这一条是反的——`blockProps.logoUrl`（建站出图那一步写进区块属性的一张）排在
 * `shell.company.logo`（客户在企业资料里上传的那一张）前面，所以客户传了图也顶不掉 AI 那张，
 * 界面上「已上传标志图」这件事在门户上完全没有兑现。
 *
 * 断言只看渲染出来的 `<img>`：这是访客真正看到的东西，不是组件里那两个表达式的次序。
 * 后端那三处（检测层 {@code SiteCrossPageScanner}、交付前自动改齐 {@code SiteProposalUnifier}、
 * 出图那一格 {@code SiteProposalOrchestrator#runImages}）读的是同一个口径，出处是
 * {@code CompanyInfoService#providedLogoUrl}——那一头不跟着改，巡检就会按访客看不见的那张报警。
 */

const CUSTOMER = '/uploads/9/customer-logo.png'
const AI = '/media/9/ai-logo.png'

function shell(companyLogo: string | null): PortalSiteShell {
  return {
    siteId: 1,
    siteName: '示例站点',
    siteCode: 'acme',
    baseUrl: null,
    company: { name: '示例公司', logo: companyLogo, description: null, copyright: null,
      phone: null, email: null, address: null },
    seo: null,
    nav: [{ title: '关于我们', url: '/about', articleCount: 1 }]
  } as unknown as PortalSiteShell
}

function mountHeader(blockProps: Record<string, unknown>, companyLogo: string | null) {
  // 品牌那一个 <img> 长在 <router-link> 的槽里：setup.ts 那个空壳桩渲染不出 slot 内容，
  // 换成带 <slot/> 的桩（本仓库 portal 那几份用例的同一条办法），断言读的才是真实 DOM
  return mount(SiteHeaderBlock, {
    props: { blockProps, shell: shell(companyLogo) },
    global: { stubs: { 'router-link': { template: '<a><slot /></a>' } } }
  })
}

function logoSrc(blockProps: Record<string, unknown>, companyLogo: string | null): string | null {
  const img = mountHeader(blockProps, companyLogo).find('.pb-header__brand img')
  if (!img.exists()) return null
  const src = img.attributes('src')
  return typeof src === 'string' && src !== '' ? src : null
}

describe('页头标志图的取值次序', () => {
  it('先自证这一趟真的渲染出了品牌区（不然「找不到 img」是夹具坏，不是产品错）', () => {
    const brand = mountHeader({ siteName: '示例公司' }, CUSTOMER).find('.pb-header__brand')
    expect(brand.exists()).toBe(true)
    expect(brand.text()).toContain('示例公司')
  })

  it('客户上传了 logo：用客户那一张，AI 那张靠边站', () => {
    expect(logoSrc({ logoUrl: AI }, CUSTOMER)).toBe(CUSTOMER)
  })

  it('客户没上传：才用 AI 生成的那一张', () => {
    expect(logoSrc({ logoUrl: AI }, null)).toBe(AI)
  })

  it('两张都没有：这一页页头不渲染 <img>（允许有些页面不带 logo，不许留一个破图）', () => {
    expect(logoSrc({}, null)).toBeNull()
    // 空串在壳里是「有行但没填」，同样不能渲染出一个 src="" 的破图
    expect(logoSrc({ logoUrl: '' }, '')).toBeNull()
  })

  it('区块那一格压根没写 logoUrl、客户给了图：照常显示客户那张（这一格不该把整块页头带崩）', () => {
    expect(logoSrc({ siteName: '示例公司' }, CUSTOMER)).toBe(CUSTOMER)
  })
})
