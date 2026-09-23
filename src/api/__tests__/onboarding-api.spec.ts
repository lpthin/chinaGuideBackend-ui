import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { backendFileUrl, demoSiteApi, portalVisibilityApi } from '../onboarding'

vi.mock('../http', () => ({
  default: { get: vi.fn().mockResolvedValue({}), post: vi.fn().mockResolvedValue({}) },
}))

async function httpMock() {
  return (await import('../http')).default as any
}

describe('门户上线引导 API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  // axios 实例的 baseURL 已经是 /api，源码里再写 /api/xxx 会请求成 /api/api/xxx（404）
  it('端点不带 /api 前缀', async () => {
    await demoSiteApi.bootstrap(42)
    await demoSiteApi.publish(42)
    await demoSiteApi.status(42)
    await portalVisibilityApi.publishedArticles('acme')
    await portalVisibilityApi.publishedCases('acme')

    expect((await httpMock()).post.mock.calls.map((call: any[]) => call[0])).toEqual([
      '/admin/tenants/42/bootstrap-demo',
      '/admin/tenants/42/publish-demo',
    ])
    expect((await httpMock()).get.mock.calls.map((call: any[]) => call[0])).toEqual([
      '/admin/tenants/42/demo-status',
      '/portal/public/articles',
      '/portal/public/cases',
    ])
  })

  it('生成演示内容默认只补缺，不覆盖租户已有内容', async () => {
    await demoSiteApi.bootstrap(42)

    expect((await httpMock()).post).toHaveBeenCalledWith('/admin/tenants/42/bootstrap-demo', null, {
      params: { mode: 'skip' },
    })
  })

  it('访客可见数按站点编码走门户公开接口，size=1 只取 total', async () => {
    await portalVisibilityApi.publishedArticles('小山竟天口腔')

    expect((await httpMock()).get).toHaveBeenCalledWith('/portal/public/articles', {
      params: { site: '小山竟天口腔', page: 1, size: 1 },
    })
  })

  it('没配置后端来源时不给可点击链接，避免点开是 SPA 首页的假链接', () => {
    vi.stubEnv('VITE_BACKEND_ORIGIN', '')

    expect(backendFileUrl('/llms.txt', 'acme')).toBeNull()
  })

  it('配置了后端来源时拼出带站点编码的绝对地址', () => {
    vi.stubEnv('VITE_BACKEND_ORIGIN', 'http://localhost:8080/')

    const url = backendFileUrl('/llms-full.txt', '小山竟天口腔')
    // 中文编码要转义（否则拼出来的 URL 不可用），配置里末尾的斜杠也不能变成 //
    expect(url).not.toContain('小山')
    expect(url).not.toContain('8080//')
    expect(url?.startsWith('http://localhost:8080/llms-full.txt?site=')).toBe(true)
    // 没有站点编码就没有 ?site=，后端会按域名解析，解析不到时如实报错
    expect(backendFileUrl('/robots.txt', null)).toBe('http://localhost:8080/robots.txt')
  })
})
