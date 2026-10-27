import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { h } from 'vue'
import { Input, Tag, message } from 'ant-design-vue'
import ReviewPanel from '../ReviewPanel.vue'
import { reviewApi } from '../../../api'

/**
 * 审核管理那一屏的空态与四张统计卡（M-P82）。
 *
 * 这一屏以前只有一句写死的「暂无待审核文章」：后端那一发（`/api/workspace/reviews/pending`）
 * 换形状之前回的是 MyBatis-Plus 的 Page，选中的身份对不上、这一发根本读失败，界面都只能念那一句，
 * 于是「读不到这一档」和「这一发没读回来」都被念成「这家没有要审的文章」。顶部那四张卡读的是
 * 另一支口（`/api/workspace/reviews/stats`），它对认不出的身份照样回 0，所以那一形也得跟着改。
 *
 * 钉这七件：
 * 1. 后端答的三种成因各念各的，逐字比后端原文，那一句写死的文案不许再出现在屏上；
 * 2. 后端没答成因时界面不替它挑一种；
 * 3. 读失败说的是读失败，并且旧行必须清掉（不能一边摆着上一发的行、一边念「读失败」）；
 * 4. 「这一发读失败」或「选中那一家读不到」时，四张卡摆 `—`，有数时才摆数；
 * 5. 屏上有行、只是筛选没命中，那句话要说清是谁把行挡住的，不记在后端的成因账上；
 * 6. 一次只回一页时，标题上要摆「本页几行 / 全档几条」，不许那几行被读成待审总数；
 * 7. 「真的没有」那一档不摆新建按钮（这一屏没有新建文章的入口，那是内容工作台的活）。
 *
 * 筛选用的是真实控件：点真标签、往真搜索框里打字，不是直接改 statusFilter / searchKeyword。
 */

/** 这三句的唯一出处是后端 `EmptyResultReasons.sentence(what)`，what 取 `PENDING_REVIEW_ARTICLES_EMPTY_WHAT` */
const WHAT = '待审核的文章'
const NONE_LINE = `${WHAT}：这一档查过了，一条都没有。`
const NOT_VISIBLE_LINE = `${WHAT}：这一档读不到（选中的那个身份在这张表里没有行），所以这里不能说「没有」。`

/**
 * 全局 setup 里那个 ResizeObserver 桩是 `vi.fn()`，真实 ant 控件用 `new` 调它会直接被拒；
 * resize-observer-polyfill 在模块加载那一刻就把全局那一个抓走了，所以这份必须顶到 import 之前。
 */
vi.hoisted(() => {
  ;(globalThis as any).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
})

/**
 * 这一屏挂载后会 watch 选中的租户，改它就等于重新读一发。
 * 要测「读失败把旧行清掉」就得走这条真实路径（切租户），所以 store 得是响应式的，
 * 而且要写在那个 proxy 上才叫得到 —— 写回原始对象不会惊动 watch。
 */
const store = vi.hoisted(() => ({ current: null as any }))

vi.mock('ant-design-vue', async () => {
  const actual = await vi.importActual<Record<string, any>>('ant-design-vue')
  return {
    ...actual,
    message: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() }
  }
})

vi.mock('../../../api', () => ({
  reviewApi: {
    pendingList: vi.fn(),
    getReviewStats: vi.fn(),
    preReview: vi.fn(),
    approve: vi.fn(),
    reject: vi.fn(),
    batchApprove: vi.fn(),
    batchReject: vi.fn()
  }
}))

vi.mock('../../../stores/auth', async () => {
  const { reactive } = await import('vue')
  const viewStore = reactive({
    selectedTenantId: null as number | null,
    user: { id: 1 },
    isSuperAdmin: true,
    hasPermission: () => true
  })
  store.current = viewStore
  return { useAuthStore: () => viewStore }
})

// 驳回原因那张饼图：这一屏在容器宽度为 0 时不 init，用例里根本用不到，但真 echarts 会拖慢挂载
vi.mock('echarts', () => ({
  getInstanceByDom: () => null,
  init: () => ({ setOption: vi.fn(), resize: vi.fn(), dispose: vi.fn() })
}))

const PASS_THROUGH = (name: string, tag = 'div') => ({
  name,
  template: `<${tag} class="${name.toLowerCase()}-stub"><slot /><slot name="overlay" /></${tag}>`
})

/** a-card 的替身要连 #title 一起渲，标题上那句「本页几行 / 全档几条」才看得见 */
const CARD = {
  name: 'ACard',
  setup(props: any, { slots }: any) {
    return () =>
      h('div', { class: 'a-card-stub' }, [
        slots.title ? slots.title() : null,
        slots.default ? slots.default() : null
      ])
  }
}

function row(id: number, extra: Record<string, any> = {}) {
  return {
    id,
    articleId: id,
    title: `待审文章${id}`,
    status: 'pending_review',
    priority: 60,
    reviewer: '审核人甲',
    wordCount: 800,
    createdAt: '2026-10-27T09:00:00',
    ...extra
  }
}

type ListShape = {
  records?: any[]
  total?: number
  emptyReason?: string | null
  emptyLine?: string | null
}

/**
 * 挂这一屏：列表那一发按传入形状回，统计那一发默认给一组能对上的数。
 * 两支口分得开才测得出「卡读的是另一支口，所以列表读不到时卡要摆 `—`」。
 */
/**
 * 每次只留一个活的屏：这一屏会 watch 选中的租户，上一支没卸掉的组件也会跟着重新读一发，
 * 那一发就把本次要断言的那次调用抢走（用例看着红得莫名其妙）。
 */
let mounted: any = null

async function mountPanel(
  list: ListShape,
  stats: Record<string, number> = { pendingCount: 0, approvedCount: 12, rejectedCount: 3 }
) {
  mounted?.unmount()
  vi.mocked(reviewApi.pendingList).mockResolvedValue({
    records: [],
    total: 0,
    page: 1,
    size: 20,
    pages: 0,
    ...list
  } as any)
  vi.mocked(reviewApi.getReviewStats).mockResolvedValue(stats as any)

  const wrapper = mount(ReviewPanel, {
    global: {
      stubs: {
        'a-spin': PASS_THROUGH('ASpin'),
        'a-row': PASS_THROUGH('ARow'),
        'a-col': PASS_THROUGH('ACol'),
        'a-space': PASS_THROUGH('ASpace'),
        'a-card': CARD,
        'a-tooltip': PASS_THROUGH('ATooltip'),
        'a-checkbox': PASS_THROUGH('ACheckbox'),
        // 筛选走真实控件：标签真点、搜索框真打字
        'a-tag': Tag,
        'a-input-search': Input.Search,
        'a-empty': PASS_THROUGH('AEmpty')
      }
    }
  })
  await flushPromises()
  mounted = wrapper
  return wrapper
}

function statValues(wrapper: any): string[] {
  return wrapper.findAll('.stat-value').map((n: any) => n.text().trim())
}

beforeEach(() => {
  store.current.selectedTenantId = null
  vi.mocked(reviewApi.pendingList).mockReset()
  vi.mocked(reviewApi.getReviewStats).mockReset()
})

afterEach(() => {
  mounted?.unmount()
  mounted = null
})

describe('审核管理「待审核」列表的空态', () => {
  it('选中那一家读不到时念后端那一句，四张卡摆 —，写死的那句不再出现', async () => {
    const wrapper = await mountPanel({ emptyReason: 'NOT_VISIBLE', emptyLine: NOT_VISIBLE_LINE })

    const emptyText = wrapper.find('.empty-list').text()
    // 逐字比后端原文：界面不许改写、不许合并成一句万能词
    expect(emptyText).toContain(NOT_VISIBLE_LINE)
    expect(wrapper.text()).not.toContain('暂无待审核文章')
    expect(statValues(wrapper)).toEqual(['—', '—', '—', '—'])
    // 读不到那一档不是说「这一档还空着」，不该给新建入口
    expect(wrapper.find('.create-on-empty').exists()).toBe(false)
  })

  it('真的没有时念「这一档查过了，一条都没有」，四张卡摆真实条数', async () => {
    const wrapper = await mountPanel({ emptyReason: 'NONE', emptyLine: NONE_LINE })

    expect(wrapper.find('.empty-list').text()).toContain(NONE_LINE)
    expect(wrapper.text()).not.toContain('暂无待审核文章')
    // 12 / (12+3) = 80%
    expect(statValues(wrapper)).toEqual(['0', '12', '3', '80%'])
    expect(wrapper.find('.create-on-empty').exists()).toBe(false)
  })

  it('后端没答成因时界面不替它挑一种', async () => {
    const wrapper = await mountPanel({ emptyReason: null, emptyLine: null })

    const emptyText = wrapper.find('.empty-list').text()
    expect(emptyText).toContain('这一格这一发没有行（后端没回是哪一种空，界面不替它猜）')
    expect(emptyText).not.toContain(NONE_LINE)
    expect(emptyText).not.toContain(NOT_VISIBLE_LINE)
    // 这一发是读回来了的，卡照旧摆数
    expect(statValues(wrapper)).toEqual(['0', '12', '3', '80%'])
  })

  it('读失败说成读失败，四张卡摆 —，旧行跟着清掉', async () => {
    // 第一发读到 2 行
    const wrapper = await mountPanel({ records: [row(1), row(2)], total: 2 })
    expect(wrapper.findAll('.article-card-item')).toHaveLength(2)
    expect(wrapper.find('.list-count').text()).toBe('2')

    // 切租户走真实那条 watch ⇒ 重新读一发，这一发读失败
    vi.mocked(reviewApi.pendingList).mockRejectedValueOnce(new Error('后端说这一发挂了'))
    store.current.selectedTenantId = 7
    await flushPromises()

    const emptyText = wrapper.find('.empty-list').text()
    expect(emptyText).toContain('这一发读失败：后端说这一发挂了（读失败不是「这一档没有」）')
    expect(wrapper.text()).not.toContain('暂无待审核文章')
    expect(wrapper.findAll('.article-card-item')).toHaveLength(0)
    expect(wrapper.find('.list-count').text()).toBe('0')
    expect(statValues(wrapper)).toEqual(['—', '—', '—', '—'])
    expect(message.error).toHaveBeenCalledWith('数据加载失败')
  })

  it('有行只是筛选没命中时，那句话要说清是谁把行挡住的', async () => {
    const wrapper = await mountPanel(
      { records: [row(1), row(2)], total: 2 },
      { pendingCount: 2, approvedCount: 12, rejectedCount: 3 }
    )

    // 点真实的「审核通过」标签（这一口只回 pending_review，选中它一定筛空）
    const approvedTag = wrapper.findAll('.filter-tag').find(n => n.text().trim() === '审核通过')!
    // 标签命中的是组件本体，VTU 给的是 VueNode，原生 click 要按 HTMLElement 调
    ;(approvedTag.element as HTMLElement).click()
    await flushPromises()

    expect(wrapper.find('.filter-miss').text()).toContain(
      '这一页读到 2 篇，按现在的筛选（状态＝审核通过）没有匹配的行——不是这一档没有要审的文章。'
    )
    // 这一形不是后端的成因，后端那一句不该被渲出来
    expect(wrapper.find('.empty-line').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('暂无待审核文章')
    // 卡读的是另一支口，这一发读得好好的，不许被筛空带成 —
    expect(statValues(wrapper)).toEqual(['2', '12', '3', '80%'])
  })

  it('往搜索框里打字没命中时，那句把关键词一起念出来', async () => {
    const wrapper = await mountPanel({ records: [row(1)], total: 1 })

    await wrapper.find('input').setValue('根本不存在的词')

    expect(wrapper.find('.filter-miss').text()).toContain('按现在的筛选（关键词「根本不存在的词」）')
    expect(wrapper.find('.empty-line').exists()).toBe(false)
  })

  it('一次只回一页时标题摆「本页几行 / 全档几条」，够得着全档时不摆', async () => {
    const paged = await mountPanel({ records: [row(1), row(2)], total: 47 })
    expect(paged.find('.list-page-note').text()).toContain('本页 2 / 共 47 篇')

    const onlyPage = await mountPanel({ records: [row(1), row(2)], total: 2 })
    expect(onlyPage.find('.list-page-note').exists()).toBe(false)
  })
})
