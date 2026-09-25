import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mediaStorageApi, MIGRATE_TIMEOUT } from '../mediaStorage'

/**
 * 素材存储那两个超管端的请求形状（任务 #30）。
 *
 * 界面测试把整个 api 模块桩掉了，「发到哪个地址、参数怎么带」在那里测不到，这一份补上。
 * 最要紧的是 tenantId 那一栏：**空值必须是「不传这个参数」，不能传成 0 或空串**——
 * 后端把「没带 tenantId」理解成全平台迁移，参数被写成 tenantId=0 就是让一次「只搬某个租户」
 * 的点击去改所有租户的 media 行。
 */

vi.mock('../http', () => ({
  default: {
    get: vi.fn().mockResolvedValue({}),
    post: vi.fn().mockResolvedValue({})
  },
  AI_REQUEST_TIMEOUT: 180000
}))

async function httpMock() {
  return (await import('../http')).default as any
}

describe('mediaStorageApi', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('状态读的是超管口，且不带任何参数', async () => {
    const http = await httpMock()

    await mediaStorageApi.status()

    expect(http.get).toHaveBeenCalledWith('/media/storage/status')
  })

  it('留空租户 = 请求里根本没有 tenantId 这一项，不是 0、不是空串', async () => {
    const http = await httpMock()

    await mediaStorageApi.migrateToOss({ tenantId: null, limit: 500 })

    const [url, body, config] = http.post.mock.calls[0]
    expect(url).toBe('/media/storage/migrate-to-oss')
    expect(body).toBeNull()
    expect(config.params).toEqual({ limit: 500 })
    expect('tenantId' in config.params).toBe(false)
  })

  it('指定租户时按数字原样带过去', async () => {
    const http = await httpMock()

    await mediaStorageApi.migrateToOss({ tenantId: 15, limit: 20 })

    expect(http.post.mock.calls[0][2].params).toEqual({ tenantId: 15, limit: 20 })
  })

  it('不传参数时批次默认 500 行（和后端 @RequestParam 的默认值是同一个数）', async () => {
    const http = await httpMock()

    await mediaStorageApi.migrateToOss()

    expect(http.post.mock.calls[0][2].params).toEqual({ limit: 500 })
  })

  it('搬迁这一发放宽了超时：默认 30s 会在后端还在复制时掐断连接', async () => {
    const http = await httpMock()

    await mediaStorageApi.migrateToOss({ limit: 500 })

    expect(MIGRATE_TIMEOUT).toBeGreaterThanOrEqual(600000)
    expect(http.post.mock.calls[0][2].timeout).toBe(MIGRATE_TIMEOUT)
  })
})
