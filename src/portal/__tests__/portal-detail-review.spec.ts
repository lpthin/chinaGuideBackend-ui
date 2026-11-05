import { describe, it, expect, vi, beforeEach } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import PortalArticleDetail from '../PortalArticleDetail.vue'
import PortalCaseDetail from '../PortalCaseDetail.vue'
import { useReviewMode } from '../useReviewMode'
import { sitePreviewToken, withSitePreviewToken } from '../previewNavigation'

const api = vi.hoisted(() => ({
  article: vi.fn(),
  caseDetail: vi.fn(),
  shell: vi.fn(),
  context: vi.fn()
}))

/**
 * 详情页接入预览态（门户预览跳转断链修复）：
 * 过去这两个页面只靠地址栏里恰好带着令牌出内容，从不「记住」令牌——
 * 列表页卸载时把记住的令牌清掉，从详情页再点任何链接就断了链；
 * 断了之后 sessionStorage 里只进不出的 ?site= 残留抢着回答「这是哪一站」，串到别人家。
 * 这一档钉住的是：激活要记住令牌（守卫靠它续链）、横幅要在详情页出现、
 * 整站预览激活要清掉残留、卸载不清场（清场在路由层 afterEach，见 router/index.ts——
 * 切页时新页先挂载、旧页后卸载，卸载钩子会把下一页刚激活的预览态一起抹掉）。
 */

const SITE_CONTEXT = { scope: 'site', ticketWritable: false, label: '候选站 A 方案', expiresAt: '2026-10-01T00:00:00' }
const PAGE_CONTEXT = { scope: 'page', ticketWritable: true, label: '逐页批注', expiresAt: '2026-10-01T00:00:00' }

vi.mock('../api/portalPublic', () => ({
  PREVIEW_TOKEN_PARAM: 'reviewToken',
  previewTokenOfUrl: vi.fn(() => ''),
  fetchArticle: (...args: unknown[]) => api.article(...args),
  fetchCase: (...args: unknown[]) => api.caseDetail(...args),
  fetchSiteShell: () => api.shell(),
  fetchReviewContext: (...args: unknown[]) => api.context(...args),
  fetchReviewIntentOptions: vi.fn(async () => ({})),
  fetchArticleComments: vi.fn(async () => []),
  likeArticle: vi.fn(),
  submitArticleComment: vi.fn(),
  PortalApiError: class extends Error {
    status: number
    code: string
    constructor(message: string, status: number, code: string) {
      super(message)
      this.status = status
      this.code = code
    }
  }
}))

const routeState = vi.hoisted(() => ({
  params: {} as Record<string, string>,
  query: {} as Record<string, unknown>,
  name: '' as unknown
}))

vi.mock('vue-router', () => ({
  useRoute: () => routeState,
  RouterLink: { name: 'RouterLink', template: '<a><slot /></a>' }
}))

const SHELL = {
  siteId: 1070,
  siteName: '澜山国际旅行社（上海）有限公司 候选方案 1',
  siteCode: 'lanshan-candidate',
  baseUrl: null,
  company: { name: '澜山国际旅行社', logo: null, description: null, copyright: null, phone: null, email: null, address: null },
  seo: null,
  nav: [{ title: '首页', url: '/', articleCount: null }],
  previewAuthorized: true
}

const ARTICLE = {
  id: 9001,
  title: '示例｜合作客户 logo：企业决策者该知道的第 9 件事',
  summary: null,
  publishedAt: null,
  authorName: null,
  categoryName: '示例｜服务',
  categorySlug: 'demo-1',
  source: null,
  coverImage: null,
  citationSummary: null,
  contentMd: '正文第一段。',
  tags: [],
  prev: null,
  next: null,
  seo: null
}

const CASE_DETAIL = {
  id: 33,
  title: '示例案例',
  summary: null,
  customerName: null,
  industry: null,
  publishedAt: null,
  coverImage: null,
  content: '案例正文。',
  tags: [],
  seo: null
}

beforeEach(() => {
  vi.clearAllMocks()
  api.article.mockResolvedValue({ ...ARTICLE })
  api.caseDetail.mockResolvedValue({ ...CASE_DETAIL })
  api.shell.mockResolvedValue({ ...SHELL })
  api.context.mockResolvedValue({ ...SITE_CONTEXT })
  sessionStorage.clear()
  useReviewMode().deactivate()
})

describe('文章详情页接入预览态', () => {
  it('地址栏带整站令牌时激活并记住令牌，身份横幅与只读实话都出现', async () => {
    routeState.params = { idOrSlug: 'demo-c1-9' }
    routeState.query = { reviewToken: 'token-site' }
    routeState.name = 'portal-article-detail'
    sessionStorage.setItem('portal.site', 'china-guide')

    const wrapper = mount(PortalArticleDetail)
    await flushPromises()

    expect(sitePreviewToken()).toBe('token-site')
    expect(wrapper.text()).toContain('你现在看的是：澜山国际旅行社（上海）有限公司 候选方案 1')
    expect(wrapper.text()).toContain('站码 lanshan-candidate')
    expect(wrapper.text()).toContain('这是这一套方案的整站预览')
    // 残留的 ?site= 在整站预览激活这一刻就该被清掉：之后每一跳的站点身份只认令牌
    expect(sessionStorage.getItem('portal.site')).toBeNull()

    // 记住的令牌要能被路由守卫拿来续链：详情页再点出去的地址必须还带着令牌
    expect(withSitePreviewToken({ path: '/news', query: { category: 'demo-1' } })).toEqual({
      path: '/news',
      query: { category: 'demo-1', reviewToken: 'token-site' },
      hash: ''
    })
  })

  it('卸载不清场：令牌留在路由记忆里，下一页（门户路径）还能续链', async () => {
    routeState.params = { idOrSlug: 'demo-c1-9' }
    routeState.query = { reviewToken: 'token-site' }
    routeState.name = 'portal-article-detail'

    const wrapper = mount(PortalArticleDetail)
    await flushPromises()
    expect(sitePreviewToken()).toBe('token-site')

    // 2026-11-05 现场实测：切页时新页先挂载、旧页后卸载，卸载钩子清场会把下一页
    // 刚激活的预览态一起抹掉（断链第一现场）。清场改在路由层 afterEach（非门户路径才退）。
    wrapper.unmount()
    expect(sitePreviewToken()).toBe('token-site')
  })

  it('逐页令牌不记住、也不清 ?site= 残留（它授权的不是这一整站）', async () => {
    routeState.params = { idOrSlug: 'demo-c1-9' }
    routeState.query = { reviewToken: 'token-page' }
    routeState.name = 'portal-article-detail'
    api.context.mockResolvedValue({ ...PAGE_CONTEXT })
    sessionStorage.setItem('portal.site', 'china-guide')

    const wrapper = mount(PortalArticleDetail)
    await flushPromises()

    expect(sitePreviewToken()).toBe('')
    expect(sessionStorage.getItem('portal.site')).toBe('china-guide')
    wrapper.unmount()
  })
})

describe('案例详情页接入预览态', () => {
  it('同样激活并记住令牌，横幅不缺席', async () => {
    routeState.params = { id: '33' }
    routeState.query = { reviewToken: 'token-site' }
    routeState.name = 'portal-case-detail'

    const wrapper = mount(PortalCaseDetail)
    await flushPromises()

    expect(api.context).toHaveBeenCalledWith('token-site')
    expect(sitePreviewToken()).toBe('token-site')
    expect(wrapper.text()).toContain('你现在看的是：澜山国际旅行社（上海）有限公司 候选方案 1')
    expect(wrapper.text()).toContain('这是这一套方案的整站预览')
  })
})

/** 防挂空跑：article 没拿到时横幅不许出现（reviewActive 认的是「真的渲染出内容」） */
describe('横幅只跟渲染出的内容走', () => {
  it('文章取不到时不摆横幅', async () => {
    routeState.params = { idOrSlug: 'missing' }
    routeState.query = { reviewToken: 'token-site' }
    routeState.name = 'portal-article-detail'
    api.article.mockRejectedValue(new (await import('../api/portalPublic')).PortalApiError('这篇文章不存在或已下架', 404, 'NOT_FOUND'))

    const wrapper: VueWrapper = mount(PortalArticleDetail)
    await flushPromises()

    expect(wrapper.text()).toContain('这篇文章不存在或已下架')
    expect(wrapper.text()).not.toContain('你现在看的是：')
  })
})
