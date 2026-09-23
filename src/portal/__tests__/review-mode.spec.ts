import { describe, it, expect, vi, beforeEach } from 'vitest'
import { reviewTokenOf, useReviewMode, viewportOfWidth } from '../useReviewMode'
import { fetchReviewIntentOptions, submitReviewTicket } from '../api/portalPublic'

/**
 * 预览批注采集器的行为测试：这个模块跑在「拿到链接的访客」手上，
 * 所以它最容易出的两类问题必须被钉住——上报字段越界（把 pageId 报出去就是越权入口），
 * 以及文案超出事实（后端对无效令牌也返回成功，前端没法承诺「一定会改」）。
 */

vi.mock('../api/portalPublic', () => ({
  fetchReviewIntentOptions: vi.fn().mockResolvedValue({ 'edit-text': '改文案' }),
  submitReviewTicket: vi.fn().mockResolvedValue(undefined)
}))

describe('reviewTokenOf', () => {
  it('只认非空字符串，数组取第一个，其他一律当作没有令牌', () => {
    expect(reviewTokenOf({ reviewToken: 'abc' })).toBe('abc')
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
    useReviewMode().deactivate()
  })

  it('没有令牌时不开启、不取词表、提交直接失败且不发请求', async () => {
    const mode = useReviewMode()
    expect(mode.enabled.value).toBe(false)

    mode.activate(null)
    expect(fetchReviewIntentOptions).not.toHaveBeenCalled()
    expect(await mode.submit('标题太长', null)).toBe(false)
    expect(submitReviewTicket).not.toHaveBeenCalled()
  })

  it('带令牌才取词表，同一个令牌重复激活不重复请求', async () => {
    const mode = useReviewMode()
    mode.activate('token-a')
    await Promise.resolve()
    expect(mode.enabled.value).toBe(true)
    expect(fetchReviewIntentOptions).toHaveBeenCalledTimes(1)

    mode.activate('token-a')
    await Promise.resolve()
    expect(fetchReviewIntentOptions).toHaveBeenCalledTimes(1)

    mode.activate('token-b')
    await Promise.resolve()
    expect(fetchReviewIntentOptions).toHaveBeenCalledTimes(2)
  })

  it('提交只发后端白名单里的字段，绝不带 pageId', async () => {
    const mode = useReviewMode()
    vi.mocked(window).innerWidth = 1280
    mode.activate('token-a')
    await Promise.resolve()
    mode.selection.value = { instanceId: 'b2', blockKey: 'hero', path: '/about', index: 2 }

    expect(await mode.submit('  标题太长，改短一点  ', 'edit-text')).toBe(true)
    expect(submitReviewTicket).toHaveBeenCalledWith('token-a', {
      blockInstanceId: 'b2',
      blockKey: 'hero',
      path: '/about',
      viewport: 'desktop',
      clientText: '标题太长，改短一点',
      intent: 'edit-text'
    })
    const payload = vi.mocked(submitReviewTicket).mock.calls[0][1] as Record<string, unknown>
    expect(Object.keys(payload).sort()).toEqual(
      ['blockInstanceId', 'blockKey', 'clientText', 'intent', 'path', 'viewport']
    )
    expect(payload).not.toHaveProperty('pageId')
  })

  it('没写诉求就不发请求，并给出能看到的原因', async () => {
    const mode = useReviewMode()
    mode.activate('token-a')
    await Promise.resolve()
    mode.selection.value = { instanceId: 'b2', blockKey: 'hero', path: '/about', index: 2 }

    expect(await mode.submit('   ', null)).toBe(false)
    expect(submitReviewTicket).not.toHaveBeenCalled()
    expect(mode.feedback.value?.kind).toBe('error')
  })

  it('成功只说「已收到」，不承诺运营一定会改', async () => {
    const mode = useReviewMode()
    mode.activate('token-a')
    await Promise.resolve()
    mode.selection.value = { instanceId: 'b3', blockKey: 'services', path: '/services', index: 3 }

    await mode.submit('服务卡片想加价格', null)
    expect(mode.feedback.value?.text).toBe('已收到，这条反馈会进入改版工单列表')
    // 提交成功后圈选状态清空：客户想接着改下一块时，必须重新点区块，不能沿用上一次定位
    expect(mode.selection.value).toBeNull()
  })

  it('提交失败时把后端的中文原因留给访客看', async () => {
    const mode = useReviewMode()
    mode.activate('token-a')
    await Promise.resolve()
    mode.selection.value = { instanceId: 'b4', blockKey: 'hero', path: '/', index: 1 }
    vi.mocked(submitReviewTicket).mockRejectedValueOnce(new Error('预览链接无效或已过期'))

    expect(await mode.submit('换个主图', null)).toBe(false)
    expect(mode.feedback.value).toEqual({ kind: 'error', text: '预览链接无效或已过期' })
    expect(mode.selection.value).not.toBeNull()
  })

  it('离开令牌即整体退出批注模式，不留残留状态', async () => {
    const mode = useReviewMode()
    mode.activate('token-a')
    await Promise.resolve()
    mode.selection.value = { instanceId: 'b2', blockKey: 'hero', path: '/about', index: 2 }
    mode.startSelecting()

    mode.activate(null)
    expect(mode.enabled.value).toBe(false)
    expect(mode.selection.value).toBeNull()
    expect(mode.selecting.value).toBe(false)
    expect(mode.intents.value).toEqual({})
  })
})
