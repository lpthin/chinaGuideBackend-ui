import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { reactive } from 'vue'
import { Button, Checkbox, InputNumber, RadioGroup, Switch, message } from 'ant-design-vue'
import InteractionView from '../InteractionView.vue'
import { interactionApi, type InteractionConfig, type InteractionSeedTask } from '../../../api/interaction'
import { JUMP_BACK_NOTICE } from '../../../utils/emptyPage'

/**
 * 后台「读者互动」这一页的形状（P9-C 拍板 1/2/4 的界面那一半）。
 *
 * 这里最坏的两件事都在钉的范围内：
 * 1. **补了多少看不见**——开关是租户自己按的，前台又不带 AI 标识，那么 `disclosure`、总账、
 *    排产计划三块必须在；而且话术原样念后端那一份，前端拼第二份中文早晚跟它分家。
 * 2. **把「没读到」渲成「没有」**——配置读失败不许回填一套默认值让人以为存过了，
 *    队列与排产读失败不许渲成一张空表（那读起来像「这条链今天什么都没干」）。
 *
 * 另外钉住动作词：放行/驳回/摘除三个动作传给接口的是 approve / reject / remove，
 * 后端对拼错的动作直接拒（以前是「不是 approve 就当 reject」，会替租户驳回一条正常评论）。
 */

vi.mock('ant-design-vue', async () => {
  const actual = await vi.importActual<Record<string, any>>('ant-design-vue')
  return {
    ...actual,
    message: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() }
  }
})

vi.mock('../../../api/interaction', () => ({
  interactionApi: {
    config: vi.fn(),
    saveConfig: vi.fn(),
    comments: vi.fn(),
    moderate: vi.fn(),
    moderateBatch: vi.fn(),
    stats: vi.fn(),
    seedTasks: vi.fn()
  }
}))

const authState = reactive({
  permissions: [] as string[],
  selectedTenantId: null as number | null,
  tenantId: undefined as number | undefined,
  isSuperAdmin: false,
  hasPermission(code: string) {
    return this.permissions.includes(code)
  }
})

vi.mock('../../../stores/auth', () => ({
  useAuthStore: () => authState
}))

const PASS_THROUGH = (name: string) => ({
  name,
  props: ['title', 'message', 'description', 'type', 'showIcon', 'size', 'label', 'bordered', 'loading', 'okText', 'cancelText'],
  template: `<div class="${name}-stub"><span>{{ title }}{{ message }}{{ description }}</span><slot name="message" /><slot /><slot name="extra" /><slot name="actions" /></div>`
})

const TABLE_STUB = {
  name: 'ATable',
  props: {
    dataSource: { type: Array, default: () => [] },
    columns: { type: Array, default: () => [] },
    loading: { type: Boolean, default: false }
  },
  template: `
    <div class="table-stub">
      <div v-if="!dataSource.length" class="empty-slot"><slot name="emptyText" /></div>
      <div v-for="record in dataSource" :key="record.id" class="row">
        <template v-for="column in columns" :key="column.key">
          <slot name="bodyCell" :column="column" :record="record" />
        </template>
      </div>
    </div>`
}

/**
 * Spec-R R1：设置 / 总账 / 排产三块搬进了右侧抽屉。真抽屉会把内容 teleport 到 body 并且关着时不渲染，
 * 这里换成「摆出来但记下 open」的替身：既能继续钉三块自己的三态与话术，也能钉开关有没有真接上。
 */
const DRAWER_STUB = {
  name: 'ADrawer',
  props: ['open', 'title', 'width', 'placement'],
  emits: ['update:open'],
  template: '<div class="drawer-stub"><span class="drawer-title">{{ title }}</span><slot name="extra" /><slot /><div class="drawer-footer"><slot name="footer" /></div></div>'
}

/** 「更多」下拉：把 overlay 摆出来，菜单项换成真按钮，点它就走它自己那条 @click */
const DROPDOWN_STUB = {
  name: 'ADropdown',
  template: '<div class="dropdown-stub"><slot /><div class="dropdown-overlay"><slot name="overlay" /></div></div>'
}
const MENU_STUB = { name: 'AMenu', template: '<div class="menu-stub"><slot /></div>' }
const MENU_ITEM_STUB = {
  name: 'AMenuItem',
  inheritAttrs: false,
  emits: ['click'],
  template: '<button class="menu-item-stub" @click="$emit(\'click\', $event)"><slot /></button>'
}
const MODAL_STUB = {
  name: 'AModal',
  props: ['open', 'title', 'okText', 'cancelText'],
  emits: ['ok', 'update:open'],
  template: '<div class="modal-stub"><span>{{ title }}</span><slot /><button class="modal-ok" @click="$emit(\'ok\')">{{ okText }}</button></div>'
}

const VIEW = 'interaction:view'
const MANAGE = 'interaction:manage'

const DISCLOSURE_TEXT = '示例评论开关已开：新发布的稿子会在发布后一个月内挑随机时刻自动补写评论，前台不带 AI 标识（按 2026-10-05 的决定）。'

function config(overrides: Partial<InteractionConfig> = {}): InteractionConfig {
  return {
    aiCommentEnabled: 1,
    virtualLikeEnabled: 0,
    moderationMode: 'review',
    aiCommentMaxPerArticle: 3,
    likeSeedMin: 6,
    likeSeedMax: 28,
    updatedBy: 88,
    updatedAt: '2026-10-05T10:00:00',
    disclosure: DISCLOSURE_TEXT,
    ...overrides
  }
}

function seedTask(overrides: Partial<InteractionSeedTask> = {}): InteractionSeedTask {
  return {
    id: 7,
    articleId: 231,
    seq: 2,
    fireAt: '2026-11-02T03:40:00',
    status: 'PENDING',
    commentId: null,
    skipReason: null,
    skipReasonText: null,
    note: null,
    ...overrides
  }
}

async function mountView(options: {
  permissions?: string[]
  cfg?: InteractionConfig | null
  configError?: string
  queueError?: string
  seedError?: string
  statsError?: string
  /** 覆盖队列那一口的回包（M-P87：成因两格与翻页那一发都要能摆出来） */
  commentsPayload?: any
  /** 覆盖排产那一口的回包（换壳后是 records 那一形） */
  seedPayload?: any
  /** 覆盖总账那一口的回包（页头那一格读的是这里的 pendingReaderComments） */
  statsPayload?: any
  /** 平台档：超管且没选客户 */
  superAdmin?: boolean
} = {}) {
  authState.permissions = options.permissions ?? [VIEW, MANAGE]
  authState.selectedTenantId = null
  authState.isSuperAdmin = options.superAdmin ?? false

  if (options.configError) {
    vi.mocked(interactionApi.config).mockRejectedValue(new Error(options.configError))
  } else {
    vi.mocked(interactionApi.config).mockResolvedValue((options.cfg ?? config()) as any)
  }
  if (options.queueError) {
    vi.mocked(interactionApi.comments).mockRejectedValue(new Error(options.queueError))
  } else {
    vi.mocked(interactionApi.comments).mockResolvedValue((options.commentsPayload ?? {
      items: [
        {
          id: 1, articleId: 231, articleTitle: '签证攻略', authorName: '读者甲',
          content: '讲得很清楚', status: 'pending', source: 'reader', sourceText: '读者写的',
          moderationNote: null, createdAt: '2026-10-05T09:00:00', reviewedAt: null
        },
        {
          id: 2, articleId: 231, articleTitle: '签证攻略', authorName: '读者乙',
          content: '看着像广告', status: 'pending', source: 'reader', sourceText: '读者写的',
          moderationNote: '这条在推销别的网站，先给人看一眼。', createdAt: '2026-10-05T09:30:00', reviewedAt: null
        },
        {
          id: 3, articleId: 232, articleTitle: '开户材料', authorName: null,
          content: '系统补的示例评论', status: 'approved', source: 'ai_seed', sourceText: '系统按开关补的示例评论',
          moderationNote: null, createdAt: '2026-10-05T09:40:00', reviewedAt: null
        }
      ],
      total: 3,
      page: 1,
      size: 20,
      pages: 1,
      counts: { pending: 2, approved: 1, rejected: 0, removed: 0 },
      emptyReason: null,
      emptyLine: null
    }) as any)
  }
  if (options.seedError) {
    vi.mocked(interactionApi.seedTasks).mockRejectedValue(new Error(options.seedError))
  } else {
    vi.mocked(interactionApi.seedTasks).mockResolvedValue((options.seedPayload ?? {
      records: [
        seedTask(),
        seedTask({ id: 8, status: 'SKIPPED', skipReason: 'SWITCH_OFF', skipReasonText: '这篇的示例评论开关已经关掉，到点的那一条没有补' })
      ],
      total: 2,
      page: 1,
      size: 2,
      pages: 1,
      emptyReason: null,
      emptyLine: null
    }) as any)
  }
  if (options.statsError) {
    vi.mocked(interactionApi.stats).mockRejectedValue(new Error(options.statsError))
  } else {
    vi.mocked(interactionApi.stats).mockResolvedValue((options.statsPayload ?? {
      readerComments: 9, approvedReaderComments: 5, pendingReaderComments: 2, seededComments: 4,
      virtualLikes: 61, readerLikes: 12, seedPending: 6, seedDone: 4, seedSkipped: 1, seedFailed: 0
    }) as any)
  }
  vi.mocked(interactionApi.saveConfig).mockResolvedValue(config() as any)
  vi.mocked(interactionApi.moderate).mockResolvedValue({ id: 1, status: 'approved' } as any)

  const wrapper = mount(InteractionView, {
    attachTo: document.body,
    global: {
      stubs: {
        'a-alert': PASS_THROUGH('AAlert'),
        'a-card': PASS_THROUGH('ACard'),
        'a-form': PASS_THROUGH('AForm'),
        'a-form-item': PASS_THROUGH('AFormItem'),
        'a-space': PASS_THROUGH('ASpace'),
        'a-tag': PASS_THROUGH('ATag'),
        'a-select': { name: 'ASelect', props: ['value', 'options'], template: '<select class="select-stub"><slot /></select>' },
        'a-pagination': {
          name: 'APagination',
          props: ['total', 'pageSize', 'current'],
          emits: ['change'],
          template: '<div class="pager-stub" @click="$emit(\'change\', 4)" />'
        },
        'a-popconfirm': PASS_THROUGH('APopconfirm'),
        'a-drawer': DRAWER_STUB,
        'a-dropdown': DROPDOWN_STUB,
        'a-menu': MENU_STUB,
        'a-menu-item': MENU_ITEM_STUB,
        'a-modal': MODAL_STUB,
        'a-descriptions': PASS_THROUGH('ADescriptions'),
        'a-descriptions-item': PASS_THROUGH('ADescriptionsItem'),
        'a-empty': PASS_THROUGH('AEmpty'),
        'a-spin': PASS_THROUGH('ASpin'),
        FilterBar: PASS_THROUGH('FilterBar'),
        'a-button': Button,
        'a-input-number': InputNumber,
        'a-switch': Switch,
        'a-checkbox': Checkbox,
        'a-radio-group': RadioGroup,
        'a-radio-button': { name: 'ARadioButton', props: ['value'], template: '<label class="radio-stub"><input type="radio" :value="value" /><slot /></label>' },
        'a-table': TABLE_STUB
      }
    }
  })
  await flushPromises()
  return wrapper
}

function byId(wrapper: any, selector: string): HTMLInputElement {
  return wrapper.find(selector).element as HTMLInputElement
}

/** 详情抽屉（Spec-R R2）：正文那一格两行封顶之后，「看全文」是读完整一条的唯一入口 */
function detailDrawer(wrapper: any) {
  return wrapper.findAllComponents({ name: 'ADrawer' }).find((d: any) => d.props('title') === '这一条评论')!
}

async function openDetailOf(wrapper: any, rowIndex: number) {
  const row = wrapper.findAll('.table-stub')[0].findAll('.row')[rowIndex]
  const link = row.findAll('button').find((b: any) =>
    b.text().trim() === '看全文' && !b.classes().includes('menu-item-stub'))
  await link!.trigger('click')
  await flushPromises()
}

/** 勾上某一行的复选框（antd Checkbox 渲染成 input[type=checkbox]） */
async function checkRow(wrapper: any, rowIndex: number) {
  const box = wrapper.findAll('.table-stub')[0].findAll('.row')[rowIndex].find('input[type="checkbox"]')
  await box.setChecked(true)
  await flushPromises()
}

/** 行内看得到的那几颗；「更多」下拉里的另算（moreOf），两者不许混成一句读数 */
function inlineButtonsOf(wrapper: any, index: number): string[] {
  return wrapper.findAll('.table-stub')[0].findAll('.row')[index]
    .findAll('button')
    .filter((b: any) => !b.classes().includes('menu-item-stub'))
    .map((b: any) => b.text().trim())
}

function moreItemsOf(wrapper: any, index: number): string[] {
  return wrapper.findAll('.table-stub')[0].findAll('.row')[index]
    .findAll('button.menu-item-stub')
    .map((b: any) => b.text().trim())
}

beforeEach(() => {
  document.body.innerHTML = ''
  vi.clearAllMocks()
})

describe('平台档与选客户两档', () => {
  it('平台档：配置、总账、队列、排产四处都不发请求，十格摆 —，开关与保存口全灰', async () => {
    const wrapper = await mountView({ superAdmin: true })

    expect(interactionApi.config).not.toHaveBeenCalled()
    expect(interactionApi.stats).not.toHaveBeenCalled()
    expect(interactionApi.comments).not.toHaveBeenCalled()
    expect(interactionApi.seedTasks).not.toHaveBeenCalled()

    expect(wrapper.findAll('.stat-cell__value').map(n => n.text().trim())).toEqual(Array(10).fill('—'))
    expect(wrapper.text()).toContain('请先在右上角切到「客户」并选一家')
    expect(byId(wrapper, '#interaction-ai-comment').disabled).toBe(true)
    expect(wrapper.find('#interaction-save-config').attributes('disabled')).toBeDefined()
  })

  it('选了客户：四处都按选中的那一家重取', async () => {
    const wrapper = await mountView({ superAdmin: true })

    authState.selectedTenantId = 558
    await flushPromises()

    expect(interactionApi.config).toHaveBeenLastCalledWith(558)
    expect(interactionApi.stats).toHaveBeenLastCalledWith(558)
    expect(interactionApi.comments).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1 }), 558)
    expect(interactionApi.seedTasks).toHaveBeenLastCalledWith(20, 558)
    expect(wrapper.findAll('.stat-cell__value').map(n => n.text().trim())).not.toContain('—')
  })
})

describe('配置卡', () => {
  it('两个开关各归各的：只开示例评论时虚拟点赞那颗仍然是关的', async () => {
    const wrapper = await mountView()

    expect(byId(wrapper, '#interaction-ai-comment').getAttribute('aria-checked')).toBe('true')
    expect(byId(wrapper, '#interaction-virtual-like').getAttribute('aria-checked')).toBe('false')
    expect(byId(wrapper, '#interaction-seed-per-article').value).toBe('3')
    expect(byId(wrapper, '#interaction-like-min').value).toBe('6')
    expect(byId(wrapper, '#interaction-like-max').value).toBe('28')
  })

  it('披露那句话原样念后端那一份，一个字都不改', async () => {
    const wrapper = await mountView()

    expect(wrapper.text()).toContain(DISCLOSURE_TEXT)
  })

  it('两个开关都关时念的是后端那句「全部来自真人」', async () => {
    const wrapper = await mountView({
      cfg: config({ aiCommentEnabled: 0, virtualLikeEnabled: 0, disclosure: '两个开关都关着：前台显示的评论与点赞数全部来自真人。' })
    })

    expect(wrapper.text()).toContain('两个开关都关着：前台显示的评论与点赞数全部来自真人。')
  })

  it('配置读失败：表单不渲染，也不回填一套看着像存过的默认值', async () => {
    const wrapper = await mountView({ configError: '这个租户没认出来' })

    expect(wrapper.text()).toContain('这个租户没认出来')
    expect(wrapper.find('#interaction-seed-per-article').exists()).toBe(false)
    expect(wrapper.find('#interaction-save-config').exists()).toBe(false)
  })

  it('保存被后端拒了就说那句中文，不说「已保存」', async () => {
    const wrapper = await mountView()
    vi.mocked(interactionApi.saveConfig).mockRejectedValue(new Error('虚拟点赞上界不能小于下界：收到下界 40、上界 6'))

    byId(wrapper, '#interaction-like-min').value = '40'
    await wrapper.find('#interaction-like-min').trigger('input')
    await wrapper.find('#interaction-save-config').trigger('click')
    await flushPromises()

    expect(message.success).not.toHaveBeenCalled()
    expect(message.error).toHaveBeenCalledWith('虚拟点赞上界不能小于下界：收到下界 40、上界 6')
  })

  it('只有 interaction:view 时改不动：开关与保存按钮全部禁用', async () => {
    const wrapper = await mountView({ permissions: [VIEW] })

    expect(byId(wrapper, '#interaction-ai-comment').disabled).toBe(true)
    expect(byId(wrapper, '#interaction-like-min').disabled).toBe(true)
    expect(wrapper.find('#interaction-save-config').attributes('disabled')).toBeDefined()
    expect(wrapper.text()).toContain('interaction:manage')
  })
})

describe('待审队列', () => {
  const QUEUE_EMPTIES: Array<[string, string]> = [
    ['NONE', '读者评论：这一档查过了，一条都没有。'],
    ['NOT_VISIBLE', '读者评论：这一档读不到（选中的那个身份在这张表里没有行），所以这里不能说「没有」。'],
    ['OUT_OF_RANGE', '读者评论：这一页翻过了头，往前面的页翻回来就有；这里没行不等于这一档没有。']
  ]

  const emptyLineText = (wrapper: any, tableIndex: number) =>
    wrapper.findAll('.table-stub')[tableIndex].find('.empty-line').text().trim()

  function commentsPayload(overrides: Record<string, unknown> = {}) {
    return {
      items: [],
      total: 0,
      page: 1,
      size: 20,
      pages: 0,
      counts: { pending: 0, approved: 0, rejected: 0, removed: 0 },
      emptyReason: 'NONE',
      emptyLine: QUEUE_EMPTIES[0][1],
      ...overrides
    }
  }
  it('三个动作传的是 approve / reject / remove', async () => {
    const wrapper = await mountView()
    const rows = wrapper.findAll('.row')

    await rows[0].find('#interaction-approve').trigger('click')
    await flushPromises()
    expect(interactionApi.moderate).toHaveBeenCalledWith(1, 'approve', undefined)

    await rows[0].findAll('button').find(b => b.text().trim() === '驳回')!.trigger('click')
    await flushPromises()
    expect(interactionApi.moderate).toHaveBeenCalledWith(1, 'reject', undefined)

    // 摘除在「更多」里，点它先出确认框，确认框那颗才真发请求
    await rows[0].findAll('button.menu-item-stub').find(b => b.text().trim() === '摘除')!.trigger('click')
    await flushPromises()
    expect(interactionApi.moderate).toHaveBeenCalledTimes(2)
    await wrapper.find('.modal-ok').trigger('click')
    await flushPromises()
    expect(interactionApi.moderate).toHaveBeenCalledWith(1, 'remove', undefined)
  })

  it('来源位只在后台念：系统补的那条写着「系统按开关补的示例评论」', async () => {
    const wrapper = await mountView()
    const rows = wrapper.findAll('.row')

    expect(rows[0].text()).toContain('读者写的')
    expect(rows[2].text()).toContain('系统按开关补的示例评论')
    // 认不出来的码不许猜一句人话顶上
    expect(rows[2].text()).not.toContain('ai_seed')
  })

  it('安全闸那句判语原样摆在详情抽屉里，它是「为什么这条还在等人」的唯一线索', async () => {
    const wrapper = await mountView()
    await openDetailOf(wrapper, 1)
    const drawer = detailDrawer(wrapper)

    expect(drawer.text()).toContain('这条在推销别的网站，先给人看一眼。')
    // 判语为 null 说的是「没被机器判过」，界面摆一个破折号，不猜一句「判定通过」
    await openDetailOf(wrapper, 0)
    expect(drawer.text()).toContain('机器没判过这一条')
    expect(drawer.text()).not.toContain('判定通过')
  })

  it('队列读失败不渲成一张空表', async () => {
    const wrapper = await mountView({ queueError: '队列接口 500' })

    expect(wrapper.text()).toContain('队列接口 500')
    expect(wrapper.find('.empty-line').exists()).toBe(false)
  })

  it.each(QUEUE_EMPTIES)('队列空且后端回 %s 时逐字念那一句，不再写死「没有等待处理的评论」', async (reason, line) => {
    const wrapper = await mountView({ commentsPayload: commentsPayload({ emptyReason: reason, emptyLine: line }) })

    expect(emptyLineText(wrapper, 0)).toBe(line)
    expect(wrapper.html()).not.toContain('没有等待处理的评论')
    expect(wrapper.html()).not.toContain('暂无数据')
  })

  it('队列空而后端没回是哪一种空时念「界面不替它猜」，不蒙成「真的没有」', async () => {
    const wrapper = await mountView({ commentsPayload: commentsPayload({ emptyReason: null, emptyLine: null }) })

    const said = emptyLineText(wrapper, 0)
    expect(said).toContain('后端没回是哪一种空')
    expect(said).not.toContain('一条都没有')
  })

  it('队列回「这一页翻过了头」时界面自己翻回第一页再读一遍', async () => {
    const wrapper = await mountView({ commentsPayload: commentsPayload({ total: 41, pages: 3 }) })
    const comments = vi.mocked(interactionApi.comments)
    comments.mockImplementation(async (params: any) => (params?.page === 4
      ? commentsPayload({ total: 41, page: 4, pages: 3, emptyReason: 'OUT_OF_RANGE', emptyLine: QUEUE_EMPTIES[2][1] })
      : commentsPayload({ total: 41, page: params?.page ?? 1, pages: 3 })) as any)

    await wrapper.find('.pager-stub').trigger('click')
    await flushPromises()

    expect(comments).toHaveBeenCalledTimes(3)
    const lastCall = comments.mock.calls[comments.mock.calls.length - 1]
    expect(lastCall[0] as any).toEqual(expect.objectContaining({ page: 1 }))
    expect(message.info).toHaveBeenCalledWith(JUMP_BACK_NOTICE)
    expect(emptyLineText(wrapper, 0)).toBe(QUEUE_EMPTIES[0][1])
  })

  it('缺 manage 码时队列只读，不摆三个动作', async () => {
    const wrapper = await mountView({ permissions: [VIEW] })

    expect(wrapper.find('#interaction-approve').exists()).toBe(false)
    expect(wrapper.text()).toContain('只读')
  })
})

/**
 * Spec-Q P2 把「待审评论」这一块接进了列表页模板的 B 型：表上面多一条读数，第一条是「等我处理」。
 *
 * 这里盯死的不是「有没有这句话」，而是这三个数的出处。页面上同屏有两个「等我处理」：
 * 页头那一格读 `stats.pendingReaderComments`（只数读者写的），
 * 队列这条读数读 `comments.counts.pending`（读者写的 + 系统补的都在内）。
 * 两个数天生会不一样，所以两处都得写清是谁的：页头那一格自己写着「只数读者写的」，
 * 队列这一行写着「全部评论」。测试也必须能分清界面读的是哪一个键——
 * 下面用「行数是 3、counts.pending 是 7」那份夹具把这条路钉住：抄错来源就会当场红。
 */
describe('待审队列的读数（B 型第一条是「等我处理」）', () => {
  function countLines(wrapper: any): string[] {
    return wrapper.findAll('.record-list-page__count').map((node: any) => node.text())
  }

  function emptyLines(wrapper: any): string[] {
    return wrapper.findAll('.empty-line').map((node: any) => node.text().trim())
  }

  const COUNT_LINE =
    '等我处理：待审 2 条。已对外 1 条、已驳回 0 条、已摘除 0 条' +
    '（这四个数按这一家全部评论分开数，读者写的和系统补的都在内，不随下面的状态筛选变）'

  it('读数逐字对上后端 counts 那四个键，「等我处理」排在最前', async () => {
    const wrapper = await mountView()

    expect(countLines(wrapper)).toEqual([COUNT_LINE])
    expect(countLines(wrapper)[0].indexOf('等我处理')).toBe(0)
  })

  it('四个数取的是 counts，不是当前页的行数（行 3 条、counts.pending 7 时念 7）', async () => {
    const wrapper = await mountView({
      commentsPayload: {
        items: [
          { id: 1, articleTitle: '签证攻略', content: '甲', status: 'pending', sourceText: '读者写的', moderationNote: null, createdAt: '2026-10-05T09:00:00' },
          { id: 2, articleTitle: '签证攻略', content: '乙', status: 'pending', sourceText: '读者写的', moderationNote: null, createdAt: '2026-10-05T09:30:00' },
          { id: 3, articleTitle: '开户材料', content: '丙', status: 'pending', sourceText: '系统按开关补的示例评论', moderationNote: null, createdAt: '2026-10-05T09:40:00' }
        ],
        total: 3,
        page: 1,
        size: 20,
        pages: 1,
        counts: { pending: 7, approved: 8, rejected: 9, removed: 10 },
        emptyReason: null,
        emptyLine: null
      }
    })

    const said = countLines(wrapper)[0]
    expect(said).toContain('待审 7 条')
    expect(said).toContain('已对外 8 条、已驳回 9 条、已摘除 10 条')
    expect(said).not.toContain('待审 3 条')
  })

  it('队列读失败：读数那一行一个字都不念，上一回的数不许留在屏上', async () => {
    const wrapper = await mountView({ queueError: '队列接口 500' })

    expect(countLines(wrapper)).toEqual([])
  })

  it('平台档：两块各说「这一发没发出去」，读数那一行不出现', async () => {
    const wrapper = await mountView({ superAdmin: true })

    expect(countLines(wrapper)).toEqual([])
    expect(emptyLines(wrapper)).toEqual([
      '待审队列按客户分开存：平台档没有「这一家」，这一发没有发出去，所以这里不能说「没有评论」。请在右上角切到「客户」并选一家。',
      '排产计划按客户分开存：平台档没有「这一家」，这一发没有发出去，所以这里不能说「没有计划」。请在右上角切到「客户」并选一家。'
    ])
    // 平台档不发这一发，队列里一个字都没有：既不能是后端的成因话，也不能是「真的没有」
    expect(wrapper.findAll('.table-stub')[0].text()).not.toContain('读者评论：这一档查过了')
  })
})

describe('总账与排产计划', () => {
  it('真实与系统补的分开数，各是一格', async () => {
    const wrapper = await mountView()
    const text = wrapper.find('.stat-grid').text()

    expect(text).toContain('真人点的赞')
    expect(text).toContain('系统补写的赞')
    expect(text).toContain('61')
    expect(text).toContain('12')
  })

  it('总账读失败说的是那句错，不摆一排零', async () => {
    const wrapper = await mountView({ statsError: '总账接口 500' })

    expect(wrapper.text()).toContain('总账接口 500')
    expect(wrapper.find('.stat-grid').exists()).toBe(false)
  })

  it('排产计划把随机时刻与「到点没补」那句原因一起念出来', async () => {
    const wrapper = await mountView()
    const rows = wrapper.findAll('.table-stub')[1].findAll('.row')

    expect(rows[1].text()).toContain('这篇的示例评论开关已经关掉，到点的那一条没有补')
    expect(rows[1].text()).not.toContain('SWITCH_OFF')
    expect(rows[0].text()).toContain('等待时刻')
  })

  it('排产读失败不渲成一张空表（那读起来像这条链什么都没干）', async () => {
    const wrapper = await mountView({ seedError: '排产接口 500' })

    expect(wrapper.text()).toContain('排产接口 500')
    expect(wrapper.html()).not.toContain('还没有排产计划')
    expect(wrapper.find('.empty-line').exists()).toBe(false)
  })

  const SEED_EMPTIES: Array<[string, string]> = [
    ['NONE', '示例评论的排产计划：这一档查过了，一条都没有。'],
    ['NOT_VISIBLE', '示例评论的排产计划：这一档读不到（选中的那个身份在这张表里没有行），所以这里不能说「没有」。']
  ]

  function seedPayload(overrides: Record<string, unknown> = {}) {
    return {
      records: [],
      total: 0,
      page: 1,
      size: 1,
      pages: 0,
      emptyReason: 'NONE',
      emptyLine: SEED_EMPTIES[0][1],
      ...overrides
    }
  }

  it.each(SEED_EMPTIES)('排产为空且后端回 %s 时逐字念那一句，不再写死「还没有排产计划」', async (reason, line) => {
    const wrapper = await mountView({ seedPayload: seedPayload({ emptyReason: reason, emptyLine: line }) })

    expect(wrapper.findAll('.table-stub')[1].find('.empty-line').text().trim()).toBe(line)
    expect(wrapper.html()).not.toContain('还没有排产计划')
    expect(wrapper.html()).not.toContain('暂无数据')
  })

  it('排产空而后端没回是哪一种空时念「界面不替它猜」，不蒙成「真的没有」', async () => {
    const wrapper = await mountView({ seedPayload: seedPayload({ emptyReason: null, emptyLine: null }) })

    const said = wrapper.findAll('.table-stub')[1].find('.empty-line').text().trim()
    expect(said).toContain('后端没回是哪一种空')
    expect(said).not.toContain('一条都没有')
  })
})

/**
 * 摘除改成一种状态（2026-11-07 拍板 Q2/Q3/Q4）。
 *
 * 这一节钉的是「撤下来的那条在界面上还有没有下文」：以前摘完哪一档都查不回来，
 * 连三个数都不算它（证据 `scratch/specq-p2/remove-evidence.json`：摘除后五个档全 0、counts 全 0）。
 * 现在必须有第五档、那一档的行必须有放回，而且不能再拿「不再出现在这个列表里」骗人。
 */
describe('已摘除是一档，不是一个查不回来的动作', () => {
  function rowOf(id: number, status: string) {
    return {
      id,
      articleId: 231,
      articleTitle: '签证攻略',
      authorName: '读者' + id,
      content: '内容' + id,
      status,
      source: 'reader',
      sourceText: '读者写的',
      moderationNote: null,
      createdAt: '2026-10-05T09:00:00',
      reviewedAt: null
    }
  }

  function queueWith(statuses: string[]) {
    return {
      items: statuses.map((status, i) => rowOf(i + 1, status)),
      total: statuses.length,
      page: 1,
      size: 20,
      pages: 1,
      counts: { pending: 1, approved: 1, rejected: 1, removed: 1 },
      emptyReason: null,
      emptyLine: null
    } as any
  }

  it('五个档平铺成一排、各带后端 counts 的数；「全部」是四个数之和', async () => {
    const wrapper = await mountView()
    const chips = wrapper.findAll('#interaction-status-filter .status-chip')

    expect(chips.map((c: any) => c.text().replace(/\s+/g, ''))).toEqual([
      '待审2', '已对外1', '已驳回0', '已摘除0', '全部3'
    ])
    // 默认档是待审：那颗反白
    expect(chips[0].classes()).toContain('status-chip--active')
    expect(chips[4].classes()).not.toContain('status-chip--active')
  })

  it('点别的档就按那个档重取，换档清勾选', async () => {
    const wrapper = await mountView()
    await checkRow(wrapper, 0)
    expect(wrapper.find('.interaction-page').text()).toContain('已选 1 条')

    await wrapper.findAll('#interaction-status-filter .status-chip')[3].trigger('click')
    await flushPromises()

    expect(interactionApi.comments).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: 'removed' }), undefined)
    expect(wrapper.find('.interaction-page').text()).not.toContain('已选')
  })

  it('待审与已对外给摘除；已驳回与已摘除不给（已驳回没有「撤下」这件事，摘完只能放回成已对外）', async () => {
    const wrapper = await mountView({ commentsPayload: queueWith(['pending', 'approved', 'rejected', 'removed']) })

    // 行内只留「放行 / 放回」与一颗「更多」；带后果的驳回与摘除在下拉里（Q3 拍的那一条）
    expect(inlineButtonsOf(wrapper, 0)).toEqual(['看全文', '放行', '更多'])
    expect(moreItemsOf(wrapper, 0)).toEqual(['看全文', '驳回', '摘除'])
    expect(inlineButtonsOf(wrapper, 1)).toEqual(['看全文', '更多'])
    expect(moreItemsOf(wrapper, 1)).toEqual(['看全文', '摘除'])
    expect(inlineButtonsOf(wrapper, 2)).toEqual(['看全文'])
    expect(moreItemsOf(wrapper, 2)).toEqual([])
    expect(inlineButtonsOf(wrapper, 3)).toEqual(['看全文', '放回'])
    expect(moreItemsOf(wrapper, 3)).toEqual([])
  })

  it('已摘除那一行的「放回」传的是 approve：后端那条边是 removed → approved，不是退回待审', async () => {
    const wrapper = await mountView({ commentsPayload: queueWith(['removed']) })
    const restore = wrapper.findAll('.table-stub')[0].findAll('.row')[0]
      .findAll('button').find((b: any) => b.text().trim() === '放回')

    await restore!.trigger('click')
    await flushPromises()

    expect(interactionApi.moderate).toHaveBeenCalledWith(1, 'approve', undefined)
  })

  it('确认框那句中文改口：说这一条会进「已摘除」那一档、查得回来放得回去', async () => {
    const wrapper = await mountView({ commentsPayload: queueWith(['pending', 'approved']) })
    await openDetailOf(wrapper, 0)
    const popconfirm = wrapper.findAllComponents({ name: 'APopconfirm' })[0]

    expect(popconfirm.props('title')).toContain('已摘除')
    expect(popconfirm.props('title')).toContain('放得回去')
    // 旧那句是假话：摘完之后哪一档都查不到它
    expect(popconfirm.props('title')).not.toContain('也不再出现在这个列表里')
    // 行内「更多」那条路用的是同一句：两处各写一份早晚分家
    expect(wrapper.find('.modal-stub').text()).toContain(popconfirm.props('title'))
  })

  it('已摘除那一行的状态那一格念「已摘除」，不是把 removed 原样显示出来', async () => {
    const wrapper = await mountView({ commentsPayload: queueWith(['pending', 'approved', 'rejected', 'removed']) })

    const said = wrapper.findAll('.table-stub')[0].findAll('.row')[3].text()
    expect(said).toContain('已摘除')
    expect(said).not.toContain('removed')
  })

  it('摘除成功后那句话交代「去哪、怎么回来」，不许只念「已处理」', async () => {
    const wrapper = await mountView({ commentsPayload: queueWith(['pending']) })
    await openDetailOf(wrapper, 0)
    const popconfirm = wrapper.findAllComponents({ name: 'APopconfirm' })[0]

    popconfirm.vm.$emit('confirm')
    await flushPromises()

    expect(interactionApi.moderate).toHaveBeenCalledWith(1, 'remove', undefined)
    expect(message.success).toHaveBeenCalledWith(expect.stringContaining('已摘除'))
    expect(message.success).toHaveBeenCalledWith(expect.stringContaining('「已摘除」那一档'))
    expect(message.success).not.toHaveBeenCalledWith('已处理')
    // 队列重取之后那一行可能已经不在这一档里，抽屉留着会显示一份过期的状态
    expect(detailDrawer(wrapper).props('open')).toBe(false)
  })
})

/**
 * Spec-R R1：这一屏原来五块叠着，现场量到 1440 那一档第一行评论在 1478px 处（首屏 0 行）。
 * 现在队列是第一块，设置 / 总账 / 排产各由页头一颗按钮开抽屉。
 *
 * 这一节钉三件事：①三块真在抽屉里、按钮真接上了开关；②页头留的那一格读的是后端哪一个键；
 * ③开关抽屉不许动到队列（不多发请求、筛选与页码不变）——那正是「抽屉」相对「跳一页」的好处。
 */
describe('Spec-R R1：三块低频内容进抽屉，队列排第一', () => {
  function drawers(wrapper: any) {
    return wrapper.findAllComponents({ name: 'ADrawer' })
  }

  function drawerByTitle(wrapper: any, title: string) {
    return drawers(wrapper).find((d: any) => d.props('title') === title)!
  }

  it('页头三颗按钮各开一个抽屉，标题与摆放宽度对得上方案', async () => {
    const wrapper = await mountView()
    const lowFrequency = () => drawers(wrapper).filter((d: any) => d.props('title') !== '这一条评论')

    expect(lowFrequency().map((d: any) => d.props('title'))).toEqual([
      '读者互动设置', '这一家的互动总账', '示例评论的排产计划'
    ])
    expect(lowFrequency().map((d: any) => d.props('width'))).toEqual([560, 560, 720])
    expect(lowFrequency().every((d: any) => d.props('placement') === 'right')).toBe(true)
    expect(lowFrequency().every((d: any) => d.props('open') === false)).toBe(true)

    await wrapper.find('#interaction-open-config').trigger('click')
    expect(lowFrequency().map((d: any) => d.props('open'))).toEqual([true, false, false])

    await wrapper.find('#interaction-open-stats').trigger('click')
    expect(lowFrequency().map((d: any) => d.props('open'))).toEqual([true, true, false])

    await wrapper.find('#interaction-open-seed').trigger('click')
    expect(lowFrequency().map((d: any) => d.props('open'))).toEqual([true, true, true])
  })

  it('设置表单、十格总账、排产表都在抽屉里，不在页面流里', async () => {
    const wrapper = await mountView()

    expect(wrapper.find('#interaction-ai-comment').element.closest('.drawer-stub')).not.toBeNull()
    expect(wrapper.find('.stat-grid').element.closest('.drawer-stub')).not.toBeNull()
    expect(wrapper.findAll('.table-stub')[1].element.closest('.drawer-stub')).not.toBeNull()
  })

  it('队列排在三个抽屉前面：打开这一屏第一块就是待审评论', async () => {
    const wrapper = await mountView()
    const blocks = Array.from((wrapper.element as HTMLElement).querySelectorAll('.record-list-page, .drawer-stub'))

    expect(blocks[0].classList.contains('record-list-page')).toBe(true)
    expect(blocks[0].textContent).toContain('待审评论')
  })

  it('页头留的那一格读 stats.pendingReaderComments，并写清「只数读者写的」', async () => {
    // 队列 counts.pending 是 2，总账 pendingReaderComments 给 4：抄错来源就会当场红
    const wrapper = await mountView({
      statsPayload: {
        readerComments: 9, approvedReaderComments: 5, pendingReaderComments: 4, seededComments: 4,
        virtualLikes: 61, readerLikes: 12, seedPending: 6, seedDone: 4, seedSkipped: 1, seedFailed: 0
      }
    })
    const head = wrapper.find('.interaction-head')

    expect(head.find('.interaction-head__value').text()).toBe('4')
    expect(head.text()).toContain('等我处理的读者评论')
    expect(head.text()).toContain('只数读者写的')
  })

  it('平台档：页头那一格摆 —，不是 0', async () => {
    const wrapper = await mountView({ superAdmin: true })

    expect(wrapper.find('.interaction-head__value').text()).toBe('—')
  })

  it('后端那句 disclosure 留在首屏，不只藏在设置抽屉里', async () => {
    const wrapper = await mountView()
    const alert = wrapper.find('.interaction-disclosure')

    expect(alert.exists()).toBe(true)
    expect(alert.text()).toContain(DISCLOSURE_TEXT)
    expect(alert.element.closest('.drawer-stub')).toBeNull()
  })

  it('开关抽屉不动队列：不多发一发请求，筛选与页码一个字不变', async () => {
    const wrapper = await mountView()
    const before = vi.mocked(interactionApi.comments).mock.calls.length
    const activeChip = () => wrapper.find('#interaction-status-filter .status-chip--active').text().replace(/\s+/g, '')

    await wrapper.find('#interaction-open-config').trigger('click')
    await wrapper.find('#interaction-open-stats').trigger('click')
    await wrapper.find('#interaction-open-seed').trigger('click')
    await flushPromises()
    drawerByTitle(wrapper, '读者互动设置').vm.$emit('update:open', false)
    await flushPromises()

    expect(vi.mocked(interactionApi.comments).mock.calls.length).toBe(before)
    expect(activeChip()).toBe('待审2')
    expect(drawerByTitle(wrapper, '读者互动设置').props('open')).toBe(false)
  })

  it('保存设置之后抽屉不关，后端回的那份值回显进表单', async () => {
    const wrapper = await mountView()
    vi.mocked(interactionApi.saveConfig).mockResolvedValue(config({ aiCommentMaxPerArticle: 7 }) as any)

    await wrapper.find('#interaction-open-config').trigger('click')
    await wrapper.find('#interaction-save-config').trigger('click')
    await flushPromises()

    expect(message.success).toHaveBeenCalledWith('设置已保存')
    expect(drawerByTitle(wrapper, '读者互动设置').props('open')).toBe(true)
    expect(byId(wrapper, '#interaction-seed-per-article').value).toBe('7')
  })
})

/**
 * Spec-R R2：行内与详情（Q2/Q3/Q7/Q9 拍的那四条）。
 *
 * 这一节最坏的那件事是 1000 字的长评论：上一版正文列没有上限宽度，
 * 现场量到整张表被撑到 15445px、放行那颗按钮离手 14 屏（scratch/spec-r-interaction/out/measure.json）。
 * 所以列的定义本身进判据：五列、每列有写死的上限宽度、加起来不许超 1000。
 */
describe('Spec-R R2：行内两行封顶 + 详情抽屉', () => {
  it('六列（勾选列打头）、每列都带上限宽度，正文那列 380；「谁写的 / 作者」合成了「来源」一列', async () => {
    const wrapper = await mountView()
    const table = wrapper.findAllComponents({ name: 'ATable' })[0]
    const columns = table.props('columns').map((c: any) => ({ ...c }))

    expect(columns.map((c: any) => c.key)).toEqual(['select', 'content', 'articleTitle', 'source', 'status', 'actions'])
    expect(columns.every((c: any) => typeof c.width === 'number')).toBe(true)
    expect(columns.find((c: any) => c.key === 'content')!.width).toBe(380)
    expect(columns.find((c: any) => c.key === 'select')!.width).toBe(50)
    // 上一版被撑到 15445px 的那条缺陷：列宽总和是硬闸，谁加列谁就得改这个数
    expect(columns.reduce((sum: number, c: any) => sum + c.width, 0)).toBeLessThanOrEqual(1000)
    // 现场量过 max-content 那一形（长标题把表撑到 1599px）：x 给数字才走固定列宽
    expect(wrapper.findComponent({ name: 'RecordListPage' }).props('scroll')).toEqual({ x: 990 })
  })

  it('没有管理权限时没有勾选列，五列照旧', async () => {
    const wrapper = await mountView({ permissions: [VIEW] })
    const columns = wrapper.findAllComponents({ name: 'ATable' })[0].props('columns').map((c: any) => c.key)

    expect(columns).toEqual(['content', 'articleTitle', 'source', 'status', 'actions'])
    expect(wrapper.findAll('.table-stub')[0].findAll('input[type="checkbox"]').length).toBe(0)
  })

  it('长评论行内只摆两行封顶的那块 + 看全文；详情抽屉里全文一字不截断', async () => {
    const long = '这一段读者写的评论故意拉得长一些好用来看内容列不截断时行会被撑到多高。'.repeat(20)
    const wrapper = await mountView({
      commentsPayload: {
        items: [
          {
            id: 1, articleId: 231, articleTitle: '签证攻略', articleUrl: null, authorName: '读者甲',
            content: long, status: 'pending', source: 'reader', sourceText: '读者写的',
            moderationNote: null, createdAt: '2026-10-05T09:00:00', reviewedAt: null, reviewedBy: null, reviewedByName: null
          }
        ],
        total: 1, page: 1, size: 20, pages: 1,
        counts: { pending: 1, approved: 0, rejected: 0, removed: 0 },
        emptyReason: null, emptyLine: null
      }
    })

    const row = wrapper.findAll('.row')[0]
    expect(row.find('.comment-excerpt').exists()).toBe(true)
    // 行内这块摆的是同一段话（两行封顶是 CSS 的事），截没截由详情抽屉那一格分清
    expect(row.find('.comment-excerpt').text()).toBe(long)

    await openDetailOf(wrapper, 0)
    const full = detailDrawer(wrapper).find('#interaction-comment-full-text')
    expect(full.text()).toBe(long)
    expect(detailDrawer(wrapper).text()).toContain('全文（一字不截断）')
  })

  it('来源那一格上下两行：来源话术在后端那份，作者名跟在同一格', async () => {
    const wrapper = await mountView()
    const row = wrapper.findAll('.row')[0]

    expect(row.text()).toContain('读者写的')
    expect(row.text()).toContain('读者甲')
  })

  it('「到站点上看这一条」只在新标签开：当前页跳走会把队列的筛选与页码丢干净', async () => {
    const wrapper = await mountView({
      commentsPayload: {
        items: [
          {
            id: 1, articleId: 94, articleTitle: '签证攻略', articleUrl: '/news/qian-zheng?site=lanshan',
            authorName: '读者甲', content: '讲得很清楚', status: 'pending', source: 'reader',
            sourceText: '读者写的', moderationNote: null, createdAt: '2026-10-05T09:00:00',
            reviewedAt: null, reviewedBy: null, reviewedByName: null
          }
        ],
        total: 1, page: 1, size: 20, pages: 1,
        counts: { pending: 1, approved: 0, rejected: 0, removed: 0 },
        emptyReason: null, emptyLine: null
      }
    })
    await openDetailOf(wrapper, 0)
    const link = detailDrawer(wrapper).find('#interaction-open-article')

    expect(link.exists()).toBe(true)
    expect(link.attributes('target')).toBe('_blank')
    expect(link.attributes('rel')).toContain('noopener')
    // 相对路径按当前 origin 补前缀，开出来就是能点开的完整地址
    expect(link.attributes('href')).toBe(window.location.origin + '/news/qian-zheng?site=lanshan')
  })

  it('后端没给文章地址就不摆链接：不摆一条点了 404 的地址', async () => {
    const wrapper = await mountView()
    await openDetailOf(wrapper, 0)

    expect(detailDrawer(wrapper).find('#interaction-open-article').exists()).toBe(false)
  })

  it('谁处理的念后端查回来的名字；没处理过的念「还没人处理过」，不猜一个「管理员」', async () => {
    const wrapper = await mountView({
      commentsPayload: {
        items: [
          {
            id: 1, articleId: 231, articleTitle: '签证攻略', articleUrl: null, authorName: '读者甲',
            content: '讲得很清楚', status: 'approved', source: 'reader', sourceText: '读者写的',
            moderationNote: null, createdAt: '2026-10-05T09:00:00', reviewedAt: '2026-10-05T10:00:00',
            reviewedBy: 88, reviewedByName: '澜山运营'
          },
          {
            id: 2, articleId: 231, articleTitle: '签证攻略', articleUrl: null, authorName: '读者乙',
            content: '看着像广告', status: 'pending', source: 'reader', sourceText: '读者写的',
            moderationNote: null, createdAt: '2026-10-05T09:30:00', reviewedAt: null,
            reviewedBy: null, reviewedByName: null
          }
        ],
        total: 2, page: 1, size: 20, pages: 1,
        counts: { pending: 1, approved: 1, rejected: 0, removed: 0 },
        emptyReason: null, emptyLine: null
      }
    })

    await openDetailOf(wrapper, 0)
    expect(detailDrawer(wrapper).text()).toContain('澜山运营')
    expect(detailDrawer(wrapper).text()).not.toContain('管理员')

    await openDetailOf(wrapper, 1)
    expect(detailDrawer(wrapper).text()).toContain('还没人处理过')
  })

  it('已驳回的那条在抽屉里没有动作，只有那句话；已摘除的那条给放回', async () => {
    const wrapper = await mountView({ commentsPayload: queueWithFixture(['rejected', 'removed']) })
    // antd 的按钮会给「放回」两个字中间插一个空格：按去空格后的文字比对
    const buttonsIn = () => detailDrawer(wrapper).findAll('button').map((b: any) => b.text().replace(/\s+/g, ''))

    await openDetailOf(wrapper, 0)
    expect(detailDrawer(wrapper).text()).toContain('已驳回的评论不能再改状态。')
    expect(buttonsIn().filter((t: string) => ['放行', '放回', '驳回', '摘除'].includes(t))).toEqual([])

    await openDetailOf(wrapper, 1)
    expect(buttonsIn().filter((t: string) => ['放行', '放回', '驳回', '摘除'].includes(t))).toEqual(['放回'])
  })
})

/** 上面这一节用的四档夹具，跟「已摘除是一档」那一节同一个形状 */
function queueWithFixture(statuses: string[]) {
  return {
    items: statuses.map((status, i) => ({
      id: i + 1, articleId: 231, articleTitle: '签证攻略', articleUrl: null,
      authorName: '读者' + (i + 1), content: '内容' + (i + 1), status,
      source: 'reader', sourceText: '读者写的', moderationNote: null,
      createdAt: '2026-10-05T09:00:00', reviewedAt: null, reviewedBy: null, reviewedByName: null
    })),
    total: statuses.length, page: 1, size: 20, pages: 1,
    counts: { pending: 1, approved: 1, rejected: 1, removed: 1 },
    emptyReason: null, emptyLine: null
  } as any
}


/**
 * Spec-R R3：勾选批量（Q6/Q6-1/Q6-2）。
 *
 * 后端那口已经钉过：只收 approve/reject、一次最多 50、逐行过转移表。界面这一节钉的是勾选那半：
 * 勾的是「这一页这几条」，翻页/换档/切客户都得清；批量回包里「M 条没动」要把原因念出来。
 */
describe('Spec-R R3：勾选与批量放行/驳回', () => {
  function selectableRows(wrapper: any) {
    return wrapper.findAll('.table-stub')[0].findAll('.row')
  }

  it('勾两行摆「已选 2 条」，批量两颗按钮跟着出现；全选本页把三行都勾上', async () => {
    const wrapper = await mountView()

    expect(wrapper.text()).not.toContain('批量放行')

    await checkRow(wrapper, 0)
    await checkRow(wrapper, 1)
    expect(wrapper.find('.interaction-page').text()).toContain('已选 2 条')
    expect(wrapper.find('#interaction-batch-approve').exists()).toBe(true)
    expect(wrapper.find('#interaction-batch-reject').exists()).toBe(true)

    await wrapper.findAll('button').find((b: any) => b.text().trim() === '全选本页')!.trigger('click')
    await flushPromises()
    expect(wrapper.find('.interaction-page').text()).toContain('已选 3 条')
  })

  it('批量放行把勾的 id 原样交给后端，成功后清勾选并重取队列与总账', async () => {
    const wrapper = await mountView()
    await checkRow(wrapper, 0)
    await checkRow(wrapper, 1)
    const queueCallsBefore = vi.mocked(interactionApi.comments).mock.calls.length
    const statsCallsBefore = vi.mocked(interactionApi.stats).mock.calls.length

    vi.mocked(interactionApi.moderateBatch).mockResolvedValue({
      action: 'approve', total: 2, success: 2, failed: 0,
      results: [{ id: 1, ok: true, status: 'approved' }, { id: 2, ok: true, status: 'approved' }]
    } as any)
    await wrapper.find('#interaction-batch-approve').trigger('click')
    await flushPromises()

    expect(interactionApi.moderateBatch).toHaveBeenCalledWith([1, 2], 'approve', undefined)
    expect(message.success).toHaveBeenCalledWith(expect.stringContaining('批量放行完成：成功 2 条'))
    expect(wrapper.find('.interaction-page').text()).not.toContain('已选')
    expect(vi.mocked(interactionApi.comments).mock.calls.length).toBeGreaterThan(queueCallsBefore)
    expect(vi.mocked(interactionApi.stats).mock.calls.length).toBeGreaterThan(statsCallsBefore)
  })

  it('「M 条没动」把每一行的原因原样念出来，不替后端改写', async () => {
    const wrapper = await mountView()
    await checkRow(wrapper, 0)
    await checkRow(wrapper, 1)
    vi.mocked(interactionApi.moderateBatch).mockResolvedValue({
      action: 'approve', total: 2, success: 1, failed: 1,
      results: [{ id: 1, ok: true, status: 'approved' }, { id: 2, ok: false, reason: '评论不能从 rejected 变成 approved：已经对外显示的话要收回，请用摘除' }]
    } as any)

    await wrapper.find('#interaction-batch-approve').trigger('click')
    await flushPromises()

    expect(message.warning).toHaveBeenCalledWith(expect.stringContaining('成功 1 条'))
    expect(message.warning).toHaveBeenCalledWith(expect.stringContaining('#2：评论不能从 rejected 变成 approved'))
  })

  it('勾选上限与后端同数：第 51 条勾不进去，当场说一句', async () => {
    const rows = Array.from({ length: 51 }, (_, i) => ({
      id: i + 1, articleId: 231, articleTitle: '签证攻略', articleUrl: null, authorName: '读者' + (i + 1),
      content: '内容' + (i + 1), status: 'pending', source: 'reader', sourceText: '读者写的',
      moderationNote: null, createdAt: '2026-10-05T09:00:00', reviewedAt: null, reviewedBy: null, reviewedByName: null
    }))
    const wrapper = await mountView({
      commentsPayload: {
        items: rows, total: 51, page: 1, size: 100, pages: 1,
        counts: { pending: 51, approved: 0, rejected: 0, removed: 0 }, emptyReason: null, emptyLine: null
      }
    })

    for (let i = 0; i < 51; i++) await checkRow(wrapper, i)

    expect(wrapper.find('.interaction-page').text()).toContain('已选 50 条')
    expect(message.warning).toHaveBeenCalledWith(expect.stringContaining('一次最多批量处理 50 条'))
    expect(wrapper.find('#interaction-batch-approve').exists()).toBe(true)
    // 那一发根本不该发出去：上限在勾的时候就拦下了
    expect(interactionApi.moderateBatch).not.toHaveBeenCalled()
  })

  it('翻页清勾选；切客户那一发也清（watch 那条路）', async () => {
    const wrapper = await mountView({ commentsPayload: { ...queueWithFixture(['pending', 'pending']), total: 41, pages: 3 } })
    await checkRow(wrapper, 0)
    expect(wrapper.find('.interaction-page').text()).toContain('已选 1 条')

    await wrapper.find('.pager-stub').trigger('click')
    await flushPromises()
    expect(wrapper.find('.interaction-page').text()).not.toContain('已选')

    authState.isSuperAdmin = true
    authState.selectedTenantId = 558
    await flushPromises()
    await checkRow(wrapper, 0)
    expect(wrapper.find('.interaction-page').text()).toContain('已选 1 条')
    authState.selectedTenantId = 42
    await flushPromises()
    expect(wrapper.find('.interaction-page').text()).not.toContain('已选')
  }, 15000)

  it('批量口被后端拒时原样念那句中文（50 上限那道门是双保险）', async () => {
    const wrapper = await mountView()
    await checkRow(wrapper, 0)
    vi.mocked(interactionApi.moderateBatch).mockRejectedValue(new Error('一次最多批量处理 50 条，这次收到 51 条；勾选不跨页，翻页会清空'))

    await wrapper.find('#interaction-batch-approve').trigger('click')
    await flushPromises()

    expect(message.error).toHaveBeenCalledWith(expect.stringContaining('一次最多批量处理 50 条'))
    // 拒了不许清勾选：人还得留着这份勾选重试
    expect(wrapper.find('.interaction-page').text()).toContain('已选 1 条')
  }, 15000)
})
