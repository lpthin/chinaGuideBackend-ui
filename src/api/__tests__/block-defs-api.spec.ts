import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * 组件库写口（Spec-M §8 第 4 步）的请求形状契约。
 *
 * <p>为什么单独钉这一支：`/api/admin/portal-blocks` 与后端 `AdminBlockDefController` 之间没有任何编译期
 * 或测试期的纽带——路由改名只会在浏览器里 404，而那已经是交付之后。10-09 现场就撞过一次：
 * 后端那个方法原来叫 `defaultSchema`（路径 `/default-schema`），而 `SeoWritePathGuardTest` 把
 * 「`default(schema|seo|og|twitter)…`」整仓零命中当作旧 SEO 真相源没有复活的证据，于是新代码把它判红了。
 * 改名成 `schema-prefill` 之后，这一支就是唯一一处把两边钉在一起的地方。</p>
 */

const httpMock = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn()
}))

vi.mock('../http', () => ({ default: httpMock }))

import { blockDefsApi } from '../blockDefs'

beforeEach(() => {
  httpMock.get.mockReset()
  httpMock.post.mockReset()
  httpMock.put.mockReset()
  httpMock.delete.mockReset()
  httpMock.get.mockResolvedValue([])
  httpMock.post.mockResolvedValue({})
  httpMock.put.mockResolvedValue({})
  httpMock.delete.mockResolvedValue({})
})

describe('组件库只读口路径', () => {
  it('列表与三个辅助口都挂在 /admin/portal-blocks 下，路径不带 /api', async () => {
    await blockDefsApi.list()
    expect(httpMock.get).toHaveBeenLastCalledWith('/admin/portal-blocks')

    await blockDefsApi.categories()
    expect(httpMock.get).toHaveBeenLastCalledWith('/admin/portal-blocks/categories')

    await blockDefsApi.rendererOptions()
    expect(httpMock.get).toHaveBeenLastCalledWith('/admin/portal-blocks/renderer-options')
  })

  it('预填 schema 读的是 schema-prefill，不是那个会撞后端 SEO 扫描器的旧名', async () => {
    await blockDefsApi.schemaPrefill()
    expect(httpMock.get).toHaveBeenLastCalledWith('/admin/portal-blocks/schema-prefill')
  })
})

describe('组件库写口形状', () => {
  it('新建与修改把表单原样交给后端，校验不在前端做第二遍', async () => {
    const form = {
      blockKey: 'card-grid',
      name: '产品分类导航网格',
      category: 'content',
      maxInstances: 2,
      rendererKey: 'genericCard',
      dataSchemaJson: '{"type":"object","properties":{},"additionalProperties":false}'
    }
    await blockDefsApi.create(form)
    expect(httpMock.post).toHaveBeenLastCalledWith('/admin/portal-blocks', form)

    await blockDefsApi.update(30, { name: '改名', category: 'nav', dataSchemaJson: form.dataSchemaJson })
    expect(httpMock.put).toHaveBeenLastCalledWith('/admin/portal-blocks/30', {
      name: '改名',
      category: 'nav',
      dataSchemaJson: form.dataSchemaJson
    })
  })

  it('启用/停用走 query 参数：后端那一格是 @RequestParam boolean，包进 body 就收不到', async () => {
    await blockDefsApi.setEnabled(30, true)
    expect(httpMock.put).toHaveBeenLastCalledWith('/admin/portal-blocks/30/enabled', null, {
      params: { enabled: true }
    })

    await blockDefsApi.setEnabled(30, false)
    expect(httpMock.put).toHaveBeenLastCalledWith('/admin/portal-blocks/30/enabled', null, {
      params: { enabled: false }
    })
  })

  it('删除只带 id，软删与「key 不释放」都由后端决定，界面不预告结果', async () => {
    await blockDefsApi.remove(31)
    expect(httpMock.delete).toHaveBeenLastCalledWith('/admin/portal-blocks/31')
  })
})
