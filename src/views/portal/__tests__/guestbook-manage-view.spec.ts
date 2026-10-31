import { describe, it, expect, beforeEach, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { Button, message } from 'ant-design-vue'
import GuestbookManageView from '../GuestbookManageView.vue'
import { guestbookApi } from '../../../api/portal'

/**
 * 留言管理页上「留资线索」那个徽标的两条纪律（任务 #11 / N7）。
 *
 * 1. 类型中文名只有 GET /guestbook/types 一个来源：这里的桩故意回一个后端从没给过的标签，
 *    界面要显示的是它，不是任何写死在 .vue 里的「留资线索」；
 * 2. 类型筛选必须真的变成一个 query 参数发出去。这一页原来那个搜索框就是反面教材——
 *    框在、按钮在、点了没反应，因为参数压根没拼进请求。
 *
 * M-P100 又钉了四件事（这一屏那四张统计卡与取数口径）：
 * 3. 没选定客户时一口都不发，屏上不摆任何一家的数；
 * 4. 四个数改叫后端那一口 GET /guestbook/stats，不再发四口 list 只为各拿一个 total；
 * 5. 读失败/读不到摆「—」并原样念后端那句，不与「这一家真没有」共用一句；
 * 6. 列表与统计各读各的：一边断了不许把另一边拖成一次都不发。
 */

vi.mock('ant-design-vue', async () => {
  const actual = await vi.importActual<Record<string, any>>('ant-design-vue')
  return {
    ...actual,
    message: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn(), loading: vi.fn() }
  }
})

const authMock: Record<string, any> = {
  isSuperAdmin: true,
  selectedTenantId: 15 as number | null,
  selectedTenantCode: 'demo' as string | null,
  user: { tenantId: 15 as number | null }
}

vi.mock('../../../stores/auth', () => ({
  useAuthStore: () => authMock
}))

vi.mock('../../../api/portal', () => ({
  guestbookApi: {
    list: vi.fn(),
    stats: vi.fn(),
    types: vi.fn(),
    budgets: vi.fn(),
    reply: vi.fn(),
    delete: vi.fn()
  },
  companyInfoApi: {},
  bannerApi: {},
  siteApi: {}
}))

const PASS_THROUGH = (name: string, extraSlots: string[] = []) => ({
  name,
  props: ['title', 'subTitle', 'bordered', 'hoverable'],
  template: `<div class="${name}-stub">${
    extraSlots.includes('title') ? '<slot name="title" />' : ''
  }<slot /></div>`
})

const SELECT_STUB = {
  name: 'ASelect',
  props: ['value', 'placeholder'],
  emits: ['update:value', 'change'],
  template: `<span class="select-stub" :data-placeholder="placeholder">
    <slot />
    <button class="select-pick" @click="$emit('update:value', 'inquiry'); $emit('change', 'inquiry')">选它</button>
  </span>`
}

const TABLE_STUB = {
  name: 'ATable',
  props: {
    dataSource: { type: Array, default: () => [] },
    columns: { type: Array, default: () => [] }
  },
  template: `
    <div class="table-stub">
      <div v-if="!dataSource.length" class="empty-slot"><slot name="emptyText" /></div>
      <div v-for="record in dataSource" :key="record.id" class="row">
        <template v-for="column in columns" :key="column.key">
          <slot v-if="$slots.bodyCell" name="bodyCell" :column="column" :record="record" />
        </template>
      </div>
    </div>`
}

// 全局替件把 a-alert 直接渲染成 nothing：这一屏「看的是哪一家」「那四个数没读上来」都靠它，得留出可读的槽
const ALERT_STUB = {
  name: 'AAlert',
  props: ['message', 'description', 'type', 'showIcon'],
  template: '<div class="alert-stub"><span class="alert-msg">{{ message }}</span></div>'
}

function row(id: number, type: string | null) {
  return {
    id,
    tenantId: 15,
    siteId: 12,
    userName: `访客 ${id}`,
    phone: '13800000000',
    content: '想问一下报价',
    status: 'pending',
    type,
    companyName: null,
    budgetCode: null,
    createTime: '2026-09-25T09:00:00',
    replyTime: null,
    replyContent: null
  }
}

async function mountView() {
  const wrapper = mount(GuestbookManageView, {
    attachTo: document.body,
    global: {
      stubs: {
        'a-button': Button,
        'a-page-header': PASS_THROUGH('APageHeader'),
        'a-card': PASS_THROUGH('ACard', ['title']),
        'a-row': PASS_THROUGH('ARow'),
        'a-col': PASS_THROUGH('ACol'),
        'a-spin': PASS_THROUGH('ASpin'),
        'a-space': PASS_THROUGH('ASpace'),
        'a-tag': PASS_THROUGH('ATag'),
        'a-select': SELECT_STUB,
        'a-select-option': { name: 'ASelectOption', template: '<option><slot /></option>' },
        'a-input-search': PASS_THROUGH('AInputSearch'),
        'a-popconfirm': PASS_THROUGH('APopconfirm'),
        'a-table': TABLE_STUB,
        'a-alert': ALERT_STUB,
        'a-modal': PASS_THROUGH('AModal'),
        'a-textarea': PASS_THROUGH('ATextarea')
      }
    }
  })
  await flushPromises()
  return wrapper
}

function cardValues(wrapper: Awaited<ReturnType<typeof mountView>>): string[] {
  return wrapper.findAll('.stat-value').map(node => node.text())
}

function alertTexts(wrapper: Awaited<ReturnType<typeof mountView>>): string {
  return wrapper.findAll('.alert-msg').map(node => node.text()).join(' | ')
}

function tagsByText(text: string) {
  return [...document.querySelectorAll('.ATag-stub')].filter(node => (node.textContent || '').trim() === text)
}

beforeEach(() => {
  vi.clearAllMocks()
  document.body.innerHTML = ''
  authMock.isSuperAdmin = true
  authMock.selectedTenantId = 15
  authMock.selectedTenantCode = 'demo'
  authMock.user = { tenantId: 15 }
  vi.mocked(guestbookApi.types).mockResolvedValue({ other: '接口给的普通名', inquiry: '接口给的留资名' })
  vi.mocked(guestbookApi.budgets).mockResolvedValue({
    under_5w: '接口给的小档',
    from_10w_to_30w: '接口给的中档',
    not_sure: '接口给的还没定'
  })
  vi.mocked(guestbookApi.stats).mockResolvedValue({
    totalMessages: 4,
    repliedCount: 1,
    pendingCount: 2,
    todayCount: 3
  })
  vi.mocked(guestbookApi.list).mockResolvedValue({
    records: [row(1, 'inquiry'), row(2, 'other'), row(3, 'mystery_type'), row(4, null)],
    total: 4
  } as any)
})

describe('GuestbookManageView 的类型徽标', () => {
  it('标签用接口回的那一份，代码没在词表里时原样显示', async () => {
    const wrapper = await mountView()
    expect(tagsByText('接口给的留资名').length).toBe(1)
    expect(tagsByText('接口给的普通名').length).toBe(1)
    // 脏数据/词表没更到：显原码而不是编一个「未知类型」，后者会让人以为系统认得它
    expect(tagsByText('mystery_type').length).toBe(1)
    expect(tagsByText('—').length).toBe(1)
    expect(document.body.textContent).not.toContain('留资线索')
    wrapper.unmount()
  })

  it('筛选下拉里的种类也来自同一份词表', async () => {
    const wrapper = await mountView()
    const filters = [...document.querySelectorAll('.select-stub')].filter(
      node => node.getAttribute('data-placeholder') === '类型筛选'
    )
    expect(filters.length).toBe(1)
    expect(filters[0].textContent).toContain('接口给的留资名')
    expect(filters[0].textContent).toContain('接口给的普通名')
    wrapper.unmount()
  })

  it('选一种类型后，list 真的带上 type 参数', async () => {
    const wrapper = await mountView()
    vi.mocked(guestbookApi.list).mockClear()
    const pick = [...document.querySelectorAll('.select-stub')]
      .find(node => node.getAttribute('data-placeholder') === '类型筛选')!
      .querySelector('.select-pick') as HTMLButtonElement
    pick.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()
    const sent = vi.mocked(guestbookApi.list).mock.calls.map(call => call[0] as any)
    expect(sent.some(params => params.type === 'inquiry')).toBe(true)
    wrapper.unmount()
  })
})

/**
 * 拍板 2026-09-27 补的两格（公司 / 预算范围）。
 *
 * 这两列读的是 portal_guestbook 的真列名（companyName / budgetCode）：这一页原来那份字段表
 * 抄的是库里没有的名字（name / createdAt / reply），所以「访客」与「留言时间」两列一直是空的——
 * 加了新列却还照着假字段表写，新线索照样看不见，那才是白做。
 */
describe('线索列表里的公司与预算两格', () => {
  it('公司名原样显示，预算档位念的是 GET /guestbook/budgets 给的那一份', async () => {
    const lead = { ...row(11, 'inquiry'), companyName: '上海纳欣精密机械', budgetCode: 'from_10w_to_30w' }
    vi.mocked(guestbookApi.list).mockResolvedValue({ records: [lead], total: 1 } as any)
    const wrapper = await mountView()

    const cells = [...document.querySelectorAll('.row')].map(node => (node.textContent || '').replace(/\s+/g, ''))
    expect(cells[0]).toContain('上海纳欣精密机械')
    expect(cells[0]).toContain('接口给的中档')
    // 中文说法不许出现在 .vue 里：这一句红了就说明有人在这边抄了第二份词表
    expect(document.body.textContent).not.toContain('10–30 万')
    wrapper.unmount()
  })

  it('没填的两格显示占位符，词表外的旧码原样回显', async () => {
    const legacy = { ...row(12, 'inquiry'), companyName: null, budgetCode: 'range_of_2024' }
    vi.mocked(guestbookApi.list).mockResolvedValue({ records: [legacy], total: 1 } as any)
    const wrapper = await mountView()

    const cells = [...document.querySelectorAll('.row')].map(node => (node.textContent || '').replace(/\s+/g, ''))
    expect(cells[0]).toContain('range_of_2024')
    expect(cells[0]).not.toContain('未知档位')
    // 公司没填就是没填：给个占位符，不猜一家「某公司」出来
    expect(cells[0]).toContain('—')
    wrapper.unmount()
  })
})

/**
 * M-P100：这一屏的四张统计卡与取数口径。
 *
 * 改前的读数以「现场真跑」为准（scratch/mp100-logs/05-findings.md 与 60/62 号取证）：
 * 超管没选客户时界面拿 `auth.tenantId`（兜底成 1）偷偷去问 1 号那一家；四个数靠连发四口
 * `list?page=1&size=1` 只为各拿一个 total，四发挤在同一个 try 里，中间一发断了后面几发根本不发；
 * 而这一切失败在屏上摆的都是裸 0，销售读到的是「这一家没留言」。
 */
describe('这一屏的数属于谁（M-P100）', () => {
  it('超管选定了客户：列表与统计都按那一家取数，页首写明看的是谁', async () => {
    const wrapper = await mountView()

    expect(guestbookApi.list).toHaveBeenCalledWith(expect.objectContaining({ tenantId: 15 }))
    expect(guestbookApi.stats).toHaveBeenCalledWith(15)
    expect(alertTexts(wrapper)).toContain('客户「demo」（编号 #15）')
    expect(cardValues(wrapper)).toEqual(['4', '1', '2', '3'])
    wrapper.unmount()
  })

  it('租户管理员按自己那一家取数，不再永远拿 1', async () => {
    authMock.isSuperAdmin = false
    authMock.selectedTenantId = null
    authMock.selectedTenantCode = null
    authMock.user = { tenantId: 558 }

    const wrapper = await mountView()

    expect(guestbookApi.list).toHaveBeenCalledWith(expect.objectContaining({ tenantId: 558 }))
    expect(guestbookApi.stats).toHaveBeenCalledWith(558)
    expect(alertTexts(wrapper)).toContain('你所在客户（编号 #558）')
    wrapper.unmount()
  })

  it('超管还没选定客户：一口都不发，卡摆「—」，表格说「这一发没发出去」', async () => {
    authMock.selectedTenantId = null
    authMock.selectedTenantCode = null

    const wrapper = await mountView()

    expect(guestbookApi.list).not.toHaveBeenCalled()
    expect(guestbookApi.stats).not.toHaveBeenCalled()
    expect(alertTexts(wrapper)).toContain('没有选定客户')
    expect(cardValues(wrapper)).toEqual(['—', '—', '—', '—'])
    expect(document.querySelector('.empty-line')?.textContent).toContain('这一发没发出去')
    // 「这一发没发出去」不该再配一条「共 0 条」的翻页条——那是把没查过说成查过了
    expect(document.querySelector('.pagination-wrapper')).toBeNull()
    wrapper.unmount()
  })
})

describe('四个数改叫后端那一口（M-P100）', () => {
  it('只发一口 /guestbook/stats，不再为拿 total 连发四口 list', async () => {
    const wrapper = await mountView()

    expect(guestbookApi.stats).toHaveBeenCalledTimes(1)
    expect(guestbookApi.list).toHaveBeenCalledTimes(1)
    const sent = vi.mocked(guestbookApi.list).mock.calls.map(call => call[0] as any)
    expect(sent.some(params => params.size === 1)).toBe(false)
    wrapper.unmount()
  })

  it('卡上的四个数就是后端那四个键，逐字对上', async () => {
    vi.mocked(guestbookApi.stats).mockResolvedValue({
      totalMessages: 1221,
      repliedCount: 40,
      pendingCount: 7,
      todayCount: 0
    })
    const wrapper = await mountView()

    expect(cardValues(wrapper)).toEqual(['1,221', '40', '7', '0'])
    wrapper.unmount()
  })

  it('口径写在屏上：四个数数的是这一家全部留言，不跟着筛选走', async () => {
    const wrapper = await mountView()
    expect(document.querySelector('.stats-scope-line')?.textContent).toContain('不随下面的状态、类型、关键词筛选变')

    // 筛一次类型：只有列表重取，那四个数一次都不该再问
    vi.mocked(guestbookApi.list).mockClear()
    const pick = [...document.querySelectorAll('.select-stub')]
      .find(node => node.getAttribute('data-placeholder') === '类型筛选')!
      .querySelector('.select-pick') as HTMLButtonElement
    pick.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()

    expect(guestbookApi.list).toHaveBeenCalledTimes(1)
    expect(guestbookApi.stats).toHaveBeenCalledTimes(1)
    wrapper.unmount()
  })
})

describe('读不到 / 读失败不摆 0（M-P100）', () => {
  it('统计那口读失败：卡摆「—」并原样念后端那句，列表照旧是真行', async () => {
    vi.mocked(guestbookApi.stats).mockRejectedValue(
      new Error('租户不存在或这一家读不到：#999999')
    )
    const wrapper = await mountView()

    expect(cardValues(wrapper)).toEqual(['—', '—', '—', '—'])
    expect(alertTexts(wrapper)).toContain('那四个数没读上来：租户不存在或这一家读不到：#999999')
    expect(document.querySelectorAll('.row').length).toBe(4)
    wrapper.unmount()
  })

  it('列表那口读失败：统计照旧发、四个数照旧摆，不把两边一起抹成 0', async () => {
    vi.mocked(guestbookApi.list).mockRejectedValue(new Error('后端服务不可用（网关 502），请确认服务已启动'))
    const wrapper = await mountView()

    expect(guestbookApi.stats).toHaveBeenCalledTimes(1)
    expect(cardValues(wrapper)).toEqual(['4', '1', '2', '3'])
    expect(document.querySelector('.empty-line')?.textContent).toContain('这一发读失败')
    expect(document.querySelector('.empty-line')?.textContent).not.toContain('这一家没有留言')
    wrapper.unmount()
  })

  it('后端答了「这一家读不到」：念它那句，界面不改写也不合并成「没有」', async () => {
    authMock.isSuperAdmin = false
    authMock.user = { tenantId: 558 }
    vi.mocked(guestbookApi.list).mockResolvedValue({
      records: [],
      total: 0,
      emptyReason: 'NOT_VISIBLE',
      emptyLine: '留言列表：这一档读不到（选中的那个身份在这张表里没有行），所以这里不能说「没有」。'
    } as any)

    const wrapper = await mountView()

    expect(document.querySelector('.empty-line')?.textContent).toContain(
      '留言列表：这一档读不到（选中的那个身份在这张表里没有行），所以这里不能说「没有」。'
    )
    wrapper.unmount()
  })
})

describe('动作失败与动作之后（M-P100）', () => {
  it('删除失败：念后端那句原因，不再只说「删除失败」', async () => {
    vi.mocked(guestbookApi.delete).mockRejectedValue(new Error('这条留言不属于当前客户'))
    const wrapper = await mountView()

    const pop = wrapper.findAllComponents({ name: 'APopconfirm' })[0]
    pop.vm.$emit('confirm')
    await flushPromises()

    const errors = vi
      .mocked(message.error)
      .mock.calls
      .map(call => String((call[0] as any)?.content ?? call[0]))
      .join(' | ')
    expect(errors).toContain('删除失败：这条留言不属于当前客户')
    wrapper.unmount()
  })

  it('删完把列表和四个数两头都重取', async () => {
    vi.mocked(guestbookApi.delete).mockResolvedValue(undefined as any)
    const wrapper = await mountView()
    vi.mocked(guestbookApi.list).mockClear()
    vi.mocked(guestbookApi.stats).mockClear()

    const pop = wrapper.findAllComponents({ name: 'APopconfirm' })[0]
    pop.vm.$emit('confirm')
    await flushPromises()

    expect(guestbookApi.list).toHaveBeenCalledTimes(1)
    expect(guestbookApi.stats).toHaveBeenCalledTimes(1)
    wrapper.unmount()
  })
})
