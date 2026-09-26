import { describe, it, expect, vi, beforeEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import type { Component } from 'vue'
import CaseGridBlock from '../blocks/CaseGridBlock.vue'
import CaseListBlock from '../blocks/CaseListBlock.vue'
import NewsListBlock from '../blocks/NewsListBlock.vue'
import type {
  PortalArticleItem,
  PortalCaseItem,
  PortalCategoryNode,
  PortalPage,
  PortalSiteShell
} from '../api/portalPublic'
import { fetchCases, fetchCaseFacets, fetchArticles, fetchCategories } from '../api/portalPublic'

/**
 * Spec-D D2 列表能力：案例按行业筛选、新闻真分页 + 分类标签。
 *
 * 契约照抄后端（PortalPublicController / PortalContentService），一处都不猜：
 * - GET /cases 收 industry（精确匹配）、page、size，回 Page{records,total,page,size}；
 * - GET /cases/facets 回 {industries:[...]}，与 /cases 共用同一份可见性 wrapper；
 * - GET /articles 收 category（id/slug/code 三认）、page、size；
 * - GET /categories 回两层栏目树。
 * 断言挂真实按钮与真实 DOM：点了哪个 chip、发出了什么参数、屏幕上剩下哪句话。
 */

vi.mock('../api/portalPublic', () => ({
  fetchCases: vi.fn(),
  fetchCaseFacets: vi.fn(),
  fetchArticles: vi.fn(),
  fetchCategories: vi.fn()
}))

// vi.mocked 拿回带 mock 方法的同一函数引用：断言的还是组件实际调用到的那一个
const cases = vi.mocked(fetchCases)
const caseFacets = vi.mocked(fetchCaseFacets)
const articles = vi.mocked(fetchArticles)
const categories = vi.mocked(fetchCategories)

const realShell = { siteId: 12, siteName: '示例', siteCode: 'acme', baseUrl: null } as unknown as PortalSiteShell
const demoShell = { siteId: 0, siteName: '画廊', siteCode: 'demo', baseUrl: null } as unknown as PortalSiteShell

function page<T>(records: T[], total = records.length, pageNum = 1, size = 10): PortalPage<T> {
  return { records, total, page: pageNum, size }
}

/**
 * setup.ts 把 router-link 糊成了空壳 stub——卡片正文在 slot 里，那样断言读不到真实 DOM。
 * 这里换成渲染 slot 的桩：文本、条数都从真实内容上来，不是在替组件兜底。
 */
function mountBlock(component: Component, blockProps: Record<string, unknown>, shell: PortalSiteShell | null) {
  return mount(component, {
    props: { blockProps, shell },
    global: { stubs: { 'router-link': { template: '<a><slot /></a>' } } }
  })
}

const caseRows: PortalCaseItem[] = [
  { id: 1, title: '跨境支付落地案例', customerName: '某行', industry: '制造', summary: '从 0 到 1', coverImage: null, link: '/cases/1' },
  { id: 2, title: '工厂巡检提效', customerName: '某厂', industry: '零售', summary: null, coverImage: null, link: '/cases/2' }
]

beforeEach(() => {
  vi.clearAllMocks()
  caseFacets.mockResolvedValue({ industries: [] })
  cases.mockResolvedValue(page<PortalCaseItem>([]))
  articles.mockResolvedValue(page<PortalArticleItem>([]))
  categories.mockResolvedValue([])
})

// ---------- 案例网格：行业筛选 ----------

describe('案例网格按行业筛选（真站取数走 /cases + /cases/facets）', () => {
  function mountGrid(blockProps: Record<string, unknown> = {}, shell: PortalSiteShell | null = realShell) {
    return mountBlock(CaseGridBlock, blockProps, shell)
  }

  it('加载中/就绪分开说：请求没回来前屏幕上就是「案例加载中」', async () => {
    let resolve: (v: PortalPage<PortalCaseItem>) => void = () => {}
    cases.mockImplementationOnce(() => new Promise<PortalPage<PortalCaseItem>>(r => { resolve = r }))
    const wrapper = mountGrid()
    expect(wrapper.text()).toContain('案例加载中')
    expect(wrapper.find('.pb-card').exists()).toBe(false)

    resolve(page(caseRows))
    await flushPromises()
    expect(wrapper.text()).not.toContain('案例加载中')
    expect(wrapper.findAll('.pb-card')).toHaveLength(2)
  })

  it('筛选条的行业名单来自 /cases/facets，一个都不写死', async () => {
    caseFacets.mockResolvedValue({ industries: ['制造', '教育', '零售'] })
    cases.mockResolvedValue(page(caseRows))
    const wrapper = mountGrid()
    await flushPromises()

    const chips = wrapper.findAll('.pb-filter__chip').map(node => node.text())
    expect(chips).toEqual(['全部', '制造', '教育', '零售'])
  })

  it('点行业 chip：按后端契约带 industry 精确值重新取数', async () => {
    caseFacets.mockResolvedValue({ industries: ['制造', '零售'] })
    cases.mockResolvedValue(page(caseRows))
    const wrapper = mountGrid()
    await flushPromises()
    cases.mockResolvedValue(page([caseRows[0]]))

    await wrapper.findAll('.pb-filter__chip')[1].trigger('click')
    await flushPromises()

    expect(cases).toHaveBeenLastCalledWith({ page: 1, size: 12, industry: '制造' })
    expect(wrapper.findAll('.pb-card')).toHaveLength(1)
    expect(wrapper.findAll('.pb-filter__chip')[1].classes()).toContain('is-active')
  })

  it('取数永远有界：首屏也不许无界拉全量（size 必带且不超过后端上限 50）', async () => {
    caseFacets.mockResolvedValue({ industries: ['制造', '零售'] })
    await mountGrid()
    await flushPromises()

    const params = cases.mock.calls[0][0]
    expect(typeof params?.size).toBe('number')
    expect(params?.size).toBeGreaterThan(0)
    expect(params?.size).toBeLessThanOrEqual(50)
  })

  it('筛选后没有结果 ⇒ 明说「这个行业还没有案例」，不摆空网格糊弄', async () => {
    caseFacets.mockResolvedValue({ industries: ['制造', '零售'] })
    const wrapper = mountGrid()
    await flushPromises()
    cases.mockResolvedValue(page<PortalCaseItem>([], 0))

    await wrapper.findAll('.pb-filter__chip')[1].trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('这个行业还没有案例')
    expect(wrapper.find('.pb-grid').exists()).toBe(false)
  })

  it('接口挂了说失败并带原因，不演「暂无案例」', async () => {
    cases.mockRejectedValueOnce(new Error('无法连接服务器'))
    const wrapper = mountGrid()
    await flushPromises()

    expect(wrapper.text()).toContain('案例加载失败：无法连接服务器')
    expect(wrapper.find('[role="alert"]').exists()).toBe(true)
    expect(wrapper.text()).not.toContain('还没有发布案例')
  })

  it('行业不足两个 ⇒ 不摆筛选条；一个可选行业都没有也不硬挂「全部」', async () => {
    caseFacets.mockResolvedValue({ industries: ['制造'] })
    cases.mockResolvedValue(page(caseRows))
    const wrapper = mountGrid()
    await flushPromises()
    expect(wrapper.find('.pb-filter').exists()).toBe(false)
  })

  it('画廊演示壳：不发真实请求，名单从绑定条目里数、筛选就地做', async () => {
    const wrapper = mountGrid({ items: caseRows }, demoShell)
    await flushPromises()

    expect(cases).not.toHaveBeenCalled()
    expect(caseFacets).not.toHaveBeenCalled()
    const chips = wrapper.findAll('.pb-filter__chip').map(node => node.text())
    expect(chips).toEqual(['全部', '制造', '零售'])

    await wrapper.findAll('.pb-filter__chip')[2].trigger('click')
    expect(wrapper.findAll('.pb-card')).toHaveLength(1)
    expect(wrapper.text()).toContain('工厂巡检提效')
  })
})

// ---------- 案例列表页：同一套行业筛选 ----------

describe('案例列表按行业筛选', () => {
  it('chip 点下去带 industry 取数，结果换的是真实列表行', async () => {
    caseFacets.mockResolvedValue({ industries: ['制造', '零售'] })
    cases.mockResolvedValue(page(caseRows))
    const wrapper = mountBlock(CaseListBlock, { heading: '客户案例' }, realShell)
    await flushPromises()

    cases.mockResolvedValue(page([caseRows[1]]))
    await wrapper.findAll('.pb-filter__chip')[2].trigger('click')
    await flushPromises()

    expect(cases).toHaveBeenLastCalledWith({ page: 1, size: 10, industry: '零售' })
    expect(wrapper.findAll('.pb-case-list li')).toHaveLength(1)
    expect(wrapper.text()).toContain('工厂巡检提效')
  })

  it('空态与失败态分开：筛完没案例是一句话，接口挂了是一句话', async () => {
    caseFacets.mockResolvedValue({ industries: ['制造', '零售'] })
    const wrapper = mountBlock(CaseListBlock, {}, realShell)
    await flushPromises()

    cases.mockResolvedValueOnce(page<PortalCaseItem>([], 0))
    await wrapper.findAll('.pb-filter__chip')[1].trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('这个行业还没有案例')

    cases.mockRejectedValueOnce(new Error('网关超时'))
    await wrapper.findAll('.pb-filter__chip')[2].trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('案例加载失败：网关超时')
  })
})

// ---------- 新闻列表：真分页 + 分类标签 ----------

function articleRows(count: number, category: string | null = null): PortalArticleItem[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    slug: `a-${i + 1}`,
    title: `新闻 ${i + 1}${category ? `（${category}）` : ''}`,
    summary: null,
    coverImage: null,
    publishedAt: '2026-09-01',
    categoryName: category,
    categorySlug: null,
    tags: [],
    link: `/news/${i + 1}`
  }))
}

function categoryNodes(): PortalCategoryNode[] {
  const child: PortalCategoryNode = {
    id: 5, name: '产品发布', slug: null, description: null, parentId: 3, sortOrder: 1, articleCount: 2, link: '/c/5', children: []
  }
  return [
    { id: 3, name: '公司动态', slug: 'company', description: null, parentId: null, sortOrder: 1, articleCount: 2, link: '/c/3', children: [child] },
    { id: 4, name: '行业观察', slug: 'insight', description: null, parentId: null, sortOrder: 2, articleCount: 4, link: '/c/4', children: [] }
  ]
}

describe('新闻列表真分页 + 分类标签（走 /articles 的 category/page/size）', () => {
  function mountNews(blockProps: Record<string, unknown> = {}, shell: PortalSiteShell | null = realShell) {
    return mountBlock(NewsListBlock, blockProps, shell)
  }

  it('分类标签来自 /categories，两层栏目树摊平、值用 slug（缺 slug 才用 id）', async () => {
    categories.mockResolvedValue(categoryNodes())
    const wrapper = mountNews()
    await flushPromises()

    const chips = wrapper.findAll('.pb-filter__chip')
    expect(chips.map(node => node.text())).toEqual(['全部', '公司动态', '产品发布', '行业观察'])

    await chips[2].trigger('click')
    await flushPromises()
    // 产品发布没配 slug：取数按键用 id 的字符串形态（后端 requireCategoryId 三认）
    expect(articles).toHaveBeenLastCalledWith({ page: 1, size: 6, category: '5' })
  })

  it('翻页带 page 重新取数；上一页越界禁用', async () => {
    articles.mockResolvedValue(page(articleRows(6), 14))
    const wrapper = mountNews({}, realShell)
    await flushPromises()

    expect(wrapper.find('.pb-pager').exists()).toBe(true)
    expect(wrapper.find('.pb-pager__position').text()).toContain('第 1 / 3 页')
    expect(wrapper.find('.pb-pager__btn').attributes('disabled')).toBeDefined()

    await wrapper.findAll('.pb-pager__btn')[1].trigger('click')
    await flushPromises()
    expect(articles).toHaveBeenLastCalledWith({ page: 2, size: 6 })
    expect(wrapper.find('.pb-pager__position').text()).toContain('第 2 / 3 页')
  })

  it('只有 1 页 ⇒ 不摆翻页控件：摆一对点了不动的箭头是谎报「还有更多」', async () => {
    articles.mockResolvedValue(page(articleRows(3), 3))
    const wrapper = mountNews({}, realShell)
    await flushPromises()

    expect(wrapper.findAll('.pb-card')).toHaveLength(3)
    expect(wrapper.find('.pb-pager').exists()).toBe(false)
  })

  it('加载中 / 失败 / 空 三种状态各说各的', async () => {
    let resolve: (v: PortalPage<PortalArticleItem>) => void = () => {}
    articles.mockImplementationOnce(() => new Promise<PortalPage<PortalArticleItem>>(r => { resolve = r }))
    const wrapper = mountNews()
    expect(wrapper.text()).toContain('新闻加载中')
    resolve(page(articleRows(2), 2))
    await flushPromises()
    expect(wrapper.text()).not.toContain('新闻加载中')

    articles.mockRejectedValueOnce(new Error('无法连接服务器'))
    categories.mockRejectedValueOnce(new Error('无法连接服务器'))
    const failed = mountNews()
    await flushPromises()
    expect(failed.text()).toContain('新闻加载失败：无法连接服务器')
    expect(failed.text()).not.toContain('还没有发布新闻')

    articles.mockResolvedValueOnce(page(articleRows(0), 0))
    const empty = mountNews()
    await flushPromises()
    expect(empty.text()).toContain('还没有发布新闻')
  })

  it('筛到没有结果的分类 ⇒ 明说「这个分类还没有新闻」', async () => {
    categories.mockResolvedValue(categoryNodes())
    articles.mockResolvedValue(page(articleRows(2), 2))
    const wrapper = mountNews()
    await flushPromises()

    articles.mockResolvedValue(page(articleRows(0), 0))
    await wrapper.findAll('.pb-filter__chip')[2].trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('这个分类还没有新闻')
    expect(wrapper.find('.pb-pager').exists()).toBe(false)
  })

  it('画廊演示壳：不发请求，分页与分类都在绑定条目里就地做', async () => {
    const items = Array.from({ length: 8 }, (_, i) => ({
      title: `动态 ${i + 1}`,
      category: i < 5 ? '公司动态' : '行业观察',
      link: `/news/${i + 1}`
    }))
    const wrapper = mountNews({ items }, demoShell)
    await flushPromises()

    expect(articles).not.toHaveBeenCalled()
    expect(categories).not.toHaveBeenCalled()
    expect(wrapper.findAll('.pb-card')).toHaveLength(6)
    expect(wrapper.find('.pb-pager__position').text()).toContain('第 1 / 2 页')

    await wrapper.findAll('.pb-pager__btn')[1].trigger('click')
    expect(wrapper.findAll('.pb-card')).toHaveLength(2)

    // 分类就地筛：行业观察 3 条，一页放得下 ⇒ 翻页控件收起
    await wrapper.findAll('.pb-filter__chip')[2].trigger('click')
    expect(wrapper.findAll('.pb-card')).toHaveLength(3)
    expect(wrapper.find('.pb-pager').exists()).toBe(false)
  })
})
