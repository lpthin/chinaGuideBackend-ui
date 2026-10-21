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
  clientBriefStatusLabel,
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

describe('超管面：转正 / 收口重跑 / 作废 / 留痕', () => {
  it('四口路径与动词逐字对齐 SiteBriefDeliveryController', async () => {
    await siteBriefDeliveryApi.promote(12)
    expect(last()).toEqual({ method: 'post', url: '/admin/site-briefs/12/promote', rest: [{ decisionId: null, siteId: null }] })

    await siteBriefDeliveryApi.promote(12, { siteId: 31 })
    expect(last().rest).toEqual([{ decisionId: null, siteId: 31 }])

    await siteBriefDeliveryApi.regenerate(12)
    expect(last()).toEqual({ method: 'post', url: '/admin/site-briefs/12/regenerate', rest: [] })

    // 作废（M-P58 拍板②）：原因必带着发——后端对空串当面拒，适配层不替他兜空串
    await siteBriefDeliveryApi.cancel(12, '客户线下说不做了')
    expect(last()).toEqual({ method: 'post', url: '/admin/site-briefs/12/cancel', rest: [{ reason: '客户线下说不做了' }] })

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
    return {
      siteId: 1,
      candidateNo: 1,
      name: '甲',
      skeletonKey: 'lead-gen',
      skeletonName: '留资转化站',
      focus: null,
      tone: null,
      previewUrl: '/?reviewToken=a',
      ...overrides
    }
  }

  it('后端给了 focus 原话就一个字不改用它的（这一句读的是 site_proposal_candidate.focus）', () => {
    const result = clientCandidatesDifference([
      candidate({ focus: '这一套把留资表单摆第一屏', tone: 'direct' }),
      candidate({ siteId: 2, candidateNo: 2, skeletonKey: 'content-first', focus: '这一套先讲案例与实力', tone: 'warm' })
    ])
    expect(result.visible).toBe(true)
    expect(result.text).toContain('这一套把留资表单摆第一屏')
    expect(result.text).toContain('这一套先讲案例与实力')
    expect(result.text).not.toContain('另外')
  })

  it('有几套没跑到 plan（focus 是 null）就把缺的数量念出来，不许看起来像三套都齐了', () => {
    const result = clientCandidatesDifference([
      candidate({ focus: '这一套把留资表单摆第一屏' }),
      candidate({ siteId: 2, candidateNo: 2, skeletonKey: 'content-first' }),
      candidate({ siteId: 3, candidateNo: 3, skeletonKey: 'blog-first' })
    ])
    expect(result.visible).toBe(true)
    expect(result.text).toContain('这一套把留资表单摆第一屏')
    expect(result.text).toContain('另外 2 套没有这句')
  })

  it('没给 focus 时只用响应真有的字段（骨架各不相同才算看得出差异），念的是中文名不是那串码', () => {
    const distinct = clientCandidatesDifference([
      candidate({ skeletonName: '留资转化站' }),
      candidate({ siteId: 2, candidateNo: 2, skeletonKey: 'corporate-base', skeletonName: '基础企业形象站' })
    ])
    expect(distinct.visible).toBe(true)
    expect(distinct.text).toContain('留资转化站')
    expect(distinct.text).toContain('基础企业形象站')
    // 走查第 6 条：比对用 key，念出来的必须是名字——这一屏以前印的是 `corporate-base`
    expect(distinct.text).not.toMatch(/lead-gen|corporate-base/)

    const same = clientCandidatesDifference([candidate(), candidate({ siteId: 2, candidateNo: 2 })])
    expect(same.visible).toBe(false)
    expect(same.text).toContain('骨架是同一份')

    const nothing = clientCandidatesDifference([candidate({ skeletonKey: null }), candidate({ siteId: 2, skeletonKey: null })])
    expect(nothing.visible).toBe(false)
    expect(nothing.text).toContain('这一屏看不出各套差在哪')
  })

  it('后端没带骨架中文名时照实说没有，绝不拿那串英文码顶上', () => {
    const result = clientCandidatesDifference([
      candidate({ skeletonName: null }),
      candidate({ siteId: 2, candidateNo: 2, skeletonKey: 'corporate-base', skeletonName: '  ' })
    ])
    expect(result.text).toContain('这一套没有骨架名')
    expect(result.text).not.toMatch(/lead-gen|corporate-base/)
  })

  it('这一句是念给买单的人听的：四个分支都不许出现工程内部的说法（2026-10-22 走查第 5 条）', () => {
    // 反例：改文案前这一屏原样印着「这套侧重什么（后端原话）」和「差异原话属 P3 的 plan 字段」
    const branches = [
      clientCandidatesDifference([candidate({ focus: '这一套把留资表单摆第一屏' })]).text,
      clientCandidatesDifference([candidate({ focus: '有这句' }), candidate({ siteId: 2, candidateNo: 2 })]).text,
      clientCandidatesDifference([candidate(), candidate({ siteId: 2, candidateNo: 2, skeletonKey: 'corporate-base' })]).text,
      clientCandidatesDifference([candidate(), candidate({ siteId: 2, skeletonKey: null })]).text,
      clientCandidatesDifference([candidate({ skeletonKey: null })]).text
    ]
    for (const text of branches) {
      expect(text).not.toMatch(/后端|落库|响应|字段|令牌|需求单|回执|接口|P3|plan|site_proposal|focus/i)
    }
  })

  it('单子状态念给客户的是中文，不是 decided 这种内部码；第三种状态回空串由界面照实说', () => {
    expect(clientBriefStatusLabel('decided')).toBe('已经收到过你的答复')
    expect(clientBriefStatusLabel('awaiting_client')).toBe('还在等你答复')
    expect(clientBriefStatusLabel('generating')).toBe('')
    expect(clientBriefStatusLabel(null)).toBe('')
  })
})
