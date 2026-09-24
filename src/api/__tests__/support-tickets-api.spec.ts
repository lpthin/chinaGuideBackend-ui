import { describe, it, expect, vi, beforeEach } from 'vitest'
import { supportTicketsApi } from '../supportTickets'

/**
 * 「联系平台」工单接口的形状测试。
 * 要紧的两条：路径不带 /api 前缀；中文状态标签只从 /statuses 拿，源里不许抄第二份。
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

describe('supportTicketsApi', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('源码里没有带 /api 前缀的路径，也没有本地抄的状态中文标签', async () => {
    const raw = import.meta.glob('../supportTickets.ts', { eager: true, query: '?raw', import: 'default' }) as Record<string, string>
    const source = Object.values(raw).join('')
    expect([...source.matchAll(/['"]\/api\/[^'"]*['"]/g)].map(m => m[0])).toEqual([])
    expect(source).not.toMatch(/待处理/)
    expect(source).not.toMatch(/已回复/)
    expect(source).not.toMatch(/已关闭/)
  })

  it('状态词表只读后端一个端点', async () => {
    const http = await httpMock()
    await supportTicketsApi.statuses()
    expect(http.get).toHaveBeenCalledWith('/portal/support-tickets/statuses')
  })

  it('提交体里没有 tenantId：租户身份归登录上下文判', async () => {
    const http = await httpMock()
    await supportTicketsApi.submit({ topic: '想加视频区块', content: '客户案例想放视频' })
    expect(http.post).toHaveBeenCalledWith('/portal/support-tickets', { topic: '想加视频区块', content: '客户案例想放视频' })
    const body = (http.post as any).mock.calls[0][1]
    expect(body).not.toHaveProperty('tenantId')
  })

  it('我的列表与管理队列是两个不同的路径', async () => {
    const http = await httpMock()
    await supportTicketsApi.listMine('open')
    expect(http.get).toHaveBeenLastCalledWith('/portal/support-tickets', { params: { status: 'open' } })
    await supportTicketsApi.listForAdmin(undefined)
    expect(http.get).toHaveBeenLastCalledWith('/portal/support-tickets/admin/list', { params: { status: undefined } })
  })

  it('回复走 PUT /admin/{id}/reply 且参数名是 replyContent', async () => {
    const http = await httpMock()
    await supportTicketsApi.reply(4, '本周内处理')
    expect(http.put).toHaveBeenCalledWith('/portal/support-tickets/admin/4/reply', { replyContent: '本周内处理' })
  })
})
