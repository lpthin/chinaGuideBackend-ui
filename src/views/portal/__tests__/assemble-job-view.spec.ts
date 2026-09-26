import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { Button, Checkbox, Select, message } from 'ant-design-vue'
import AssembleJobView from '../AssembleJobView.vue'
import {
  portalAssembleApi,
  type AssembleDraftRow,
  type AssembleEstimate,
  type PortalAssembleJob
} from '../../../api/portalAssemble'
import { portalSkeletonsApi } from '../../../api/portalSkeletons'
import { portalReferenceApi } from '../../../api/referenceSites'
import { siteApi } from '../../../api/workspace'

/**
 * 整站组装任务视图（Spec §6.3 / Q3，决策 N4）。
 *
 * 这一页要钉住的全是「钱与可见性」这两件事，所以用真控件（Button / Checkbox / Select 都装真的），
 * 只有表壳、抽屉类容器换成会走 bodyCell 插槽的桩件——真 a-table 在这个环境里渲不出表体：
 * 1. 组装（run）不是点一下就发出去的：必须先取到属于当前任务的预估、再由用户亲手勾上确认框；
 *    「没勾」与「勾了」两种情况下各按一次按钮，前者必须一个请求都不发；
 * 2. 出价（estimate）这一发不许带 confirm，也不许顺带把组装发出去；
 * 3. 应用是一页一次，被门禁拒 / 没产出草稿 / 已应用这三种落点在表里各说一句话，
 *    回滚要先在 popconfirm 里确认一次；
 * 4. 状态的中文说法来自 /statuses——用例把词表换成完全不同的字，页面上要是还出现
 *    「待开始」这类本地常量就会红。
 */

vi.mock('ant-design-vue', async () => {
  const actual = await vi.importActual<Record<string, any>>('ant-design-vue')
  return {
    ...actual,
    message: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() }
  }
})

/**
 * http 只桩掉两个用途：默认导出没人调（接口整体被桩了），describeHttpError 保留「纯 Error 原样透出后端中文」
 * 这一支真实口径——否则「读失败时透出后端原因」那两条用例就是在测空气。
 */
vi.mock('../../../api/http', () => ({
  default: { get: vi.fn(), post: vi.fn() },
  AI_REQUEST_TIMEOUT: 180000,
  describeHttpError: (error: unknown) =>
    (error as Error | null)?.message || '无法连接服务器，请确认后端已启动'
}))

vi.mock('../../../api/portalAssemble', async () => {
  const actual = await vi.importActual<typeof import('../../../api/portalAssemble')>('../../../api/portalAssemble')
  return {
    ...actual,
    portalAssembleApi: {
      statusLabels: vi.fn(),
      list: vi.fn(),
      create: vi.fn(),
      estimate: vi.fn(),
      run: vi.fn(),
      detail: vi.fn(),
      applyPage: vi.fn(),
      rollbackAll: vi.fn()
    }
  }
})
vi.mock('../../../api/portalSkeletons', () => ({ portalSkeletonsApi: { list: vi.fn() } }))
vi.mock('../../../api/referenceSites', () => ({ portalReferenceApi: { list: vi.fn() } }))
vi.mock('../../../api/workspace', () => ({ siteApi: { list: vi.fn() } }))

/**
 * 视图读 `route.query.siteId`（需求单详情页「这一站的组装任务」那一跳）：
 * 只替 useRoute 换一个可写的 query，其余（含真 router 插件）保持原样，
 * 免得把「页面自己能不能拉到这一站的任务」测成「桩件能不能拉到」。
 */
const { routeQuery } = vi.hoisted(() => ({ routeQuery: { current: {} as Record<string, string> } }))
vi.mock('vue-router', async importOriginal => {
  const actual = await importOriginal<Record<string, any>>()
  return { ...actual, useRoute: () => ({ query: routeQuery.current, params: {} }) }
})

/** 按 dataSource 逐行走 bodyCell 插槽的表壳：真 a-table 在这个环境里渲不出表体，空态也得自己接上 */
const TABLE_STUB = {
  name: 'ATable',
  props: { dataSource: { type: Array, default: () => [] }, columns: { type: Array, default: () => [] } },
  template: `
    <div class="table-stub">
      <div v-for="(record, rowIndex) in dataSource" :key="rowIndex" class="row">
        <template v-for="column in columns" :key="column.key">
          <slot v-if="$slots.bodyCell" name="bodyCell" :column="column" :record="record" />
        </template>
      </div>
      <div v-if="!dataSource.length" class="empty-text"><slot name="emptyText" /></div>
    </div>`
}

const PASS_THROUGH = (name: string) => ({
  name,
  props: ['title', 'message', 'type', 'description', 'label', 'size', 'spinning', 'open', 'danger', 'column', 'bordered'],
  template: `<div class="${name}-stub"><span>{{ message }}{{ description }}</span>`
    + '<slot name="title" /><slot name="message" /><slot /></div>'
})

/** popconfirm 换成「带禁用态的确认按钮」：要钉的是回滚没确认之前一次都不发 */
const POPCONFIRM_STUB = {
  name: 'APopconfirm',
  props: { title: { type: String, default: '' }, disabled: { type: Boolean, default: false } },
  emits: ['confirm'],
  template: '<span class="popconfirm-stub"><button class="popconfirm-ok" :disabled="disabled" '
    + '@click="$emit(\'confirm\')">气泡里确认</button><slot /></span>'
}

/** 词表：全部用后端根本不存在的说法，页面里只要冒出抄来的中文就会红 */
const FAKE_LABELS = {
  pending: '还没开始呢',
  estimating: '报过价了',
  running: '正在装',
  needs_human: '要人看',
  done: '草稿出完了',
  failed: '这一轮黄了'
}

function job(overrides: Partial<PortalAssembleJob> = {}): PortalAssembleJob {
  return {
    id: 12,
    tenantId: 5,
    siteId: 7,
    skeletonKey: 'some-set',
    skeletonVersion: 3,
    referenceSiteId: null,
    status: 'pending',
    inputJson: null,
    planJson: null,
    draftPagesJson: null,
    estimatedTokens: 0,
    promptTokens: null,
    completionTokens: null,
    errorMessage: null,
    createdBy: 'platform',
    createdAt: '2026-09-25T02:00:00',
    updatedAt: null,
    ...overrides
  }
}

function row(overrides: Partial<AssembleDraftRow> = {}): AssembleDraftRow {
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

function estimate(overrides: Partial<AssembleEstimate> = {}): AssembleEstimate {
  return { jobId: 12, estimatedTokens: 3800, remainingTokens: 90000, aiEnabled: true, notice: null, ...overrides }
}

interface Options {
  sites?: Array<{ id: number; name: string }>
  skeletons?: Array<Record<string, unknown>>
  jobs?: PortalAssembleJob[]
  detailJob?: PortalAssembleJob
  drafts?: AssembleDraftRow[]
  statusLabels?: Record<string, string>
  estimateValue?: AssembleEstimate
  listError?: string
  detailError?: string
  baseError?: string
}

async function mountView(options: Options = {}) {
  const {
    sites = [{ id: 7, name: '甲站' }],
    skeletons = [{ skeletonKey: 'some-set', name: '甲套骨架', status: 'published', version: 3, pages: [] }],
    jobs = [job()],
    detailJob = jobs[0],
    drafts = [],
    statusLabels = FAKE_LABELS,
    estimateValue = estimate(),
    listError = '',
    detailError = '',
    baseError = ''
  } = options

  vi.mocked(portalAssembleApi.statusLabels).mockResolvedValue(statusLabels as any)
  vi.mocked(portalAssembleApi.detail).mockResolvedValue({ job: detailJob, drafts } as any)
  vi.mocked(portalAssembleApi.estimate).mockResolvedValue(estimateValue as any)
  vi.mocked(portalAssembleApi.run).mockResolvedValue(detailJob as any)
  vi.mocked(portalAssembleApi.create).mockResolvedValue(jobs[0] || job() as any)
  vi.mocked(portalAssembleApi.applyPage).mockResolvedValue({ id: 41, title: '关于我们' } as any)
  vi.mocked(portalAssembleApi.rollbackAll).mockResolvedValue(2 as any)
  if (listError) {
    vi.mocked(portalAssembleApi.list).mockRejectedValue(new Error(listError))
  } else {
    vi.mocked(portalAssembleApi.list).mockResolvedValue(jobs as any)
  }
  if (detailError) {
    vi.mocked(portalAssembleApi.detail).mockRejectedValue(new Error(detailError))
  }
  if (baseError) {
    vi.mocked(siteApi.list).mockRejectedValue(new Error(baseError))
  } else {
    vi.mocked(siteApi.list).mockResolvedValue(sites as any)
  }
  vi.mocked(portalSkeletonsApi.list).mockResolvedValue(skeletons as any)
  vi.mocked(portalReferenceApi.list).mockResolvedValue([{ id: 66, sourceUrl: 'https://other.example' }] as any)

  const wrapper = mount(AssembleJobView, {
    attachTo: document.body,
    global: {
      stubs: {
        'a-button': Button,
        'a-checkbox': Checkbox,
        'a-select': Select,
        'a-table': TABLE_STUB,
        'a-popconfirm': POPCONFIRM_STUB,
        'a-card': PASS_THROUGH('ACard'),
        'a-form': PASS_THROUGH('AForm'),
        'a-form-item': PASS_THROUGH('AFormItem'),
        'a-space': PASS_THROUGH('ASpace'),
        'a-alert': PASS_THROUGH('AAlert'),
        'a-spin': PASS_THROUGH('ASpin'),
        'a-tag': PASS_THROUGH('ATag'),
        'a-empty': PASS_THROUGH('AEmpty'),
        'a-tooltip': PASS_THROUGH('ATooltip'),
        'a-descriptions': PASS_THROUGH('ADescriptions'),
        'a-descriptions-item': PASS_THROUGH('ADescriptionsItem')
      }
    }
  })
  await flushPromises()
  return wrapper
}

function buttonContaining(text: string) {
  return [...document.querySelectorAll('button')].filter(node => (node.textContent || '').includes(text))
}

function click(node: Element) {
  node.dispatchEvent(new MouseEvent('click', { bubbles: true }))
}

/** 第 index 个下拉：update:value 走 v-model，change 走视图自己挂的处理器 */
async function pickValue(wrapper: any, index: number, value: unknown) {
  const select = wrapper.findAllComponents(Select)[index]
  expect(select, `页面上应有第 ${index + 1} 个下拉`).toBeTruthy()
  select.vm.$emit('update:value', value)
  select.vm.$emit('change', value)
  await flushPromises()
}

/** 真确认框：勾之前先看它是不是真的还能勾 */
async function tickConfirm(wrapper: any) {
  const input = wrapper.find('input[type="checkbox"]')
  expect((input.element as HTMLInputElement).disabled, '取到预估之后确认框应该可以勾').toBe(false)
  await input.setValue(true)
  await flushPromises()
}

function confirmInput(wrapper: any) {
  return wrapper.find('input[type="checkbox"]')
}

/** [0] 是任务表，[1] 是草稿表 */
function tables() {
  return [...document.querySelectorAll('.table-stub')]
}

function rowsOf(tableIndex: number) {
  return [...(tables()[tableIndex]?.querySelectorAll('.row') || [])]
}

/** 回执走 message（不落在 DOM 里）：要断言就说人话，别为了测试把提示抄一份到模板里 */
function successLines(): string[] {
  return (vi.mocked(message.success).mock.calls as unknown as unknown[][]).map(call => String(call[0]))
}

function rowContaining(text: string, tableIndex = 1) {
  return rowsOf(tableIndex).find(node => (node.textContent || '').includes(text))
}

/** 选站点 → 打开任务详情：第 3 步那一整段就是这么展开出来的 */
async function openDetail(wrapper: any) {
  await pickValue(wrapper, 0, 7)
  const entry = buttonContaining('看产出与操作')
  expect(entry.length).toBeGreaterThan(0)
  click(entry[0])
  await flushPromises()
}

beforeEach(() => {
  document.body.innerHTML = ''
  routeQuery.current = {}
  vi.clearAllMocks()
})

describe('组装：先出价、再亲手勾确认，两道都过了才发那一发', () => {
  it('没有预估时确认框是灭的，组装也是灭的，按下去一个请求都不发', async () => {
    const wrapper = await mountView()
    await openDetail(wrapper)
    expect(portalAssembleApi.detail).toHaveBeenCalledWith(12)

    expect((confirmInput(wrapper).element as HTMLInputElement).disabled).toBe(true)
    const run = buttonContaining('开始整站组装')
    expect((run[0] as HTMLButtonElement).disabled).toBe(true)
    run.forEach(node => click(node))
    await flushPromises()
    expect(portalAssembleApi.run).not.toHaveBeenCalled()
    expect(portalAssembleApi.estimate).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('还没有预估')
  })

  it('勾了确认但没取预估：仍然不发组装', async () => {
    const wrapper = await mountView()
    await openDetail(wrapper)
    // 绕过灭着的控件直接推 v-model：界面的守卫不该依赖「控件恰好被禁用了」
    wrapper.findAllComponents(Checkbox)[0].vm.$emit('update:checked', true)
    await flushPromises()
    const run = buttonContaining('开始整站组装')
    expect((run[0] as HTMLButtonElement).disabled).toBe(true)
    run.forEach(node => click(node))
    await flushPromises()
    expect(portalAssembleApi.run).not.toHaveBeenCalled()
  })

  it('「先估算消耗」只出价：不带 confirm，也不顺带把组装发出去', async () => {
    const wrapper = await mountView()
    await openDetail(wrapper)
    click(buttonContaining('先估算消耗')[0])
    await flushPromises()

    expect(portalAssembleApi.estimate).toHaveBeenCalledTimes(1)
    // 只传任务 id：第二个参数出现就说明有人往出价里塞了确认
    expect(vi.mocked(portalAssembleApi.estimate).mock.calls[0]).toEqual([12])
    expect(portalAssembleApi.run).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('3800')
    expect(wrapper.text()).toContain('90000')
    // 出完价确认框还是没勾：这一页不存在「估算完自动往下走」
    expect((confirmInput(wrapper).element as HTMLInputElement).checked).toBe(false)
    expect((buttonContaining('开始整站组装')[0] as HTMLButtonElement).disabled).toBe(true)
  })

  it('取到预估 + 亲手勾上确认之后才发 run(12, true)，一次点两下也只发一次', async () => {
    const wrapper = await mountView()
    await openDetail(wrapper)
    click(buttonContaining('先估算消耗')[0])
    await flushPromises()
    await tickConfirm(wrapper)

    let resolveRun: (value: unknown) => void = () => {}
    vi.mocked(portalAssembleApi.run).mockImplementationOnce(
      () => new Promise(resolve => { resolveRun = resolve }) as any
    )
    const run = buttonContaining('开始整站组装')
    expect((run[0] as HTMLButtonElement).disabled).toBe(false)
    run.forEach(node => click(node))
    await flushPromises()
    expect(portalAssembleApi.run).toHaveBeenCalledTimes(1)
    expect(portalAssembleApi.run).toHaveBeenCalledWith(12, true)
    // 还在路上：反复点不许再扣一次配额
    buttonContaining('开始整站组装').forEach(node => click(node))
    await flushPromises()
    expect(portalAssembleApi.run).toHaveBeenCalledTimes(1)

    resolveRun(job({ status: 'done' }))
    await flushPromises()
    // 跑完的确认收回：下一次组装还得重新勾
    expect(wrapper.findAllComponents(Checkbox)[0].props('checked')).toBe(false)
  })

  it('没勾的时候一个 true 都不发；勾了才发一次 run(12, true)', async () => {
    const wrapper = await mountView()
    await openDetail(wrapper)
    click(buttonContaining('先估算消耗')[0])
    await flushPromises()
    buttonContaining('开始整站组装').forEach(node => click(node))
    await flushPromises()
    expect(vi.mocked(portalAssembleApi.run).mock.calls).toEqual([])
    await tickConfirm(wrapper)
    click(buttonContaining('开始整站组装')[0])
    await flushPromises()
    expect(vi.mocked(portalAssembleApi.run).mock.calls).toEqual([[12, true]])
  })

  it('换任务后旧预估作废：拿上一轮的报价点不动组装，详情按新 id 重取', async () => {
    const wrapper = await mountView({
      jobs: [job(), job({ id: 13, status: 'pending' })],
      drafts: []
    })
    await pickValue(wrapper, 0, 7)
    click(buttonContaining('看产出与操作')[0])
    await flushPromises()
    click(buttonContaining('先估算消耗')[0])
    await flushPromises()
    expect(portalAssembleApi.estimate).toHaveBeenLastCalledWith(12)
    await tickConfirm(wrapper)

    // 换到另一个任务：报价是 12 号那轮的，确认与组装都得重新来
    click(buttonContaining('看产出与操作')[1])
    await flushPromises()
    expect(portalAssembleApi.detail).toHaveBeenLastCalledWith(13)
    expect((buttonContaining('开始整站组装')[0] as HTMLButtonElement).disabled).toBe(true)
    buttonContaining('开始整站组装').forEach(node => click(node))
    await flushPromises()
    expect(portalAssembleApi.run).not.toHaveBeenCalled()
  })

  it('回来的预估不属于当前任务：不算看过价格，勾了也不给组装', async () => {
    // 竞态/串号时后端可能带回别人的 jobId——那种报价不能点亮烧钱的按钮
    const wrapper = await mountView({ estimateValue: estimate({ jobId: 999 }) })
    await openDetail(wrapper)
    click(buttonContaining('先估算消耗')[0])
    await flushPromises()
    expect((confirmInput(wrapper).element as HTMLInputElement).disabled).toBe(true)
    wrapper.findAllComponents(Checkbox)[0].vm.$emit('update:checked', true)
    await flushPromises()
    expect((buttonContaining('开始整站组装')[0] as HTMLButtonElement).disabled).toBe(true)
    buttonContaining('开始整站组装').forEach(node => click(node))
    await flushPromises()
    expect(portalAssembleApi.run).not.toHaveBeenCalled()
  })

  it('任务已经落定：不能再出价也不能再组装，重来要新建任务', async () => {
    const done = job({ status: 'done', promptTokens: 100, completionTokens: 50 })
    const wrapper = await mountView({ jobs: [done], detailJob: done })
    await openDetail(wrapper)
    expect((buttonContaining('先估算消耗')[0] as HTMLButtonElement).disabled).toBe(true)
    expect((buttonContaining('开始整站组装')[0] as HTMLButtonElement).disabled).toBe(true)
    expect(wrapper.text()).toContain('这个任务已经落定（草稿出完了）')
    expect(wrapper.text()).toContain('新建一个任务')
    expect(wrapper.text()).toContain('150')
    click(buttonContaining('先估算消耗')[0])
    click(buttonContaining('开始整站组装')[0])
    await flushPromises()
    expect(portalAssembleApi.estimate).not.toHaveBeenCalled()
    expect(portalAssembleApi.run).not.toHaveBeenCalled()
  })

  it('AI 这一路没开：显示后端原话，勾了确认也不给组装', async () => {
    const notice = 'AI 整站组装当前未开启（app.portal.assembly.enabled=false），确认也不会调用模型'
    const wrapper = await mountView({ estimateValue: estimate({ aiEnabled: false, notice }) })
    await openDetail(wrapper)
    click(buttonContaining('先估算消耗')[0])
    await flushPromises()
    expect(wrapper.text()).toContain(notice)

    const run = buttonContaining('开始整站组装')
    expect((run[0] as HTMLButtonElement).disabled).toBe(true)
    // 没开的时候连确认都不该给勾：这一步没有「点了才知道没开」
    expect((confirmInput(wrapper).element as HTMLInputElement).disabled).toBe(true)
    run.forEach(node => click(node))
    await flushPromises()
    expect(portalAssembleApi.run).not.toHaveBeenCalled()
  })
})

describe('草稿表：三种落点各说各的话，应用一页一次', () => {
  const DRAFTS: AssembleDraftRow[] = [
    row({ pageId: 41, draftId: 88, pageKey: 'home', title: '首页' }),
    row({
      pageId: 42,
      draftId: 89,
      pageKey: 'about',
      title: '关于我们',
      rejected: true,
      error: '这一页的联系电话是编的，门禁拦下'
    }),
    row({ pageId: null, draftId: null, pageKey: 'news', title: null, error: '规划里的页面在站点上已经找不到了' }),
    row({ pageId: 44, draftId: 91, pageKey: 'contact', title: '联系我们', applied: true }),
    row({
      pageId: 45,
      draftId: 92,
      pageKey: 'cases',
      title: '案例展示',
      warnings: ['文案与参考站高度相似', '图片来自外部地址']
    })
  ]

  async function mountWithDrafts(drafts: AssembleDraftRow[] = DRAFTS) {
    const wrapper = await mountView({
      jobs: [job({ status: 'done' })],
      detailJob: job({ status: 'done' }),
      drafts
    })
    await openDetail(wrapper)
    return wrapper
  }

  it('被门禁拒 / 没产出草稿 / 已应用是三种不同的话', async () => {
    await mountWithDrafts()
    expect(rowContaining('首页')?.textContent).toContain('可应用')
    expect(rowContaining('关于我们')?.textContent).toContain('被门禁拒')
    expect(rowContaining('关于我们')?.textContent).toContain('这一页的联系电话是编的，门禁拦下')
    // 没草稿的行要说清是压根没产出，而不是「被拒了」
    const noDraft = rowContaining('news')
    expect(noDraft?.textContent).toContain('没产出草稿')
    expect(noDraft?.textContent).toContain('站点上已经没有这一页')
    expect(noDraft?.textContent).not.toContain('被门禁拒')
    expect(rowContaining('联系我们')?.textContent).toContain('已应用')
    expect(wrapperText()).toContain('已应用 1 页')
    expect(wrapperText()).toContain('可应用 2 页')
    expect(wrapperText()).toContain('被门禁拒 1 页')
    expect(wrapperText()).toContain('没产出草稿 1 页')
  })

  it('素材来源/照抄的警告原样列出来：这些是允许落地但必须看见的提示', async () => {
    await mountWithDrafts()
    const cases = rowContaining('案例展示')?.textContent || ''
    expect(cases).toContain('文案与参考站高度相似')
    expect(cases).toContain('图片来自外部地址')
    expect(rowContaining('首页')?.textContent).toContain('没有门禁原因，也没有素材来源提示')
  })

  it('应用是一页一次：只有可应用那两行点得动，其余点了不发请求', async () => {
    await mountWithDrafts()
    const clickable = rowsOf(1).filter(node => {
      const button = node.querySelector('button')
      return button && !(button as HTMLButtonElement).disabled
    })
    expect(clickable).toHaveLength(2)

    click(clickable[0].querySelector('button') as Element)
    await flushPromises()
    expect(portalAssembleApi.applyPage).toHaveBeenCalledTimes(1)
    expect(portalAssembleApi.applyPage).toHaveBeenCalledWith(12, 41)

    // 被拒的、没草稿的、已应用的三行：按钮灭着，硬点也不该发出任何一发
    const inert = rowsOf(1).filter(node => {
      const button = node.querySelector('button')
      return button && (button as HTMLButtonElement).disabled
    })
    expect(inert).toHaveLength(3)
    inert.forEach(node => click(node.querySelector('button') as Element))
    await flushPromises()
    expect(portalAssembleApi.applyPage).toHaveBeenCalledTimes(1)

    click(clickable[1].querySelector('button') as Element)
    await flushPromises()
    expect(portalAssembleApi.applyPage).toHaveBeenCalledTimes(2)
    expect(vi.mocked(portalAssembleApi.applyPage).mock.calls.map(call => call[1])).toEqual([41, 45])
    // 一次一发，每发都带着自己那一页的 pageId：整条链里没有「整站应用」这种东西
    expect(vi.mocked(portalAssembleApi.applyPage).mock.calls.every(call => call[0] === 12)).toBe(true)
    // 应用完必须说清「这一页访客现在看得到了」，这是全链路唯一见客的动作
    expect(successLines().some(line => line.includes('已应用') && line.includes('访客'))).toBe(true)
  })

  it('回滚必须先在气泡里确认一次：按按钮本身不发请求', async () => {
    await mountWithDrafts()
    const rollback = buttonContaining('回滚本任务应用过的页面')
    expect(rollback.length).toBeGreaterThan(0)
    expect((rollback[0] as HTMLButtonElement).disabled).toBe(false)
    click(rollback[0])
    await flushPromises()
    expect(portalAssembleApi.rollbackAll).not.toHaveBeenCalled()

    click(document.querySelector('.popconfirm-ok') as Element)
    await flushPromises()
    expect(portalAssembleApi.rollbackAll).toHaveBeenCalledTimes(1)
    expect(portalAssembleApi.rollbackAll).toHaveBeenCalledWith(12)
    // 报的是后端给的页数，不是界面自己数的：这一句要说清只退回本任务应用过的那几页
    expect(successLines().some(line => line.includes('已回滚 2 页') && line.includes('别的改动'))).toBe(true)
  })

  it('一页都没应用过时回滚是灭的：不把 ASSEMBLE_NOTHING_APPLIED 留给用户去撞', async () => {
    const wrapper = await mountWithDrafts([row({ pageId: 41, draftId: 88, pageKey: 'home', title: '首页' })])
    const rollback = buttonContaining('回滚本任务应用过的页面')[0]
    expect((rollback as HTMLButtonElement).disabled).toBe(true)
    expect((document.querySelector('.popconfirm-ok') as HTMLButtonElement).disabled).toBe(true)
    click(document.querySelector('.popconfirm-ok') as Element)
    await flushPromises()
    expect(portalAssembleApi.rollbackAll).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('已应用 0 页')
  })

  function wrapperText() {
    return document.body.textContent || ''
  }
})

describe('建任务：这一步不花钱，所以没有 confirm 这个东西', () => {
  it('选站点 + 已发布骨架 → 建任务只发（站点、骨架、参考站）', async () => {
    const wrapper = await mountView({ jobs: [] })
    // mountView 会把 create 的默认回执设成列表里的任务；这里要的是「新建出来那个 id」
    vi.mocked(portalAssembleApi.create).mockResolvedValue(job({ id: 99 }) as any)
    await pickValue(wrapper, 0, 7)
    await pickValue(wrapper, 1, 'some-set')
    click(buttonContaining('新建组装任务')[0])
    await flushPromises()

    expect(portalAssembleApi.create).toHaveBeenCalledTimes(1)
    const body = vi.mocked(portalAssembleApi.create).mock.calls[0]?.[0] as unknown as Record<string, unknown>
    expect(body).toEqual({ siteId: 7, skeletonKey: 'some-set', referenceSiteId: null })
    expect(body).not.toHaveProperty('confirm')
    expect(portalAssembleApi.run).not.toHaveBeenCalled()
    expect(portalAssembleApi.estimate).not.toHaveBeenCalled()
    // 建完直接进第 3 步，但仍然没有替用户点任何烧钱的按钮
    expect(portalAssembleApi.detail).toHaveBeenCalledWith(99)
  })

  it('参考站是可选项：选了就把 id 带上', async () => {
    const wrapper = await mountView({ jobs: [] })
    await pickValue(wrapper, 0, 7)
    await pickValue(wrapper, 1, 'some-set')
    await pickValue(wrapper, 2, 66)
    click(buttonContaining('新建组装任务')[0])
    await flushPromises()
    expect(vi.mocked(portalAssembleApi.create).mock.calls[0]?.[0]).toEqual({
      siteId: 7,
      skeletonKey: 'some-set',
      referenceSiteId: 66
    })
  })

  it('没选骨架时建任务是灭的；下拉里只出已发布的骨架', async () => {
    const wrapper = await mountView({
      jobs: [],
      skeletons: [
        { skeletonKey: 'some-set', name: '甲套骨架', status: 'published', version: 1, pages: [] },
        { skeletonKey: 'old-set', name: '乙套骨架', status: 'retired', version: 9, pages: [] }
      ]
    })
    await pickValue(wrapper, 0, 7)
    expect((buttonContaining('新建组装任务')[0] as HTMLButtonElement).disabled).toBe(true)
    click(buttonContaining('新建组装任务')[0])
    await flushPromises()
    expect(portalAssembleApi.create).not.toHaveBeenCalled()

    const options = wrapper.findAllComponents(Select)[1].props('options') as Array<{ value: string }>
    expect(options.map(item => item.value)).toEqual(['some-set'])
  })
})

describe('状态中文只有一处来源，读不到的东西不猜', () => {
  it('词表换成别的字页面跟着换；词表里没有的状态原样写出来', async () => {
    const wrapper = await mountView({ jobs: [job({ status: 'pending' }), job({ id: 14, status: 'reviewing' })] })
    await pickValue(wrapper, 0, 7)
    const text = wrapper.text()
    expect(text).toContain('还没开始呢')
    expect(text).not.toContain('待开始')
    // 后端将来加状态：不认识就照原样显示，不替它编一个中文名
    expect(text).toContain('reviewing')
  })

  it('详情里的状态也走同一份词表', async () => {
    const wrapper = await mountView({
      jobs: [job({ status: 'estimating' })],
      detailJob: job({ status: 'estimating' })
    })
    await openDetail(wrapper)
    expect(wrapper.text()).toContain('报过价了')
    expect(portalAssembleApi.statusLabels).toHaveBeenCalledTimes(1)
  })

  it('任务列表读失败：透出后端那句中文，而不是显示「还没有任务」', async () => {
    const wrapper = await mountView({ listError: '这个账号没有 portal:build:assemble' })
    await pickValue(wrapper, 0, 7)
    expect(wrapper.text()).toContain('这个账号没有 portal:build:assemble')
    expect(wrapper.text()).not.toContain('这个站点还没有组装任务')
  })

  it('详情读失败：第 3 步说清是没读到，不摆出一张空草稿表', async () => {
    const wrapper = await mountView({ detailError: '组装任务的产出记录读不出来，请新建任务重跑' })
    await openDetail(wrapper)
    expect(wrapper.text()).toContain('组装任务的产出记录读不出来，请新建任务重跑')
  })

  it('这个站点还没有任务：说清建任务不花钱', async () => {
    const wrapper = await mountView({ jobs: [] })
    await pickValue(wrapper, 0, 7)
    expect(wrapper.text()).toContain('这个站点还没有组装任务')
    expect(portalAssembleApi.detail).not.toHaveBeenCalled()
  })

  it('一个站点都取不到 / 没有可组装的骨架：各说各的原因', async () => {
    const noSite = await mountView({ sites: [] })
    expect(noSite.text()).toContain('一个站点都取不到')
    const noSkeleton = await mountView({ skeletons: [{ skeletonKey: 'x', name: '还没定稿', status: 'draft', pages: [] }] })
    expect(noSkeleton.text()).toContain('骨架库里现在没有可组装的骨架')
  })
})

describe('地址里的 ?siteId=（需求单详情那一跳的落点）', () => {
  it('站点在列表里：进页面就替它选中并按它拉任务，还写明号是地址给的', async () => {
    routeQuery.current = { siteId: '7' }
    const wrapper = await mountView()
    expect(portalAssembleApi.list).toHaveBeenCalledWith(7)
    expect(wrapper.findAllComponents(Select)[0].props('value')).toBe(7)
    expect(wrapper.text()).toContain('站点是从需求单详情带过来的（甲站）')
    // 替用户选中不等于替他花钱：这一页的组装仍然要预估 + 亲手勾
    expect(portalAssembleApi.estimate).not.toHaveBeenCalled()
    expect(portalAssembleApi.run).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('站点不在这个账号取到的列表里：不假选，原话说明为什么没替它选', async () => {
    routeQuery.current = { siteId: '999' }
    const wrapper = await mountView()
    expect(portalAssembleApi.list).not.toHaveBeenCalled()
    expect(wrapper.findAllComponents(Select)[0].props('value')).toBeFalsy()
    expect(wrapper.text()).toContain('不在这个账号取到的站点列表里')
    wrapper.unmount()
  })

  it('非法 siteId（0 / 字母）当没带：一个任务请求都不发，也不弹那句话', async () => {
    routeQuery.current = { siteId: '0' }
    const wrapper = await mountView()
    expect(portalAssembleApi.list).not.toHaveBeenCalled()
    expect(wrapper.text()).not.toContain('站点是从需求单详情带过来的')
    routeQuery.current = { siteId: 'abc' }
    document.body.innerHTML = ''
    const second = await mountView()
    expect(portalAssembleApi.list).not.toHaveBeenCalled()
    expect(second.text()).not.toContain('不在这个账号取到的站点列表里')
    second.unmount()
  })
})
