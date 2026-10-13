import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * 企业资料上传这一发的请求形状契约（M-P13 全流程走查挖出来的：新租户「新建项目 → 批量上传」上传成功、
 * 库里也多了一行，但那一行的 category_id 是 NULL，项目列表按 categoryId 过滤就永远滤不到它）。
 *
 * 单独钉这一支的理由和别的 api 契约一样：前后端之间没有编译期纽带，少带一个参数不会有任何编译错误，
 * 只在浏览器里表现为「明明传上去了，项目里却什么都没有」。后端那个写口是
 * `@RequestParam(required = false) Long categoryId` 并直接 `doc.setCategoryId(categoryId)`，
 * 所以这一头不带，那一行就真的是无主行。
 */

const httpMock = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn()
}))

vi.mock('../http', () => ({ default: httpMock }))

import { knowledgeDocumentApi } from '../knowledge'

beforeEach(() => {
  vi.clearAllMocks()
  httpMock.post.mockResolvedValue({})
})

const form = () => new FormData()

describe('上传企业资料', () => {
  it('进了哪个项目，categoryId 就跟着那一发走', () => {
    knowledgeDocumentApi.upload(180, form(), undefined, 7)
    expect(httpMock.post).toHaveBeenLastCalledWith(
      '/knowledge/documents/upload',
      expect.anything(),
      expect.objectContaining({ params: { tenantId: 180, categoryId: 7 } })
    )
  })

  it('没归属项目时整个键都不带：categoryId= 空串会被后端绑成 400', () => {
    knowledgeDocumentApi.upload(180, form())
    expect(httpMock.post).toHaveBeenLastCalledWith(
      '/knowledge/documents/upload',
      expect.anything(),
      expect.objectContaining({ params: { tenantId: 180 } })
    )

    knowledgeDocumentApi.upload(180, form(), undefined, null)
    expect(httpMock.post).toHaveBeenLastCalledWith(
      '/knowledge/documents/upload',
      expect.anything(),
      expect.objectContaining({ params: { tenantId: 180 } })
    )
  })

  it('multipart 头与进度回调还是原来的形状（加了参数不许把上传本身改坏）', () => {
    const onProgress = vi.fn()
    knowledgeDocumentApi.upload(180, form(), onProgress, 7)
    const config = httpMock.post.mock.calls[0][2]
    expect(config.headers['Content-Type']).toBe('multipart/form-data')
    expect(config.onUploadProgress).toBe(onProgress)
  })
})

describe('向量化失败后的重跑那一发', () => {
  it('挂在文档号上，是 POST（排队一件事，不是读一眼）', () => {
    knowledgeDocumentApi.vectorize(8)
    expect(httpMock.post).toHaveBeenLastCalledWith('/knowledge/documents/8/vectorize', { model: undefined })
    expect(httpMock.get).not.toHaveBeenCalled()
  })
})
