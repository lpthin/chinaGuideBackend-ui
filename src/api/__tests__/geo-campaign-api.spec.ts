import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * GEO 诊断的接口契约（Spec-F §11.3 P2，对齐后端 `GeoCampaignController`）。
 *
 * 这一族里最容易做错的两件事都出在「花钱」那条线上，所以逐字钉住：
 * 1. **预估不带 body**：`GET /{id}/estimate` 的验收点是「打完之后 `ai_call_log` 不多一行」，
 *    前端一旦给它塞参数或改POST，它就变成一个看起来像写操作的读口；
 * 2. **confirm 不许有默认值**：`run(id, confirm)` 必须把调用方那个布尔原样发出去。
 *    写成 `confirm = true` 等于在前端把 §6.2 的两段式（先看价、再点头）拆掉，
 *    后端 `GEO_CAMPAIGN_CONFIRM_REQUIRED` 那条闸就永远测不到第二遍。
 *
 * 另一半是单源（§9.2）：轮次状态与确认态的中文只允许待在 `/vocabulary` 的响应里，
 * 这一族新文件（api + 面板 + 报告 + 第⑤步 + 判据）抄一份就算红灯——抄一次，
 * 下次后端改词表界面就不跟着变。
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

import {
  geoCampaignApi,
  geoJudgeIsInFlight,
  geoRunIsInFlight,
  geoRunIsSettled,
  GEO_JUDGE_QUEUE_FULL_CODE,
  GEO_QUEUE_FULL_CODE,
} from '../geoCampaign'

function lastCall(spy: { mock: { calls: unknown[][] } }): unknown[] {
  const calls = spy.mock.calls
  return calls[calls.length - 1] || []
}

beforeEach(() => {
  httpMock.get.mockReset()
  httpMock.post.mockReset()
  httpMock.put.mockReset()
  httpMock.delete.mockReset()
  httpMock.get.mockResolvedValue({} as never)
  httpMock.post.mockResolvedValue({} as never)
  httpMock.put.mockResolvedValue({} as never)
  httpMock.delete.mockResolvedValue({} as never)
})

describe('端点形状：与后端 GeoCampaignController 逐字一致', () => {
  it('计划的建 / 改 / 删 / 查各走各的动词，改与删都不带 confirm', async () => {
    await geoCampaignApi.createCampaign({
      siteId: 3, brandProfileId: 7, name: '牙科一期', platformIds: [4, 11],
      questionIds: [], repeatTimes: 3, wizardState: '{"current":4,"maxReached":4}', note: '',
    })
    expect(lastCall(httpMock.post)[0]).toBe('/geo/campaign')
    // 题池留空 = 后端拍「该档案下当前启用的题」，所以这里绝不自己填一份题 id 清单
    expect((lastCall(httpMock.post)[1] as { questionIds: number[] }).questionIds).toEqual([])

    await geoCampaignApi.updateCampaign(12, { repeatTimes: 5 })
    expect(httpMock.put).toHaveBeenLastCalledWith('/geo/campaign/12', { repeatTimes: 5 })

    await geoCampaignApi.deleteCampaign(12)
    expect(httpMock.delete).toHaveBeenLastCalledWith('/geo/campaign/12')

    await geoCampaignApi.getCampaign(12)
    expect(httpMock.get).toHaveBeenLastCalledWith('/geo/campaign/12')

    expect(JSON.stringify([...httpMock.post.mock.calls, ...httpMock.put.mock.calls])).not.toContain('confirm')
  })

  it('列表只带（档案、page、size），没有 tenantId：租户归属由后端从登录态推', async () => {
    await geoCampaignApi.listCampaigns({ brandProfileId: 7, page: 2, size: 20 })
    expect(httpMock.get).toHaveBeenLastCalledWith('/geo/campaign/list', {
      params: { brandProfileId: 7, page: 2, size: 20 },
    })
    expect(JSON.stringify(lastCall(httpMock.get))).not.toContain('tenantId')
  })

  it('estimate 是 GET 且一发不带参数：它的验收点就是「一次模型都不调」', async () => {
    await geoCampaignApi.estimate(12)
    expect(httpMock.get).toHaveBeenLastCalledWith('/geo/campaign/12/estimate')
    expect(lastCall(httpMock.get).length).toBe(1)
    expect(httpMock.post.mock.calls).toHaveLength(0)
    expect(JSON.stringify(httpMock.get.mock.calls)).not.toContain('confirm')
  })

  it('run 的 confirm 原样是调用方给的那个布尔值：false 就发 false', async () => {
    await geoCampaignApi.run(12, false)
    expect(httpMock.post).toHaveBeenLastCalledWith('/geo/campaign/12/run', { confirm: false })
    await geoCampaignApi.run(12, true)
    expect((lastCall(httpMock.post)[1] as { confirm: boolean }).confirm).toBe(true)
  })

  it('平台卡片与轮次/报告三条读口：卡片按 siteId 查，报告按 runId 查', async () => {
    await geoCampaignApi.platforms(3)
    expect(httpMock.get).toHaveBeenLastCalledWith('/geo/campaign/platforms', { params: { siteId: 3 } })
    await geoCampaignApi.runs(12)
    expect(httpMock.get).toHaveBeenLastCalledWith('/geo/campaign/12/runs')
    await geoCampaignApi.getRun(88)
    expect(httpMock.get).toHaveBeenLastCalledWith('/geo/campaign/run/88')
    await geoCampaignApi.getReport(88)
    expect(httpMock.get).toHaveBeenLastCalledWith('/geo/campaign/run/88/report')
  })

  it('词表只有一个端点：/vocabulary，不带任何参数', async () => {
    await geoCampaignApi.vocabulary()
    expect(httpMock.get).toHaveBeenLastCalledWith('/geo/campaign/vocabulary')
  })

  it('judge 的 confirm 同样不许有默认值：判定是第二次花钱，那段路也要先看价再点头', async () => {
    await geoCampaignApi.judge(88, false)
    expect(httpMock.post).toHaveBeenLastCalledWith('/geo/campaign/run/88/judge', { confirm: false })
    await geoCampaignApi.judge(88, true)
    expect((lastCall(httpMock.post)[1] as { confirm: boolean }).confirm).toBe(true)
  })

  it('判定明细与原文溯源两条读口都是 GET：抽屉一次模型都不调，所以它不挂写码也不该发 POST', async () => {
    await geoCampaignApi.judgments(88)
    expect(httpMock.get).toHaveBeenLastCalledWith('/geo/campaign/run/88/judgments')
    await geoCampaignApi.answer(900)
    expect(httpMock.get).toHaveBeenLastCalledWith('/geo/campaign/answer/900')
    expect(httpMock.post.mock.calls).toHaveLength(0)
  })

  it('只读外链三条：发与撤是 POST 且都带 runId，列表是 GET（Spec-G G6）', async () => {
    await geoCampaignApi.issueReportLink(88, '给张总的第三季度报告')
    expect(httpMock.post).toHaveBeenLastCalledWith('/geo/campaign/run/88/report-link', {
      label: '给张总的第三季度报告',
    })
    // 备注名可空：留空时后端按默认名兜，前端不自己编一个名字（编了就是界面替客户起名）
    await geoCampaignApi.issueReportLink(88, null)
    expect(lastCall(httpMock.post)[1]).toEqual({ label: null })

    await geoCampaignApi.reportLinks(88)
    expect(httpMock.get).toHaveBeenLastCalledWith('/geo/campaign/run/88/report-links')

    await geoCampaignApi.revokeReportLink(88, 5)
    expect(httpMock.post).toHaveBeenLastCalledWith('/geo/campaign/run/88/report-link/5/revoke')
    // 撤销带的是（这一轮, sessionId）两个位置：只凭 sessionId 就能撤，等于能撤隔壁模块的整站预览令牌
    expect(JSON.stringify(httpMock.post.mock.calls)).not.toContain('confirm')
  })

  it('没有「一键全站诊断」这种批量口子：起跑只按 campaignId 一发一发来', () => {
    const risky = Object.keys(geoCampaignApi).filter((name) =>
      /runAll|batch|all|apply|publish/i.test(name),
    )
    expect(risky).toEqual([])
  })
})

describe('轮次状态分档（进度轮询的停表判据）', () => {
  it('落定只认那三个终态 key，新状态一律按「还能再跑」处理', () => {
    expect(geoRunIsSettled('SUCCEEDED')).toBe(true)
    expect(geoRunIsSettled('PARTIAL')).toBe(true)
    expect(geoRunIsSettled('FAILED')).toBe(true)
    expect(geoRunIsSettled('PENDING')).toBe(false)
    expect(geoRunIsSettled('RUNNING')).toBe(false)
    expect(geoRunIsSettled('QUEUED_BY_SOMEBODY_ELSE')).toBe(false)
    expect(geoRunIsSettled(null)).toBe(false)
  })

  it('在跑的两档与落定三档互不重叠：同一状态不能既是终态又要轮询', () => {
    for (const status of ['PENDING', 'RUNNING', 'SUCCEEDED', 'PARTIAL', 'FAILED']) {
      expect(geoRunIsInFlight(status) && geoRunIsSettled(status)).toBe(false)
    }
    expect(geoRunIsInFlight('RUNNING')).toBe(true)
    expect(geoRunIsInFlight('FAILED')).toBe(false)
  })

  it('队列满是错误码，不是状态：界面靠它给「重按不会重复扣钱」那一句', () => {
    expect(GEO_QUEUE_FULL_CODE).toBe('GEO_CAMPAIGN_QUEUE_FULL')
    expect(GEO_JUDGE_QUEUE_FULL_CODE).toBe('GEO_JUDGE_QUEUE_FULL')
  })

  it('判定的在飞判据只认 JUDGING：null（没判过）与 FAILED（判过但失败了）是两件事', () => {
    expect(geoJudgeIsInFlight('JUDGING')).toBe(true)
    expect(geoJudgeIsInFlight('DONE')).toBe(false)
    expect(geoJudgeIsInFlight('FAILED')).toBe(false)
    expect(geoJudgeIsInFlight(null)).toBe(false)
    expect(geoJudgeIsInFlight(undefined)).toBe(false)
  })

  it('判定词表与提问词表互不重叠：JUDGING 不是轮次状态，SUCCEEDED 也不是判定状态（§11.4 两份词表）', () => {
    for (const state of ['JUDGING', 'DONE', 'FAILED']) {
      expect(geoRunIsInFlight(state), `${state} 不该被当成提问在跑`).toBe(false)
    }
    for (const status of ['PENDING', 'RUNNING', 'SUCCEEDED', 'PARTIAL']) {
      expect(geoJudgeIsInFlight(status), `${status} 不该被当成判定在跑`).toBe(false)
    }
  })
})

/**
 * 单源扫描：这一族的视图与取数层，源码当文本读回来逐条对。
 * 按 basename 过滤（glob 的键在 VTU 下可能是绝对路径，写死键名会静默空转）。
 *
 * <p>G6 之后把 `geoReportAccess.ts` 也扫进来：它是「登录态读 / 令牌读」那一个岔口的唯一出处，
 * 公开口的 URL 形状就写在这一份里 —— 谁在这里补一个 `/api/` 前缀（axios 已经带了）或者
 * 把 runId 拼进公开地址，这一发当场红。</p>
 */
const scanned = import.meta.glob(
  [
    '../geoCampaign.ts',
    '../geoReportAccess.ts',
    '../../views/geocampaign/*.vue',
    '../../views/geocampaign/geoCampaignModel.ts',
    '../../views/geocampaign/geoOpportunityModel.ts',
  ],
  { eager: true, query: '?raw', import: 'default' },
) as Record<string, string>

const scannedNames = Object.keys(scanned)
  .map((path) => path.split(/[\\/]/).pop() as string)
  .sort()

function allCode(): string {
  return Object.values(scanned)
    .join('\n')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
}

describe('I-1：P2 前端不抄第二份词表', () => {
  it('扫到的就是这一族的文件（文件名写错时这里先红）', () => {
    expect(scannedNames).toEqual([
      'CampaignRunPanel.vue',
      'GeoCampaignReportView.vue',
      'GeoCampaignWorkbenchView.vue',
      'GeoDiagnosticWorkbenchView.vue',
      'GeoJudgmentDrawer.vue',
      'GeoOpportunityDrawer.vue',
      'GeoOpportunityPanel.vue',
      'GeoReportLinkPanel.vue',
      'GeoReportPublicView.vue',
      'WizardPlatformStep.vue',
      'geoCampaign.ts',
      'geoCampaignModel.ts',
      'geoOpportunityModel.ts',
      'geoReportAccess.ts',
    ].sort())
  })

  it('后端那套状态中文在这些文件里一份都没有（说法只来自 /vocabulary 与响应里的 label 字段）', () => {
    const raw = allCode()
    for (const label of ['排队中', '诊断中', '部分完成', '待确认', '已确认', '已完成']) {
      expect(raw, `「${label}」来自后端词表，不该在这里出现第二份`).not.toContain(label)
    }
  })

  it('判定那一段的三份词表也不抄：状态、档位、情感都只念接口给的 label', () => {
    const raw = allCode()
    for (const label of ['判定中', '已判定', '判定失败', '在推荐位', '提到但未推荐', '被绕开']) {
      expect(raw, `「${label}」来自 /vocabulary.judgeStates / prominences，界面抄一份就是下一次对不上的来源`).not.toContain(label)
    }
    // 情感三档的中文同理——只有那句「没有净情感」的解释例外，它不指任何一个档位
    for (const label of ['正面档', '中立档', '负面档']) {
      expect(raw).not.toContain(label)
    }
  })

  it('P4 机会那一族的三份词表也不抄：四档缺口、四个动作、四个状态都只念接口给的 label', () => {
    const raw = allCode()
    // GeoGapTypes.labels()
    for (const label of ['站里没这内容', '有内容但没被引用', '引用得不稳', '已覆盖且被引用']) {
      expect(raw, `「${label}」来自 /vocabulary.gapTypes，抄进 TS 就是下一次对不上的来源`).not.toContain(label)
    }
    // GeoOpportunityActions.labels()
    for (const label of ['新建一页', '加一条问答', '写一篇文章', '加一个案例']) {
      expect(raw).not.toContain(label)
    }
    // GeoOpportunityStates.labels()
    for (const label of ['还没动', '已出草稿', '已放弃']) {
      expect(raw).not.toContain(label)
    }
    // 「已发布」是 PUBLISHED 的中文：界面唯一能说它的地方是念接口回来的 label，勾选句与回执都不许带
    expect(raw).not.toContain('已发布')
  })

  it('§5 禁令：这一族文件里不出现「排名」那个词，位置只念词表给的 positionLabel', () => {
    expect(allCode()).not.toContain('排名')
    expect(allCode()).toContain('positionLabel')
  })

  it('状态英文 key 也没有被就地映射成中文常量（映射表在后端 GeoRunStatuses / GeoOpportunityStates / GeoGapTypes）', () => {
    expect(
      new RegExp(
        '(PENDING|RUNNING|SUCCEEDED|PARTIAL|FAILED|OPEN|DRAFTED|PUBLISHED|DISMISSED'
        + '|NOT_COVERED|COVERED_NOT_CITED|CITED_BELOW|COVERED_CITED)\\s*:\\s*[\'"][^\'"]*[\u4e00-\u9fa5]',
      ).test(allCode()),
    ).toBe(false)
  })

  it('请求路径没有多余的 /api 前缀（axios baseURL 已经带 /api）', () => {
    expect([...allCode().matchAll(/['"`]\/api\/[^'"`\n]*['"`]/g)].map((match) => match[0])).toEqual([])
  })

  it('指标口径句子不在前端写死：视图只念接口那一行自带的 definition', () => {
    // §5 的单源：口径句子跟着数据走。视图里出现「= 被提及次数 / 成功回答数」这类手写公式就是第二份。
    const views = Object.entries(scanned)
      .filter(([path]) => path.includes('.vue'))
      .map(([, text]) => text)
      .join('\n')
    expect(views).not.toMatch(/分子\s*[=＝]/)
    expect(views).toContain('row.definition')
  })
})
