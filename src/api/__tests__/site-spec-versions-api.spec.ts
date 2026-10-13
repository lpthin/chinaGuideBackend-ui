import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * 说明书版本目录与逐段差异这两条只读口的请求形状契约（Spec-M P5 缺口 B，后端 V178 + SiteSpecController）。
 *
 * 单独钉这一支的理由与组件库那一份相同：前后端之间没有编译期纽带，路径写错只在浏览器里 404。
 * 这里最要紧的是 `to` 那一格——后端是 `@RequestParam(required = false) Integer to`，
 * 「不比到某一存档版」必须是**整个键都不带**，而不是传 `to=`：传空串会被绑成 400，
 * 传 0 会被当成一个不存在的版本号，两边都能出「存档里没有第 0 版」这种看起来像数据问题的假错。
 */

const httpMock = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn()
}))

vi.mock('../http', () => ({ default: httpMock }))

import { siteSpecApi, SITE_SPEC_DRAFT_TIMEOUT } from '../siteSpec'

beforeEach(() => {
  vi.clearAllMocks()
  httpMock.get.mockResolvedValue({})
})

describe('版本目录', () => {
  it('挂在需求单下，路径不带 /api，也不带段名', async () => {
    await siteSpecApi.versions(12)
    expect(httpMock.get).toHaveBeenLastCalledWith('/admin/site-briefs/12/spec/versions')
  })

  it('是 GET：读历史不该改任何东西，更不该调模型', async () => {
    await siteSpecApi.versions(12)
    expect(httpMock.post).not.toHaveBeenCalled()
    expect(httpMock.put).not.toHaveBeenCalled()
  })
})

describe('逐段差异', () => {
  it('不给 to 时整个键都不带，让后端读主表当前全文', async () => {
    await siteSpecApi.diff(12, 2)
    expect(httpMock.get).toHaveBeenLastCalledWith('/admin/site-briefs/12/spec/diff', {
      params: { from: 2 }
    })

    await siteSpecApi.diff(12, 2, null)
    expect(httpMock.get).toHaveBeenLastCalledWith('/admin/site-briefs/12/spec/diff', {
      params: { from: 2 }
    })
  })

  it('给 to 时两个版本号都在 query 上，from 不许省', async () => {
    await siteSpecApi.diff(12, 1, 3)
    expect(httpMock.get).toHaveBeenLastCalledWith('/admin/site-briefs/12/spec/diff', {
      params: { from: 1, to: 3 }
    })
  })
})

/**
 * 「AI 出初稿」这一发单独放宽超时（M-P13 现场实测：模型 163 秒与 212 秒各成一发、两发都 success 并扣了钱，
 * 浏览器却在第 31.7 秒按全局 30 秒掐断，弹出一句「初稿没有生成」——同一次动作两套结论，报的那句还是假的）。
 * 预算必须长过后端那道 `app.ai.chat-timeout-seconds`（默认 300 秒），否则界面永远看不见后端的真话。
 */
describe('花钱那一发的浏览器预算', () => {
  it('初稿带上了比后端 chat 闸还长的预算', async () => {
    await siteSpecApi.draft(12, true)
    expect(httpMock.post).toHaveBeenLastCalledWith(
      '/admin/site-briefs/12/spec/draft', { overwrite: true }, { timeout: SITE_SPEC_DRAFT_TIMEOUT }
    )
    expect(SITE_SPEC_DRAFT_TIMEOUT).toBeGreaterThan(300000)
  })

  it('读、写一段、签字这三发不跟着放宽：它们不调模型，放宽只会把真慢也演成正常', async () => {
    await siteSpecApi.read(12)
    await siteSpecApi.saveSection(12, 'overview', '字')
    await siteSpecApi.confirm(12)

    expect(httpMock.get).toHaveBeenLastCalledWith('/admin/site-briefs/12/spec')
    expect(httpMock.put).toHaveBeenLastCalledWith('/admin/site-briefs/12/spec/overview', { content: '字' })
    expect(httpMock.post).toHaveBeenLastCalledWith('/admin/site-briefs/12/spec/confirm')
  })
})
