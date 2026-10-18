import { beforeEach, describe, expect, it, vi } from 'vitest'
import { briefGenerationApi, showcaseBatchLineOf } from '@/api/siteBriefs'
import {
  PROGRESS_POLL_MS,
  createProposalProgressFollower
} from '@/utils/proposalProgressFollow'

/**
 * 等待机（M-P33 批 C / #340）——向导第 3、4 步与候选画廊共用这一份，所以判据也只在这一处钉死。
 *
 * 要钉的五件事，一件都比「界面好不好看」重要：
 * 1. **全进终态就不许留任何会动的读数**：不开流、不起表。挂一条永不结束的流与一只不停问的表，
 *    等于让十个开着的画廊页面替平台打十个无用请求。
 * 2. **读数出口只有一个**：流里推的那一份就是 `progress` 那一个数组；这台机器自己不发第三种请求。
 * 3. **接不上就当面换腿**：浏览器没有 EventSource、或者那条流报错，退成轮询，
 *    并且界面上那一行「进度是怎么来的」要跟着换——写着「推送」而其实在轮询就是谎报。
 * 4. **跑完要重读外围读数**：complete（或轮询自己认出的终态）之后 onSettled 必须被叫到，
 *    否则画廊的预览状态与向导的步序条停在跑之前那一份。
 * 5. **轮询不许把「正在跑」闪成「停了」**：读的那一眼期间旧读数得留着。
 *
 * 桩的形状照后端 SSE 口抄（`SiteProposalController.streamProgress`）：事件名 connected/progress/complete/error，
 * progress 与 complete 的 data 就是 `orchestrator.progress(id)` 那一份的 JSON。
 */

/**
 * 只替这两支出网的读口，`candidateStatusTerminal`／`formatWaitMs` 用真那份：
 * 这两支是「一个词只指一个东西」的那一份出处，桩掉它们就等于把判据换成我自己写的第二套说法。
 */
vi.mock('@/api/siteBriefs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/siteBriefs')>()
  return {
    ...actual,
    briefGenerationApi: {
      ...actual.briefGenerationApi,
      progress: vi.fn(),
      streamProgress: vi.fn()
    }
  }
})

class FakeEventSource {
  static opened: FakeEventSource[] = []
  closed = false
  readonly events: Record<string, ((event: { data?: string }) => void)[]> = {}

  constructor(readonly url: string) {
    FakeEventSource.opened.push(this)
  }

  addEventListener(name: string, handler: (event: { data?: string }) => void) {
    (this.events[name] ||= []).push(handler)
  }

  removeEventListener(name: string) {
    delete this.events[name]
  }

  close() {
    this.closed = true
  }

  emit(name: string, rows?: unknown[]) {
    (this.events[name] || []).forEach(handler => {
      handler({ data: rows === undefined ? '' : JSON.stringify(rows) })
    })
  }

  get listening() {
    return Object.keys(this.events)
  }
}

function running(overrides: Record<string, unknown> = {}) {
  return {
    candidateId: 71, siteId: 31, candidateNo: 1, attempt: 1,
    status: 'running', statusLabel: '进行中', stage: 'build', stageLabel: '生成页面',
    stageWaitMs: 95000, ...overrides
  }
}

function succeeded(overrides: Record<string, unknown> = {}) {
  return { ...running(), status: 'succeeded', statusLabel: '已完成', stageWaitMs: null, ...overrides }
}

function setup(briefIdValue: number | null = 12) {
  const settled = vi.fn()
  const follower = createProposalProgressFollower({ briefId: () => briefIdValue, onSettled: settled })
  return { follower, settled }
}

beforeEach(() => {
  vi.useFakeTimers()
  FakeEventSource.opened = []
  vi.mocked(briefGenerationApi.progress).mockReset()
  vi.mocked(briefGenerationApi.streamProgress).mockReset()
  // 默认给一条假流：没设这一份的用例走的是「根本不该开流」那一支，靠计数判；
  // 而「在跑所以开流」那几支要的是一条真能收事件的流，形状照后端 SSE 口
  vi.mocked(briefGenerationApi.streamProgress).mockImplementation(() => new FakeEventSource('stream') as never)
  vi.stubGlobal('EventSource', FakeEventSource)
})

describe('出方案进度的等待机', () => {
  it('① 一整轮都进终态：不开流、不起表，那一行话也明说没有要等的东西', async () => {
    vi.mocked(briefGenerationApi.progress).mockResolvedValue([succeeded()] as never)
    const { follower } = setup()

    await follower.load()

    expect(follower.rows.value).toHaveLength(1)
    expect(follower.inFlight.value).toBe(false)
    expect(briefGenerationApi.streamProgress).not.toHaveBeenCalled()
    expect(FakeEventSource.opened).toHaveLength(0)
    expect(follower.transport.value).toBe('idle')
    expect(follower.sourceLine.value).toContain('没有要等的东西')
    expect(follower.sourceLine.value).not.toContain('推送')

    await vi.advanceTimersByTimeAsync(PROGRESS_POLL_MS * 3)
    expect(briefGenerationApi.progress).toHaveBeenCalledTimes(1)
  })

  it('② 还在跑：开一条流，progress 事件把后端推的那一份原样换上（读数出口仍然只有 progress 那一条 GET）', async () => {
    vi.mocked(briefGenerationApi.progress).mockResolvedValue([running()] as never)
    const { follower } = setup()

    await follower.load()

    expect(briefGenerationApi.streamProgress).toHaveBeenCalledTimes(1)
    expect(briefGenerationApi.progress).toHaveBeenCalledTimes(1)
    expect(follower.transport.value).toBe('sse')
    expect(follower.sourceLine.value).toContain('后端推过来')
    const source = FakeEventSource.opened[0]
    expect(source.listening.sort()).toEqual(['complete', 'error', 'progress'])

    source.emit('progress', [running({ stage: 'demo', stageLabel: '演示内容', stageWaitMs: 12000 })])
    expect(follower.rows.value[0].stageLabel).toBe('演示内容')
    expect(follower.waitLineOf(follower.rows.value[0])).toBe('约 12 秒')

    // 事件名之外的东西一概不认：这一头只吃后端那三个名字
    source.emit('connected')
    expect(follower.rows.value).toHaveLength(1)

    await vi.advanceTimersByTimeAsync(PROGRESS_POLL_MS * 2)
    expect(briefGenerationApi.progress).toHaveBeenCalledTimes(1)
  })

  /**
   * 「演示内容」那一格里面的批号四格走的是<b>同一条腿</b>（M-P35-2）：后端在流里推的还是
   * `progress` 那一份数组，等待机只许原样换上屏——它自己裁字段或另算一套批号，向导与画廊
   * 就会对同一趟念出两个不同的「第几批」。这里钉的是这一趟没有第二把读数。
   */
  it('②b 流里推来的批号四格原样落进读数，等待机一个字段都不裁', async () => {
    vi.mocked(briefGenerationApi.progress).mockResolvedValue([running()] as never)
    const { follower } = setup()
    await follower.load()
    const source = FakeEventSource.opened[0]

    source.emit('progress', [running({
      stage: 'demo',
      stageLabel: '演示内容',
      showcaseBatchIndex: 5,
      showcaseBatchTotal: 7,
      showcaseBatchLabel: '经营指标',
      showcaseBatchWaitMs: 26_000,
      showcaseBatchState: 'skipped',
      showcaseBatchStateLabel: '没写成'
    })])

    const row = follower.rows.value[0]
    expect(row.showcaseBatchIndex).toBe(5)
    expect(row.showcaseBatchTotal).toBe(7)
    expect(row.showcaseBatchLabel).toBe('经营指标')
    expect(row.showcaseBatchWaitMs).toBe(26_000)
    // M-P37 那两格也在同一条腿上：等待机裁掉它，那一格就永远念不出「上一批没写成」
    expect(row.showcaseBatchState).toBe('skipped')
    expect(row.showcaseBatchStateLabel).toBe('没写成')
    // 「这一批等了多久」与「这一步等了多久」是两个数，谁也不许顶替谁
    expect(follower.waitLineOf(row)).toBe('约 1 分 35 秒')
    expect(showcaseBatchLineOf(row)).toBe('这一格里分批在写：第 5/7 批 · 经营指标 · 这一批已经等了 约 26 秒 · 上一批：没写成')
  })

  it('③ complete 一到就收流，并且把外围读数重读一次（画廊的预览状态、向导的步序条都靠这一下）', async () => {
    vi.mocked(briefGenerationApi.progress).mockResolvedValue([running()] as never)
    const { follower, settled } = setup()
    await follower.load()
    const source = FakeEventSource.opened[0]

    source.emit('complete', [succeeded()])

    expect(source.closed).toBe(true)
    expect(follower.transport.value).toBe('idle')
    expect(follower.rows.value[0].status).toBe('succeeded')
    expect(settled).toHaveBeenCalledTimes(1)
  })

  it('④ 浏览器没有 EventSource：当面退回每 5 秒读一眼那一条 GET，读到全终态自己收摊', async () => {
    vi.stubGlobal('EventSource', undefined)
    vi.mocked(briefGenerationApi.progress)
      .mockResolvedValueOnce([running()] as never)
      .mockResolvedValueOnce([running()] as never)
      .mockResolvedValueOnce([succeeded()] as never)
    const { follower, settled } = setup()

    await follower.load()

    expect(briefGenerationApi.streamProgress).not.toHaveBeenCalled()
    expect(follower.transport.value).toBe('poll')
    // 这一句必须是轮询那句：接不上推送却写着推送，界面就在说谎
    expect(follower.sourceLine.value).toContain('每 5 秒自己读一眼')
    expect(follower.sourceLine.value).not.toContain('进度是后端推过来的')

    await vi.advanceTimersByTimeAsync(PROGRESS_POLL_MS)
    expect(briefGenerationApi.progress).toHaveBeenCalledTimes(2)

    await vi.advanceTimersByTimeAsync(PROGRESS_POLL_MS)
    expect(briefGenerationApi.progress).toHaveBeenCalledTimes(3)
    expect(follower.transport.value).toBe('idle')
    expect(settled).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(PROGRESS_POLL_MS * 2)
    expect(briefGenerationApi.progress).toHaveBeenCalledTimes(3)
  })

  it('⑤ 那条流出错：换腿走轮询，那一行话跟着换成轮询那句', async () => {
    vi.mocked(briefGenerationApi.progress).mockResolvedValue([running()] as never)
    const { follower } = setup()
    await follower.load()
    const source = FakeEventSource.opened[0]

    source.emit('error')

    expect(source.closed).toBe(true)
    expect(follower.transport.value).toBe('poll')
    expect(follower.sourceLine.value).toContain('每 5 秒自己读一眼')
    expect(FakeEventSource.opened).toHaveLength(1)

    await vi.advanceTimersByTimeAsync(PROGRESS_POLL_MS)
    expect(briefGenerationApi.progress).toHaveBeenCalledTimes(2)
  })

  it('⑥ 读这一眼失败：错误原文挂出来，不静默、也不开流', async () => {
    vi.mocked(briefGenerationApi.progress).mockRejectedValue(new Error('502 网关没通'))
    const { follower } = setup()

    await follower.load()

    expect(follower.error.value).toBe('502 网关没通')
    expect(follower.rows.value).toEqual([])
    expect(briefGenerationApi.streamProgress).not.toHaveBeenCalled()
  })

  it('⑦ 读的那一眼还在路上时旧读数留着：轮询不许把「正在跑」闪成「停了」', async () => {
    // 用数组装着那一发的放行把手：局部变量会被 TS 按控制流窄成 null，而它明明是回调里赋的
    const release: (() => void)[] = []
    vi.mocked(briefGenerationApi.progress)
      .mockResolvedValueOnce([running()] as never)
      .mockImplementationOnce(() => new Promise(resolve => {
        release.push(() => resolve([running({ stageWaitMs: 20000 })] as never))
      }))
    const { follower } = setup()
    await follower.load()
    expect(follower.rows.value[0].stage).toBe('build')

    const pending = follower.load()
    expect(follower.rows.value).toHaveLength(1)

    release[0]()
    await pending
    expect(follower.rows.value[0].stageWaitMs).toBe(20000)
  })

  it('⑧ 流里那一格坏了（不是数组 / 解析不动）：原样等下一眼，不改读数', async () => {
    vi.mocked(briefGenerationApi.progress).mockResolvedValue([running()] as never)
    const { follower } = setup()
    await follower.load()
    const source = FakeEventSource.opened[0]

    source.events.progress.forEach(handler => handler({ data: '{不是 JSON' }))
    expect(follower.rows.value[0].stage).toBe('build')

    source.events.progress.forEach(handler => handler({ data: JSON.stringify({ candidates: [] }) }))
    expect(follower.rows.value[0].stage).toBe('build')

    source.emit('progress', [running({ stage: 'screenshot' })])
    expect(follower.rows.value[0].stage).toBe('screenshot')
  })

  it('⑨ 换需求单与离开页面都收流：不许在后台替一个不在看的页面一直读', async () => {
    vi.mocked(briefGenerationApi.progress).mockResolvedValue([running()] as never)
    const { follower } = setup()
    await follower.load()
    const source = FakeEventSource.opened[0]

    follower.stop()

    expect(source.closed).toBe(true)
    expect(follower.transport.value).toBe('idle')
    await vi.advanceTimersByTimeAsync(PROGRESS_POLL_MS * 2)
    expect(briefGenerationApi.progress).toHaveBeenCalledTimes(1)
  })

  it('⑩ 时长那一格：终态明说不念了，后端没回那一说「不是 0 秒」而不是念 0', () => {
    const { follower } = setup()
    expect(follower.waitLineOf(succeeded({ stageWaitMs: 0 }))).toBe('这一套已进终态，不再念等了')
    expect(follower.waitLineOf(running({ stageWaitMs: null }))).toBe('后端这一发没回时长读数（不是 0 秒）')
    expect(follower.waitLineOf(running({ stageWaitMs: 95000 }))).toBe('约 1 分 35 秒')
    expect(follower.waitLineOf(running({ stageWaitMs: 3_900_000 }))).toBe('约 1 小时 5 分')
  })

  it('⑪ 没有需求单 id：既不读也不听，读数清空', async () => {
    const { follower } = setup(null)
    await follower.load()
    expect(briefGenerationApi.progress).not.toHaveBeenCalled()
    expect(briefGenerationApi.streamProgress).not.toHaveBeenCalled()
    expect(follower.rows.value).toEqual([])
  })
})
