import { describe, it, expect, vi, beforeEach } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { SITE_PREVIEW_NOTICE, reviewTokenOf, useReviewMode, viewportOfWidth } from '../useReviewMode'
import { sitePreviewToken, withSitePreviewToken } from '../previewNavigation'
import { PREVIEW_TOKEN_PARAM } from '../api/portalPublic'

/**
 * 预览批注采集器的行为测试：这个模块跑在「拿到链接的访客」手上，
 * 所以它最容易出的两类问题必须被钉住——上报字段越界（把 pageId 报出去就是越权入口），
 * 以及文案超出事实（后端对无效令牌也返回成功，前端没法承诺「一定会改」）。
 *
 * 第三条是这一轮补上的：<em>这条链接能不能提工单</em>只有后端 /context 那一行 scope 知道
 * （{@code ReviewSessionService#canWriteTickets}），前端拿「地址栏有没有令牌」当作用域就是猜。
 * 猜错的代价不对称——多问一次词表只是浪费，把候选站那条只能看的链接摆出提交框，
 * 后端对无写口的提交恒回 200 且一行不落（§9-7），客户的意见就这么消失了。
 */

const api = vi.hoisted(() => ({
  context: vi.fn(),
  intents: vi.fn(),
  submit: vi.fn()
}))

/** 回包形状照真后端 PortalReviewPublicController.TokenContext 抄，字段一个不多一个不少 */
const PAGE_CONTEXT = { scope: 'page', ticketWritable: true, label: '逐页批注', expiresAt: '2026-10-01T00:00:00' }
const SITE_CONTEXT = { scope: 'site', ticketWritable: false, label: '候选站 A 方案', expiresAt: '2026-10-01T00:00:00' }

vi.mock('../api/portalPublic', () => ({
  PREVIEW_TOKEN_PARAM: 'reviewToken',
  previewTokenOfUrl: vi.fn(() => ''),
  fetchReviewContext: (...args: unknown[]) => api.context(...args),
  fetchReviewIntentOptions: (...args: unknown[]) => api.intents(...args),
  submitReviewTicket: (...args: unknown[]) => api.submit(...args)
}))

describe('reviewTokenOf', () => {
  it('只认非空字符串，数组取第一个，其他一律当作没有令牌', () => {
    expect(reviewTokenOf({ [PREVIEW_TOKEN_PARAM]: 'abc' })).toBe('abc')
    expect(reviewTokenOf({ reviewToken: ['abc', 'def'] })).toBe('abc')
    expect(reviewTokenOf({ reviewToken: '' })).toBeNull()
    expect(reviewTokenOf({})).toBeNull()
    expect(reviewTokenOf(null)).toBeNull()
    expect(reviewTokenOf(undefined)).toBeNull()
  })
})

describe('viewportOfWidth', () => {
  it('按后端词表分三档，边界取低档', () => {
    expect(viewportOfWidth(1440)).toBe('desktop')
    expect(viewportOfWidth(1024)).toBe('desktop')
    expect(viewportOfWidth(1023)).toBe('tablet')
    expect(viewportOfWidth(768)).toBe('tablet')
    expect(viewportOfWidth(375)).toBe('mobile')
  })
})

describe('useReviewMode', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.context.mockResolvedValue({ ...PAGE_CONTEXT })
    api.intents.mockResolvedValue({ 'edit-text': '改文案' })
    api.submit.mockResolvedValue(undefined)
    useReviewMode().deactivate()
  })

  it('没有令牌时不开启、不问作用域、不取词表、提交直接失败且不发请求', async () => {
    const mode = useReviewMode()
    expect(mode.enabled.value).toBe(false)

    mode.activate(null)
    await flushPromises()
    expect(api.context).not.toHaveBeenCalled()
    expect(api.intents).not.toHaveBeenCalled()
    expect(await mode.submit('标题太长', null)).toBe(false)
    expect(api.submit).not.toHaveBeenCalled()
  })

  it('逐页令牌：后端说能提，才取词表，也才允许圈选与提交', async () => {
    const mode = useReviewMode()
    mode.activate('token-a')
    await flushPromises()

    expect(api.context).toHaveBeenCalledWith('token-a')
    expect(mode.ticketWritable.value).toBe(true)
    expect(mode.sitePreview.value).toBe(false)
    expect(api.intents).toHaveBeenCalledTimes(1)
    expect(mode.intents.value).toEqual({ 'edit-text': '改文案' })

    mode.startSelecting()
    expect(mode.selecting.value).toBe(true)
  })

  it('整站令牌（候选站那一档）：不取词表、不能圈选，只留一句实话', async () => {
    api.context.mockResolvedValue({ ...SITE_CONTEXT })
    const mode = useReviewMode()
    mode.activate('token-site')
    await flushPromises()

    expect(mode.sitePreview.value).toBe(true)
    expect(mode.ticketWritable.value).toBe(false)
    // 词表一次都不取：这条链接上根本摆不出提交框，取了就是白烧一次公开端点
    expect(api.intents).not.toHaveBeenCalled()
    // 链接的名字来自令牌那一行，不是来自页面模型（整站预览走公开取数口，没有 reviewLabel）
    expect(mode.label.value).toBe('候选站 A 方案')

    mode.startSelecting()
    expect(mode.selecting.value).toBe(false)
    expect(mode.feedback.value).toEqual({ kind: 'error', text: SITE_PREVIEW_NOTICE })

    mode.selection.value = { instanceId: 'b2', blockKey: 'hero', path: '/', index: 1 }
    expect(await mode.submit('标题太长', null)).toBe(false)
    expect(api.submit).not.toHaveBeenCalled()
  })

  it('作用域问不到就按只读办：不猜能提，也不发提交请求', async () => {
    api.context.mockRejectedValue(new Error('预览链接无效或已过期'))
    const mode = useReviewMode()
    mode.activate('token-a')
    await flushPromises()

    expect(mode.ticketWritable.value).toBe(false)
    expect(mode.sitePreview.value).toBe(false)
    expect(api.intents).not.toHaveBeenCalled()
    expect(sitePreviewToken()).toBe('')

    mode.selection.value = { instanceId: 'b2', blockKey: 'hero', path: '/', index: 1 }
    expect(await mode.submit('标题太长', null)).toBe(false)
    expect(api.submit).not.toHaveBeenCalled()
  })

  it('同一条令牌翻页只问一次作用域、只取一次词表；换令牌才重问', async () => {
    const mode = useReviewMode()
    mode.activate('token-a')
    await flushPromises()
    mode.activate('token-a')
    await flushPromises()
    expect(api.context).toHaveBeenCalledTimes(1)
    expect(api.intents).toHaveBeenCalledTimes(1)

    api.context.mockResolvedValue({ ...SITE_CONTEXT })
    mode.activate('token-b')
    await flushPromises()
    expect(api.context).toHaveBeenCalledTimes(2)
    // 词表跟着新令牌的作用域走：这一轮换成不能提，就不该再有第三次取数
    expect(api.intents).toHaveBeenCalledTimes(1)
    expect(mode.sitePreview.value).toBe(true)
  })

  it('只有整站那一条令牌会被记下来供翻页续用，逐页令牌一次都不记', async () => {
    const mode = useReviewMode()

    mode.activate('token-page')
    await flushPromises()
    expect(sitePreviewToken()).toBe('')
    expect(withSitePreviewToken({ path: '/services', query: {} })).toBeUndefined()

    api.context.mockResolvedValue({ ...SITE_CONTEXT })
    mode.activate('token-site')
    await flushPromises()
    expect(sitePreviewToken()).toBe('token-site')
    expect(withSitePreviewToken({ path: '/services', query: {} })).toEqual({
      path: '/services',
      query: { reviewToken: 'token-site' },
      hash: ''
    })

    // 退出预览必须把这枚令牌从路由的记忆里擦干净，否则下一个访客翻到的是别人的站
    mode.deactivate()
    expect(sitePreviewToken()).toBe('')
    expect(withSitePreviewToken({ path: '/services', query: {} })).toBeUndefined()
  })

  it('提交只发后端白名单里的字段，绝不带 pageId', async () => {
    const mode = useReviewMode()
    vi.mocked(window).innerWidth = 1280
    mode.activate('token-a')
    await flushPromises()
    mode.selection.value = { instanceId: 'b2', blockKey: 'hero', path: '/about', index: 2 }

    expect(await mode.submit('  标题太长，改短一点  ', 'edit-text')).toBe(true)
    expect(api.submit).toHaveBeenCalledWith('token-a', {
      blockInstanceId: 'b2',
      blockKey: 'hero',
      path: '/about',
      viewport: 'desktop',
      clientText: '标题太长，改短一点',
      intent: 'edit-text'
    })
    const payload = vi.mocked(api.submit).mock.calls[0][1] as Record<string, unknown>
    expect(Object.keys(payload).sort()).toEqual(
      ['blockInstanceId', 'blockKey', 'clientText', 'intent', 'path', 'viewport']
    )
    expect(payload).not.toHaveProperty('pageId')
  })

  it('没写诉求就不发请求，并给出能看到的原因', async () => {
    const mode = useReviewMode()
    mode.activate('token-a')
    await flushPromises()
    mode.selection.value = { instanceId: 'b2', blockKey: 'hero', path: '/about', index: 2 }

    expect(await mode.submit('   ', null)).toBe(false)
    expect(api.submit).not.toHaveBeenCalled()
    expect(mode.feedback.value?.kind).toBe('error')
  })

  it('成功只说「已收到」，不承诺运营一定会改', async () => {
    const mode = useReviewMode()
    mode.activate('token-a')
    await flushPromises()
    mode.selection.value = { instanceId: 'b3', blockKey: 'services', path: '/services', index: 3 }

    await mode.submit('服务卡片想加价格', null)
    expect(mode.feedback.value?.text).toBe('已收到，这条反馈会进入改版工单列表')
    // 提交成功后圈选状态清空：客户想接着改下一块时，必须重新点区块，不能沿用上一次定位
    expect(mode.selection.value).toBeNull()
  })

  it('提交失败时把后端的中文原因留给访客看', async () => {
    const mode = useReviewMode()
    mode.activate('token-a')
    await flushPromises()
    mode.selection.value = { instanceId: 'b4', blockKey: 'hero', path: '/', index: 1 }
    api.submit.mockRejectedValueOnce(new Error('预览链接无效或已过期'))

    expect(await mode.submit('换个主图', null)).toBe(false)
    expect(mode.feedback.value).toEqual({ kind: 'error', text: '预览链接无效或已过期' })
    expect(mode.selection.value).not.toBeNull()
  })

  it('离开令牌即整体退出批注模式，不留残留状态', async () => {
    api.context.mockResolvedValue({ ...SITE_CONTEXT })
    const mode = useReviewMode()
    mode.activate('token-site')
    await flushPromises()
    mode.selection.value = { instanceId: 'b2', blockKey: 'hero', path: '/about', index: 2 }
    mode.startSelecting()
    expect(sitePreviewToken()).toBe('token-site')

    mode.activate(null)
    expect(mode.enabled.value).toBe(false)
    expect(mode.selection.value).toBeNull()
    expect(mode.selecting.value).toBe(false)
    expect(mode.intents.value).toEqual({})
    expect(mode.sitePreview.value).toBe(false)
    // 作用域与「记住的整站令牌」也一起清掉：留着就等于下一位访客翻页还被补上别人的令牌
    expect(sitePreviewToken()).toBe('')
    expect(mode.contextError.value).toBe('')
  })
})
