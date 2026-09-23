import { describe, it, expect, vi, beforeEach } from 'vitest'
import { portalPagesApi } from '../portalPages'

/**
 * 页面管理接口的形状测试。
 *
 * 这类测试要防的不是「接口调不通」（那要跑起来才知道），而是三件写在代码里就会漂移的事：
 * 路径别重复 /api 前缀、词表必须走接口而不是在 TS 里抄第二份、乐观锁必须真的把 baseVersion 发出去。
 */

vi.mock('../http', () => ({
  default: {
    get: vi.fn().mockResolvedValue({}),
    post: vi.fn().mockResolvedValue({}),
    put: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue({})
  }
}))

async function httpMock() {
  return (await import('../http')).default as any
}

describe('portalPagesApi', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('源码里不出现带 /api 前缀的请求路径（axios baseURL 已经带 /api）', async () => {
    const raw = import.meta.glob('../portalPages.ts', { eager: true, query: '?raw', import: 'default' }) as Record<string, string>
    const source = Object.values(raw).join('')
    expect([...source.matchAll(/['"]\/api\/[^'"]*['"]/g)].map(m => m[0])).toEqual([])
  })

  it('状态与变更来源标签来自后端接口，TS 里不留第二份中文词表', async () => {
    await portalPagesApi.statusLabels()
    expect((await httpMock()).get).toHaveBeenCalledWith('/portal/pages/statuses')

    await portalPagesApi.changeSourceLabels()
    expect((await httpMock()).get).toHaveBeenCalledWith('/portal/pages/change-sources')

    const raw = import.meta.glob('../portalPages.ts', { eager: true, query: '?raw', import: 'default' }) as Record<string, string>
    const source = Object.values(raw).join('')
    // 这些字符串只该出现在后端返回的标签里；一旦模块里再出现，说明有人抄了第二份词表
    expect(source).not.toMatch(/'已发布'/)
    expect(source).not.toMatch(/'草稿'/)
  })

  it('列表按后端参数名传 siteId/status/pageKind，空值不发送', async () => {
    const http = await httpMock()
    await portalPagesApi.list({ siteId: 0, status: '', pageKind: undefined })
    expect(http.get).toHaveBeenCalledWith('/portal/pages', {
      params: { siteId: 0, status: undefined, pageKind: undefined }
    })

    await portalPagesApi.list({ siteId: 7, status: 'draft' })
    expect(http.get).toHaveBeenLastCalledWith('/portal/pages', {
      params: { siteId: 7, status: 'draft', pageKind: undefined }
    })
  })

  it('保存结构必须带上 baseVersion 与变更来源（乐观锁的基线）', async () => {
    const http = await httpMock()
    await portalPagesApi.updateLayout(12, {
      baseVersion: 4,
      layoutJson: '{"blocks":[]}',
      changeSource: 'manual'
    })
    expect(http.put).toHaveBeenCalledWith('/portal/pages/12/layout', {
      baseVersion: 4,
      layoutJson: '{"blocks":[]}',
      changeSource: 'manual'
    })
  })

  it('版本对比路径是 /versions/{from}/diff/{to}', async () => {
    const http = await httpMock()
    await portalPagesApi.versionsDiff(38, 1, 2)
    expect(http.get).toHaveBeenCalledWith('/portal/pages/38/versions/1/diff/2')
  })

  it('发布/下线/回滚是动作接口，不是把 status 写进保存请求', async () => {
    const http = await httpMock()
    await portalPagesApi.publish(9)
    await portalPagesApi.offline(9)
    await portalPagesApi.rollback(9, 3)
    expect(http.post).toHaveBeenNthCalledWith(1, '/portal/pages/9/publish')
    expect(http.post).toHaveBeenNthCalledWith(2, '/portal/pages/9/offline')
    expect(http.post).toHaveBeenNthCalledWith(3, '/portal/pages/9/rollback/3')
    expect(http.put).not.toHaveBeenCalled()
  })

  it('新建页面的 siteId 走查询参数（与后端 @RequestParam 同形状）', async () => {
    const http = await httpMock()
    await portalPagesApi.create({ title: '关于我们' }, 5)
    expect(http.post).toHaveBeenCalledWith('/portal/pages', { title: '关于我们' }, { params: { siteId: 5 } })

    await portalPagesApi.create({ title: '无站点归属' })
    expect(http.post).toHaveBeenLastCalledWith('/portal/pages', { title: '无站点归属' }, { params: { siteId: undefined } })
  })

  it('区块元数据读 /portal/blocks：搭建器的字段清单只有一个来源', async () => {
    const http = await httpMock()
    await portalPagesApi.blocks()
    expect(http.get).toHaveBeenCalledWith('/portal/blocks')
  })
})
