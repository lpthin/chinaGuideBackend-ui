import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  dashboardApi,
  keywordApi,
  clusterApi,
  suggestionApi,
  articleApi,
  reviewApi,
  publishApi,
  mediaApi,
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
}))

describe('Workspace API Module', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('dashboardApi', () => {
    it('getStats should call correct endpoint', async () => {
      await dashboardApi.getStats()
      const http = (await import('../http')).default
      expect(http.get).toHaveBeenCalledWith('/workspace/dashboard/stats')
    })

    it('getCharts should call correct endpoint', async () => {
      await dashboardApi.getCharts()
      const http = (await import('../http')).default
      expect(http.get).toHaveBeenCalledWith('/workspace/dashboard/charts')
    })
  })

  describe('keywordApi', () => {
    it('list should call correct endpoint with params', async () => {
      const params = { page: 1, size: 10, status: 'PENDING' }
      await keywordApi.list(params)
      const http = (await import('../http')).default
      expect(http.get).toHaveBeenCalledWith('/workspace/keywords', { params })
    })

    it('importKeywords should call correct endpoint', async () => {
      const data = { keywords: ['keyword1', 'keyword2'] }
      await keywordApi.importKeywords(data)
      const http = (await import('../http')).default
      expect(http.post).toHaveBeenCalledWith('/workspace/keywords/import', data)
    })

    it('delete should call correct endpoint', async () => {
      await keywordApi.delete(1)
      const http = (await import('../http')).default
      expect(http.delete).toHaveBeenCalledWith('/workspace/keywords/1')
    })
  })

  describe('clusterApi', () => {
    it('list should call correct endpoint', async () => {
      await clusterApi.list({ page: 1, size: 10 })
      const http = (await import('../http')).default
      expect(http.get).toHaveBeenCalledWith('/workspace/clusters', { params: { page: 1, size: 10 } })
    })

    it('distill should call correct endpoint', async () => {
      await clusterApi.distill()
      const http = (await import('../http')).default
      expect(http.post).toHaveBeenCalledWith('/workspace/clusters/distill')
    })
  })

  describe('articleApi', () => {
    it('generateFromSuggestion should call correct endpoint', async () => {
      await articleApi.generateFromSuggestion(1, 'default')
      const http = (await import('../http')).default
      expect(http.post).toHaveBeenCalledWith('/workspace/articles/generate', {
        suggestionId: 1,
        templateType: 'default',
      })
    })

    it('list should call correct endpoint', async () => {
      await articleApi.list({ status: 'PUBLISHED' })
      const http = (await import('../http')).default
      expect(http.get).toHaveBeenCalledWith('/workspace/articles', { params: { status: 'PUBLISHED' } })
    })
  })

  describe('reviewApi', () => {
    it('approve should call correct endpoint', async () => {
      await reviewApi.approve(1, 'Looks good')
      const http = (await import('../http')).default
      expect(http.post).toHaveBeenCalledWith('/workspace/reviews/1/approve', { comment: 'Looks good' })
    })

    it('reject should call correct endpoint', async () => {
      await reviewApi.reject(1, 'Needs improvement')
      const http = (await import('../http')).default
      expect(http.post).toHaveBeenCalledWith('/workspace/reviews/1/reject', { reason: 'Needs improvement' })
    })
  })

  describe('publishApi', () => {
    it('create should call correct endpoint', async () => {
      const params = { articleId: 1, platform: 'default', scheduledTime: '2024-01-01' }
      await publishApi.create(params)
      const http = (await import('../http')).default
      expect(http.post).toHaveBeenCalledWith('/workspace/publish/1', params)
    })

    it('cancel should call correct endpoint', async () => {
      await publishApi.cancel(1)
      const http = (await import('../http')).default
      expect(http.post).toHaveBeenCalledWith('/workspace/publish/jobs/1/cancel')
    })
  })

  describe('adminApi', () => {
    it('sites.list should call correct endpoint', async () => {
      await adminApi.sites.list({ status: 'ACTIVE' })
      const http = (await import('../http')).default
      expect(http.get).toHaveBeenCalledWith('/api/v2/admin/sites', { params: { status: 'ACTIVE' } })
    })

    it('roles.all should call correct endpoint', async () => {
      await adminApi.roles.all()
      const http = (await import('../http')).default
      expect(http.get).toHaveBeenCalledWith('/api/v2/admin/roles/all')
    })

    it('permissions.tree should call correct endpoint', async () => {
      await adminApi.permissions.tree()
      const http = (await import('../http')).default
      expect(http.get).toHaveBeenCalledWith('/api/v2/admin/permissions/tree')
    })

    it('ai.getStats should call correct endpoint', async () => {
      await adminApi.ai.getStats()
      const http = (await import('../http')).default
      expect(http.get).toHaveBeenCalledWith('/api/v2/admin/ai/stats')
    })

    it('dashboard should call correct endpoint', async () => {
      await adminApi.dashboard()
      const http = (await import('../http')).default
      expect(http.get).toHaveBeenCalledWith('/api/v2/admin/dashboard')
    })
  })
})
