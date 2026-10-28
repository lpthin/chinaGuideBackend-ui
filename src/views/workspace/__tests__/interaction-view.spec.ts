import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { Button, InputNumber, RadioGroup, Switch, message } from 'ant-design-vue'
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
    stats: vi.fn(),
    seedTasks: vi.fn()
  }
}))

const authState = {
  permissions: [] as string[],
  selectedTenantId: null as number | null
}

vi.mock('../../../stores/auth', () => ({
  useAuthStore: () => ({
    get permissions() {
      return authState.permissions
    },
    get selectedTenantId() {
      return authState.selectedTenantId
    },
    isSuperAdmin: false,
    hasPermission: (code: string) => authState.permissions.includes(code)
  })
}))

const PASS_THROUGH = (name: string) => ({
  name,
  props: ['title', 'message', 'description', 'type', 'showIcon', 'size', 'label', 'bordered', 'loading', 'okText', 'cancelText'],
  template: `<div class="${name}-stub"><span>{{ title }}{{ message }}{{ description }}</span><slot /><slot name="extra" /><slot name="actions" /></div>`
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
} = {}) {
  authState.permissions = options.permissions ?? [VIEW, MANAGE]
  authState.selectedTenantId = null

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
      counts: { pending: 2, approved: 1, rejected: 0 },
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
    vi.mocked(interactionApi.stats).mockResolvedValue({
      readerComments: 9, approvedReaderComments: 5, pendingReaderComments: 2, seededComments: 4,
      virtualLikes: 61, readerLikes: 12, seedPending: 6, seedDone: 4, seedSkipped: 1, seedFailed: 0
    } as any)
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
        FilterBar: PASS_THROUGH('FilterBar'),
        'a-button': Button,
        'a-input-number': InputNumber,
        'a-switch': Switch,
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

beforeEach(() => {
  document.body.innerHTML = ''
  vi.clearAllMocks()
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
      counts: { pending: 0, approved: 0, rejected: 0 },
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

    await rows[0].findAll('button').find(b => b.text() === '驳回')!.trigger('click')
    await flushPromises()
    expect(interactionApi.moderate).toHaveBeenCalledWith(1, 'reject', undefined)
  })

  it('来源位只在后台念：系统补的那条写着「系统按开关补的示例评论」', async () => {
    const wrapper = await mountView()
    const rows = wrapper.findAll('.row')

    expect(rows[0].text()).toContain('读者写的')
    expect(rows[2].text()).toContain('系统按开关补的示例评论')
    // 认不出来的码不许猜一句人话顶上
    expect(rows[2].text()).not.toContain('ai_seed')
  })

  it('安全闸那句判语原样摆出来，它是「为什么这条还在等人」的唯一线索', async () => {
    const wrapper = await mountView()
    const rows = wrapper.findAll('.row')

    expect(rows[1].text()).toContain('这条在推销别的网站，先给人看一眼。')
    // 判语为 null 说的是「没被机器判过」，界面摆一个破折号，不猜一句「判定通过」
    expect(rows[0].text()).toContain('—')
    expect(rows[0].text()).not.toContain('通过')
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
    ['NONE', '示例评论排产计划：这一档查过了，一条都没有。'],
    ['NOT_VISIBLE', '示例评论排产计划：这一档读不到（选中的那个身份在这张表里没有行），所以这里不能说「没有」。']
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
