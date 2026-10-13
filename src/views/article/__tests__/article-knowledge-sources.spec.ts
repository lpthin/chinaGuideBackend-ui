import { describe, it, expect, beforeEach, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

/**
 * M-P13 走查 #232 的前端那一半：文章详情页要念得出「这一篇用了哪几份资料」。
 *
 * 现场起因：生成时勾了「引用企业资料」，模型确实是照着那几段写的，但存完之后
 * 这条链在界面上一处都读不到——出了岔子只能猜「它当时看见的是什么」。
 * 后端把命中的文档落进 `article_source`（题名是那一刻的快照），详情口念出来，
 * 这一格钉的是前端摆得出来、并且两种「空」不混成一谈：
 *
 * 1. 进页面就调 `/articles/{id}/sources`，摆的是后端给的那一份，前端不自己编序号；
 * 2. 顺序就是当初喂给模型的顺序（第 1 份 = 第一个段落），降级检索与向量命中要分得开；
 * 3. 接口真的回空数组才说「这一篇没有资料引用留痕」；
 * 4. 读失败时不许摆那句话——失败说失败，不能冒充「真的没引用」。
 *
 * 挂真实控件：真 mount 这个视图，断言读的是渲染出来的 DOM 文本。
 */

const api = vi.hoisted(() => ({
  get: vi.fn(),
  list: vi.fn(),
  versions: vi.fn(),
  knowledgeSources: vi.fn(),
  updateVersion: vi.fn(),
  delete: vi.fn()
}))

vi.mock('../../../api/article', () => ({ articleManageApi: api }))
vi.mock('../../../api/http', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
  describeHttpError: (error: unknown) => (error instanceof Error ? error.message : String(error))
}))
vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
  useRoute: () => ({ params: { id: '17' } })
}))
const notify = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() }))
vi.mock('ant-design-vue', async () => {
  const actual = await vi.importActual<Record<string, any>>('ant-design-vue')
  return { ...actual, message: notify }
})

const ArticleDetailView = (await import('../../../views/article/ArticleDetailView.vue')).default

const PASS = (name: string) => ({
  name,
  template: `<div class="${name}-stub"><slot name="title" /><slot name="extra" /><slot /></div>`
})

const GLOBALS = {
  stubs: {
    'a-spin': PASS('a-spin'),
    'a-page-header': PASS('a-page-header'),
    'a-row': PASS('a-row'),
    'a-col': PASS('a-col'),
    'a-card': PASS('a-card'),
    'a-alert': {
      name: 'a-alert',
      props: ['type', 'message', 'description'],
      template: `<div class="alert-stub" data-type="type"><span class="alert-msg">{{ message }}</span><span class="alert-desc">{{ description }}</span></div>`
    },
    'a-tag': { name: 'a-tag', template: '<span class="tag-stub"><slot /></span>' },
    'a-divider': PASS('a-divider'),
    'a-empty': {
      name: 'a-empty',
      props: ['description'],
      template: '<div class="empty-stub">{{ description }}</div>'
    },
    'a-list': PASS('a-list'),
    'a-list-item': PASS('a-list-item'),
    'a-button': PASS('a-button'),
    'a-input': PASS('a-input'),
    'a-textarea': PASS('a-textarea'),
    'a-popconfirm': PASS('a-popconfirm'),
    'a-space': PASS('a-space')
  }
}

function articleRow() {
  return {
    id: 17,
    tenantId: 180,
    title: '集采价格怎么问',
    summary: '一段摘要',
    content: '正文',
    keywords: '集采,价格',
    source: 'AI 生成',
    viewCount: 3,
    likeCount: 0,
    publishedAt: '2026-10-13T10:00:00'
  }
}

function sourceRow(overrides: Record<string, unknown> = {}) {
  return {
    documentId: 9,
    documentTitle: '2026 年产品资料册',
    chunkId: 501,
    chunkIndex: 2,
    quoteIndex: 1,
    sourceType: 'vector',
    ...overrides
  }
}

async function open() {
  const wrapper = mount(ArticleDetailView, { global: GLOBALS })
  await flushPromises()
  return wrapper
}

describe('#232 详情页摆出「这一篇用了哪几份资料」', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.get.mockResolvedValue(articleRow())
    api.list.mockResolvedValue({ records: [] })
    api.versions.mockResolvedValue([])
    api.knowledgeSources.mockResolvedValue([])
  })

  it('进页面就把留痕口读回来，路径只有 /articles/{id}/sources 一个说法', async () => {
    await open()

    expect(api.knowledgeSources).toHaveBeenCalledWith(17)
  })

  it('摆的是后端给的那一份：题名列出来，序号照抄不自己排', async () => {
    api.knowledgeSources.mockResolvedValue([
      sourceRow({ quoteIndex: 1 }),
      sourceRow({ documentId: 12, documentTitle: '集采价格表', chunkIndex: 0, quoteIndex: 2 })
    ])

    const wrapper = await open()
    const text = wrapper.text()

    expect(text).toContain('2026 年产品资料册')
    expect(text).toContain('集采价格表')
    expect(wrapper.findAll('.source-row')).toHaveLength(2)
    expect(wrapper.findAll('.source-row')[1].text()).toContain('第 2 份')
  })

  it('降级检索与向量命中分得开；题名没记录时念资料编号而不是摆个空格', async () => {
    api.knowledgeSources.mockResolvedValue([
      sourceRow({ sourceType: 'like' }),
      sourceRow({ documentId: 44, documentTitle: null, chunkId: null, chunkIndex: null, quoteIndex: 2 })
    ])

    const wrapper = await open()
    const rows = wrapper.findAll('.source-row')

    expect(rows[0].text()).toContain('向量不可用时降级检索')
    expect(rows[1].text()).toContain('向量检索命中')
    expect(rows[1].text()).toContain('整份文档')
    expect(rows[1].text()).toContain('资料 #44（题名未记录）')
  })

  it('接口真回空数组才说「没有资料引用留痕」', async () => {
    api.knowledgeSources.mockResolvedValue([])

    const wrapper = await open()

    expect(wrapper.text()).toContain('这一篇没有资料引用留痕')
  })

  it('读失败时不许把失败演成「这篇没引用」，要当面念一句读失败', async () => {
    api.knowledgeSources.mockRejectedValue(new Error('502 Bad Gateway'))

    const wrapper = await open()
    const text = wrapper.text()

    expect(text).not.toContain('这一篇没有资料引用留痕')
    expect(text).toContain('这一栏没读到，不代表这一篇没引用资料')
    // 当面念那一句走的是 message.warning（DOM 里没有这行字），断言要盯真的那发调用
    expect(notify.warning).toHaveBeenCalledWith('资料引用读取失败：502 Bad Gateway')
  })
})
