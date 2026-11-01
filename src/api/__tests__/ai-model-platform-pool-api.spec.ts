import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * M-P102（2026-11-01 拍板）：模型配置／向量化配置／向量库连接这一族的平台契约。
 *
 * 钉的是「前端发出去的那一发 URL 与参数，跟后端那一支只认平台一家（租户 1）的方法签名对得上」。
 * 逐字取自 `ai/model/AiModelConfigController`、`EmbeddingConfigController`、`VectorDbConfigController`：
 * 那三支 GET/PUT 现在都不收 tenantId 了。http 层的 baseURL 是 `/api`，所以这里断言去掉 `/api` 那一段。
 *
 * 为什么要在 API 层再钉一遍，不只在看屏幕的测试里钉：
 * 屏幕不传不等于 URL 干净——参数可能被 api 那一层自己兜进去。反向也一样，
 * 下一屏若有人手滑把 `tenantId` 塞回类型里，这一支会当场红，而不是等界面查出别家客户的模型。
 */

const calls: Array<{ method: string; args: unknown[] }> = []

vi.mock('../http', () => ({
  default: {
    get: (...args: unknown[]) => calls.push({ method: 'get', args }),
    post: (...args: unknown[]) => calls.push({ method: 'post', args }),
    put: (...args: unknown[]) => calls.push({ method: 'put', args }),
    delete: (...args: unknown[]) => calls.push({ method: 'delete', args }),
  },
  AI_REQUEST_TIMEOUT: 0,
}))

import { embeddingConfigApi, modelConfigApi, vectorDbApi } from '../ai-model'

function last(): { method: string; url: string; rest: unknown[] } {
  const entry = calls[calls.length - 1]
  return { method: entry.method, url: String(entry.args[0]), rest: entry.args.slice(1) }
}

beforeEach(() => {
  calls.length = 0
})

describe('模型配置那一族：查询里没有「哪一家客户」', () => {
  it('GET /ai/model-configs?page=1&size=100 —— 没有 tenantId', async () => {
    await modelConfigApi.list({ page: 1, size: 100 })
    expect(last()).toEqual({ method: 'get', url: '/ai/model-configs', rest: [{ params: { page: 1, size: 100 } }] })
  })

  it('POST /ai/model-configs —— 新行落在哪一家由后端定，请求体里不许带 tenantId', async () => {
    await modelConfigApi.create({ name: '通义千问-文章生成', provider: 'dashscope', modelName: 'qwen-plus' } as any)
    const call = last()
    expect(call.method).toBe('post')
    expect(call.url).toBe('/ai/model-configs')
    expect(JSON.stringify(call.rest)).not.toContain('tenantId')
  })
})

describe('向量化配置那一族：全平台一份，无参', () => {
  it('GET /ai/embedding-config —— 后端那一支已经不收 tenantId', async () => {
    await embeddingConfigApi.get()
    expect(last()).toEqual({ method: 'get', url: '/ai/embedding-config', rest: [] })
  })

  it('PUT /ai/embedding-config —— 只有一个参数（配置本体）', async () => {
    await embeddingConfigApi.update({ chunkSize: 512, chunkOverlap: 50 } as any)
    const call = last()
    expect(call.method).toBe('put')
    expect(call.url).toBe('/ai/embedding-config')
    expect(call.rest.length).toBe(1)
    expect(JSON.stringify(call.rest)).not.toContain('tenantId')
  })

  it('GET /ai/embedding-config/stats —— 这一口现在是全部客户的合计，不再按家切', async () => {
    await embeddingConfigApi.stats()
    expect(last()).toEqual({ method: 'get', url: '/ai/embedding-config/stats', rest: [] })
  })
})

describe('向量库连接那一族：跟着并成平台一份', () => {
  it('GET /ai/vector-dbs —— 无参', async () => {
    await vectorDbApi.list()
    expect(last()).toEqual({ method: 'get', url: '/ai/vector-dbs', rest: [] })
  })

  it('POST /ai/vector-dbs —— 请求体里没有 tenantId', async () => {
    await vectorDbApi.create({ name: '本地 Milvus', dbType: 'milvus', host: '127.0.0.1', port: 19530 } as any)
    const call = last()
    expect(call.method).toBe('post')
    expect(call.url).toBe('/ai/vector-dbs')
    expect(JSON.stringify(call.rest)).not.toContain('tenantId')
  })
})
