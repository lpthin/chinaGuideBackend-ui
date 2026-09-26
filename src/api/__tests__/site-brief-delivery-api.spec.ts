import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * P4 这两张面的路径契约（Spec-C §5 的 public brief 两行 + promote/regenerate/decisions 三行）。
 *
 * 钉的是「端点长得跟后端源码一样」，逐字取自 cgBackendP4 的
 * `sitebrief/decision/PortalBriefPublicController`（`@RequestMapping("/api/portal/public/brief/{token}")`
 * + `@GetMapping` / `@PostMapping("/decide")`）与 `SiteBriefDeliveryController`
 * （`/api/admin/site-briefs` + `/{id}/promote`、`/{id}/regenerate`、`/{id}/decisions`）。
 * http 层的 baseURL 是 `/api`，所以这里断言的是去掉 `/api` 之后那一段。
 *
 * 另外两条容易被人顺手改坏的：
 * - 公开两口**不带任何身份参数**（拍板 10）：payload 只有 chosenSiteId / clientNote / website 三根；
 * - 令牌进 URL 时逐段转义，含空格与 `/` 的坏令牌不能被拼成别的路径。
 */

const calls: Array<{ method: string; args: unknown[] }> = []

vi.mock('../http', () => ({
  default: {
    get: (...args: unknown[]) => calls.push({ method: 'get', args }),
    post: (...args: unknown[]) => calls.push({ method: 'post', args })
  }
}))

import {
  clientBriefApi,
  clientCandidatesDifference,
  hasChosenDecision,
  resolvePreviewUrl,
  siteBriefDeliveryApi,
  type ClientBriefCandidate
} from '../siteBriefDelivery'

function last(): { method: string; url: string; rest: unknown[] } {
  const entry = calls[calls.length - 1]
  return { method: entry.method, url: String(entry.args[0]), rest: entry.args.slice(1) }
}

beforeEach(() => {
  calls.length = 0
})

describe('公开面：客户选择页一读一写', () => {
  it('读口 = GET /portal/public/brief/{token}，除令牌外没有任何参数', async () => {
    await clientBriefApi.fetch('abc123')
    expect(last()).toEqual({ method: 'get', url: '/portal/public/brief/abc123', rest: [] })
  })

  it('令牌里的特殊字符按路径段转义（坏令牌不许被拼成另一条路径）', async () => {
    await clientBriefApi.fetch('a/b c')
    expect(last().url).toBe('/portal/public/brief/a%2Fb%20c')
  })

  it('写口 = POST /portal/public/brief/{token}/decide，payload 只有后端那三根字段', async () => {
    await clientBriefApi.decide('tok', { chosenSiteId: 31, clientNote: '案例想放首页第一屏', website: undefined })
    expect(last()).toEqual({
      method: 'post',
      url: '/portal/public/brief/tok/decide',
      rest: [{ chosenSiteId: 31, clientNote: '案例想放首页第一屏', website: undefined }]
    })
    // 拍板 10：这一发里没有姓名/邮箱/手机号/租户号/站点号等任何一根身份或归属字段
    const sent = calls[0].args[1] as Record<string, unknown>
    expect(Object.keys(sent).sort()).toEqual(['chosenSiteId', 'clientNote', 'website'])
  })

  it('「只提意见不选」是后端明列的合法形状：chosenSiteId 发 null 而不是不发', async () => {
    await clientBriefApi.decide('tok', { chosenSiteId: null, clientNote: '都不满意，想重出一轮' })
    expect((calls[0].args[1] as Record<string, unknown>).chosenSiteId).toBe(null)
  })
})

describe('超管面：转正 / 收口重跑 / 留痕', () => {
  it('三口路径与动词逐字对齐 SiteBriefDeliveryController', async () => {
    await siteBriefDeliveryApi.promote(12)
    expect(last()).toEqual({ method: 'post', url: '/admin/site-briefs/12/promote', rest: [{ decisionId: null, siteId: null }] })

    await siteBriefDeliveryApi.promote(12, { siteId: 31 })
    expect(last().rest).toEqual([{ decisionId: null, siteId: 31 }])

    await siteBriefDeliveryApi.regenerate(12)
    expect(last()).toEqual({ method: 'post', url: '/admin/site-briefs/12/regenerate', rest: [] })

    await siteBriefDeliveryApi.decisions(12)
    expect(last()).toEqual({ method: 'get', url: '/admin/site-briefs/12/decisions', rest: [] })
  })

  it('转正按钮的判据：只有留痕里真有 chosenSiteId 的行才算「客户已选定」', () => {
    expect(hasChosenDecision([])).toBe(false)
    expect(hasChosenDecision(null)).toBe(false)
    expect(hasChosenDecision([{ id: 1, chosenSiteId: null } as never])).toBe(false)
    expect(hasChosenDecision([{ id: 1, chosenSiteId: null }, { id: 2, chosenSiteId: 31 }] as never)).toBe(true)
  })
})

describe('预览地址与差异说明（拍板 1A / 5A 的前端那一半）', () => {
  it('后端没配 preview-base-url 时回的是相对路径：按当前 origin 拼；绝对地址原样透传', () => {
    expect(resolvePreviewUrl('/?reviewToken=xyz', 'https://admin.example.com/')).toBe('https://admin.example.com/?reviewToken=xyz')
    expect(resolvePreviewUrl('https://demo.preview.internal/?reviewToken=1')).toBe('https://demo.preview.internal/?reviewToken=1')
    expect(resolvePreviewUrl(null)).toBe('')
    expect(resolvePreviewUrl('   ')).toBe('')
  })

  function candidate(overrides: Partial<ClientBriefCandidate> = {}): ClientBriefCandidate {
    return { siteId: 1, candidateNo: 1, name: '甲', skeletonKey: 'lead-gen', previewUrl: '/?reviewToken=a', ...overrides }
  }

  it('后端给了差异原话就一个字不改用它的', () => {
    const result = clientCandidatesDifference([
      candidate({ differentiation: '这一套把留资表单摆第一屏' }),
      candidate({ siteId: 2, candidateNo: 2, skeletonKey: 'content-first', differentiation: '这一套先讲案例与实力' })
    ])
    expect(result.visible).toBe(true)
    expect(result.text).toContain('这一套把留资表单摆第一屏')
    expect(result.text).toContain('这一套先讲案例与实力')
  })

  it('没给差异原话时只用响应真有的字段（骨架各不相同才算看得出差异）', () => {
    const distinct = clientCandidatesDifference([candidate(), candidate({ siteId: 2, candidateNo: 2, skeletonKey: 'corporate-base' })])
    expect(distinct.visible).toBe(true)
    expect(distinct.text).toContain('lead-gen')
    expect(distinct.text).toContain('corporate-base')

    const same = clientCandidatesDifference([candidate(), candidate({ siteId: 2, candidateNo: 2 })])
    expect(same.visible).toBe(false)
    expect(same.text).toContain('骨架是同一份')

    const nothing = clientCandidatesDifference([candidate({ skeletonKey: null }), candidate({ siteId: 2, skeletonKey: null })])
    expect(nothing.visible).toBe(false)
    expect(nothing.text).toContain('这一份响应里没有写出各套差在哪')
  })
})
