import { describe, it, expect, vi, beforeEach } from 'vitest'
import { analyticsApi, botCategoryLabel, pageTypeLabel } from '../analytics'

vi.mock('../http', () => ({
  default: { get: vi.fn().mockResolvedValue({}) },
}))

async function httpMock() {
  return (await import('../http')).default as any
}

describe('门户访问统计 API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // axios 实例的 baseURL 已经是 /api，源码里再写 /api/xxx 会请求成 /api/api/xxx（404）
  it('端点不带 /api 前缀', async () => {
    await analyticsApi.overview({ tenantId: 3, from: '2026-09-01', to: '2026-09-10' })
    await analyticsApi.pages({ tenantId: 3, limit: 20 })
    await analyticsApi.bot({ tenantId: 3, top: 5 })
    await analyticsApi.trend({ tenantId: 3 })

    expect((await httpMock()).get.mock.calls.map((call: any[]) => call[0])).toEqual([
      '/analytics/overview',
      '/analytics/pages',
      '/analytics/bot',
      '/analytics/trend',
    ])
  })

  it('租户为空时不发送 tenantId 参数，由后端按登录身份判定', async () => {
    await analyticsApi.overview({ tenantId: null, from: '', to: '' })

    expect((await httpMock()).get).toHaveBeenCalledWith('/analytics/overview', {
      params: { tenantId: undefined, from: undefined, to: undefined },
    })
  })

  // 报表上任何「人 + 爬虫」的合计数字都是错的口径，接口层就不能出现这种字段
  it('人工浏览与抓取是两套命名，不存在合计字段', () => {
    expect(Object.keys(analyticsApi)).toEqual(['overview', 'bot', 'pages', 'trend'])
    expect(analyticsApi).not.toHaveProperty('total')
    expect(analyticsApi).not.toHaveProperty('summary')
  })

  it('爬虫分类必须写清是服务端识别，不能被读成 AI 浏览量', () => {
    expect(botCategoryLabel('ai-crawler')).toContain('服务端识别')
    expect(botCategoryLabel('search-engine')).toBe('搜索引擎收录')
    // 词表之外的类别原样透出，不能悄悄显示成中文猜测
    expect(botCategoryLabel('some-new-bot')).toBe('some-new-bot')
  })

  it('服务端口径的页面类型要和门户页面区分开', () => {
    expect(pageTypeLabel('article')).toBe('文章详情')
    expect(pageTypeLabel('portal-api')).toContain('服务端')
    expect(pageTypeLabel('seo-file')).toContain('服务端')
    expect(pageTypeLabel(null)).toBe('未标注')
  })
})
