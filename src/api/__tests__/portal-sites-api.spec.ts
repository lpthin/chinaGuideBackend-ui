import { describe, it, expect, vi, beforeEach } from 'vitest'
import { portalSitesApi } from '../portalSites'

/**
 * 租户侧站点口（Q-3d）的形状测试。
 *
 * 这一条要防的是「改回建设域那个口」：上线检查表与展示内容页以前都打 `/admin/sites`，
 * 而它整棵要 `portal:build:manage`（V93：租户不做建站），租户档必吃 403——
 * 界面还把那句 403 演成了「该租户还没有站点」。路径写错一个字母，这个病就原样复发。
 */

vi.mock('../http', () => ({
  default: {
    get: vi.fn().mockResolvedValue([]),
    post: vi.fn().mockResolvedValue({}),
    put: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue({})
  }
}))

async function httpMock() {
  return (await import('../http')).default as any
}

describe('portalSitesApi', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('走 /portal/sites，不带任何参数（站点范围由后端按登录租户定）', async () => {
    await portalSitesApi.listMine()
    expect((await httpMock()).get).toHaveBeenCalledWith('/portal/sites')
  })

  it('带引号的请求路径只有 /portal/sites 这一条（注释里提建设域那个口不算）', () => {
    const raw = import.meta.glob('../portalSites.ts', { eager: true, query: '?raw', import: 'default' }) as Record<string, string>
    const source = Object.values(raw).join('')
    const quoted = [...source.matchAll(/'\/[^']*'/g)].map(m => m[0])
    // 只有一个路径 → 既没有重复的 /api 前缀，也没有人把 /admin/sites 再引回来
    expect(quoted).toEqual(["'/portal/sites'"])
  })
})
