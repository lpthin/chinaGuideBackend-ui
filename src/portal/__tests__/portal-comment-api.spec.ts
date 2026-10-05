import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * 公开写口到底带不带预览令牌（P9-C / §2A 的界面那一半）。
 *
 * 这一条值得单独钉，是因为它的失败方式完全静默：评论与点赞那两条 POST 如果忘了带头，
 * 后端的 access() 直接为空，访客看到的会是「无法定位站点，评论没有收到」——
 * 而真话应该是「这个页面还在预览阶段，暂不接收评论」。两种都是不收，
 * 但前者把我们的 bug 演成了客户的问题。
 *
 * 反方向也要钉住：/inquiry 与 /track 不许因为这期顺手把令牌带上——
 * 留资在预览视图连提交按钮都不给，带上只是给一套还没交付的站多开一条写入口。
 */

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  siteCode: { current: 'acme-portal' }
}))

vi.mock('axios', () => ({
  default: {
    get: mocks.get,
    post: mocks.post,
    isAxiosError: () => false
  }
}))

vi.mock('../api/portalData', () => ({ resolveSiteCode: () => mocks.siteCode.current }))

const ok = (data: unknown) => ({ data: { success: true, data } })

async function loadApi() {
  vi.resetModules()
  return import('../api/portalPublic')
}

function urlWith(search: string) {
  window.history.replaceState(null, '', `/news/some-article${search}`)
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.get.mockResolvedValue(ok({ items: [], total: 0, likeCount: 0 }))
  mocks.post.mockResolvedValue(ok({ accepted: true, needsReview: true, message: '已提交', likeCount: 3, recorded: true }))
  mocks.siteCode.current = 'acme-portal'
  urlWith('')
})

afterEach(() => {
  urlWith('')
})

function postHeaders(call: number): Record<string, string> | undefined {
  return (mocks.post.mock.calls[call][2] as { headers?: Record<string, string> } | undefined)?.headers
}

describe('评论与点赞带预览令牌，留资与埋点不带', () => {
  it('地址栏有令牌时：评论、点赞、以及所有取数口都带上同一枚令牌', async () => {
    urlWith('?reviewToken=tok-1')
    const api = await loadApi()

    await api.submitArticleComment('42', { content: '写得好' })
    await api.likeArticle('42')
    await api.fetchArticle('42')

    expect(mocks.post.mock.calls[0][0]).toBe('/api/portal/public/articles/42/comments')
    expect(postHeaders(0)).toEqual({ 'X-Review-Token': 'tok-1' })
    expect(mocks.post.mock.calls[1][0]).toBe('/api/portal/public/articles/42/like')
    expect(postHeaders(1)).toEqual({ 'X-Review-Token': 'tok-1' })
    expect(mocks.get.mock.calls[0][1]?.headers).toEqual({ 'X-Review-Token': 'tok-1' })
  })

  it('地址栏没有令牌时一个头都不加：匿名访客不该多一次会话表查询的机会', async () => {
    const api = await loadApi()

    await api.submitArticleComment('42', { content: '写得好' })
    await api.likeArticle('42')

    expect(postHeaders(0)).toBeUndefined()
    expect(postHeaders(1)).toBeUndefined()
  })

  it('留资仍然不带令牌：预览视图那条路本来就给它收着', async () => {
    urlWith('?reviewToken=tok-1')
    const api = await loadApi()

    await api.submitInquiry({ name: '张三', content: '想问问价格', page: '/news' })

    expect(mocks.post).toHaveBeenCalledTimes(1)
    expect(mocks.post.mock.calls[0][0]).toBe('/api/portal/public/inquiry')
    expect(postHeaders(0)).toBeUndefined()
  })

  it('中文 slug 照样编码，且 body 不会被拼进 query', async () => {
    const api = await loadApi()

    await api.submitArticleComment('签证攻略', { content: '很实用', website: '' })

    expect(mocks.post.mock.calls[0][0]).toBe(`/api/portal/public/articles/${encodeURIComponent('签证攻略')}/comments`)
    expect(mocks.post.mock.calls[0][2]).toEqual({ params: { site: 'acme-portal' } })
    expect(mocks.post.mock.calls[0][1]).toEqual({ content: '很实用', website: '' })
  })
})
