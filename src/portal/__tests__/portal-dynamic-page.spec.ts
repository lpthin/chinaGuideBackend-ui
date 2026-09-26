import { describe, it, expect, vi, beforeEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import type { VueWrapper } from '@vue/test-utils'
import type { ComponentPublicInstance } from 'vue'
import type { Router } from 'vue-router'
import PortalDynamicPage from '../PortalDynamicPage.vue'

const api = vi.hoisted(() => ({
  page: vi.fn(),
  reviewPage: vi.fn(),
  shell: vi.fn(),
  context: vi.fn(),
}))

/**
 * 桩件里每一条回包都照真后端的形状写：PortalReviewPublicController.TokenContext 是
 * (scope, ticketWritable, label, expiresAt) 四条，多一个少一个都会让组件里的判断在测试里假绿。
 */
vi.mock('../api/portalPublic', () => ({
  PREVIEW_TOKEN_PARAM: 'reviewToken',
  previewTokenOfUrl: vi.fn(() => ''),
  fetchPublicPage: (...args: unknown[]) => api.page(...args),
  fetchReviewPage: (...args: unknown[]) => api.reviewPage(...args),
  fetchReviewContext: (...args: unknown[]) => api.context(...args),
  fetchReviewIntentOptions: vi.fn().mockResolvedValue({}),
  fetchSiteShell: () => api.shell(),
}))

const SHELL = {
  siteId: 1,
  siteName: '示例站点',
  siteCode: 'acme',
  baseUrl: null,
  company: { name: '示例公司', logo: null, description: null, copyright: '© 示例公司', phone: '010-0000', email: null, address: null },
  seo: null,
  nav: [{ title: '关于我们', url: '/about', articleCount: 3 }],
}

function renderedPage(overrides: Record<string, unknown> = {}) {
  return {
    id: 7,
    slug: 'home',
    path: '/',
    title: '首页',
    pageKind: 'home',
    theme: { colorPrimary: '#ff6600', fontScale: 1.1 },
    seo: { title: '首页标题', description: '站点说明', keywords: null },
    blocks: [
      { instanceId: 'b2', blockKey: 'hero', rendererKey: 'hero', props: { title: '真实主标题', description: '真实副文案' } },
    ],
    skippedBlocks: [],
    ...overrides,
  }
}

/**
 * 区块组件是 defineAsyncComponent，首次访问还要过 vite 转译（几百毫秒），
 * 所以按「页面上出现期望文案」轮询而不是拍一个固定 sleep——慢机器上不会假失败，快机器上不会白等。
 */
async function waitForText(wrapper: VueWrapper<ComponentPublicInstance>, text: string) {
  const deadline = Date.now() + 5000
  while (Date.now() < deadline) {
    await flushPromises()
    if (wrapper.text().includes(text)) {
      return
    }
    await new Promise(resolve => setTimeout(resolve, 20))
  }
  throw new Error(`等待超时：页面上没出现「${text}」，实际是「${wrapper.text()}」`)
}

async function mountPage(expectText: string, slug = 'home') {
  const wrapper = mount(PortalDynamicPage, { props: { slug } })
  await waitForText(wrapper, expectText)
  return wrapper
}

/**
 * 把预览令牌放进地址栏：用的还是 setup.ts 里那个真 router，
 * 因为「令牌在 route.query 里」正是组件读它的方式——拿全局 stub 塞一份假 query，
 * 测出来的只是 stub（这条纪律的来处见本仓另一条踩坑记录）。
 */
async function gotoWithToken(wrapper: VueWrapper<ComponentPublicInstance>, token: string) {
  await wrapper.vm.$router.push({ path: '/', query: { reviewToken: token } })
  await flushPromises()
}

/**
 * setup.ts 那个 router 是跨用例活着的：上一例留下的 ?reviewToken=tok-page 会变成下一例的初始地址，
 * 于是「整站令牌那一例」里能看到逐页令牌的取数调用——红得很随机。每例开始先把地址擦回 '/'。
 */
let sharedRouter: Router | null = null
async function resetRoute() {
  if (!sharedRouter) {
    const probe = mount({ render: () => null })
    sharedRouter = (probe.vm as unknown as { $router: Router }).$router
    probe.unmount()
  }
  await sharedRouter.replace('/')
  await flushPromises()
}

describe('PortalDynamicPage 区块渲染', () => {
  beforeEach(async () => {
    await resetRoute()
    vi.clearAllMocks()
    api.shell.mockResolvedValue(SHELL)
    api.page.mockResolvedValue(renderedPage())
    api.reviewPage.mockResolvedValue(renderedPage())
    api.context.mockResolvedValue({ scope: 'page', ticketWritable: true, label: null, expiresAt: null })
  })

  it('按 slug 取页面，并把已登记区块的真实内容渲染出来', async () => {
    const wrapper = await mountPage('真实主标题')
    expect(api.page).toHaveBeenCalledWith('home')
    expect(wrapper.text()).toContain('真实副文案')
  })

  it('未登记的 rendererKey 整块不渲染，页面上不留痕迹', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    api.page.mockResolvedValue(renderedPage({
      blocks: [
        { instanceId: 'b1', blockKey: 'hero', rendererKey: 'hero', props: { title: '保留' } },
        { instanceId: 'b2', blockKey: 'x', rendererKey: 'notRegistered', props: { title: '不该出现' } },
      ],
    }))
    const wrapper = await mountPage('保留')
    expect(wrapper.text()).not.toContain('不该出现')
    expect(wrapper.text()).not.toContain('notRegistered')
    spy.mockRestore()
  })

  it('theme_json 落到 CSS 变量上（运行时换肤的唯一入口）', async () => {
    const wrapper = await mountPage('真实主标题')
    const style = wrapper.attributes('style') ?? ''
    expect(style).toContain('--portal-color-primary')
    expect(style).toContain('#ff6600')
  })

  it('后端说页面不存在时，原样显示中文原因而不是编一条「加载失败」', async () => {
    api.page.mockRejectedValue(new Error('页面不存在或未发布'))
    const wrapper = await mountPage('页面不存在或未发布', 'no-such-page')
    expect(wrapper.text()).not.toContain('真实主标题')
  })

  it('站点壳取不到不影响正文：区块照样渲染', async () => {
    api.shell.mockRejectedValue(new Error('该域名未绑定站点'))
    const wrapper = await mountPage('真实主标题')
    expect(wrapper.text()).not.toContain('该域名未绑定站点')
  })

  it('换一个 slug 会重新取页面（同组件实例在栏目间复用）', async () => {
    const wrapper = await mountPage('真实主标题')
    api.page.mockResolvedValue(renderedPage({
      slug: 'about',
      blocks: [{ instanceId: 'b1', blockKey: 'hero', rendererKey: 'hero', props: { title: '关于页标题' } }],
    }))
    await wrapper.setProps({ slug: 'about' })
    await waitForText(wrapper, '关于页标题')
    expect(api.page).toHaveBeenLastCalledWith('about')
  })

  /**
   * 招聘区块：岗位字段只能来自后端把 {"$data":"jobs"} 解析好的结果——前端既不去自己取数，
   * 也不给没填的字段编一个「面议」当占位（库里没有的那一格就是不出现）。
   */
  it('job-list 渲染解析出来的岗位字段', async () => {
    api.page.mockResolvedValue(renderedPage({
      slug: 'jobs',
      blocks: [{
        instanceId: 'b1',
        blockKey: 'job-list',
        rendererKey: 'jobList',
        props: {
          heading: '在招岗位',
          items: [
            {
              id: 9, title: '口腔执业医师', department: '口腔科', jobType: '全职',
              location: '昆明', salaryText: '12-20 元/月',
              description: '负责口腔门诊日常诊疗', requirements: '持有口腔执业医师证', benefits: null,
            },
            { id: 10, title: '前台接待', location: '昆明' },
          ],
        },
      }],
    }))
    const wrapper = await mountPage('口腔执业医师', 'jobs')
    expect(api.page).toHaveBeenCalledWith('jobs')
    expect(wrapper.text()).toContain('在招岗位')
    expect(wrapper.text()).toContain('12-20 元/月')
    // 岗位元信息拼的是后端字典翻译后的值，不是 FULL_TIME 这种代码
    expect(wrapper.text()).toContain('口腔科 · 全职 · 昆明')
    expect(wrapper.text()).toContain('负责口腔门诊日常诊疗')
    expect(wrapper.text()).toContain('持有口腔执业医师证')
    expect(wrapper.text()).toContain('前台接待')
    expect(wrapper.text()).not.toContain('面议')
  })

  /** 一条岗位都没有时整块消失（区块里没有「暂无」这种编出来的文案），页面照常渲染其余区块 */
  it('岗位列表为空时 job-list 整块不渲染', async () => {
    api.page.mockResolvedValue(renderedPage({
      slug: 'jobs',
      // job-list 放在前面：等后面的标题出现时，这一块的异步组件也已经解析完了
      blocks: [
        { instanceId: 'b1', blockKey: 'job-list', rendererKey: 'jobList', props: { heading: '在招岗位', items: [] } },
        { instanceId: 'b2', blockKey: 'hero', rendererKey: 'hero', props: { title: '加入我们' } },
      ],
    }))
    const wrapper = await mountPage('加入我们', 'jobs')
    expect(wrapper.text()).not.toContain('在招岗位')
  })

  /**
   * 逐页预览令牌：取数走 /review/{token}/page（草稿版本也只有令牌那条口能看到），
   * 公开取数口一次都不碰。
   */
  it('逐页令牌按令牌取这一页，并摆出批注工具条', async () => {
    const wrapper = await mountPage('真实主标题')
    await gotoWithToken(wrapper, 'tok-page')
    await waitForText(wrapper, '预览页')

    expect(api.context).toHaveBeenCalledWith('tok-page')
    expect(api.reviewPage).toHaveBeenCalledWith('tok-page')
    // 令牌到手之后没有再按 slug 去公开口要过一次这一页：草稿版本只在令牌那条口上存在
    expect(api.page).toHaveBeenCalledTimes(1)
    expect(wrapper.find('.review-toolbar').exists()).toBe(true)
    expect(wrapper.find('.portal-dynamic-page__notice').exists()).toBe(false)
  })

  /**
   * 整站预览令牌（候选站那一档）：作用域是「这一整套站」，每一页都该走公开取数口——
   * 后端已经让令牌优先于域名，无域名的候选站也认得出自己，所以 /p/{slug} 拿得到内容。
   * 这条链接没有工单写口（拍板 1A/R-3），界面上只许出现那句实话，不许出现提交框。
   */
  it('整站令牌翻每一页都走公开取数口，页面上只有「这里不能提意见」那句实话', async () => {
    api.context.mockResolvedValue({ scope: 'site', ticketWritable: false, label: '候选站 A 方案', expiresAt: null })
    const wrapper = await mountPage('真实主标题')
    await gotoWithToken(wrapper, 'tok-site')

    expect(api.context).toHaveBeenCalledWith('tok-site')
    expect(api.reviewPage).not.toHaveBeenCalled()
    expect(api.page).toHaveBeenCalledWith('home')

    await wrapper.setProps({ slug: 'services' })
    await waitForText(wrapper, '真实主标题')
    // 翻页还是同一套站：取数口仍然是公开的这一条，且没有换成令牌口
    expect(api.page).toHaveBeenCalledWith('services')
    expect(api.reviewPage).not.toHaveBeenCalled()

    await waitForText(wrapper, '整站预览')
    const notice = wrapper.find('.portal-dynamic-page__notice')
    expect(notice.exists(), '只读预览该给出那句「不能在这里提交修改意见」').toBe(true)
    expect(notice.text()).toContain('它不能在这里提交修改意见')
    expect(wrapper.find('.review-toolbar').exists()).toBe(false)
  })

  it('作用域问不到时按只读处理：不摆提交框，也不硬猜一条取数口', async () => {
    api.context.mockRejectedValue(new Error('预览链接无效或已过期'))
    const wrapper = await mountPage('真实主标题')
    await gotoWithToken(wrapper, 'tok-unknown')
    await waitForText(wrapper, '只读')

    expect(wrapper.find('.review-toolbar').exists()).toBe(false)
    expect(wrapper.find('.portal-dynamic-page__notice').exists()).toBe(true)
  })
})

