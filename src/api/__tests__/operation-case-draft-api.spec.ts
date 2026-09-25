import { describe, it, expect, vi, beforeEach } from 'vitest'
import { customerCaseApi } from '../operation'

/**
 * 案例 AI 起草那两个端点的形状（任务 #29）。
 *
 * 界面测试把整个 api 模块桩掉了，所以「请求发到哪个地址」在那里是测不到的，这一份补上：
 * 预估必须是 GET（它什么都不改，用 POST 会让人以为又花了一次钱），
 * 起草必须把 confirm 原样带出去——省略它等于「点一下就走一次付费模型」。
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

describe('customerCaseApi 的 AI 起草', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('预估走 GET，地址是这一条案例自己的', async () => {
    const http = await httpMock()

    await customerCaseApi.estimateAiDraft(65)

    expect(http.get).toHaveBeenCalledWith('/operation/cases/65/ai-draft/estimate')
    expect(http.post).not.toHaveBeenCalled()
  })

  it('起草把 confirm 与这一轮的额外要求一起带出去', async () => {
    const http = await httpMock()

    await customerCaseApi.aiDraft(65, true, '把复查那一段写细一点')

    expect(http.post).toHaveBeenCalledWith('/operation/cases/65/ai-draft', {
      confirm: true,
      instruction: '把复查那一段写细一点'
    })
  })

  it('没勾确认时传的是 false，不是省略这个字段', async () => {
    const http = await httpMock()

    await customerCaseApi.aiDraft(65, false)

    expect(http.post).toHaveBeenCalledWith('/operation/cases/65/ai-draft', {
      confirm: false,
      instruction: undefined
    })
  })

  it('路径里没有 /api 前缀（baseURL 已经带上了）', async () => {
    const raw = import.meta.glob('../operation.ts', { eager: true, query: '?raw', import: 'default' }) as Record<string, string>
    const source = Object.values(raw).join('')
    expect([...source.matchAll(/['"]\/api\/[^'"]*['"]/g)].map(m => m[0])).toEqual([])
  })
})
