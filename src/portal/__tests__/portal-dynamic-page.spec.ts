import { describe, it, expect, vi, beforeEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import type { VueWrapper } from '@vue/test-utils'
import type { ComponentPublicInstance } from 'vue'
import PortalDynamicPage from '../PortalDynamicPage.vue'

const api = vi.hoisted(() => ({
  page: vi.fn(),
  shell: vi.fn(),
}))

vi.mock('../api/portalPublic', () => ({
  fetchPublicPage: (...args: unknown[]) => api.page(...args),
  fetchSiteShell: () => api.shell(),
}))

const SHELL = {
  siteId: 1,
  siteName: '示例站点',
  siteCode: 'acme',
  baseUrl: null,
  company: { name: '示例公司', logo: null, description: null, copyright: '© 示例公司', phone: '010-0000', email: null, address: null },
  seo: null,
  template: { code: null, name: null, renderKey: 'tech' },
  nav: [{ title: '关于我们', url: '/about', articleCount: 3 }],
  pageModelEnabled: true,
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

describe('PortalDynamicPage 区块渲染', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.shell.mockResolvedValue(SHELL)
    api.page.mockResolvedValue(renderedPage())
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
})
