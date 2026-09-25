import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mediaStorageApi, MIGRATE_TIMEOUT, TEST_TIMEOUT } from '../mediaStorage'

/**
 * 素材存储那五个超管端的请求形状（任务 #30、#32）。
 *
 * 界面测试把整个 api 模块桩掉了，「发到哪个地址、参数怎么带」在那里测不到，这一份补上。
 * 最要紧的是 tenantId 那一栏：**空值必须是「不传这个参数」，不能传成 0 或空串**——
 * 后端把「没带 tenantId」理解成全平台迁移，参数被写成 tenantId=0 就是让一次「只搬某个租户」
 * 的点击去改所有租户的 media 行。
 *
 * 第二条要紧的是测连接时「带 body」与「不带 body」是两种不同的动作：前者测还没保存的参数，
 * 后者测库里那份。空 body 必须是 null 而不是 {}，否则后端会把一份全空的表单当成待测参数。
 */

vi.mock('../http', () => ({
  default: {
    get: vi.fn().mockResolvedValue({}),
    post: vi.fn().mockResolvedValue({}),
    put: vi.fn().mockResolvedValue({})
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

  it('配置读的是 /config，密钥那一栏后端只回掩码', async () => {
    const http = await httpMock()

    await mediaStorageApi.config()

    expect(http.get).toHaveBeenCalledWith('/media/storage/config')
  })

  it('保存走 PUT，表单原样带过去（界面上看到什么就存什么，不在前端删字段）', async () => {
    const http = await httpMock()
    const form = { storage: 'oss', endpoint: 'oss-cn-hangzhou.aliyuncs.com', accessKeySecret: '已保存（不显示）' }

    await mediaStorageApi.saveConfig(form)

    const [url, body] = http.put.mock.calls[0]
    expect(url).toBe('/media/storage/config')
    expect(body).toEqual(form)
  })

  it('带表单测连接 = 测还没保存的那组参数，且单独放宽超时', async () => {
    const http = await httpMock()

    await mediaStorageApi.testConfig({ bucket: 'aiwebsites' })

    const [url, body, config] = http.post.mock.calls[0]
    expect(url).toBe('/media/storage/config/test')
    expect(body).toEqual({ bucket: 'aiwebsites' })
    expect(config.timeout).toBe(TEST_TIMEOUT)
  })

  it('不带表单测的是库里那份：body 是 null，不是一个空对象', async () => {
    const http = await httpMock()

    await mediaStorageApi.testConfig()

    const [, body] = http.post.mock.calls[0]
    // {} 会被后端当成「八个字段全给了空值」，那份配置就此被清空——这一条钉的就是这个区别
    expect(body).toBeNull()
    expect(TEST_TIMEOUT).toBeGreaterThanOrEqual(60000)
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
