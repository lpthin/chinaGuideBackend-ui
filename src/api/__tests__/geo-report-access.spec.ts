import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * 诊断报告的两种读法（Spec-G G6 的前端岔口，对齐后端 `GeoReportPublicController`）。
 *
 * 这一份存在的意义是「外链页与后台页共用同一份形状」，所以钉的四件事都是形状本身：
 * 1. **公开口六个 GET、零个写动作**，且 URL 上没有轮次号——有 runId 参数就等于承认
 *    「换个号能试别人的报告」，而后端那一条路上根本没有这个位置；
 * 2. **令牌走 encodeURIComponent**：它是 64 位十六进制，但手抄链接带进来的空白/半个字符
 *    不该变成另一条路径分段；
 * 3. **令牌优先于 runId**：外链页地址上两者都可能被改，可信的是令牌绑定的那一轮；
 * 4. **公开形状上就没有那几个写动作**（重算 SOV / 判定 / 一键成内容）：比「按钮摆着、按下去 404」
 *    诚实，也比在模板里散落三个 `v-if` 可靠。
 */

const httpMock = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
}))

vi.mock('../http', () => ({
  default: httpMock,
  AI_REQUEST_TIMEOUT: 180000,
  describeHttpError: (e: unknown) => String(e),
}))

// 登录态那一条读路径只需要「能被认出调了哪个方法」，它自己的契约另有 geo-campaign-api.spec.ts 钉
vi.mock('../geoCampaign', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../geoCampaign')>()
  return {
    ...actual,
    geoCampaignApi: {
      getReport: vi.fn(), judgments: vi.fn(), answer: vi.fn(), vocabulary: vi.fn(),
    },
  }
})

import {
  authedReportAccess,
  geoPublicApi,
  publicReportAccess,
  reportAccessOf,
  reportLinkUrl,
} from '../geoReportAccess'
import { geoCampaignApi } from '../geoCampaign'

const TOKEN = 'd'.repeat(64)

function urlsOf(spy: { mock: { calls: unknown[][] } }): string[] {
  return spy.mock.calls.map((call) => String(call[0]))
}

beforeEach(() => {
  for (const spy of [httpMock.get, httpMock.post, httpMock.put, httpMock.delete]) {
    spy.mockReset()
    spy.mockResolvedValue({} as never)
  }
  vi.clearAllMocks()
})

describe('访客侧六个读口', () => {
  it('六个口子各打各的相对路径，前缀里带的是令牌而不是轮次号', async () => {
    const api = geoPublicApi(TOKEN)
    await api.report()
    await api.run()
    await api.judgments()
    await api.answer(900)
    await api.vocabulary()
    await api.context()

    expect(urlsOf(httpMock.get)).toEqual([
      `/geo/public/${TOKEN}/report`,
      `/geo/public/${TOKEN}/run`,
      `/geo/public/${TOKEN}/judgments`,
      `/geo/public/${TOKEN}/answer/900`,
      `/geo/public/${TOKEN}/vocabulary`,
      `/geo/public/${TOKEN}/context`,
    ])
    expect(httpMock.post.mock.calls).toHaveLength(0)
    expect(httpMock.put.mock.calls).toHaveLength(0)
    expect(httpMock.delete.mock.calls).toHaveLength(0)
  })

  it('URL 上没有 runId 这个位置：读哪一轮由令牌作用域说，不由访客传的参数说', async () => {
    const api = geoPublicApi(TOKEN)
    await api.report()
    await api.judgments()
    await api.context()

    for (const call of httpMock.get.mock.calls) {
      // 第二段有值 = 塞了 axios config：公开口一个查询参数都不该带（runId / tenantId / includeResolved 都不许）
      expect(call.length, `公开口 ${call[0]} 不该带参数`).toBe(1)
      // 令牌就是全部准入凭据：路径除那一段令牌外没有别的东西
      expect(String(call[0]).startsWith(`/geo/public/${TOKEN}/`)).toBe(true)
    }
    expect(JSON.stringify(httpMock.get.mock.calls)).not.toContain('runId')
    expect(JSON.stringify(httpMock.get.mock.calls)).not.toContain('88')
  })

  it('令牌先 trim 再转义：手抄链接带来的空白不该变成另一条路径分段', async () => {
    await geoPublicApi(`  ${TOKEN}  `).report()
    expect(httpMock.get).toHaveBeenLastCalledWith(`/geo/public/${TOKEN}/report`)

    // 半截链接里出现 / 或 ? 时，转义之后的那一段仍然是一条完整路径而不是多一段
    await geoPublicApi('abc/def?x=1').run()
    expect(urlsOf(httpMock.get)[1]).toBe('/geo/public/abc%2Fdef%3Fx%3D1/run')
  })

  it('顶栏那一格读的是 context：它给的是到期时刻，没有签发人', async () => {
    await geoPublicApi(TOKEN).context()
    expect(httpMock.get).toHaveBeenLastCalledWith(`/geo/public/${TOKEN}/context`)
    expect(Object.keys({ ...(geoPublicApi(TOKEN) as object) })).toEqual([
      'report', 'run', 'judgments', 'answer', 'vocabulary', 'context',
    ])
  })
})

describe('两条读路收成一个形状', () => {
  it('公开形状上就没有那几个写动作：连方法名都没有，界面就点不出那个按钮', () => {
    const access = publicReportAccess(TOKEN) as unknown as Record<string, unknown>
    expect(Object.keys(access).sort()).toEqual(
      ['answer', 'judgments', 'kind', 'report', 'vocabulary'].sort(),
    )
    expect(access.kind).toBe('public')
    for (const name of ['recalculateSov', 'judge', 'run', 'opportunityDraft', 'issueReportLink', 'revokeReportLink']) {
      expect(access[name], `公开那一支里不许出现 ${name}：形状上没有，界面就摆不出那个按钮`).toBeUndefined()
    }
  })

  it('authed 那一支复用登录态的四个方法，参数是它自己那一个 runId', async () => {
    const access = authedReportAccess(88)
    expect(access.kind).toBe('authed')
    await access.report()
    await access.judgments()
    await access.answer(900)
    await access.vocabulary()
    expect(geoCampaignApi.getReport).toHaveBeenLastCalledWith(88)
    expect(geoCampaignApi.judgments).toHaveBeenLastCalledWith(88)
    expect(geoCampaignApi.answer).toHaveBeenLastCalledWith(900)
    expect(geoCampaignApi.vocabulary).toHaveBeenCalledTimes(1)
    expect(httpMock.get.mock.calls).toHaveLength(0)
  })

  it('令牌优先于轮次号：两个都给时走公开口', () => {
    const access = reportAccessOf({ runId: 88, token: TOKEN })
    expect(access?.kind).toBe('public')
    expect(access?.answer).toBeTypeOf('function')
  })

  it('没令牌时按轮次走登录态；轮次号缺失或为 0 给的是 null，不是「拿 NaN 去发请求」', () => {
    expect(reportAccessOf({ runId: 88 })?.kind).toBe('authed')
    // 地址栏里 runId=88 是字符串：视图传什么形状都得认
    expect(reportAccessOf({ runId: '88' })?.kind).toBe('authed')
    expect(reportAccessOf({ runId: null })).toBeNull()
    expect(reportAccessOf({ runId: undefined })).toBeNull()
    expect(reportAccessOf({ runId: 0 })).toBeNull()
    expect(reportAccessOf({ runId: 'abc' })).toBeNull()
    expect(reportAccessOf({ runId: NaN })).toBeNull()
    // 只有空白令牌 = 没有令牌：不许把 trim 掉的空串当成一枚真令牌发一发请求
    expect(reportAccessOf({ token: '   ' })).toBeNull()
    expect(reportAccessOf({})).toBeNull()
  })
})

describe('只读链接的地址拼法', () => {
  it('后端回相对路径，界面按当前 origin 拼（同源部署与 dev 的 5190 都照这一条）', () => {
    expect(reportLinkUrl('/geo-report/abc', 'http://127.0.0.1:8080'))
      .toBe('http://127.0.0.1:8080/geo-report/abc')
    // 尾斜杠不 doubled up：拼出来的地址要能直接点开
    expect(reportLinkUrl('/geo-report/abc', 'http://127.0.0.1:8080/'))
      .toBe('http://127.0.0.1:8080/geo-report/abc')
    // 绝对地址原样透传：哪天这一页挪到别的域，改的是后端那一句而不是前端再抄一份规则
    expect(reportLinkUrl('https://admin.example.com/geo-report/abc')).toBe('https://admin.example.com/geo-report/abc')
    // 读不出地址时给空串：调用方据此走「这一条还没有可点开的链接」，不摆死链
    expect(reportLinkUrl(null)).toBe('')
    expect(reportLinkUrl(undefined)).toBe('')
    expect(reportLinkUrl('')).toBe('')
  })
})
