import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { Comment, Fragment, h, isVNode, nextTick } from 'vue'
import { Button, message } from 'ant-design-vue'
import AccountSecurityView from '../AccountSecurityView.vue'
import { adminApi, tenantApi } from '../../../api/workspace'
import { JUMP_BACK_NOTICE } from '../../../utils/emptyPage'
import type { LoginLog, Tenant, TenantSwitchLog } from '../../../types/workspace'

/**
 * 超管专用「账号安全」屏（M-P110 拍板 Q-1／Q-2／Q-3）。
 *
 * 钉四件：
 * 1. 一屏两标签：切标签走的是各自那一口，并把 `?tab=` 写回地址（刷新还在同一格）；
 * 2. 这一屏的客户范围只认屏内那个下拉三档——右上角全局切换器不许偷偷把它收窄（Q-2）；
 * 3. 归属那一格逐字念后端算好的那一句，界面不拿裸客户号自己猜（Q-3）；
 * 4. 空态三种念法与读失败各说各的，两张表全只读所以不给新建按钮。
 */

vi.mock('ant-design-vue', async () => {
  const actual = await vi.importActual<Record<string, any>>('ant-design-vue')
  return {
    ...actual,
    message: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() }
  }
})

vi.mock('../../../api/workspace', () => ({
  adminApi: {
    accountSecurity: {
      loginLogs: vi.fn(),
      tenantSwitchLogs: vi.fn()
    }
  },
  tenantApi: { list: vi.fn() }
}))

const routeState: { query: Record<string, string> } = { query: {} }
const routerReplace = vi.fn()

vi.mock('vue-router', async () => {
  // 只换 useRoute/useRouter 两个把手：`src/api/http.ts` 会 import 真路由实例，整模块替掉会连它一起打死
  const actual = await vi.importActual<Record<string, any>>('vue-router')
  return {
    ...actual,
    useRoute: () => ({ query: routeState.query, meta: {} }),
    useRouter: () => ({ replace: routerReplace })
  }
})

/**
 * 表格替身：逐列走真实的 bodyCell 插槽，插槽没产出时退回 dataIndex——
 * 与 ant-design-vue 自己的 `customRenderSlot`/`ensureValidVNode` 同一判据，
 * 否则「这一列念了哪一句」在测试里是假的。
 */
const validSlot = (nodes: unknown): any[] | null => {
  const list = (nodes || []) as any[]
  return list.some((child) => {
    if (!isVNode(child)) return true
    if (child.type === Comment) return false
    if (child.type === Fragment) return !!validSlot(child.children)
    return true
  }) ? list : null
}

const TABLE_STUB = {
  name: 'ATable',
  props: {
    dataSource: { type: Array, default: () => [] },
    columns: { type: Array, default: () => [] },
    loading: { type: Boolean, default: false },
    pagination: { type: Object, default: () => ({}) }
  },
  emits: ['change'],
  setup(props: any, { slots, emit }: any) {
    return () => {
      const rows = props.dataSource as any[]
      return h('div', { class: 'table-stub' }, [
        h('button', { class: 'go-page', onClick: () => emit('change', { current: 3, pageSize: 10 }) }, '到第 3 页'),
        rows.length === 0
          ? h('div', { class: 'empty' }, slots.emptyText ? slots.emptyText({}) : '暂无数据')
          : rows.map((record) =>
              h(
                'div',
                { class: 'row', 'data-row': record.id },
                (props.columns as any[]).map((column) => {
                  const slotContent = validSlot(slots.bodyCell ? slots.bodyCell({ column, record }) : null)
                  return h(
                    'span',
                    { class: ['cell', `cell-${column.key}`] },
                    slotContent ?? String(record[column.dataIndex] ?? '')
                  )
                })
              )
            )
      ])
    }
  }
}

const PASS_THROUGH = (name: string) => ({
  name,
  template: `<div class="${name}-stub"><slot /><slot name="tab" /></div>`
})

const TENANT_SELECT_STUB = {
  name: 'ASelect',
  props: ['value', 'placeholder'],
  emits: ['update:value'],
  template: '<select class="select-stub"><slot /></select>'
}

const LOGIN_ROW = {
  id: 71,
  username: 'admin',
  tenantId: 558,
  tenantLabel: '安鼎建设',
  status: 'success',
  failReason: null,
  loginIp: '10.0.0.7',
  userAgent: 'Mozilla/5.0',
  createTime: '2026-11-04T09:12:00'
} as unknown as LoginLog

/** 归属为空的登录行：后端那一档念「账号查不到归属」，不是「未挂某一家」 */
const LOGIN_UNATTRIBUTED = {
  ...LOGIN_ROW,
  id: 72,
  tenantId: null,
  tenantLabel: '账号查不到归属'
} as unknown as LoginLog

const SWITCH_ROW = {
  id: 88,
  username: 'admin',
  tenantId: 558,
  fromTenantId: null,
  fromTenantLabel: '切换前在全局视角',
  toTenantId: 558,
  toTenantLabel: '安鼎建设',
  ipAddress: '10.0.0.7',
  userAgent: 'Mozilla/5.0',
  createdAt: '2026-11-04T10:02:00'
} as unknown as TenantSwitchLog

/** 库里认不出这行、但这条留痕记过客户代码的那一家：凭据要跟号一起念 */
const SWITCH_GHOST_ROW = {
  ...SWITCH_ROW,
  id: 89,
  tenantId: 326,
  fromTenantId: 326,
  fromTenantLabel: '未知客户 #326（当时记的代码 e2e-probe）',
  toTenantId: null,
  toTenantLabel: '退回全局视角'
} as unknown as TenantSwitchLog

const TENANTS = [{ id: 558, name: '安鼎建设' }, { id: 2, name: '中原机械' }] as Tenant[]

type PageShape = {
  records: any[]
  total: number
  emptyReason?: string | null
  emptyLine?: string | null
}

async function mountView(
  options: {
    login?: PageShape
    switchRows?: PageShape
    tenants?: Tenant[] | Error
    tab?: string
    loginFail?: Error
  } = {}
) {
  routeState.query = options.tab ? { tab: options.tab } : {}
  const login = options.login ?? { records: [LOGIN_ROW], total: 1, emptyReason: null, emptyLine: null }
  const switchRows = options.switchRows ?? { records: [SWITCH_ROW], total: 1, emptyReason: null, emptyLine: null }

  if (options.loginFail) {
    vi.mocked(adminApi.accountSecurity.loginLogs).mockRejectedValue(options.loginFail)
  } else {
    vi.mocked(adminApi.accountSecurity.loginLogs).mockResolvedValue(login as any)
  }
  vi.mocked(adminApi.accountSecurity.tenantSwitchLogs).mockResolvedValue(switchRows as any)
  if (options.tenants instanceof Error) {
    vi.mocked(tenantApi.list).mockRejectedValue(options.tenants)
  } else {
    vi.mocked(tenantApi.list).mockResolvedValue((options.tenants ?? TENANTS) as any)
  }

  const wrapper = mount(AccountSecurityView, {
    attachTo: document.body,
    global: {
      stubs: {
        'a-card': PASS_THROUGH('ACard'),
        'a-space': PASS_THROUGH('ASpace'),
        'a-alert': {
          name: 'AAlert',
          props: ['message', 'description'],
          template: '<div class="alert-stub">{{ message }} {{ description }}</div>'
        },
        'a-tabs': {
          name: 'ATabs',
          props: ['activeKey'],
          emits: ['update:activeKey'],
          template: '<div class="tabs-stub"><slot /></div>'
        },
        'a-tab-pane': { name: 'ATabPane', template: '<div class="pane-stub"><slot name="tab" /></div>' },
        'a-table': TABLE_STUB,
        'a-select': TENANT_SELECT_STUB,
        'a-select-option': { name: 'ASelectOption', props: ['value'], template: '<option :value="value"><slot /></option>' },
        'a-range-picker': { name: 'ARangePicker', template: '<div class="range-stub" />' },
        'a-input': { name: 'AInput', template: '<input class="input-stub" />' },
        'a-tag': { name: 'ATag', template: '<span class="tag-stub"><slot /></span>' },
        'a-tooltip': PASS_THROUGH('ATooltip'),
        'a-button': Button
      }
    }
  })
  await flushPromises()
  return wrapper
}

/** 第一颗下拉＝本屏的客户档位；第二颗才是登录标签里的「结果」 */
const scopeSelect = (wrapper: any) => wrapper.findAllComponents({ name: 'ASelect' })[0]

const pickScope = async (wrapper: any, value: number) => {
  scopeSelect(wrapper).vm.$emit('update:value', value)
  await flushPromises()
}

const buttonByText = (wrapper: any, text: string) =>
  wrapper.findAll('button').find((node: any) => node.text().includes(text))

const lastLoginParams = () => {
  const calls = vi.mocked(adminApi.accountSecurity.loginLogs).mock.calls
  return calls[calls.length - 1][0] as Record<string, unknown>
}

const emptyText = (wrapper: any) => wrapper.find('.empty').text().trim()

const THREE_EMPTIES: Array<[string, string]> = [
  ['NONE', '登录记录：这一档查过了，一条都没有。'],
  ['NOT_VISIBLE', '登录记录：这一档读不到（选中的那个身份在这张表里没有行），所以这里不能说「没有」。'],
  ['OUT_OF_RANGE', '登录记录：这一页翻过了头，往前面的页翻回来就有；这里没行不等于这一档没有。']
]

describe('AccountSecurityView 的标签与客户档位', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('一个菜单项里两个标签，进来先读登录那一格', async () => {
    const wrapper = await mountView()

    const tabs = wrapper.findAll('.pane-stub').map((node) => node.text().trim())
    expect(tabs).toEqual(['登录记录', '超管进客户视角'])
    expect(adminApi.accountSecurity.loginLogs).toHaveBeenCalledTimes(1)
    expect(adminApi.accountSecurity.tenantSwitchLogs).not.toHaveBeenCalled()
  })

  it('切标签只读自己那一口，并把 ?tab= 写回地址', async () => {
    const wrapper = await mountView()

    wrapper.findComponent({ name: 'ATabs' }).vm.$emit('update:activeKey', 'switch')
    await flushPromises()

    expect(adminApi.accountSecurity.tenantSwitchLogs).toHaveBeenCalledTimes(1)
    expect(adminApi.accountSecurity.loginLogs).toHaveBeenCalledTimes(1)
    expect(routerReplace).toHaveBeenCalledWith({ query: { tab: 'switch' } })
  })

  it('地址里带着 ?tab=switch 时直接开在第二格', async () => {
    const wrapper = await mountView({ tab: 'switch' })

    expect(adminApi.accountSecurity.tenantSwitchLogs).toHaveBeenCalledTimes(1)
    expect(adminApi.accountSecurity.loginLogs).not.toHaveBeenCalled()
    expect(wrapper.findAllComponents({ name: 'ASelect' })).toHaveLength(1)
  })

  it('地址里的标签名认不出时回到登录格，不摆一个没有的标签', async () => {
    await mountView({ tab: 'nonsense' })

    expect(adminApi.accountSecurity.loginLogs).toHaveBeenCalledTimes(1)
    expect(adminApi.accountSecurity.tenantSwitchLogs).not.toHaveBeenCalled()
  })

  it('默认「全部客户」那一发只带 tenantScope=all，不带右上角那个客户号', async () => {
    await mountView()

    expect(lastLoginParams()).toMatchObject({ tenantScope: 'all', page: 1, size: 20 })
    expect(lastLoginParams()).not.toHaveProperty('tenantId')
  })

  it('选「归属未知」⇒ 只带这一档（历史那批空归属记录只有这一档捞得出来）', async () => {
    const wrapper = await mountView()

    await pickScope(wrapper, -2)

    expect(lastLoginParams()).toMatchObject({ tenantScope: 'unknown', page: 1 })
    expect(lastLoginParams()).not.toHaveProperty('tenantId')
  })

  it('选某一家 ⇒ 带它的号，并同时声明这一档是 known', async () => {
    const wrapper = await mountView()

    await pickScope(wrapper, 558)

    expect(lastLoginParams()).toMatchObject({ tenantScope: 'known', tenantId: 558 })
  })

  it('换档位时两个标签都回到第一页，切换那一格也认同一档', async () => {
    const wrapper = await mountView()
    await wrapper.find('.go-page').trigger('click')
    await flushPromises()
    expect(lastLoginParams()).toMatchObject({ page: 3 })

    wrapper.findComponent({ name: 'ATabs' }).vm.$emit('update:activeKey', 'switch')
    await flushPromises()
    await pickScope(wrapper, -2)

    const switchCalls = vi.mocked(adminApi.accountSecurity.tenantSwitchLogs).mock.calls
    expect(switchCalls[switchCalls.length - 1][0]).toMatchObject({ tenantScope: 'unknown', page: 1 })

    // 登录那一格停在第 3 页没重读（不在眼前不发），但档位一换它的页码就作废了：切回去是从第一页读
    wrapper.findComponent({ name: 'ATabs' }).vm.$emit('update:activeKey', 'login')
    await flushPromises()
    expect(lastLoginParams()).toMatchObject({ tenantScope: 'unknown', page: 1 })
  })

  it('屏内这个下拉与右上角切换客户无关，界面上就把这句说明白', async () => {
    const wrapper = await mountView()

    expect(wrapper.find('.scope-hint').text()).toContain('这一屏按下面这个客户下拉筛，和右上角切换当前客户无关')
  })
})

describe('AccountSecurityView 的筛选项真的跟着发', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('账号名、日期区间与结果三个把手都进那一发', async () => {
    const wrapper = await mountView()

    wrapper.findAllComponents({ name: 'AInput' })[0].vm.$emit('update:value', 'admin')
    await nextTick()
    wrapper.findAllComponents({ name: 'ARangePicker' })[0].vm.$emit('update:value', ['2026-11-01', '2026-11-04'])
    await nextTick()
    wrapper.findAllComponents({ name: 'ASelect' })[1].vm.$emit('update:value', 'failed')
    await nextTick()

    await buttonByText(wrapper, '查询')!.trigger('click')
    await flushPromises()

    expect(lastLoginParams()).toMatchObject({
      username: 'admin',
      startDate: '2026-11-01',
      endDate: '2026-11-04',
      status: 'failed',
      page: 1
    })
  })

  it('重置把三档退回「全部客户」并清空其余把手', async () => {
    const wrapper = await mountView()
    await pickScope(wrapper, 558)
    wrapper.findAllComponents({ name: 'AInput' })[0].vm.$emit('update:value', 'admin')
    await nextTick()

    await buttonByText(wrapper, '重置')!.trigger('click')
    await flushPromises()

    expect(lastLoginParams()).toMatchObject({ tenantScope: 'all', page: 1 })
    expect(lastLoginParams()).not.toHaveProperty('tenantId')
    expect(lastLoginParams()).not.toHaveProperty('username')
  })
})

describe('AccountSecurityView 的客户归属那一格（两张表全只读）', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('登录表那一列逐字念后端那四档，行里不摆裸客户号', async () => {
    const wrapper = await mountView({
      login: { records: [LOGIN_ROW, LOGIN_UNATTRIBUTED], total: 2, emptyReason: null, emptyLine: null }
    })

    expect(wrapper.findAll('.cell-tenantLabel').map((node) => node.text().trim())).toEqual(['安鼎建设', '账号查不到归属'])
    expect(wrapper.find('.row[data-row="71"]').text()).not.toContain('558')
  })

  it('切换表把出发与进的分成两列念，全局视角那两档也照后端原文', async () => {
    const wrapper = await mountView({
      switchRows: { records: [SWITCH_ROW, SWITCH_GHOST_ROW], total: 2, emptyReason: null, emptyLine: null },
      tab: 'switch'
    })

    expect(wrapper.findAll('.cell-fromTenantLabel').map((node) => node.text().trim()))
      .toEqual(['切换前在全局视角', '未知客户 #326（当时记的代码 e2e-probe）'])
    expect(wrapper.findAll('.cell-toTenantLabel').map((node) => node.text().trim()))
      .toEqual(['安鼎建设', '退回全局视角'])
  })

  it('两张表全只读：这一屏不摆任何写动作的把手', async () => {
    const loginView = await mountView()
    const switchView = await mountView({ tab: 'switch' })

    for (const wrapper of [loginView, switchView]) {
      const labels = wrapper.findAll('button').map((node) => node.text().trim())
      expect(labels.some((label) => /新建|新增|删除|编辑|导出/.test(label))).toBe(false)
    }
  })
})

describe('AccountSecurityView 的空态与失败', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it.each(THREE_EMPTIES)('后端回 %s 那一档时逐字念那一句，页面上没有「暂无数据」', async (reason, line) => {
    const wrapper = await mountView({
      login: { records: [], total: 0, emptyReason: reason, emptyLine: line }
    })

    expect(emptyText(wrapper)).toBe(line)
    expect(wrapper.html()).not.toContain('暂无数据')
  })

  it('后端没答是哪一种空时念「界面不替它猜」', async () => {
    const wrapper = await mountView({ login: { records: [], total: 0, emptyReason: null, emptyLine: null } })

    expect(emptyText(wrapper)).toContain('后端没回是哪一种空')
  })

  it('两张表全只读，空态下面不许摆新建按钮', async () => {
    const wrapper = await mountView({
      login: { records: [], total: 0, emptyReason: 'NONE', emptyLine: THREE_EMPTIES[0][1] }
    })

    expect(wrapper.find('.create-on-empty').exists()).toBe(false)
  })

  it('那一口读失败说的是读失败，不是「这一档没有」', async () => {
    const wrapper = await mountView({ loginFail: new Error('读口断了') })

    // 读失败只走空态那句，不再另弹 toast
    expect(vi.mocked(message.error).mock.calls.flat().join()).not.toContain('获取登录记录失败')
    expect(emptyText(wrapper)).toContain('这一发读失败：读口断了')
    expect(emptyText(wrapper)).toContain('读失败不是「这一档没有」')
    expect(emptyText(wrapper)).not.toContain('一条都没有')
  })

  it('后端回「这一页翻过了头」时自动翻回第一页再读一遍，只在那之后提示一次', async () => {
    const login = vi.mocked(adminApi.accountSecurity.loginLogs)
    const wrapper = await mountView()

    login
      .mockResolvedValueOnce({ records: [], total: 122, emptyReason: 'OUT_OF_RANGE', emptyLine: THREE_EMPTIES[2][1] } as any)
      .mockResolvedValueOnce({ records: [], total: 0, emptyReason: 'NONE', emptyLine: THREE_EMPTIES[0][1] } as any)

    await wrapper.find('.go-page').trigger('click')
    await flushPromises()

    expect(login).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1 }))
    expect(message.info).toHaveBeenCalledWith(JUMP_BACK_NOTICE)
    expect(emptyText(wrapper)).toBe(THREE_EMPTIES[0][1])
  })

  it('客户名单读失败时明说，并且只认「全部客户」和「归属未知」两档', async () => {
    const wrapper = await mountView({ tenants: new Error('名单读不到') })

    expect(wrapper.find('.tenant-list-failed').text()).toContain('客户名单读失败：只认「全部客户」和「归属未知」两档')
    const options = scopeSelect(wrapper).findAll('option').map((node: any) => node.text().trim())
    expect(options).toEqual(['全部客户', '归属未知'])
    // 名单读失败只走下拉旁那句，不再另弹 toast
    expect(vi.mocked(message.warning).mock.calls.flat().join()).not.toContain('客户名单读取失败')
    // 名单读不到时不许拿一个没核过的客户号继续发：那一发仍是「全部客户」
    expect(lastLoginParams()).toMatchObject({ tenantScope: 'all' })
    expect(lastLoginParams()).not.toHaveProperty('tenantId')
  })

  it('名单读成功时客户下拉摆出真号，档位值就是它的号', async () => {
    const wrapper = await mountView()

    const options = scopeSelect(wrapper).findAll('option')
    expect(options.map((node: any) => node.text().trim())).toEqual(['全部客户', '安鼎建设', '中原机械', '归属未知'])
    expect(options[1].attributes('value')).toBe('558')
  })
})
