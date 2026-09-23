import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  portalTicketsApi,
  sessionAllowsTicketWrite,
  sessionPageIds,
  ticketIntent,
  AI_DRAFT_TIMEOUT
} from '../portalTickets'

/**
 * 改版闭环接口的形状测试。
 *
 * 最要紧的一条是「烧钱的入口必须带 confirm」：这个参数一旦被某个调用点顺手写成 true 或者省略，
 * 界面就变成「点一下就走一次付费模型」，而这正是决策 D4 要防的事。
 * 第二条是词表只能来自 /portal/tickets/options，前端抄的第二份必然漂移。
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

describe('portalTicketsApi', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('源码里没有带 /api 前缀的路径，也没有本地抄的状态中文标签', async () => {
    const raw = import.meta.glob('../portalTickets.ts', { eager: true, query: '?raw', import: 'default' }) as Record<string, string>
    const source = Object.values(raw).join('')
    expect([...source.matchAll(/['"]\/api\/[^'"]*['"]/g)].map(m => m[0])).toEqual([])
    expect(source).not.toMatch(/待处理/)
    expect(source).not.toMatch(/已应用/)
  })

  it('词表只读后端一个端点', async () => {
    const http = await httpMock()
    await portalTicketsApi.options()
    expect(http.get).toHaveBeenCalledWith('/portal/tickets/options')
  })

  it('工单按 pageId 参数过滤，访客上报与运营代录都不带 tenantId', async () => {
    const http = await httpMock()
    await portalTicketsApi.list({ status: 'open', pageId: 38 })
    expect(http.get).toHaveBeenLastCalledWith('/portal/tickets', { params: { status: 'open', pageId: 38 } })

    await portalTicketsApi.create(38, { clientText: '标题太长', blockInstanceId: 'b2', intent: 'edit-text' })
    expect(http.post).toHaveBeenLastCalledWith('/portal/tickets',
      { clientText: '标题太长', blockInstanceId: 'b2', intent: 'edit-text' },
      { params: { pageId: 38 } })
  })

  it('估算与起草是两个端点，起草没有 confirm 就原样发 false', async () => {
    const http = await httpMock()
    await portalTicketsApi.estimate(7)
    expect(http.post).toHaveBeenLastCalledWith('/portal/tickets/7/estimate')

    await portalTicketsApi.aiDraft(7, false)
    expect(http.post).toHaveBeenLastCalledWith('/portal/tickets/7/ai-draft', { confirm: false }, { timeout: AI_DRAFT_TIMEOUT })

    await portalTicketsApi.aiDraft(7, true)
    expect(http.post).toHaveBeenLastCalledWith('/portal/tickets/7/ai-draft', { confirm: true }, { timeout: AI_DRAFT_TIMEOUT })
  })

  it('撤销预览链接是 POST /revoke，不是 DELETE（发出去过的链接要留痕）', async () => {
    const http = await httpMock()
    await portalTicketsApi.revokeSession(3)
    expect(http.post).toHaveBeenCalledWith('/portal/review-sessions/3/revoke')
    expect(http.delete).not.toHaveBeenCalled()
  })

  it('自由改版同样必须显式确认', async () => {
    const http = await httpMock()
    await portalTicketsApi.freeRevise({ pageId: 38, instruction: '首屏太挤', confirm: false })
    expect(http.post).toHaveBeenCalledWith('/portal/drafts/free-revise',
      { pageId: 38, instruction: '首屏太挤', confirm: false },
      { timeout: AI_DRAFT_TIMEOUT })
  })

  it('应用草稿是唯一写内容的动作，走 /drafts/{id}/apply', async () => {
    const http = await httpMock()
    await portalTicketsApi.apply(11)
    expect(http.post).toHaveBeenCalledWith('/portal/drafts/11/apply')
  })
})

describe('工单与会话的解析辅助', () => {
  it('structured_intent 坏了就当没有动作，不替客户编一个', () => {
    expect(ticketIntent({ structuredIntent: '{"intent":"edit-text"}' })).toBe('edit-text')
    expect(ticketIntent({ structuredIntent: 'not json' })).toBeNull()
    expect(ticketIntent({ structuredIntent: null })).toBeNull()
    expect(ticketIntent({ structuredIntent: '{"other":1}' })).toBeNull()
  })

  it('会话授权范围按 page:N 解析，提单权限单独判', () => {
    const scopes = { scopes: 'page:12,page:13,ticketWrite' }
    expect(sessionPageIds(scopes)).toEqual([12, 13])
    expect(sessionAllowsTicketWrite(scopes)).toBe(true)
    expect(sessionPageIds({ scopes: null })).toEqual([])
    expect(sessionAllowsTicketWrite({ scopes: 'page:12' })).toBe(false)
  })
})
