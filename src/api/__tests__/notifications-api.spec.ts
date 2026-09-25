import { describe, it, expect, vi, beforeEach } from 'vitest'
import { notificationsApi } from '../notifications'

/**
 * 待办接口层的形状测试（Spec §13.3-6 的最后一公里）。
 *
 * 两条：
 * 1. 路径不带 /api（http 实例已有 baseURL），且**这一层里不许出现后端那个类型码的字面量**——
 *    通知类型没有词表端点，前端一旦抄一份 `health:patrol → 某句中文`，后端改名时界面会指着
 *    一条已经不存在的类型说瞎话（I-1）；
 * 2. 空筛选不许拼进 query：`status=''` 会变成「只看 status 为空的」，`siteId=null` 会变成
 *    「只看没有站点的那几条」，两者都是把「全部」显示成「什么都没有」。
 */

vi.mock('../http', () => ({
  default: {
    get: vi.fn().mockResolvedValue({ records: [], total: 0, page: 1, size: 20 }),
    post: vi.fn().mockResolvedValue({})
  }
}))

async function httpMock() {
  return (await import('../http')).default as any
}

function source() {
  const records = import.meta.glob('../notifications.ts', {
    eager: true,
    query: '?raw',
    import: 'default'
  }) as Record<string, string>
  return Object.values(records).join('')
}

describe('notificationsApi', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('源码里没有 /api 前缀，也没有后端类型码的字面量', () => {
    const raw = source()
    expect([...raw.matchAll(/['"]\/api\/[^'"]*['"]/g)].map(m => m[0])).toEqual([])
    expect(raw).not.toMatch(/['"]health:[a-z-]+['"]/)
    expect(raw).not.toMatch(/['"]lead:[a-z-]+['"]/)
  })

  it('默认分页如实带上，空筛选不出现在 query 里', async () => {
    const http = await httpMock()
    await notificationsApi.list()
    expect(http.get).toHaveBeenLastCalledWith('/notifications', {
      params: { page: 1, size: 20, status: undefined, type: undefined, siteId: undefined }
    })

    await notificationsApi.list({ status: '', type: '   ', siteId: null })
    expect(http.get).toHaveBeenLastCalledWith('/notifications', {
      params: { page: 1, size: 20, status: undefined, type: undefined, siteId: undefined }
    })

    await notificationsApi.list({ page: 3, size: 10, status: 'read', type: ' health:patrol ', siteId: 7 })
    expect(http.get).toHaveBeenLastCalledWith('/notifications', {
      params: { page: 3, size: 10, status: 'read', type: 'health:patrol', siteId: 7 }
    })
  })

  it('未读数、单条已读、全部已读各打自己那条端点', async () => {
    const http = await httpMock()
    await notificationsApi.unreadCount()
    expect(http.get).toHaveBeenLastCalledWith('/notifications/unread-count')

    await notificationsApi.read(12)
    expect(http.post).toHaveBeenLastCalledWith('/notifications/12/read')

    await notificationsApi.readAll()
    expect(http.post).toHaveBeenLastCalledWith('/notifications/read-all')
  })
})
