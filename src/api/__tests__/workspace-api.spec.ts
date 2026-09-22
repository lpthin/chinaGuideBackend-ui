import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  dashboardApi,
  keywordApi,
  clusterApi,
  articleApi,
  reviewApi,
  publishApi,
  publishQueueApi,
  publishConfigApi,
  adminApi,
} from '../workspace'

// Mock the http module
vi.mock('../http', () => ({
  default: {
    get: vi.fn().mockResolvedValue({}),
    post: vi.fn().mockResolvedValue({}),
    put: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue({}),
  },
  AI_REQUEST_TIMEOUT: 180000,
}))

async function httpMock() {
  return (await import('../http')).default as any
}

describe('Workspace API Module', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // axios 实例的 baseURL 已经是 /api，源码里再写 /api/xxx 就会请求成 /api/api/xxx（404）。
  // EventSource / window.open 不走 axios，它们的模板字符串必须带 /api 前缀，所以只扫引号字面量。
  it('no request path in the source starts with /api', () => {
    const raw = import.meta.glob('../workspace.ts', { eager: true, query: '?raw', import: 'default' }) as Record<string, string>
    const source = Object.values(raw).join('')
    const offenders = [...source.matchAll(/['"]\/api\/[^'"]*['"]/g)].map(m => m[0])
    expect(offenders).toEqual([])
  })

  describe('dashboardApi', () => {
    it('getStats should call correct endpoint', async () => {
      await dashboardApi.getStats()
      expect((await httpMock()).get).toHaveBeenCalledWith('/workspace/dashboard/stats', {})
    })

    it('getCharts should call correct endpoint', async () => {
      await dashboardApi.getCharts(1)
      expect((await httpMock()).get).toHaveBeenCalledWith('/workspace/dashboard/charts', { params: { tenantId: 1 } })
    })
  })

  describe('keywordApi', () => {
    it('list should call correct endpoint with params', async () => {
      const params = { page: 1, size: 10, status: 'pending' }
      await keywordApi.list(params)
      expect((await httpMock()).get).toHaveBeenCalledWith('/workspace/keywords', { params })
    })

    it('importKeywords should call correct endpoint', async () => {
      const data = { keywords: ['keyword1', 'keyword2'] }
      await keywordApi.importKeywords(data, 15)
      expect((await httpMock()).post).toHaveBeenCalledWith('/workspace/keywords/import', data, { params: { tenantId: 15 } })
    })

    it('delete should call correct endpoint', async () => {
      await keywordApi.delete(1)
      expect((await httpMock()).delete).toHaveBeenCalledWith('/workspace/keywords/1', { params: { tenantId: undefined } })
    })

    it('batchUpdatePriority should hit the endpoint the backend actually exposes', async () => {
      await keywordApi.batchUpdatePriority([1, 2], 80, 15)
      expect((await httpMock()).post).toHaveBeenCalledWith(
        '/workspace/keywords/batch-priority', { ids: [1, 2], priority: 80 }, { params: { tenantId: 15 } })
    })
  })

  describe('clusterApi', () => {
    it('list should call correct endpoint', async () => {
      await clusterApi.list({ page: 1, size: 10 })
      expect((await httpMock()).get).toHaveBeenCalledWith('/workspace/clusters', { params: { page: 1, size: 10 } })
    })

    it('distill should call correct endpoint', async () => {
      await clusterApi.distill({ preview: true })
      // 蒸馏一次 AI 调用要一分多钟，必须带放长的超时，否则 axios 30s 默认值先报错
      expect((await httpMock()).post).toHaveBeenCalledWith('/workspace/clusters/distill', null, {
        params: { preview: true },
        timeout: 180000,
      })
    })
  })

  describe('articleApi', () => {
    it('list should call correct endpoint', async () => {
      await articleApi.list({ status: 'published' })
      expect((await httpMock()).get).toHaveBeenCalledWith('/workspace/articles', { params: { status: 'published' } })
    })

    it('submitReview should not double the /api prefix', async () => {
      await articleApi.submitReview(7, 15)
      expect((await httpMock()).post).toHaveBeenCalledWith('/workspace/articles/7/submit-review', null, { params: { tenantId: 15 } })
    })

    it('batchPublish should send ids, not articleIds', async () => {
      await articleApi.batchPublish([1, 2], { scheduledTime: '2026-01-01T10:00:00' }, 15)
      expect((await httpMock()).post).toHaveBeenCalledWith(
        '/workspace/articles/batch-publish',
        { ids: [1, 2], scheduledTime: '2026-01-01T10:00:00' },
        { params: { tenantId: 15 } }
      )
    })
  })

  describe('reviewApi', () => {
    it('approve should call the plural reviews path', async () => {
      await reviewApi.approve(1, 'Looks good', 15)
      expect((await httpMock()).post).toHaveBeenCalledWith(
        '/workspace/reviews/1/approve', { comment: 'Looks good' }, { params: { tenantId: 15 } })
    })

    it('reject should call the plural reviews path', async () => {
      await reviewApi.reject(1, 'Needs improvement')
      expect((await httpMock()).post).toHaveBeenCalledWith(
        '/workspace/reviews/1/reject', { reason: 'Needs improvement' }, { params: { tenantId: undefined } })
    })

    it('preReview should hit the ai-prereview endpoint with the long timeout', async () => {
      await reviewApi.preReview(61, 15)
      expect((await httpMock()).post).toHaveBeenCalledWith(
        '/workspace/articles/61/ai-prereview', null, { params: { tenantId: 15 }, timeout: 180000 })
    })
  })

  describe('publishApi', () => {
    it('publish should send scheduledTime in the body, not the query string', async () => {
      await publishApi.publish(1, { scheduledTime: '2026-01-01T10:00:00', priority: 3 }, 15)
      expect((await httpMock()).post).toHaveBeenCalledWith(
        '/workspace/publish/1', { scheduledTime: '2026-01-01T10:00:00', priority: 3 }, { params: { tenantId: 15 } })
    })

    it('records should read from the publish-records controller', async () => {
      await publishApi.records({ page: 1, size: 10 })
      expect((await httpMock()).get).toHaveBeenCalledWith('/publish-records', { params: { page: 1, size: 10 } })
    })
  })

  describe('publishQueueApi', () => {
    it('publishNow should not double the /api prefix', async () => {
      await publishQueueApi.publishNow(3, 15)
      expect((await httpMock()).post).toHaveBeenCalledWith('/publish-queue/3/publish-now', null, { params: { tenantId: 15 } })
    })

    it('cancel should use PUT on the queue path', async () => {
      await publishQueueApi.cancel(3)
      expect((await httpMock()).put).toHaveBeenCalledWith('/publish-queue/3/cancel', null, { params: { tenantId: undefined } })
    })
  })

  describe('publishConfigApi', () => {
    it('platforms should live under publish-config, not workspace', async () => {
      await publishConfigApi.listPlatforms({ tenantId: 15 })
      expect((await httpMock()).get).toHaveBeenCalledWith('/publish-config/platforms', { params: { tenantId: 15 } })
    })
  })

  describe('adminApi', () => {
    it('sites.list should call correct endpoint', async () => {
      await adminApi.sites.list({ status: 'ACTIVE' })
      expect((await httpMock()).get).toHaveBeenCalledWith('/admin/sites', { params: { status: 'ACTIVE' } })
    })

    it('roles.all should call correct endpoint', async () => {
      await adminApi.roles.all()
      expect((await httpMock()).get).toHaveBeenCalledWith('/admin/roles/all')
    })

    it('permissions.tree should call correct endpoint', async () => {
      await adminApi.permissions.tree()
      expect((await httpMock()).get).toHaveBeenCalledWith('/admin/permissions/tree', { params: undefined })
    })

    it('ai.getStats should call correct endpoint', async () => {
      await adminApi.ai.getStats()
      expect((await httpMock()).get).toHaveBeenCalledWith('/admin/ai/stats')
    })

    it('dashboard should call correct endpoint', async () => {
      await adminApi.dashboard()
      expect((await httpMock()).get).toHaveBeenCalledWith('/admin/dashboard')
    })
  })
})
