import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import SiteProposalOverviewView from '../SiteProposalOverviewView.vue'
import { briefGenerationApi } from '../../../api/siteBriefs'

/**
 * 超管侧「建站任务总览」（Spec-M §10.44 拍板 ⑩，M-P33 批 D）。
 *
 * 这一页的风险不在排版，在<b>说谎的形状</b>，所以用例逐条钉的是：
 * 1. 读不到一律露空，不许补 0：`roundElapsedMs` / `stageWaitMs` 为 null 时念的是「后端这一发没回」；
 *    0 秒说的是「刚开跑」，与「没读到」不是一件事（批 C 同一条纪律）。
 * 2. 已进终态的那一套不再念「等了多久」——后端把那一格还给 null 了。
 * 3. 阶段、状态两格只念后端给的原话（`stageLabel`/`statusLabel`/`briefStatusLabel`），界面不抄第三份词表。
 *    字段名本身也是判据：需求单那一格的真名是 `briefStatusLabel`，写成 `statusLabel` 时它会永远念「没回」，
 *    而单测里塞的是自己写的桩，只有真按键取值才测得出来——所以下面专门钉一次。
 * 4. 这一页一个字都不写：除了刷新与「进这一单的向导」，不许出现任何启动/取消/补跑类把手。
 * 5. 只有「真读到空列表」才许说「今天没人点」；读失败那一趟不许顺手把空态摆出来。
 * 6. 表只有「真有东西在跑」时才续；读到全空必须自己停表（不许挂一条永远在打的读）。
 */

const pushSpy = vi.fn()

// 页面第一行标题是 <PageTitle />，它读的是 route.meta.title；这一格不给就等于把标题渲没了，
// 而 useRouter 要留自己的 spy，所以只替这两个钩子，其余仍用真模块。
vi.mock('vue-router', async importOriginal => {
  const actual = await importOriginal<Record<string, any>>()
  return {
    ...actual,
    useRoute: () => ({ meta: { title: '建站任务总览' }, query: {}, params: {} }),
    useRouter: () => ({ push: pushSpy })
  }
})

vi.mock('../../../api/http', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() }
}))

vi.mock('../../../api/siteBriefs', async importOriginal => {
  const actual = await importOriginal<Record<string, any>>()
  return {
    ...actual,
    briefGenerationApi: { overview: vi.fn(), progress: vi.fn(), streamProgress: vi.fn() }
  }
})

/** a-card/a-alert 用真实插槽（标题与 message 槽都要读得到），FoldedText 只要把 raw 露出来 */
const CARD_STUB = defineComponent({
  name: 'ACard',
  props: { title: { type: String, default: '' }, size: { type: String, default: '' } },
  setup(props: any, { slots }: any) {
    return () => h('section', { class: 'card-stub', 'data-title': props.title }, [
      h('h3', props.title),
      slots.title ? slots.title() : null,
      slots.default ? slots.default() : null
    ])
  }
})

const ALERT_STUB = defineComponent({
  name: 'AAlert',
  props: { type: { type: String, default: '' }, message: { type: String, default: '' } },
  setup(props: any, { slots }: any) {
    return () => h('div', { class: 'alert-stub', 'data-type': props.type }, [
      slots.message ? slots.message() : props.message,
      slots.default ? slots.default() : null
    ])
  }
})

const TAG_STUB = { name: 'ATag', props: ['color'], template: '<span class="tag-stub"><slot /></span>' }
const SPACE_STUB = { name: 'ASpace', template: '<div class="space-stub"><slot /></div>' }
const BUTTON_STUB = { name: 'AButton', props: ['loading', 'size', 'type'], template: '<button><slot /></button>' }
const FOLDED_STUB = {
  name: 'FoldedText',
  props: ['raw', 'summary', 'rawLabel', 'tone'],
  template: '<div class="folded-stub">{{ raw }}</div>'
}

function mountView() {
  return mount(SiteProposalOverviewView, {
    global: {
      stubs: {
        'a-card': CARD_STUB,
        'a-alert': ALERT_STUB,
        'a-tag': TAG_STUB,
        'a-space': SPACE_STUB,
        'a-button': BUTTON_STUB,
        FoldedText: FOLDED_STUB
      }
    }
  })
}

const CANDIDATE_RUNNING = {
  candidateId: 26,
  candidateNo: 2,
  stage: 'copy',
  stageLabel: '逐页文案',
  status: 'running',
  statusLabel: '生成中',
  stageWaitMs: 336_000,
  stageLatencyNote: '这一阶段以往实测 18～183 秒（一发；不是预计剩余，也不代表这一发还要多久）。',
  promptTokens: 20_000,
  completionTokens: 7_786
}

const CANDIDATE_DONE = {
  candidateId: 25,
  candidateNo: 1,
  stage: 'done',
  stageLabel: '已完成',
  status: 'succeeded',
  statusLabel: '已产出',
  stageWaitMs: null,
  stageLatencyNote: '这一阶段没有 AI 外呼，等的是本地动作，给不出 AI 耗时区间。',
  promptTokens: 40_000,
  completionTokens: 23_226
}

const ROUND = {
  briefId: 555,
  tenantId: 326,
  tenantName: '示例租户',
  briefStatus: 'generating',
  briefStatusLabel: '方案生成中',
  attempt: 1,
  roundStartedAt: '2026-10-17T11:40:00',
  roundElapsedMs: 900_000,
  candidateTotal: 3,
  runningCount: 1,
  terminalCount: 1,
  waitingForPool: false,
  waitingLine: null,
  burnedTokens: 63_226,
  estimatedTokens: 216_277,
  candidates: [CANDIDATE_DONE, CANDIDATE_RUNNING],
  tenantBurn: { calls: 12, lines: ['这条建站链在这一家名下已经跑过 12 发外呼。'] }
}

/** 已受理、一套都没开始，而且没有归属租户（老数据真存在这一形） */
const ROUND_WAITING = {
  briefId: 556,
  tenantId: null,
  tenantName: null,
  briefStatus: 'generating',
  briefStatusLabel: '方案生成中',
  attempt: 1,
  roundStartedAt: '2026-10-17T12:00:00',
  roundElapsedMs: null,
  candidateTotal: 3,
  runningCount: 0,
  terminalCount: 0,
  waitingForPool: true,
  waitingLine:
    '这一单已受理、还没有一套开始跑（前面可能有别单占着那两条线程；出方案队列满了不当场排队，'
    + '而是当场中文拒绝并把这一轮标失败，所以这里不会有长长的队）。',
  burnedTokens: 0,
  estimatedTokens: 210_000,
  candidates: [],
  tenantBurn: null
}

const DRAFT = {
  briefId: 557,
  tenantId: 1,
  tenantName: '另一家',
  draftStatus: 'RUNNING',
  draftStatusLabel: '出初稿中（模型正在写这七段）',
  startedAt: '2026-10-17T12:05:00',
  waitMs: 20_000,
  errorMessage: null
}

const OVERVIEW = {
  runningRounds: 2,
  runningDrafts: 1,
  pools: [
    {
      name: '出方案',
      activeCount: 1,
      poolSize: 1,
      maxPoolSize: 2,
      queueSize: 0,
      queueCapacity: 5,
      line: '出方案池：本进程 1 条在跑（池 1/2），队列里还有 0 个任务（上限 5）。'
        + '这两个数只是这一个进程的瞬时快照，多实例部署时不代表全平台。'
    },
    {
      name: '说明书初稿',
      activeCount: 0,
      poolSize: 0,
      maxPoolSize: 1,
      queueSize: 1,
      queueCapacity: 2,
      line: '说明书初稿池：本进程 0 条在跑（池 0/1），队列里还有 1 个任务（上限 2）。'
        + '这两个数只是这一个进程的瞬时快照，多实例部署时不代表全平台。'
    }
  ],
  rounds: [ROUND, ROUND_WAITING],
  drafts: [DRAFT],
  note: '口径：这一页只读，不启动、不取消、不补跑任何东西；'
    + '「已跑多久」是从那一行开始跑的时刻算到现在，不是预计剩余。'
}

const EMPTY_OVERVIEW = {
  runningRounds: 0,
  runningDrafts: 0,
  pools: OVERVIEW.pools,
  rounds: [],
  drafts: [],
  note: OVERVIEW.note,
  // 拍板 ⑤：空态的成因是后端那一格带的码，界面只认它；这句话的唯一出处在后端，这里逐字抄一份
  emptyReason: 'NONE',
  emptyLine: '建站这一族：这一档查过了，一条都没有。'
}

/** 同一个空列表，成因换成「读不到」：选中的那个身份在这张表里根本没有行 */
const EMPTY_OVERVIEW_NOT_VISIBLE = {
  ...EMPTY_OVERVIEW,
  emptyReason: 'NOT_VISIBLE',
  emptyLine: '建站这一族：这一档读不到（选中的那个身份在这张表里没有行），所以这里不能说「没有」。'
}

/** 后端没回成因（老接口、或这一族只空了一半）：界面不替它猜一个 */
const EMPTY_OVERVIEW_NO_REASON = {
  ...EMPTY_OVERVIEW,
  emptyReason: null,
  emptyLine: null
}

beforeEach(() => {
  vi.clearAllMocks()
  pushSpy.mockReset()
  ;(briefGenerationApi.overview as any).mockResolvedValue({ ...OVERVIEW })
})

describe('建站任务总览（批 D 只读页）', () => {
  it('抬头、池子与口径那一行都只念后端给的原话', async () => {
    const wrapper = mountView()
    await flushPromises()

    // UIB-3 那条同源纪律：页标题就是菜单上那几个字，取自 route.meta.title，界面不许手抄第二份
    expect(wrapper.find('.page-title__text').text()).toBe('建站任务总览')
    expect(wrapper.text()).toContain('现在同时在跑 2 单出方案、1 份说明书初稿')
    expect(wrapper.text()).toContain('出方案池：本进程 1 条在跑（池 1/2），队列里还有 0 个任务（上限 5）')
    expect(wrapper.text()).toContain('这两个数只是这一个进程的瞬时快照')
    expect(wrapper.text()).toContain('这一页只读，不启动、不取消、不补跑任何东西')
    expect(briefGenerationApi.overview).toHaveBeenCalledTimes(1)
  })

  /** 后端那一格的组件名是 briefStatus/briefStatusLabel；这里按错名取值的话这一格会永远念「没回」 */
  it('需求单状态那一格读的是后端那个键的真名', async () => {
    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.findAll('.tag-stub').map(tag => tag.text())).toContain('方案生成中')
    expect(wrapper.text()).not.toContain('状态原码没回')
  })

  it('每一套的阶段状态等待区间四格都来自 progress 那一份读数', async () => {
    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.text()).toContain('逐页文案')
    expect(wrapper.text()).toContain('约 5 分 36 秒')
    expect(wrapper.text()).toContain('这一阶段以往实测 18～183 秒（一发；不是预计剩余')
    // 已进终态的那一套：后端把 stageWaitMs 还给 null，界面也不许自己算一个
    expect(wrapper.text()).toContain('这一套已进终态，不再念等了')
    expect(wrapper.text()).toContain('这一阶段没有 AI 外呼')
    // 这一套已烧 = prompt+completion 两个数相加（候选行的实报），不是字数尺那把
    expect(wrapper.text()).toContain('27786')
  })

  /**
   * 「演示内容」那一格<em>里面</em>正在写第几批（M-P35-2）。
   *
   * 这一页摆的这句话与向导、候选画廊是<b>同一份出处</b>（`showcaseBatchLineOf`）——同一趟在两个页面上
   * 一个说「第 3/7 批」一个不说，就是界面自己跟自己打架（I-1）。判据两边都要钉：批号在才摆，
   * 批号没回（终态那套、以及已受理还没开跑那一单）不许凭空摆出一行「第 ? 批」。
   */
  it('分批那一格：批号在就照那一份共享的句子摆，批号没回就不摆', async () => {
    ;(briefGenerationApi.overview as any).mockResolvedValue({
      ...OVERVIEW,
      rounds: [{
        ...ROUND,
        candidates: [{
          ...CANDIDATE_RUNNING,
          stage: 'demo',
          stageLabel: '演示内容',
          showcaseBatchIndex: 3,
          showcaseBatchTotal: 7,
          showcaseBatchLabel: '资质荣誉',
          showcaseBatchWaitMs: 40_000
        }, CANDIDATE_DONE]
      }, ROUND_WAITING]
    })

    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.text()).toContain('这一格里分批在写：第 3/7 批 · 资质荣誉 · 这一批已经等了 约 40 秒')
    // 手上只有一套真在分批：终态那一套与「还没开跑」那一单都不许跟着冒出一句
    expect(wrapper.text().match(/分批在写/g)).toHaveLength(1)
    expect(wrapper.text()).not.toContain('/? 批')
  })

  it('进度那一口没回行时说的是没回，而不是「没有候选」', async () => {
    ;(briefGenerationApi.overview as any).mockResolvedValue({
      ...OVERVIEW,
      rounds: [{ ...ROUND, candidates: [] }]
    })

    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.text()).toContain('进度那一口这一发没回行（读不到不等于没在跑，刷新重试才有）')
  })

  it('等待那一格念后端那句中文，没有归属租户的单露空而不编名字', async () => {
    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.text()).toContain('这一单已受理、还没有一套开始跑')
    expect(wrapper.text()).toContain('这一单没有归属租户')
    expect(wrapper.text()).not.toContain('未知租户')
  })

  /** 有 tenantId 但名字没查到（或那一家没填名）：露 id，不兜一个中文顶着 */
  it('租户名没查到时露 id 而不是编一个「未知租户」', async () => {
    ;(briefGenerationApi.overview as any).mockResolvedValue({
      ...OVERVIEW,
      rounds: [{ ...ROUND, tenantName: null }]
    })

    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.text()).toContain('#326')
    expect(wrapper.text()).not.toContain('未知租户')
  })

  it('整单没在跑那一步时不念已跑多久，也不补一个 0', async () => {
    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.text()).toContain('这一单已经没有在跑的那一步了，所以不念已跑多久')
    expect(wrapper.text()).toContain('63226 token（这一轮的候选行实报合计）')
    expect(wrapper.text()).toContain('约 15 分 0 秒')
  })

  it('这一页没有任何能启动、取消、补跑东西的把手', async () => {
    const wrapper = mountView()
    await flushPromises()

    const labels = wrapper.findAll('button').map(button => button.text())
    expect(labels).toContain('刷新')
    expect(labels).toContain('进这一单的向导')
    expect(labels.join('|')).not.toMatch(/开始出方案|收口重跑|取消|补跑|重发|发放|确认执行/)
  })

  it('进这一单的向导：带 briefId 回到出方案那一步', async () => {
    const wrapper = mountView()
    await flushPromises()

    const link = wrapper.findAll('button').find(button => button.text() === '进这一单的向导')
    link!.element.click()
    await flushPromises()

    expect(pushSpy).toHaveBeenCalledWith({
      path: '/workspace/portal/wizard',
      query: { step: 'generate', briefId: '555' }
    })
  })

  it('初稿那一格念自己的词表，并把已等的那个数说成人话', async () => {
    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.text()).toContain('出初稿中（模型正在写这七段）')
    expect(wrapper.text()).toContain('已等：约 20 秒')
    expect(wrapper.text()).not.toContain('RUNNING')
  })

  /** 读失败 ≠ 今天没人点：那一句话只在真读到空列表时才许出现（这条是现场逼出来的判据） */
  it('读失败时摆后端原话与重试，而不顺手念成「今天没人点」', async () => {
    ;(briefGenerationApi.overview as any).mockRejectedValue({
      response: { data: { message: '只有超管能看这一页' } }
    })

    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.find('.alert-stub').text()).toContain('只有超管能看这一页')
    expect(wrapper.findAll('button').map(button => button.text())).toContain('重试')
    expect(wrapper.text()).not.toContain('今天没有任何一单处在「方案生成中」')
    expect(wrapper.text()).not.toContain('现在同时在跑')
  })

  it('读到空列表时才说「没人点」，并说明一家同时只许一单', async () => {
    ;(briefGenerationApi.overview as any).mockResolvedValue({ ...EMPTY_OVERVIEW })

    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.text()).toContain('今天没有任何一单处在「方案生成中」')
    expect(wrapper.text()).toContain('一家租户同时只许一单')
  })

  /**
   * 拍板 ⑤（M-P37）的前端那一半：空态的「为什么没有」只认后端带的成因码。
   * 读不到（这一档在这个身份下根本没有行）≠ 真没有 —— 界面不许把前者念成后者。
   */
  it('后端说读不到时逐字念它那句，不许念成「没人点」', async () => {
    ;(briefGenerationApi.overview as any).mockResolvedValue({ ...EMPTY_OVERVIEW_NOT_VISIBLE })

    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.text()).toContain('这一档读不到（选中的那个身份在这张表里没有行）')
    expect(wrapper.text()).not.toContain('没人点')
    expect(wrapper.text()).not.toContain('今天没有任何一单处在「方案生成中」')
    // 初稿那一格走的是同一条规矩：成因不是「真没有」时，那句描述自己跑法的话也不许摆出来
    expect(wrapper.text()).not.toContain('没有一份初稿在跑')
  })

  /** 后端没回成因时那一格说什么：只报「这一发没有行」这个自己看得见的事实，不猜成因 */
  it('后端没回成因时不猜：既不说「没人点」也不说「读不到」', async () => {
    ;(briefGenerationApi.overview as any).mockResolvedValue({ ...EMPTY_OVERVIEW_NO_REASON })

    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.text()).toContain('这一格这一发没有行（成因后端没回，界面不替它猜）')
    expect(wrapper.text()).not.toContain('没人点')
    expect(wrapper.text()).not.toContain('读不到')
    expect(wrapper.text()).not.toContain('没有一份初稿在跑')
  })

  it('有东西在跑才挂 10 秒的表，读到全空就自己停', async () => {
    const intervalSpy = vi.spyOn(globalThis, 'setInterval')
    const clearSpy = vi.spyOn(globalThis, 'clearInterval')
    try {
      const wrapper = mountView()
      await flushPromises()

      expect(intervalSpy).toHaveBeenCalledTimes(1)
      expect(intervalSpy.mock.calls[0][1]).toBe(10000)
      const timerId = intervalSpy.mock.results[0].value
      const tick = intervalSpy.mock.calls[0][0] as unknown as () => Promise<void>

      ;(briefGenerationApi.overview as any).mockResolvedValue({ ...EMPTY_OVERVIEW })
      await tick()
      await flushPromises()

      expect(clearSpy).toHaveBeenCalledWith(timerId)
      expect(wrapper.text()).toContain('今天没有东西在跑，这一页不再自己读')
    } finally {
      intervalSpy.mockRestore()
      clearSpy.mockRestore()
    }
  })
})
