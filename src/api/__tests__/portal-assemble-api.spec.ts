import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * AI 整站组装接口（Spec §6.3 / Q3，决策 N4）的三类契约：
 * 1. 请求形状——路径不带 /api；estimate 一发不带任何 body（它的验收点就是「不调模型」）；
 *    run 的 confirm 是调用方传进来的那一个布尔值，前端不许有「默认 true」的写法；
 *    apply-page 一次只带一个 pageId，接口层面就不存在批量应用这个口子；
 * 2. 钱的口径——draftRowState 把「没产出草稿 / 被门禁拒 / 已应用 / 可应用」分得开：
 *    这是给超管交代「这一页到底花没花钱」用的，混着说就是在替后端撒谎；
 * 3. I-1 单源——状态中文说法不许在这两个新文件里出现第二份。
 */

const httpMock = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }))

vi.mock('../http', () => ({ default: httpMock, AI_REQUEST_TIMEOUT: 180000 }))

import {
  ASSEMBLE_RUN_TIMEOUT,
  assembleIsSettled,
  assembleTokensUsed,
  draftRowState,
  portalAssembleApi,
  type AssembleDraftRow
} from '../portalAssemble'

function draftRow(overrides: Partial<AssembleDraftRow> = {}): AssembleDraftRow {
  return {
    pageId: 41,
    draftId: 88,
    pageKey: 'about',
    title: '关于我们',
    rejected: false,
    error: null,
    warnings: [],
    applied: false,
    ...overrides
  }
}

/** 取某把 spy 的最后一次调用：target 是 ES2020，没有 Array.prototype.at 可用 */
function lastCall(spy: { mock: { calls: unknown[][] } }): unknown[] {
  const calls = spy.mock.calls
  return calls[calls.length - 1] || []
}

beforeEach(() => {
  httpMock.get.mockReset()
  httpMock.post.mockReset()
  httpMock.get.mockResolvedValue([])
  httpMock.post.mockResolvedValue({})
})

describe('组装任务的路径与 body', () => {
  it('词表与列表都是 /admin 下的口，路径不带 /api，列表按站点过滤且不传 tenantId', async () => {
    await portalAssembleApi.statusLabels()
    expect(httpMock.get).toHaveBeenLastCalledWith('/admin/portal/assemble-jobs/statuses')

    await portalAssembleApi.list(7)
    expect(httpMock.get).toHaveBeenLastCalledWith('/admin/portal/assemble-jobs', { params: { siteId: 7 } })
    // 租户归属只由后端从登录态推：这里塞 tenantId 等于把越权做成一个可点的选项
    expect(JSON.stringify(lastCall(httpMock.get))).not.toContain('tenantId')
  })

  it('建任务只带（站点、骨架、参考站），没有 confirm 也没有 body 级的 tenantId', async () => {
    await portalAssembleApi.create({ siteId: 7, skeletonKey: 'some-set', referenceSiteId: null })
    expect(httpMock.post).toHaveBeenLastCalledWith('/admin/portal/assemble-jobs', {
      siteId: 7,
      skeletonKey: 'some-set',
      referenceSiteId: null
    })
    const body = lastCall(httpMock.post)[1] as Record<string, unknown>
    expect(body).not.toHaveProperty('confirm')
    expect(body).not.toHaveProperty('tenantId')
  })

  it('estimate 一发不带 body：这一步的验收点是「一次模型都不调」', async () => {
    await portalAssembleApi.estimate(12)
    expect(httpMock.post).toHaveBeenLastCalledWith('/admin/portal/assemble-jobs/12/estimate')
    // 带第二个参数就意味着有人开始往出价里塞 confirm
    expect(lastCall(httpMock.post).length).toBe(1)
    expect(JSON.stringify(httpMock.post.mock.calls)).not.toContain('confirm')
  })

  it('run 的 confirm 原样是调用方给的那个布尔值，false 不会被偷偷改成 true', async () => {
    await portalAssembleApi.run(12, false)
    expect(httpMock.post).toHaveBeenLastCalledWith(
      '/admin/portal/assemble-jobs/12/run',
      { confirm: false },
      { timeout: ASSEMBLE_RUN_TIMEOUT }
    )

    await portalAssembleApi.run(12, true)
    expect(httpMock.post).toHaveBeenLastCalledWith(
      '/admin/portal/assemble-jobs/12/run',
      { confirm: true },
      { timeout: ASSEMBLE_RUN_TIMEOUT }
    )
    // 出价与组装是两次请求，谁都没办法一次点完全套（后端 ASSEMBLE_CONFIRM_REQUIRED 判的就是这个）
    expect(httpMock.post.mock.calls).toHaveLength(2)
    // 第三个参数只能是超时：不许有人往组装里再塞别的 body 字段
    expect(lastCall(httpMock.post).slice(2)).toEqual([{ timeout: ASSEMBLE_RUN_TIMEOUT }])
  })

  it('组装这一发的超时比默认 30s 宽：后端还在逐页花钱时不许前端先挂电话', () => {
    expect(ASSEMBLE_RUN_TIMEOUT).toBeGreaterThanOrEqual(600000)
  })

  it('详情按 id 读，产出与任务行一起回来', async () => {
    await portalAssembleApi.detail(12)
    expect(httpMock.get).toHaveBeenLastCalledWith('/admin/portal/assemble-jobs/12')
  })

  it('apply-page 一次只带一页，接口里没有批量应用这个口子', async () => {
    await portalAssembleApi.applyPage(12, 41)
    expect(httpMock.post).toHaveBeenLastCalledWith('/admin/portal/assemble-jobs/12/apply-page', { pageId: 41 })

    // 唯一的写出口就是逐页那一个；出现 applyAll / publish 之类就说明有人把「见客」做成了批量
    const writeNames = Object.keys(portalAssembleApi).filter(name => /apply|publish|online|ship/.test(name))
    expect(writeNames).toEqual(['applyPage'])
  })

  it('回滚只按任务 id 发一发，回执是页数', async () => {
    httpMock.post.mockResolvedValueOnce(3)
    await expect(portalAssembleApi.rollbackAll(12)).resolves.toBe(3)
    expect(httpMock.post).toHaveBeenLastCalledWith('/admin/portal/assemble-jobs/12/rollback-all')
  })
})

describe('草稿行的四种落点分得开', () => {
  it('draftId 为空是没产出草稿，不是被门禁拒', () => {
    expect(draftRowState(draftRow({ draftId: null }))).toBe('no-draft')
    expect(draftRowState(draftRow({ draftId: null, rejected: true, pageId: null }))).toBe('no-draft')
  })

  it('有草稿但 rejected 是被门禁拒：这一页的钱花了，界面上不能写成「没干活」', () => {
    expect(draftRowState(draftRow({ rejected: true }))).toBe('rejected')
  })

  it('已应用优先于可应用：只有点过应用才为真，且只有第四种允许再点', () => {
    expect(draftRowState(draftRow({ applied: true }))).toBe('applied')
    expect(draftRowState(draftRow())).toBe('applicable')
  })

  it('落定状态只认后端那三个终态 key，别的值一律按「还没落定」处理', () => {
    expect(assembleIsSettled('done')).toBe(true)
    expect(assembleIsSettled('needs_human')).toBe(true)
    expect(assembleIsSettled('failed')).toBe(true)
    expect(assembleIsSettled('pending')).toBe(false)
    expect(assembleIsSettled('estimating')).toBe(false)
    expect(assembleIsSettled(null)).toBe(false)
    // 后端新增的状态不许被前端当成终态自己吞掉
    expect(assembleIsSettled('reviewing')).toBe(false)
  })

  it('实耗 token：没跑过是 null，跑了 0 个是 0——这两种在界面上必须说得出来', () => {
    expect(assembleTokensUsed({ promptTokens: null, completionTokens: null })).toBeNull()
    expect(assembleTokensUsed({ promptTokens: undefined, completionTokens: undefined })).toBeNull()
    expect(assembleTokensUsed({ promptTokens: 0, completionTokens: 0 })).toBe(0)
    expect(assembleTokensUsed({ promptTokens: 1200, completionTokens: 800 })).toBe(2000)
  })
})

/**
 * 扫这两个新文件（Q3 新写的那两个）：把源码当文本读回来，逐条对单源纪律。
 * 用 basename 自己过滤，不要写死 import.meta.glob 的键数——VTU 的 glob 会把 `../portalAssemble.ts`
 * 解析成绝对路径，写死的键名永远匹配不上（真匹配不上时下面两条会静默通过，那比红灯更糟）。
 */
const scanned = import.meta.glob(['../portalAssemble.ts', '../../views/portal/AssembleJobView.vue'], {
  eager: true,
  query: '?raw',
  import: 'default'
}) as Record<string, string>

/** 按路径片段挑文件（第二个参数是「必须命中几条」，命不中就抛错，绝不让扫描空转） */
function readSources(include: string, expected: number): string {
  const hits = Object.entries(scanned).filter(([path]) => path.includes(include))
  if (hits.length !== expected) {
    throw new Error(`源码扫描没命中「${include}」：找到 ${hits.length} 个，应有 ${expected} 个`)
  }
  return hits.map(([, text]) => text).join('\n')
}

const scannedNames = Object.keys(scanned).map(path => path.split(/[\\/]/).pop() as string).sort()

describe('I-1：前端不抄第二份词表', () => {
  it('扫到的就是这两个新文件（文件名写错时这里先红，别指望后面几条）', () => {
    expect(scannedNames).toEqual(['AssembleJobView.vue', 'portalAssemble.ts'])
  })

  it('没有组装状态的中文第二份来源（说法只有 /admin/portal/assemble-jobs/statuses）', () => {
    const raw = readSources('portalAssemble.ts', 1) + readSources('AssembleJobView.vue', 1)
    for (const label of ['待开始', '已出价', '正在组装', '待人工', '已产出草稿']) {
      expect(raw, `这两个文件里不该出现「${label}」这个词：它来自后端词表`).not.toContain(label)
    }
  })

  it('后端的状态 key 也没有被映射成任何中文常量', () => {
    const raw = readSources('portalAssemble.ts', 1) + readSources('AssembleJobView.vue', 1)
    expect(new RegExp('(pending|estimating|running|needs_human|done|failed)\\s*:\\s*[\'"]').test(raw)).toBe(false)
  })

  it('骨架状态的中文说法也没抄（那份归骨架库自己的端点）', () => {
    const view = readSources('AssembleJobView.vue', 1)
    expect(view).not.toMatch(/['"](已发布|已退役|草稿)['"]/)
  })

  it('请求路径里没有多余的 /api 前缀（axios baseURL 已经带 /api）', () => {
    const source = readSources('portalAssemble.ts', 1)
    expect([...source.matchAll(/['"`]\/api\/[^'"`]*['"`]/g)].map(match => match[0])).toEqual([])
  })
})
