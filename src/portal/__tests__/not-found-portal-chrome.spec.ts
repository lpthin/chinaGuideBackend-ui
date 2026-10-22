import { describe, it, expect, vi, beforeEach } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import type { Router } from 'vue-router'
import NotFoundView from '../../views/NotFoundView.vue'

const api = vi.hoisted(() => ({ shell: vi.fn() }))

vi.mock('../api/portalPublic', () => ({
  PREVIEW_TOKEN_PARAM: 'reviewToken',
  previewTokenOfUrl: vi.fn(() => ''),
  fetchSiteShell: () => api.shell()
}))

/**
 * 404 页的两副面孔（缺陷 #2）：
 * 1. 门户那一路的 404 必须带站点壳——访客输错一个门户地址时，落点不能是一条没有导航的死路，
 *    他得看到与站内其它页同一条导航（同一份 shell.nav，判据在 portal-nav-single-source.spec.ts 那边钉着）；
 * 2. 管理侧（/workspace、/login、/admin、/brief/…）保持今天这块裸卡片：既不多一次 /site 请求，
 *    也不给工作台套上访客页头。两副面孔判的是同一件事，所以走的是 previewNavigation 里那条 isPortalPath，
 *    本档直接把那几个前缀逐个走一遍，清单换人改动时这里会跟着红。
 *
 * 还有一条是「不许演」：壳取不到（站点没绑域名、接口失败）时页头只剩空导航，
 * 404 那句实话照常摆出来，既不报错也不补一份假链接列表。
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
  company: { name: '蓝山旅程', logo: null, description: null, copyright: null, phone: null, email: null, address: null },
  seo: null,
  nav: NAV.map(item => ({ ...item, articleCount: null }))
}

/** 地址栏那一格只能取自 setup.ts 里那个真 router：见下面 mountAt 的说明 */
let sharedRouter: Router | null = null

async function getRouter(): Promise<Router> {
  if (!sharedRouter) {
    const probe = mount({ render: () => null })
    sharedRouter = (probe.vm as unknown as { $router: Router }).$router
    probe.unmount()
  }
  return sharedRouter
}

/**
 * 把地址换成 path 再挂这个视图。
 *
 * 为什么不用自造的第二份 router：vue-router 5 在同一个 app 上装第二次会直接抛
 * `Cannot redefine property: $route`（不是警告），而 setup.ts 已经把全局那份装进每个 mount 了。
 * 照仓里 portal-dynamic-page.spec.ts 那条路走——拿同一个实例把地址换过去，
 * 被测组件读的 `route.path` 就是这一次真的落在地址栏上的那一条（拿 mocks 塞一份假 query，
 * 测出来的只是 mock）。
 */
async function mountAt(path: string): Promise<VueWrapper> {
  const router = await getRouter()
  await router.replace(path)
  const wrapper = mount(NotFoundView, {
    global: {
      // setup.ts 的 router-link 桩不渲 slot，这一档读的正是链接里的标题
      stubs: { 'router-link': { template: '<a><slot /></a>' } }
    }
  })
  // 壳是在 PortalPageShell 的 onMounted 里取的，等一次微任务队列
  await flushPromises()
  return wrapper
}

function headerTitles(wrapper: VueWrapper): string[] {
  return wrapper.findAll('.pb-header__link').map(link => link.text())
}

beforeEach(() => {
  // 每例先擦调用记录：管理侧那一例判的就是「一次壳请求都不发」，
  // 不清的话前几例（门户路径）留下的调用会把它顶成红，红的还不是被测的那件事
  vi.clearAllMocks()
  api.shell.mockResolvedValue(SHELL)
})

describe('门户路径上的 404：带上真导航', () => {
  it('输错了门户地址也看得到那一条导航（八条一条不少）', async () => {
    const wrapper = await mountAt('/news/no-such-article')
    expect(wrapper.find('.pb-header').exists()).toBe(true)
    expect(headerTitles(wrapper)).toEqual(NAV.map(item => item.title))
    // 页脚同样是那一族组件本体，不是又写一份
    expect(wrapper.find('.pb-footer').exists()).toBe(true)
    expect(wrapper.findAll('.pb-footer__links a')).toHaveLength(NAV.length)
  })

  it('404 那句实话还在原位：挂壳是给导航，不是把话换成一句成功提示', async () => {
    const wrapper = await mountAt('/p/lost-page')
    expect(wrapper.text()).toContain('页面未找到')
    expect(wrapper.text()).toContain('您访问的页面不存在或已被移除')
    expect(wrapper.find('.not-found-page--framed').exists(), '壳里那一版该收掉 100vh 那档高度').toBe(true)
  })

  it('壳取不到时退回今天这块：404 照说，一条链接都不编', async () => {
    api.shell.mockRejectedValue(new Error('该域名未绑定站点'))
    const wrapper = await mountAt('/cases/no-such-case')

    expect(wrapper.text()).toContain('页面未找到')
    expect(wrapper.text()).not.toContain('该域名未绑定站点')
    // 骨架还在（页头元素本身不是假的），但一条链接都不渲：那才是「后端没说这条站有导航」的真实状态
    expect(wrapper.find('.pb-header').exists()).toBe(true)
    expect(headerTitles(wrapper)).toEqual([])
  })
})

describe('管理侧的 404：一扇门都不开', () => {
  it.each([
    ['/workspace/articles'],
    ['/login'],
    ['/admin/sites'],
    ['/brief/abc123'],
    ['/workspace/portal?page=2']
  ])('%s 保持裸卡片，且一次壳请求都不发', async path => {
    const wrapper = await mountAt(path)

    expect(wrapper.find('.pb-header').exists()).toBe(false)
    expect(wrapper.find('.pb-footer').exists()).toBe(false)
    expect(api.shell).not.toHaveBeenCalled()
    expect(wrapper.find('.not-found-page').exists()).toBe(true)
    expect(wrapper.find('.not-found-page--framed').exists()).toBe(false)
    expect(wrapper.text()).toContain('页面未找到')
  })
})
