import { computed, ref, type ComputedRef, type Ref } from 'vue'
import {
  briefGenerationApi,
  candidateStatusTerminal,
  formatWaitMs,
  type BriefCandidateProgress
} from '@/api/siteBriefs'

/**
 * 「一趟出方案」的等待机（M-P33 批 C）：一条腿听后端推送，另一条腿自己按时读一眼。
 *
 * 为什么只有这一份实现：向导第 3/4 步和候选画廊说的是同一趟的同一份读数，
 * 两条腿的形状（什么时候听、什么时候收、听不到怎么办）必须一模一样，
 * 抄第二份就会有一处先改一处后改——界面上「在跑」和「已经停了」两句话打架。
 *
 * 三条形状要说死：
 * 1. **读数出口仍然只有一个**：流里推的就是 `progress` 那一份数组，这里不另算字段、
 *    也不开第二支读口（M-P16 #248：两支口对同一趟只许有一份真相）。
 * 2. **只在真有待可等的时候听**：全部进终态就收流停表，不许挂一条永不结束的流；
 *    人离开这一步、换了需求单、页面卸载也都收。
 * 3. **听不到不装死**：浏览器没有 EventSource，或者那条流出错，就当面退回轮询，
 *    `sourceLine` 跟着换成轮询那句话——不许写着「推送」而其实在轮询。
 */

/** 退到轮询那条腿时读一眼的间隔：比后端流的 2 秒缓，但比人的耐心快 */
export const PROGRESS_POLL_MS = 5000

export type ProgressTransport = 'idle' | 'sse' | 'poll'

export interface ProposalProgressFollower {
  /** 每套一行，就是 `progress` 口的原样 */
  rows: Ref<BriefCandidateProgress[]>
  /** 读这一眼失败时的原文；空串表示没有错 */
  error: Ref<string>
  transport: Ref<ProgressTransport>
  /** 这一轮里还有没有没进终态的套 */
  inFlight: ComputedRef<boolean>
  /** 界面上那一行「进度是怎么来的」：说真在用的那一条腿 */
  sourceLine: ComputedRef<string>
  /** 读一眼，并决定要不要接着听 */
  load: () => Promise<void>
  stop: () => void
  /** 逐套那一格「等了多久」 */
  waitLineOf: (row: BriefCandidateProgress) => string
}

export function createProposalProgressFollower(options: {
  /** 当前需求单 id；取不到就不读不听 */
  briefId: () => number | null
  /** 一整轮进终态时再重读一次的那些外围读数（画廊重读候选列表、向导重读步序条） */
  onSettled?: () => void
}): ProposalProgressFollower {
  const rows = ref<BriefCandidateProgress[]>([])
  const error = ref('')
  const transport = ref<ProgressTransport>('idle')
  let source: EventSource | null = null
  let pollTimer: ReturnType<typeof setInterval> | null = null

  const inFlight = computed(() => rows.value.some(row => !candidateStatusTerminal(row.status)))

  function stop() {
    if (source) {
      source.close()
      source = null
    }
    if (pollTimer) {
      clearInterval(pollTimer)
      pollTimer = null
    }
    transport.value = 'idle'
  }

  /** 后端推来的那一份就是 progress 那一个数组；解析不动就等下一眼，不改读数 */
  function applyStreamedRows(raw: string) {
    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) rows.value = parsed as BriefCandidateProgress[]
    } catch {
      // 这一格坏了一趟不改读数：下一眼（流里的下一次或轮询那一次）照旧
    }
  }

  function settle() {
    stop()
    options.onSettled?.()
  }

  function startPolling() {
    if (pollTimer || options.briefId() === null) return
    transport.value = 'poll'
    pollTimer = setInterval(async () => {
      await load()
      // 这一条腿没有对岸发的 complete，只能自己认终态
      if (!inFlight.value) settle()
    }, PROGRESS_POLL_MS)
  }

  function startStreaming() {
    const id = options.briefId()
    if (source || id === null) return
    const created = briefGenerationApi.streamProgress(id)
    source = created
    transport.value = 'sse'
    created.addEventListener('progress', event => applyStreamedRows((event as MessageEvent).data ?? ''))
    created.addEventListener('complete', event => {
      applyStreamedRows((event as MessageEvent).data ?? '')
      settle()
    })
    created.addEventListener('error', () => {
      // EventSource 断了它会自己重连，但这一头不赌：当场换腿走轮询，界面上那句话跟着换
      if (!source) return
      stop()
      startPolling()
    })
  }

  function follow() {
    if (options.briefId() === null || !inFlight.value) {
      stop()
      return
    }
    if (transport.value !== 'idle') return
    if (typeof EventSource === 'undefined') {
      startPolling()
      return
    }
    startStreaming()
  }

  async function load() {
    const id = options.briefId()
    if (id === null) {
      rows.value = []
      error.value = ''
      return
    }
    try {
      // 进门不清空：轮询那一闪「没有数据」会把「正在跑」演成「停了」
      rows.value = (await briefGenerationApi.progress(id)) || []
      error.value = ''
    } catch (err) {
      rows.value = []
      error.value = err instanceof Error ? err.message : String(err)
    }
    follow()
  }

  const sourceLine = computed(() => {
    if (transport.value === 'sse') {
      return '进度是后端推过来的（那一趟跑完这边当场重读一次外围读数）；每一套已经等了多久是后端算好的读数。'
    }
    if (transport.value === 'poll') {
      return '这条推送没接上（或这个浏览器没有推送），所以这一页每 5 秒自己读一眼那一条进度 GET：读的是同一个出口，没有第二套数。'
    }
    return inFlight.value
      ? '这一轮还在跑，但进度这一眼还没读回来，所以现在既没在听推送也没在轮询。'
      : '这一轮没有要等的东西（要么还没开始，要么都已经进终态），所以这里不留任何会动的读数。'
  })

  /** 进终态就明确说不念了：后端那一格在终态回的是 null，不是 0 秒 */
  function waitLineOf(row: BriefCandidateProgress): string {
    if (candidateStatusTerminal(row.status)) return '这一套已进终态，不再念等了'
    return formatWaitMs(row.stageWaitMs)
  }

  return { rows, error, transport, inFlight, sourceLine, load, stop, waitLineOf }
}
