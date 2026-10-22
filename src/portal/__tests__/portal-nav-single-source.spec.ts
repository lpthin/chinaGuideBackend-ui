import { describe, it, expect, vi, beforeEach } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import type { Component } from 'vue'
import PortalPageShell from '../PortalPageShell.vue'
import SiteHeaderBlock from '../blocks/SiteHeaderBlock.vue'
import SiteFooterBlock from '../blocks/SiteFooterBlock.vue'
import type { BlockProps } from '../blocks/types'
import type { PortalSiteShell } from '../api/portalPublic'

const api = vi.hoisted(() => ({ shell: vi.fn() }))

/**
 * 桩件只替掉取数口：壳形状（company / nav）照后端 PortalContentDTO 的字段名给，
 * PREVIEW_TOKEN_PARAM 必须一起提供——previewNavigation 导的就是这一个模块，缺了它那条常量会变 undefined。
 */
vi.mock('../api/portalPublic', () => ({
  PREVIEW_TOKEN_PARAM: 'reviewToken',
  previewTokenOfUrl: vi.fn(() => ''),
  fetchSiteShell: () => api.shell()
}))

/**
 * 整站导航只有一份，每一页渲染出的都必须是一样的那一条（按后端给的顺序，不重排、不截断）。
 *
 * 这一档存在的理由很具体：详情页（文章 / 案例）过去走的是 PortalPageShell 自己写的一套页头，
 * 里面把壳返回的 nav 截成 6 条，而首页那类区块页走 SiteHeaderBlock、渲染完整的 8 条——
 * 访客点一下导航就看到条目数变了，这正是 2026-10-22 在 611 那套站上实测到的缺陷 #1。
 * 所以判据不是「详情页有 8 条」这种碰巧的数字，而是这两条：
 * ① 详情页渲染的条目数 == 壳里那一条数组的长度（截断、去重、重排都当场红）；
 * ② 同一份壳喂给区块页那个页头组件，两边得到的有序标题完全相同（跨页相等才是真正的不变量）。
 * 页脚同理：它没绑 footerLinks 槽位时退回的就是 shell.nav，所以第三例把「页脚 = 页头 = 全量」钉在一起。
 *
 * 8 条这个样本量是照现场那一套站取的（候选站 611 的导航实测 8 条），大于旧代码那个 6 的截断位，
 * 截断一旦回来，第一个断言就会少一条。
 */
const NAV = [
  { title: '首页', url: '/' },
  { title: '关于我们', url: '/about' },
  { title: '服务与方案', url: '/services' },
  { title: '客户案例', url: '/cases' },
  { title: '新闻动态', url: '/news' },
  { title: '加入我们', url: '/jobs' },
  { title: '文档中心', url: '/docs' },
  { title: '联系我们', url: '/contact' }
]

const SHELL = {
  siteId: 611,
  siteName: '蓝山旅程 候选方案 2',
  siteCode: 'lanshan-journey',
  baseUrl: null,
  company: {
    name: '蓝山旅程',
    logo: '/api/media/1/logo.png',
    description: null,
    copyright: '© 2026 蓝山旅程',
    phone: '010-00000000',
    email: null,
    address: null
  },
  seo: null,
  nav: NAV.map(item => ({ ...item, articleCount: null }))
} as unknown as PortalSiteShell

/**
 * setup.ts 把 router-link 糊成了不渲 slot 的空壳桩，而这一档断言读的就是链接里的标题与 to，
 * 所以换成渲染 slot 的桩（同仓另几档区块测试的写法）。
 * 这份口子要交给 `global`，不是挂在 mount 选项的根上：VTU 2 只认 global.stubs，
 * 根上那个 `stubs` 会被静默忽略，于是标题全读成空串——红得很像被测代码坏了，其实是桩没换上。
 */
const GLOBALS = { stubs: { 'router-link': { template: '<a><slot /></a>' } } }

async function mountShell(): Promise<VueWrapper> {
  const wrapper = mount(PortalPageShell, { global: GLOBALS })
  // 壳是 onMounted 里取的，等一次微任务队列让 shell.nav 落到那两个组件上
  await flushPromises()
  return wrapper
}

function mountBlock(component: Component, blockProps: BlockProps = {}, shell: PortalSiteShell | null = SHELL) {
  return mount(component, { props: { blockProps, shell }, global: GLOBALS })
}

/** 页头那排链接的有序标题：这就是「访客看到的那一条导航」 */
function headerTitles(wrapper: VueWrapper): string[] {
  return wrapper.findAll('.pb-header__link').map(link => link.text())
}

/** 页脚那排链接的有序标题（没绑槽位时它取的就是 shell.nav，同一份顺序） */
function footerTitles(wrapper: VueWrapper): string[] {
  return wrapper.findAll('.pb-footer__links a').map(link => link.text())
}

beforeEach(() => {
  api.shell.mockResolvedValue(SHELL)
})

describe('详情页壳的导航：不给截断留第二条路', () => {
  it('八条的壳就渲八条：条数照壳里那个数组的长度判，不写死数字', async () => {
    const wrapper = await mountShell()
    const titles = headerTitles(wrapper)

    expect(titles).toHaveLength(SHELL.nav.length)
    expect(titles).toHaveLength(8)
    // 每一条标题都真的出现在页面上（条数对了却被换成别的词，同样是这条不变量破了）
    for (const item of NAV) {
      expect(titles).toContain(item.title)
    }
  })

  it('详情页与区块页喂同一份壳，得到的导航逐条同序', async () => {
    const wrapper = await mountShell()
    const blockPageHeader = mountBlock(SiteHeaderBlock)

    expect(headerTitles(wrapper)).toEqual(headerTitles(blockPageHeader))
    // 顺序也是判据的一部分：排序逻辑第二次出现在详情页就等于有了第二条真相
    expect(headerTitles(wrapper)).toEqual(NAV.map(item => item.title))
  })

  it('详情页挂的是那两个组件本体，而不是又一份同姓的页头页脚', async () => {
    const wrapper = await mountShell()
    expect(wrapper.find('.pb-header').exists()).toBe(true)
    expect(wrapper.find('.pb-footer').exists()).toBe(true)
    // 站点标志/站点名也只有一处取法（shell.company.*），所以详情页的头与首页的头同源
    expect(wrapper.find('.pb-header__brand img').attributes('src')).toBe('/api/media/1/logo.png')
    expect(wrapper.find('.pb-header__brand').text()).toContain('蓝山旅程')
  })
})

describe('页脚退回的就是全量导航', () => {
  it('没绑 footerLinks 槽位时，页脚那条 = 页脚组件那条 = 壳里的 nav', async () => {
    const wrapper = await mountShell()
    expect(footerTitles(wrapper)).toEqual(footerTitles(mountBlock(SiteFooterBlock)))
    expect(footerTitles(wrapper)).toEqual(headerTitles(wrapper))
  })

  it('壳里是几条就渲几条：给条数判据换个长度（截断若被挪到页脚这边也照样红）', async () => {
    const short = { ...SHELL, nav: SHELL.nav.slice(0, 3) }
    const blockPage = mountBlock(SiteFooterBlock, {}, short)
    expect(footerTitles(blockPage)).toEqual(['首页', '关于我们', '服务与方案'])

    api.shell.mockResolvedValue(short)
    const detail = await mountShell()
    expect(footerTitles(detail)).toEqual(footerTitles(blockPage))
    expect(headerTitles(detail)).toEqual(['首页', '关于我们', '服务与方案'])
  })
})
